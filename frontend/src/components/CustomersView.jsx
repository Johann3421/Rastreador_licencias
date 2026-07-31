import { useEffect, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import EntityModal from './EntityModal'
import LicenseDetailModal from './LicenseDetailModal'
import { LoadingState } from './StateMessage'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'

function CustomersView({ api, setError, user, initialTab = 'customers' }) {
  const [activeTab, setActiveTab] = useState(initialTab) // 'customers' | 'activations'
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ totalCustomers: 0, activeCustomers: 0, totalActivations: 0, expiringSoon: 0 })

  // Modal states
  const [modalMode, setModalMode] = useState(null) // 'create' | 'edit'
  const [selectedRow, setSelectedRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const isCustomersTab = activeTab === 'customers'
  const moduleKey = isCustomersTab ? 'customers' : 'activations'
  const modulePerms = rolePermissions[user?.role?.name]?.[moduleKey] || []
  const canCreate = modulePerms.includes('create')
  const canUpdate = modulePerms.includes('update')

  useEffect(() => {
    if (initialTab && (initialTab === 'customers' || initialTab === 'activations') && initialTab !== activeTab) {
      setActiveTab(initialTab)
      setSearch('')
      setPage(1)
    }
  }, [initialTab])

  // Fetch summary stats
  async function fetchStats() {
    try {
      const [cRes, aRes] = await Promise.all([
        api.request('/customers?limit=200'),
        api.request('/activations?limit=200'),
      ])
      const cList = cRes.data || []
      const aList = aRes.data || []
      const activeC = cList.filter((c) => c.active !== false).length
      const expiring = aList.filter((a) => {
        const d = Number(a.days_remaining)
        return !isNaN(d) && d >= 0 && d <= 30
      }).length

      setStats({
        totalCustomers: cRes.pagination?.total ?? cList.length,
        activeCustomers: activeC,
        totalActivations: aRes.pagination?.total ?? aList.length,
        expiringSoon: expiring,
      })
    } catch (_) {
      // Fail silently for stats
    }
  }

  // Fetch tab data
  async function loadData(overSearch, overPage, overTab) {
    setLoading(true)
    const targetTab = overTab || activeTab
    const endpoint = targetTab === 'customers' ? '/customers' : '/activations'
    try {
      const q = new URLSearchParams()
      q.set('page', overPage || (overTab ? 1 : page))
      q.set('limit', 25)
      const s = typeof overSearch === 'string' ? overSearch : search
      if (s.trim()) q.set('search', s.trim())

      const body = await api.request(`${endpoint}?${q.toString()}`)
      setRows(body.data || [])
      setPagination(body.pagination || null)
      if (overPage) setPage(overPage)
      else if (overTab) setPage(1)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    loadData()
  }, [activeTab])

  function handleTabSwitch(tabKey) {
    setActiveTab(tabKey)
    setSearch('')
    setPage(1)
    window.location.hash = `#/${tabKey}`
  }

  function handleSearch(e) {
    if (e.key === 'Enter' || e.type === 'click') {
      setPage(1)
      loadData(search, 1)
    }
  }

  function handleCreateCustomer() {
    setSelectedRow(null)
    setModalMode('create')
  }

  function handleEditCustomer(row) {
    setSelectedRow(row)
    setModalMode('edit')
  }

  function handleToggleActiveCustomer(row) {
    const isInactive = row.active === false
    const verb = isInactive ? 'reactivar' : 'desactivar'

    setConfirmAction({
      title: `${isInactive ? 'Reactivar' : 'Desactivar'} cliente`,
      description: `¿Estás seguro de que deseas ${verb} a "${row.name}"?`,
      confirmLabel: isInactive ? 'Reactivar' : 'Desactivar',
      danger: !isInactive,
      onConfirm: async () => {
        try {
          await api.request(`/customers/${row.id}`, {
            method: 'PUT',
            body: JSON.stringify({ active: isInactive }),
          })
          setConfirmAction(null)
          await loadData()
          await fetchStats()
          setError(`Cliente ${isInactive ? 'reactivado' : 'desactivado'} con éxito.`, 'success')
        } catch (err) {
          setError(err.message)
        }
      },
    })
  }

  const totalPages = Math.max(pagination?.totalPages || 1, 1)

  return (
    <div className="cat-view">
      {/* CABECERA */}
      <div className="cat-header">
        <div className="cat-header-info">
          <h2>Clientes y Entidades</h2>
          <p>Directorio de clientes, entidades receptoras y licencias activadas</p>
        </div>
        <div className="cat-header-actions">
          {isCustomersTab && canCreate && (
            <button type="button" className="lic-btn-primary" onClick={handleCreateCustomer}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" focusable="false">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Crear cliente
            </button>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="lic-stats-strip">
        <div
          className={`lic-stat ${activeTab === 'customers' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('customers')}
          style={{ cursor: 'pointer' }}
        >
          <span>Total Clientes</span>
          <strong className="ok">{stats.totalCustomers}</strong>
        </div>
        <div
          className={`lic-stat ${activeTab === 'customers' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('customers')}
          style={{ cursor: 'pointer' }}
        >
          <span>Clientes Activos</span>
          <strong>{stats.activeCustomers}</strong>
        </div>
        <div
          className={`lic-stat ${activeTab === 'activations' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('activations')}
          style={{ cursor: 'pointer' }}
        >
          <span>Licencias Activadas</span>
          <strong>{stats.totalActivations}</strong>
        </div>
        <div
          className={`lic-stat ${activeTab === 'activations' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('activations')}
          style={{ cursor: 'pointer' }}
        >
          <span>Por Vencer (&le; 30d)</span>
          <strong className="warn">{stats.expiringSoon}</strong>
        </div>
      </div>

      {/* PESTAÑAS (SUB-NAVEGACIÓN) */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`cat-tab ${isCustomersTab ? 'active' : ''}`}
          onClick={() => handleTabSwitch('customers')}
        >
          Directorio de Clientes
        </button>
        <button
          type="button"
          className={`cat-tab ${activeTab === 'activations' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('activations')}
        >
          Licencias Activadas
        </button>
      </div>

      {/* TOOLBAR DE BÚSQUEDA */}
      <div className="lic-toolbar">
        <div className="lic-search-wrap">
          <svg className="lic-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="lic-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            placeholder={isCustomersTab ? 'Buscar cliente por nombre, RUC/Documento o correo...' : 'Buscar activación por cliente, producto o clave...'}
          />
          {search && (
            <button type="button" className="lic-search-clear" onClick={() => { setSearch(''); loadData('', 1) }}>
              ×
            </button>
          )}
        </div>
        <button type="button" className="lic-btn-secondary" onClick={handleSearch}>Buscar</button>
        <button type="button" className="lic-btn-secondary" onClick={() => loadData()} title="Actualizar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="lic-table-wrap">
        {loading ? (
          <div className="lic-loading"><LoadingState message={isCustomersTab ? 'Cargando clientes...' : 'Cargando licencias activadas...'} /></div>
        ) : rows.length === 0 ? (
          <div className="lic-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p>{isCustomersTab ? 'No se encontraron clientes registrados.' : 'No se encontraron licencias activadas.'}</p>
            {isCustomersTab && canCreate && (
              <button type="button" className="lic-btn-primary" onClick={handleCreateCustomer}>
                Crear cliente
              </button>
            )}
          </div>
        ) : (
          <table className="lic-table">
            <thead>
              {isCustomersTab ? (
                <tr>
                  <th>Cliente / Razón Social</th>
                  <th>RUC / Documento</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th>Producto / Licencia</th>
                  <th>ID Comercial</th>
                  <th>Cliente</th>
                  <th>Dispositivo / Ref.</th>
                  <th>Activado por</th>
                  <th>Vencimiento</th>
                  <th style={{ width: '110px', textAlign: 'right' }}>Ficha</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((row) =>
                isCustomersTab ? (
                  <tr key={row.id} className={row.active === false ? 'lic-row cancelled' : 'lic-row'}>
                    <td>
                      <div className="lic-cell-main">
                        <strong>{row.name}</strong>
                      </div>
                    </td>
                    <td>
                      <code className="lic-id-code">{row.tax_id || '—'}</code>
                    </td>
                    <td>
                      <span className="lic-custodian">{row.email || '—'}</span>
                    </td>
                    <td>
                      <span>{row.phone || '—'}</span>
                    </td>
                    <td>
                      <span className={`lic-badge ${row.active !== false ? 'available' : 'cancelled'}`}>
                        {row.active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="lic-row-actions">
                        {canUpdate && (
                          <button type="button" className="lic-btn-secondary" onClick={() => handleEditCustomer(row)}>
                            Editar
                          </button>
                        )}
                        {canUpdate && (
                          <button type="button" className="lic-btn-secondary" onClick={() => handleToggleActiveCustomer(row)}>
                            {row.active !== false ? 'Desactivar' : 'Reactivar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="lic-row">
                    <td>
                      <div className="lic-cell-main">
                        <strong>{row.product_name || row.license_name || '—'}</strong>
                        <span>{row.variant_name || '—'}</span>
                      </div>
                    </td>
                    <td>
                      <code className="lic-id-code">{row.commercial_identifier || '—'}</code>
                    </td>
                    <td>
                      <strong className="lic-custodian">{row.customer_name || 'Sin cliente'}</strong>
                    </td>
                    <td>
                      <span>{row.device_reference || row.support_reference || '—'}</span>
                    </td>
                    <td>
                      <span className="lic-custodian">{row.activated_by_name || '—'}</span>
                      <br />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {row.activation_date ? String(row.activation_date).slice(0, 10) : ''}
                      </span>
                    </td>
                    <td>
                      {renderDaysRemainingBadge(row.days_remaining, row.next_renewal_date || row.expiration_date)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="lic-btn-secondary"
                        onClick={() => setDetailRow({ id: row.license_unit_id || row.id, ...row })}
                      >
                        Ver ficha
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINACIÓN */}
      {!loading && pagination && (
        <div className="lic-pagination">
          <span>{pagination.total} registros · Página {pagination.page} de {totalPages}</span>
          <div className="lic-page-buttons">
            <button type="button" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); loadData(undefined, p) }}>
              ← Anterior
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); loadData(undefined, p) }}>
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {modalMode && (
        <EntityModal
          api={api}
          config={tableConfig.customers}
          formConfig={formConfig.customers}
          mode={modalMode}
          row={selectedRow}
          setError={setError}
          guideText={formConfig.customers?.guideText}
          onClose={() => { setModalMode(null); setSelectedRow(null) }}
          onSaved={async () => {
            setModalMode(null)
            setSelectedRow(null)
            await loadData()
            await fetchStats()
            setError(`Cliente ${modalMode === 'create' ? 'creado' : 'actualizado'} con éxito.`, 'success')
          }}
        />
      )}

      {/* MODAL FICHA DE LICENCIA / ACTIVACIÓN */}
      {detailRow && (
        <LicenseDetailModal
          api={api}
          license={detailRow}
          setError={setError}
          onClose={() => setDetailRow(null)}
        />
      )}

      {/* MODAL CONFIRMAR ACCIÓN */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.onConfirm}
        />
      )}
    </div>
  )
}

function renderDaysRemainingBadge(daysRemaining, dateValue) {
  const dateStr = dateValue ? String(dateValue).slice(0, 10) : ''
  if (daysRemaining === null || daysRemaining === undefined || daysRemaining === '') {
    return <span className="lic-no-date">{dateStr || '—'}</span>
  }

  const d = Number(daysRemaining)
  if (d < 0) {
    return (
      <span className="lic-badge expired" title={`Venció hace ${Math.abs(d)} días`}>
        Vencida ({dateStr})
      </span>
    )
  }
  if (d <= 30) {
    return (
      <span className="lic-priority-date" title={`Vence en ${d} días`}>
        {d}d restantes ({dateStr})
      </span>
    )
  }
  return (
    <span className="lic-badge available" title={`Vence en ${d} días`}>
      {d}d restantes
    </span>
  )
}

export default CustomersView
