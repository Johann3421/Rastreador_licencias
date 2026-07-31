import { useState } from 'react'
import Modal from './Modal'

function ReasonModal({ title, description, confirmLabel, danger, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const canSubmit = reason.trim().length >= 5

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} badge="Motivo requerido" onClose={onClose}>
      <form className="mf" onSubmit={submit}>
        {description && (
          <div className={`mf-hint ${danger ? 'mf-hint-danger' : 'mf-hint-info'}`}>
            {description}
          </div>
        )}

        <div className="mf-field">
          <label>Motivo <span className="mf-required">*</span></label>
          <textarea
            value={reason}
            maxLength="500"
            rows="4"
            placeholder="Describe brevemente el motivo..."
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <p className="mf-help">
            {reason.trim().length}/500 caracteres · mínimo 5. Quedará registrado en auditoría.
          </p>
        </div>

        <div className="mf-actions">
          <button type="button" className="mf-btn-cancel" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            type="submit"
            className={danger ? 'mf-btn-danger' : 'mf-btn-confirm'}
            disabled={!canSubmit || saving}
          >
            {saving ? 'Guardando...' : (confirmLabel || 'Confirmar')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ReasonModal
