import { useEffect, useState } from 'react'
import { formConfig, tableConfig } from '../config/modules'
import EntityModal from './EntityModal'
import Modal from './Modal'
import { LoadingState } from './StateMessage'

const CODE_PATTERN = '([A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}-[A-Za-z0-9]{5}|[A-Za-z0-9]{20}|[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4})'
const ID_PATTERN = '[A-Za-z0-9][A-Za-z0-9._/#: +()\\-]{1,179}'

function LicenseWizard({ api, setError, onClose, onCreated, initialValues = {} }) {
  const today = new Date().toISOString().slice(0, 10)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCode, setShowCode] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batches, setBatches] = useState([])
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({
    batch_id: initialValues.batch_id ? String(initialValues.batch_id) : '',
    responsible_user_id: '',
    name: '',
    commercial_identifier: '',
    license_code: '',
    validity_start_mode: 'purchase_date',
    start_date: today,
    cost: '',
    sale_price: '',
    billing_cycle: 'annual',
    currency_code: 'PEN',
    notes: '',
  })

  async function loadOptions() {
    setLoading(true)
    try {
      const [bb, ub] = await Promise.all([
        api.request('/batches?limit=100'),
        api.request('/users?limit=100'),
      ])
      setBatches(bb.data || [])
      setUsers(ub.data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOptions() }, [])

  useEffect(() => {
    if (initialValues.batch_id) {
      setForm((f) => ({ ...f, batch_id: String(initialValues.batch_id) }))
    }
  }, [initialValues.batch_id])

  function set(field, value) {
    if (field === 'batch_id') {
      const batch = batches.find((b) => String(b.id) === String(value))
      setForm((f) => ({
        ...f,
        batch_id: value,
        billing_cycle: batch?.variant_billing_cycle || f.billing_cycle,
        currency_code: batch?.currency_code || f.currency_code,
      }))
      return
    }
    setForm((f) => ({ ...f, [field]: value }))
  }

  const availableBatches = batches.filter((b) => {
    if (String(b.id) === String(form.batch_id)) return true
    return b.active !== false && b.status === 'confirmed' && Number(b.available_to_register) > 0
  })

  function batchLabel(b) {
    const days = Number(b.variant_duration_days)
    const dur = days === 365 ? '1 año' : days === 30 ? '1 mes' : days > 0 ? `${days}d` : ''
    return `${b.product_name || '?'}${b.variant_name ? ` ${b.variant_name}` : ''} ${dur ? `(${dur})` : ''} — ${b.available_to_register} disponibles`
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.batch_id || !form.responsible_user_id || !form.name || !form.commercial_identifier || !form.license_code) {
      setError('Completa los campos obligatorios marcados con *')
      return
    }
    setSaving(true)
    setError('')
    try {
      const isFirstActivation = form.validity_start_mode === 'first_activation'
      await api.request('/licenses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          start_date: isFirstActivation ? '' : form.start_date,
          batch_id: Number(form.batch_id),
          responsible_user_id: Number(form.responsible_user_id),
        }),
      })
      await onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Registrar licencia" badge="Nueva entrada" onClose={onClose} size="large">
      <form className="mf" onSubmit={submit}>
        {loading ? (
          <LoadingState message="Cargando datos..." />
        ) : (
          <>
            {/* SECCIÓN: INVENTARIO */}
            <div className="mf-section-title">Inventario</div>
            <div className="mf-grid">
              <div className="mf-field mf-field-full">
                <div className="mf-field-header">
                  <label>Lote de origen <span className="mf-required">*</span></label>
                  <button type="button" className="mf-inline-link" onClick={() => setShowBatchModal(true)}>
                    + Crear lote nuevo
                  </button>
                </div>
                <select
                  value={form.batch_id}
                  onChange={(e) => set('batch_id', e.target.value)}
                  required
                >
                  <option value="">Seleccionar lote...</option>
                  {availableBatches.map((b) => (
                    <option key={b.id} value={b.id}>{batchLabel(b)}</option>
                  ))}
                </select>
                {availableBatches.length === 0 && (
                  <p className="mf-help mf-help-warn">No hay lotes con cupo disponible. Crea uno nuevo.</p>
                )}
              </div>

              <div className="mf-field">
                <label>Custodio responsable <span className="mf-required">*</span></label>
                <select
                  value={form.responsible_user_id}
                  onChange={(e) => set('responsible_user_id', e.target.value)}
                  required
                >
                  <option value="">Seleccionar custodio...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="mf-field">
                <label>Moneda</label>
                <select value={form.currency_code} onChange={(e) => set('currency_code', e.target.value)}>
                  <option value="PEN">PEN — Sol peruano</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>

            {/* SECCIÓN: IDENTIFICACIÓN */}
            <div className="mf-section-title">Identificación</div>
            <div className="mf-grid">
              <div className="mf-field mf-field-full">
                <label>Nombre de la licencia <span className="mf-required">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Ej. ESET Internet Security 2026"
                  required
                />
              </div>

              <div className="mf-field">
                <label>ID Comercial (SKU / Contrato) <span className="mf-required">*</span></label>
                <input
                  value={form.commercial_identifier}
                  onChange={(e) => set('commercial_identifier', e.target.value.toUpperCase())}
                  placeholder="OEM-WIN11-PRO-001"
                  pattern={ID_PATTERN}
                  required
                />
                <p className="mf-help">Identificador público, sin datos sensibles</p>
              </div>

              <div className="mf-field">
                <label>Clave de activación <span className="mf-required">*</span></label>
                <div className="mf-password-wrap">
                  <input
                    type={showCode ? 'text' : 'password'}
                    value={form.license_code}
                    onChange={(e) => set('license_code', e.target.value.toUpperCase())}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                    pattern={CODE_PATTERN}
                    required
                  />
                  <button
                    type="button"
                    className="mf-toggle-vis"
                    onClick={() => setShowCode((v) => !v)}
                    title={showCode ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showCode ? (
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mf-help">Se guarda cifrada. Solo el backend puede leerla.</p>
              </div>
            </div>

            {/* SECCIÓN: VIGENCIA */}
            <div className="mf-section-title">Vigencia</div>
            <div className="mf-grid">
              <div className="mf-field">
                <label>Inicio de vigencia</label>
                <select value={form.validity_start_mode} onChange={(e) => set('validity_start_mode', e.target.value)}>
                  <option value="purchase_date">Desde la compra</option>
                  <option value="first_activation">Desde la primera activación</option>
                </select>
              </div>

              {form.validity_start_mode === 'purchase_date' && (
                <div className="mf-field">
                  <label>Fecha de inicio</label>
                  <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
                </div>
              )}

              <div className="mf-field">
                <label>Ciclo de facturación</label>
                <select value={form.billing_cycle} onChange={(e) => set('billing_cycle', e.target.value)}>
                  <option value="monthly">Mensual</option>
                  <option value="annual">Anual</option>
                  <option value="biennial">Bienal</option>
                  <option value="permanent">Permanente</option>
                  <option value="one_time">Uso único</option>
                </select>
              </div>
            </div>

            {/* SECCIÓN: PRECIOS */}
            <div className="mf-section-title">Precios <span className="mf-optional">(opcional)</span></div>
            <div className="mf-grid">
              <div className="mf-field">
                <label>Costo de adquisición</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => set('cost', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="mf-field">
                <label>Precio de venta</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => set('sale_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="mf-field mf-field-full">
                <label>Notas <span className="mf-optional">(opcional)</span></label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows="2"
                  placeholder="Información adicional sobre esta licencia..."
                />
              </div>
            </div>
          </>
        )}

        <div className="mf-actions">
          <button type="button" className="mf-btn-cancel" onClick={onClose}>Cancelar</button>
          <button type="submit" className="mf-btn-confirm" disabled={saving || loading}>
            {saving ? 'Guardando...' : 'Registrar licencia'}
          </button>
        </div>
      </form>

      {showBatchModal && (
        <EntityModal
          api={api}
          config={tableConfig.batches}
          formConfig={formConfig.batches}
          mode="create"
          row={null}
          setError={setError}
          onClose={() => setShowBatchModal(false)}
          onSaved={async () => {
            setShowBatchModal(false)
            await loadOptions()
          }}
        />
      )}
    </Modal>
  )
}

export default LicenseWizard
