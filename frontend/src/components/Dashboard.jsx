import { useEffect, useState } from 'react'
import DataTable from './DataTable'
import { EmptyState, LoadingState } from './StateMessage'

const ALERT_KEY = 'tracksaas_last_alert_key'

function Dashboard({ api, setError, onNavigate }) {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .request('/dashboard/overview')
      .then((body) => {
        setOverview(body.data)
        notifyOperationalAlerts(body.data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [api, setError])

  function notifyOperationalAlerts(data) {
    const alerts = data?.alerts || {}
    const red = Number(alerts.red || 0)
    const yellow = Number(alerts.yellow || 0)
    const noticeKey = `${red}-${yellow}`

    if (!red && !yellow) return
    if (noticeKey === sessionStorage.getItem(ALERT_KEY)) return

    sessionStorage.setItem(ALERT_KEY, noticeKey)
    if (red) {
      setError(`Atención: ${red} licencia(s) han vencido y requieren acción.`, 'alert')
      return
    }

    setError(`Aviso: ${yellow} licencia(s) vencerán en los próximos 30 días.`, 'alert')
  }

  async function expireOverdue() {
    try {
      const body = await api.request('/licenses/expire-overdue', { method: 'POST' })
      setError(`Se actualizaron ${body.data.expiredCount} licencias vencidas en el sistema.`, 'info')
      const next = await api.request('/dashboard/overview')
      setOverview(next.data)
      notifyOperationalAlerts(next.data)
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) return <section className="content-block"><LoadingState message="Cargando estado del sistema..." /></section>
  if (!overview) return <section className="content-block"><EmptyState message="Sin datos disponibles para mostrar." /></section>

  const status = overview.licensesByStatus || {}
  const inventory = overview.inventory || {}
  const alerts = overview.alerts || {}
  const financial = overview.financial || {}
  
  const totalLicenses = Number(inventory.licenses || 0)
  const available = Number(status.available || 0)
  const activated = Number(status.activated || 0)
  const expired = Number(status.expired || 0)
  const criticalCount = Number(alerts.red || 0) + Number(alerts.yellow || 0)

  return (
    <div className="dashboard-container">
      {/* CABECERA EJECUTIVA LIMPIA */}
      <div className="dashboard-header-strip">
        <div>
          <h2>Control de Licencias</h2>
          <p className="subtitle">Estado operativo en tiempo real del parque de licencias</p>
        </div>
        <div className="header-actions">
          {criticalCount > 0 && alerts.red > 0 && (
            <button type="button" className="action-sync-button" onClick={expireOverdue} title="Actualizar licencias vencidas automáticamente">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>Actualizar Vencidas</span>
              <span className="badge-count-red">{alerts.red}</span>
            </button>
          )}
          <button type="button" className="primary-button" onClick={() => onNavigate?.('licenses')}>
            Ver todas las licencias
          </button>
        </div>
      </div>

      {/* TARJETAS KPI DE LECTURA DIRECTA (LEY DE TESLER: MÁXIMO 3 MÉTRICAS CLAVE) */}
      <div className="dashboard-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Licencias Activas</span>
          <strong className="kpi-value">{activated}</strong>
          <span className="kpi-subtext">En uso por clientes / usuarios</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Disponibles para Asignar</span>
          <strong className="kpi-value positive">{available}</strong>
          <span className="kpi-subtext">Listas en inventario</span>
        </div>

        <div className={`kpi-card ${criticalCount ? 'warning-border' : ''}`}>
          <span className="kpi-label">Atención Requerida</span>
          <strong className={`kpi-value ${criticalCount ? 'danger-text' : ''}`}>{criticalCount}</strong>
          <span className="kpi-subtext">{alerts.red} vencidas · {alerts.yellow} por vencer (30 días)</span>
        </div>
      </div>

      {/* BLOQUE PRINCIPAL DE ACCIÓN RÁPIDA Y ESTADÍSTICAS SOBRIAS */}
      <div className="dashboard-main-grid">
        {/* TABLA DE ATENCIÓN URGENTE / PRÓXIMOS VENCIMIENTOS */}
        <div className="dashboard-card main-card">
          <div className="card-header">
            <div>
              <h3>Licencias Críticas / Próximos Vencimientos</h3>
              <p className="card-subtitle">Requieren renovación o atención en los próximos 30 días</p>
            </div>
          </div>
          
          {overview.upcomingRenewals && overview.upcomingRenewals.length > 0 ? (
            <DataTable
              rows={overview.upcomingRenewals}
              columns={[
                ['name', 'Licencia / Producto'],
                ['commercial_identifier', 'ID Comercial'],
                ['status', 'Estado'],
                ['alert_date', 'Fecha Límite'],
                ['days_remaining', 'Días Restantes'],
              ]}
            />
          ) : (
            <div className="clean-empty-state">
              <span className="check-icon">✓</span>
              <p>Todas las licencias operan con normalidad. No hay alertas críticas registradas.</p>
            </div>
          )}
        </div>

        {/* PANEL LATERAL DE VALORIZACIÓN Y RESUMEN RÁPIDO */}
        <div className="dashboard-card side-card">
          <div className="card-header">
            <h3>Valorización de Inventario</h3>
          </div>
          <div className="finance-block">
            <div className="finance-item">
              <span>Ingresos Licencias Activas</span>
              <strong>{formatMoney(financial.activated_revenue)}</strong>
            </div>
            <div className="finance-item">
              <span>Valor Inventario Disponible</span>
              <strong>{formatMoney(financial.available_inventory_value)}</strong>
            </div>
            <div className="finance-item highlight-item">
              <span>Margen Estimado Global</span>
              <strong>{formatMoney(financial.estimated_margin)}</strong>
            </div>
          </div>

          <div className="card-header border-top">
            <h3>Resumen por Producto</h3>
          </div>
          <div className="summary-pills">
            <div className="pill-item">
              <span>Productos registrados</span>
              <strong>{inventory.products}</strong>
            </div>
            <div className="pill-item">
              <span>Clientes activos</span>
              <strong>{inventory.customers}</strong>
            </div>
            <div className="pill-item">
              <span>Total en Registro</span>
              <strong>{totalLicenses}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatMoney(value) {
  return `S/ ${Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default Dashboard
