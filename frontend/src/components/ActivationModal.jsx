import { useEffect, useState } from 'react'
import Modal from './Modal'

function ActivationModal({ api, license, setError, onClose, onActivated, user }) {
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customer_id: license?.reserved_customer_id ? String(license.reserved_customer_id) : '',
    device_reference: '',
    support_reference: '',
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
    setSaving(true)
    setError('')
    try {
      await api.request(`/licenses/${license.id}/activate`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          customer_id: form.customer_id ? Number(form.customer_id) : null,
        }),
      })
      await onActivated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const productLabel = [license.product_name, license.variant_name].filter(Boolean).join(' · ')

  return (
    <Modal title="Activar licencia" badge="Operación" onClose={onClose}>
      <form className="mf" onSubmit={submit}>
        {/* Info de la licencia */}
        <div className="mf-context">
          <div className="mf-context-item">
            <span>Licencia</span>
            <strong>{license.name || license.commercial_identifier || '—'}</strong>
          </div>
          {productLabel && (
            <div className="mf-context-item">
              <span>Producto</span>
              <strong>{productLabel}</strong>
            </div>
          )}
          <div className="mf-context-item">
            <span>Activado por</span>
            <strong>{user?.name || 'Usuario actual'}</strong>
          </div>
        </div>

        <div className="mf-hint">
          Esta acción es definitiva. La licencia pasará a estado <strong>Activada</strong> y quedará registrada en auditoría con tu usuario.
        </div>

        <div className="mf-grid">
          <div className="mf-field">
            <label>Cliente</label>
            <select value={form.customer_id} onChange={(e) => set('customer_id', e.target.value)}>
              <option value="">Sin cliente asignado</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="mf-field">
            <label>Equipo o dispositivo</label>
            <input
              value={form.device_reference}
              onChange={(e) => set('device_reference', e.target.value)}
              placeholder="Ej. LAPTOP-0023 o nombre del equipo"
            />
          </div>

          <div className="mf-field">
            <label>Referencia de soporte</label>
            <input
              value={form.support_reference}
              onChange={(e) => set('support_reference', e.target.value)}
              placeholder="Número de ticket o referencia"
            />
          </div>

          <div className="mf-field mf-field-full">
            <label>Notas adicionales <span className="mf-optional">(opcional)</span></label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows="3"
              placeholder="Información relevante sobre esta activación..."
            />
          </div>
        </div>

        <div className="mf-actions">
          <button type="button" className="mf-btn-cancel" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mf-btn-confirm" disabled={saving}>
            {saving ? 'Activando...' : 'Confirmar activación'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default ActivationModal
