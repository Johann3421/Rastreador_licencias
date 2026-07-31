import { useEffect, useState } from 'react'
import Modal from './Modal'

function ReservationModal({ api, license, setError, onClose, onReserved, user }) {
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    reservation_expires_at: '',
    notes: '',
  })

  useEffect(() => {
    api.request('/customers?limit=100')
      .then((b) => setCustomers(b.data || []))
      .catch((err) => setError(err.message))
  }, [])

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.customer_id) {
      setError('Selecciona el cliente para reservar la licencia.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.request(`/licenses/${license.id}/reserve`, {
        method: 'POST',
        body: JSON.stringify({
          customer_id: Number(form.customer_id),
          reservation_expires_at: form.reservation_expires_at || null,
          notes: form.notes || null,
        }),
      })
      await onReserved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Reservar licencia" badge="Operación" onClose={onClose}>
      <form className="mf" onSubmit={submit}>
        {/* Info de la licencia */}
        <div className="mf-context">
          <div className="mf-context-item">
            <span>Licencia</span>
            <strong>{license.name || license.commercial_identifier || '—'}</strong>
          </div>
          <div className="mf-context-item">
            <span>Reservado por</span>
            <strong>{user?.name || 'Usuario actual'}</strong>
          </div>
        </div>

        <div className="mf-hint mf-hint-info">
          La reserva bloquea la licencia para un cliente específico. Quedará disponible para activar en cualquier momento hasta que se libere.
        </div>

        <div className="mf-grid">
          <div className="mf-field mf-field-full">
            <label>
              Cliente <span className="mf-required">*</span>
            </label>
            <select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)} required>
              <option value="">Seleccionar cliente...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="mf-field">
            <label>Vigencia de reserva <span className="mf-optional">(opcional)</span></label>
            <input
              type="date"
              value={form.reservation_expires_at}
              onChange={(e) => set('reservation_expires_at', e.target.value)}
            />
            <p className="mf-help">Hasta cuándo está apartada la licencia para ese cliente</p>
          </div>

          <div className="mf-field mf-field-full">
            <label>Notas <span className="mf-optional">(opcional)</span></label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows="3"
              placeholder="Contexto o motivo de la reserva..."
            />
          </div>
        </div>

        <div className="mf-actions">
          <button type="button" className="mf-btn-cancel" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mf-btn-confirm" disabled={saving}>
            {saving ? 'Reservando...' : 'Confirmar reserva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ReservationModal
