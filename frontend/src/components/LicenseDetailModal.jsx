import { useEffect, useState } from 'react'
import Modal from './Modal'
import { LoadingState } from './StateMessage'
import { formatValue } from '../utils/formatters'

const STATUS_LABELS = {
  available: 'Disponible',
  reserved: 'Reservada',
  activated: 'Activada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}

const STATUS_COLORS = {
  available: '#065f46',
  reserved: '#92400e',
  activated: '#1e40af',
  expired: '#991b1b',
  cancelled: '#6b7280',
}

const STATUS_BG = {
  available: '#d1fae5',
  reserved: '#fef3c7',
  activated: '#dbeafe',
  expired: '#fee2e2',
  cancelled: '#f3f4f6',
}

function LicenseDetailModal({ api, license, setError, onClose }) {
  const [detail, setDetail] = useState(license)
  const [activation, setActivation] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      try {
        const [lb, ab, aub] = await Promise.all([
          api.request(`/licenses/${license.id}`),
          api.request(`/activations?licenseUnitId=${license.id}&limit=1`),
          api.request(`/audit-logs?entityName=license_units&entityId=${license.id}&limit=20`),
        ])
        if (ignore) return
        setDetail(lb.data || license)
        setActivation((ab.data || [])[0] || null)
        setAuditLogs(aub.data || [])
      } catch (err) {
        if (!ignore) setError(err.message)
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [api, license, setError])

  const d = detail || license
  const events = buildEvents(auditLogs, activation, d)
  const importantReason = findReason(auditLogs, d)

  return (
    <Modal title="Ficha de licencia" badge="Detalle" onClose={onClose} size="large">
      {loading ? (
        <LoadingState message="Cargando ficha de licencia..." />
      ) : (
        <div className="ld">
          {/* CABECERA DE ESTADO */}
          <div className="ld-status-bar" style={{ background: STATUS_BG[d.status], color: STATUS_COLORS[d.status] }}>
            <div className="ld-status-main">
              <span className="ld-status-label">{STATUS_LABELS[d.status] || d.status}</span>
              <strong className="ld-name">{d.name || d.commercial_identifier || '—'}</strong>
            </div>
            <div className="ld-status-meta">
              {d.product_name && <span>{d.product_name}{d.variant_name ? ` · ${d.variant_name}` : ''}</span>}
              {d.commercial_identifier && <code>{d.commercial_identifier}</code>}
            </div>
          </div>

          {/* MOTIVO DE CANCELACIÓN / EXPIRACIÓN */}
          {importantReason && (
            <div className="ld-reason-block">
              <span>{d.status === 'cancelled' ? 'Motivo de cancelación' : 'Motivo de expiración'}</span>
              <strong>{importantReason.reason}</strong>
              {importantReason.userName && (
                <p>{importantReason.userName} · {fmtDT(importantReason.date)}</p>
              )}
            </div>
          )}

          <div className="ld-sections">
            {/* IDENTIFICACIÓN */}
            <section className="ld-section">
              <h4>Identificación</h4>
              <dl className="ld-grid">
                <Row label="Nombre" val={d.name} />
                <Row label="ID Comercial" val={<code className="ld-code">{d.commercial_identifier || '—'}</code>} />
                <Row label="Clave única" val={<code className="ld-code">{d.masked_code || '—'}</code>} />
                <Row label="Producto" val={d.product_name} />
                <Row label="Variante" val={d.variant_name} />
                <Row label="Ciclo" val={formatValue(d.billing_cycle)} />
              </dl>
            </section>

            {/* VIGENCIA */}
            <section className="ld-section">
              <h4>Vigencia y Costos</h4>
              <dl className="ld-grid">
                <Row label="Inicio" val={fmtD(d.start_date)} />
                <Row label="Vencimiento" val={fmtD(d.next_renewal_date || d.expiration_date)} />
                <Row label="Límite de canje" val={fmtD(d.redeem_deadline_date)} />
                <Row label="Prioridad" val={fmtD(d.activation_priority_date)} />
                <Row label="Costo" val={d.cost ? `${d.currency_code || ''} ${d.cost}`.trim() : '—'} />
                <Row label="Precio venta" val={d.sale_price ? `${d.currency_code || ''} ${d.sale_price}`.trim() : '—'} />
              </dl>
            </section>

            {/* RESERVA */}
            {d.status === 'reserved' && (
              <section className="ld-section">
                <h4>Reserva</h4>
                <dl className="ld-grid">
                  <Row label="Cliente" val={d.reserved_customer_name} />
                  <Row label="Reservado por" val={d.reserved_by_name} />
                  <Row label="Fecha" val={fmtDT(d.reserved_at)} />
                  <Row label="Vigencia" val={fmtD(d.reservation_expires_at)} />
                  <Row label="Notas" val={d.reservation_notes} full />
                </dl>
              </section>
            )}

            {/* ACTIVACIÓN */}
            {activation && (
              <section className="ld-section">
                <h4>Activación</h4>
                <dl className="ld-grid">
                  <Row label="Activado por" val={activation.activated_by_name} />
                  <Row label="Fecha" val={fmtDT(activation.activation_date)} />
                  <Row label="Cliente" val={activation.customer_name} />
                  <Row label="Equipo" val={activation.device_reference} />
                  <Row label="Ref. soporte" val={activation.support_reference} />
                  <Row label="Notas" val={activation.notes} full />
                </dl>
              </section>
            )}

            {/* INVENTARIO */}
            <section className="ld-section">
              <h4>Inventario</h4>
              <dl className="ld-grid">
                <Row label="Lote" val={d.batch_number} />
                <Row label="Proveedor" val={d.provider_name} />
                <Row label="Custodio" val={d.responsible_user_name} />
                <Row label="Registrado por" val={d.created_by_name} />
                <Row label="Fecha registro" val={fmtDT(d.create_date)} />
                <Row label="Última edición" val={fmtDT(d.write_date)} />
              </dl>
            </section>

            {/* HISTORIAL */}
            {events.length > 0 && (
              <section className="ld-section ld-section-full">
                <h4>Historial operativo</h4>
                <div className="ld-timeline">
                  {events.map((ev) => (
                    <div key={ev.id} className="ld-event">
                      <div className="ld-event-dot" />
                      <div className="ld-event-content">
                        <strong>{ev.label}</strong>
                        <span>{ev.userName || 'Sistema'} · {fmtDT(ev.date)}</span>
                        {ev.detail && <p>{ev.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, val, full }) {
  return (
    <>
      <dt className={full ? 'ld-full' : ''}>{label}</dt>
      <dd className={full ? 'ld-full' : ''}>{val || <span className="ld-empty">—</span>}</dd>
    </>
  )
}

function fmtD(v) {
  if (!v) return null
  return String(v).slice(0, 10)
}

function fmtDT(v) {
  if (!v) return null
  return new Date(v).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

function buildEvents(auditLogs, activation, license) {
  const events = auditLogs.map((item) => {
    const op = item.new_values?.operation
    const prev = item.old_values?.status || item.old_values?.license?.status
    const next = item.new_values?.license?.status || item.new_values?.status
    return {
      id: `a-${item.id}`,
      date: item.created_at,
      userName: item.user_name,
      label: eventLabel(op, item.action, prev, next),
      detail: eventDetail(op, prev, next, item),
    }
  })

  if (activation && !events.some((e) => e.label === 'Activación registrada')) {
    events.push({
      id: `act-${activation.id}`,
      date: activation.activation_date,
      userName: activation.activated_by_name,
      label: 'Activación registrada',
      detail: activation.device_reference ? `Equipo: ${activation.device_reference}` : '',
    })
  }

  if (license?.created_by_name && !events.some((e) => e.label === 'Licencia registrada')) {
    events.push({
      id: 'created',
      date: license.create_date,
      userName: license.created_by_name,
      label: 'Licencia registrada',
      detail: 'Ingreso inicial al inventario.',
    })
  }

  return events
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8)
}

function eventLabel(op, action, prev, next) {
  if (op === 'reserve') return 'Reserva registrada'
  if (op === 'release_reservation') return 'Reserva liberada'
  if (op === 'expire_overdue') return 'Marcada expirada automáticamente'
  if (action === 'activate') return 'Activación registrada'
  if (action === 'create') return 'Licencia registrada'
  if (action === 'cancel' || next === 'cancelled') return 'Licencia cancelada'
  if (next === 'expired' && prev !== 'expired') return 'Marcada expirada manualmente'
  if (prev && next && prev !== next) return `Cambio: ${formatValue(prev)} → ${formatValue(next)}`
  return formatValue(action)
}

function eventDetail(op, prev, next, item) {
  if (op === 'reserve') {
    const name = item.new_values?.reserved_for?.name
    return name ? `Cliente: ${name}` : 'Licencia apartada para uso futuro.'
  }
  if (op === 'release_reservation') return 'La licencia volvió a estar disponible.'
  if (op === 'expire_overdue') return 'Marcada vencida por el sistema automáticamente.'
  if (item.new_values?.reason) return `Motivo: ${item.new_values.reason}`
  return ''
}

function findReason(auditLogs, license) {
  if (!['expired', 'cancelled'].includes(license?.status)) return null
  const row = auditLogs.find((item) => {
    const op = item.new_values?.operation
    const prev = item.old_values?.status || item.old_values?.license?.status
    const next = item.new_values?.license?.status || item.new_values?.status
    return item.new_values?.reason && (
      ['mark_expired', 'expire_overdue', 'cancel'].includes(op) || (next === license.status && prev !== next)
    )
  })
  if (row) return { reason: row.new_values.reason, userName: row.user_name, date: row.created_at }
  if (license.notes) {
    const statusRow = auditLogs.find((item) => {
      const next = item.new_values?.license?.status || item.new_values?.status
      return next === license.status
    })
    return { reason: license.notes, userName: statusRow?.user_name, date: statusRow?.created_at }
  }
  return null
}

export default LicenseDetailModal
