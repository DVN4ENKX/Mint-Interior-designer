import { createPortal } from 'react-dom'
import { usePlanStore } from '../store'
import { ROOM_TEMPLATES } from '../data/templates'

export default function TemplateModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const walls = usePlanStore((s) => s.walls)
  const applyTemplate = usePlanStore((s) => s.applyTemplate)

  if (!open) return null

  const choose = (id: string) => {
    const tpl = ROOM_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    if (walls.length > 0 && !confirm(`Заменить текущие стены шаблоном «${tpl.name}»?`)) return
    applyTemplate(tpl)
    onClose()
  }

  return createPortal(
    <>
      <div className="modal fade show d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">🏗 Шаблоны комнат и квартир</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Закрыть"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              <p className="small text-secondary mb-2">
                Выберите шаблон — он заменит текущие стены и проёмы (мебель останется).
              </p>
              <div className="row g-2">
                {ROOM_TEMPLATES.map((t) => (
                  <div key={t.id} className="col-sm-6 col-md-4">
                    <button type="button" className="template-card w-100" onClick={() => choose(t.id)}>
                      <div className="fw-semibold">{t.name}</div>
                      <div className="small text-secondary">{t.description}</div>
                      <div className="small text-secondary">
                        {t.rooms} {t.rooms === 1 ? 'помещение' : 'помещения'}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>,
    document.body,
  )
}
