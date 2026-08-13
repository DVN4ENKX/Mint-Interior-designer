import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import pg from 'pg'

const PORT = process.env.PORT ?? 8787
const SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'
const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://planner:planner@localhost:5432/planner',
})

// --- пароли: scrypt без нативных зависимостей ---
const hashPassword = (password) => {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
const verifyPassword = (password, stored) => {
  const [salt, hash] = stored.split(':')
  const a = scryptSync(password, salt, 64)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
const signToken = (user) =>
  jwt.sign({ uid: user.id, email: user.email }, SECRET, { expiresIn: '7d' })

const app = express()
app.use(cors())
// подложка — data-URL в jsonb, поэтому лимит большой
app.use(express.json({ limit: '25mb' }))

// --- обязательная аутентификация ---
const auth = (req, res, next) => {
  const h = req.headers.authorization ?? ''
  if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Нужен вход' })
  try {
    req.user = jwt.verify(h.slice(7), SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Токен недействителен, войдите заново' })
  }
}

const emailOk = (e) => typeof e === 'string' && /^\S+@\S+\.\S+$/.test(e)

// --- аккаунты ---
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body ?? {}
  if (!emailOk(email) || typeof password !== 'string' || password.length < 6)
    return res.status(400).json({ error: 'Некорректный email или пароль короче 6 символов' })
  try {
    const { rows } = await pool.query(
      'insert into users (email, pass_hash) values ($1, $2) returning id, email',
      [email.toLowerCase(), hashPassword(password)],
    )
    res.json({ ...rows[0], token: signToken(rows[0]) })
  } catch {
    res.status(409).json({ error: 'Такой email уже зарегистрирован' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const { rows } = await pool.query('select * from users where email = $1', [
    String(email ?? '').toLowerCase(),
  ])
  if (!rows[0] || !verifyPassword(String(password ?? ''), rows[0].pass_hash))
    return res.status(401).json({ error: 'Неверный email или пароль' })
  const user = { id: rows[0].id, email: rows[0].email }
  res.json({ ...user, token: signToken(user) })
})

app.get('/api/me', auth, (req, res) => res.json({ id: req.user.uid, email: req.user.email }))

// --- проекты ---
app.post('/api/projects', auth, async (req, res) => {
  const { rows } = await pool.query(
    'insert into projects (owner_id, data) values ($1, $2) returning id',
    [req.user.uid, JSON.stringify(req.body.data ?? {})],
  )
  res.json(rows[0])
})

app.put('/api/projects/:id', auth, async (req, res) => {
  const { rowCount } = await pool.query(
    'update projects set data = $1, updated_at = now() where id = $2 and owner_id = $3',
    [JSON.stringify(req.body.data ?? {}), req.params.id, req.user.uid],
  )
  if (!rowCount) return res.status(404).json({ error: 'Проект не найден или не ваш' })
  res.json({ ok: true })
})

app.post('/api/projects/:id/share', auth, async (req, res) => {
  const { rowCount } = await pool.query(
    'update projects set is_public = true where id = $1 and owner_id = $2',
    [req.params.id, req.user.uid],
  )
  if (!rowCount) return res.status(404).json({ error: 'Проект не найден или не ваш' })
  res.json({ ok: true })
})

// чтение: владелец или публичный проект (токен опционален)
app.get('/api/projects/:id', (req, res, next) => {
  const h = req.headers.authorization ?? ''
  let user = null
  if (h.startsWith('Bearer ')) {
    try { user = jwt.verify(h.slice(7), SECRET) } catch { /* аноним */ }
  }
  next()
}, async (req, res) => {
  const { rows } = await pool.query('select * from projects where id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Проект не найден' })
  const p = rows[0]
  const isOwner = req.user?.uid === p.owner_id
  if (!p.is_public && !isOwner) return res.status(403).json({ error: 'Проект не публичный' })
  res.json({ id: p.id, owner_id: p.owner_id, is_public: p.is_public, data: p.data })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Внутренняя ошибка сервера' })
})

app.listen(PORT, () => console.log(`API на http://localhost:${PORT}`))