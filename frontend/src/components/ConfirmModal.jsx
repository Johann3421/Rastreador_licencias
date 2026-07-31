import { useState } from 'react'
import Modal from './Modal'

function ConfirmModal({ title, description, confirmLabel, danger, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} badge="Confirmación" onClose={onClose} size="sm">
      <div className="mf">
        {description && (
          <div className={`mf-hint ${danger ? 'mf-hint-danger' : 'mf-hint-info'}`}>
            {description}
          </div>
        )}
        <div className="mf-actions">
          <button type="button" className="mf-btn-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? 'mf-btn-danger' : 'mf-btn-confirm'}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'Procesando...' : (confirmLabel || 'Confirmar')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmModal
