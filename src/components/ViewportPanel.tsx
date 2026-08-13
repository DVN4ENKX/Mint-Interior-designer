import { usePlanStore } from '../store'

export default function ViewportPanel() {
  const placed = usePlanStore((s) => s.placed)
  const removeFromRoom = usePlanStore((s) => s.removeFromRoom)
  const total = placed.reduce((sum, p) => sum + p.item.price, 0)

  return (
    <section className="panel">
      <h2>Сцена</h2>
      {placed.length === 0 ? (
        <p>Пока пусто — добавьте мебель из каталога →</p>
      ) : (
        <>
          <ul>
            {placed.map((p) => (
              <li key={p.uid} className="placed" title="Клик — удалить"
                  onClick={() => removeFromRoom(p.uid)}>
                {p.item.name} — {p.item.price.toLocaleString('ru-RU')} ₽
              </li>
            ))}
          </ul>
          <div className="total">Итого: {total.toLocaleString('ru-RU')} ₽</div>
        </>
      )}
    </section>
  )
}