import { useEffect, useState } from 'react'
import ActivationModal from './ActivationModal'
import ConfirmModal from './ConfirmModal'
import LicenseDetailModal from './LicenseDetailModal'
import LicenseWizard from './LicenseWizard'
import ReasonModal from './ReasonModal'
import ReservationModal from './ReservationModal'
import EntityModal from './EntityModal'
import { LoadingState } from './StateMessage'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'

const EMPTY_FILTERS = { productId: '', status: '', due: '' }
const STATUS_LABELS = {
  available: 'Disponible',
  reserved: 'Reservada',
  activated: 'Activada',
  expired: 'Vencida',
  cancelled: 'Cancelada',
}
const STATUS_CLASS = {
  available: 'lic-badge available',
  reserved: 'lic-badge reserved',
  activated: 'lic-badge activated',
  expired: 'lic-badge expired',
  cancelled: 'lic-badge cancelled',
}

function LicensesView({ api, setError, user }) {
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [products, setProducts] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)

  const [showWizard, setShowWizard] = useState(false)
  const [activationRow, setActivationRow] = useState(null)
  const [reservationRow, setReservationRow] = useState(null)
  const [detailRow, setDetailRow] = useState(null)
  const [editRow, setEditRow] = useState(null)
  const [reasonAction, setReasonAction] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)

  const perms = rolePermissions[user?.role?.name]?.licenses || []
  const canCreate = perms.includes('create')
  const canUpdate = perms.includes('update')
  const canActivate = perms.includes('activate')
  const canRead = perms.includes('read')

  async function load(overSearch, overFilters, overPage) {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('page', overPage || page)
      q.set('limit', 25)
      q.set('statuses', 'available,reserved')
      const s = typeof overSearch === 'string' ? overSearch : search
      if (s.trim()) q.set('search', s.trim())
      const f = overFilters || filters
      if (f.productId) q.set('productId', f.productId)
      if (f.status) q.set('statuses', f.status)
      if (f.due) q.set('due', f.due)
      const body = await api.request(`/licenses?${q.toString()}`)
      setRows(body.data || [])
      setPagination(body.pagination || null)
      setPage(body.pagination?.page || overPage || page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.request('/products?limit=100')
      .then(b => setProducts(b.data || []))
      .catch(() => {})
    load()
  }, [])

  function applyFilters() {
    setPage(1)
    load(undefined, filters, 1)
    setFilterOpen(false)
  }

  function clearFilters() {
    const empty = EMPTY_FILTERS
    setFilters(empty)
    setSearch('')
    setPage(1)
    load('', empty, 1)
    setFilterOpen(false)
  }

  function doSearch(e) {
    if (e.key === 'Enter' || e.type === 'click') {
      setPage(1)
      load(search, undefined, 1)
    }
  }

  async function markExpired(row) {
    setActiveMenuId(null)
    setReasonAction({
      title: 'Marcar como expirada',
      description: 'Indica el motivo por el que la clave ya no puede activarse (rechazo del proveedor, clave usada, etc.)',
      confirmLabel: 'Confirmar expiración',
      danger: true,
      onConfirm: async (reason) => {
        await api.request(`/licenses/${row.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'expired',
            expiration_date: new Date().toISOString().slice(0, 10),
            reason,
            notes: reason,
          }),
        })
        setReasonAction(null)
        await load()
        setError('Licencia marcada como expirada.', 'success')
      },
    })
  }

  async function cancelLicense(row) {
    setActiveMenuId(null)
    setReasonAction({
      title: 'Cancelar licencia',
      description: 'Indica el motivo de la cancelación. Esto queda registrado en auditoría.',
      confirmLabel: 'Cancelar licencia',
      danger: true,
      onConfirm: async (reason) => {
        await api.request(`/licenses/${row.id}`, {
          method: 'DELETE',
          body: JSON.stringify({ reason, notes: reason }),
        })
        setReasonAction(null)
        await load()
        setError('Licencia cancelada.', 'success')
      },
    })
  }

  async function releaseReservation(row) {
    setActiveMenuId(null)
    try {
      await api.request(`/licenses/${row.id}/release-reservation`, { method: 'POST' })
      await load()
      setError('Reserva liberada.', 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const totalPages = Math.max(pagination?.totalPages || 1, 1)

  const activeCount = rows.filter(r => r.status === 'available').length
  const reservedCount = rows.filter(r => r.status === 'reserved').length

  return (
    <div className="lic-view">
      {/* CABECERA */}
      <div className="lic-header">
        <div className="lic-header-info">
          <h2>Licencias</h2>
          <p>Inventario disponible y reservado · <span>{pagination?.total ?? '—'} registros</span></p>
        </div>
        <div className="lic-header-actions">
          {canCreate && (
            <button type="button" className="lic-btn-primary" onClick={() => setShowWizard(true)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" focusable="false">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Registrar licencia
            </button>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="lic-stats-strip">
        <div className="lic-stat">
          <span>Disponibles</span>
          <strong className="ok">{activeCount}</strong>
        </div>
        <div className="lic-stat">
          <span>Reservadas</span>
          <strong className="warn">{reservedCount}</strong>
        </div>
        <div className="lic-stat">
          <span>En página</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="lic-stat">
          <span>Total</span>
          <strong>{pagination?.total ?? '—'}</strong>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="lic-toolbar">
        <div className="lic-search-wrap">
          <svg className="lic-search-icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="lic-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={doSearch}
            placeholder="Buscar por nombre, ID comercial o clave..."
          />
          {search && (
            <button type="button" className="lic-search-clear" onClick={() => { setSearch(''); load('', undefined, 1) }}>
              ×
            </button>
          )}
        </div>
        <button type="button" className="lic-btn-secondary" onClick={doSearch}>Buscar</button>
        <button
          type="button"
          className={`lic-btn-secondary ${filterOpen ? 'active' : ''}`}
          onClick={() => setFilterOpen(v => !v)}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filtrar
        </button>
        <button type="button" className="lic-btn-secondary" onClick={() => load()}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
            <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* PANEL DE FILTROS */}
      {filterOpen && (
        <div className="lic-filter-panel">
          <div className="lic-filter-fields">
            <label>
              Producto
              <select value={filters.productId} onChange={e => setFilters(f => ({ ...f, productId: e.target.value }))}>
                <option value="">Todos</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>
              Estado
              <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">Todos</option>
                <option value="available">Disponible</option>
                <option value="reserved">Reservada</option>
              </select>
            </label>
            <label>
              Vencimiento
              <select value={filters.due} onChange={e => setFilters(f => ({ ...f, due: e.target.value }))}>
                <option value="">Sin filtro</option>
                <option value="overdue">Vencidas</option>
                <option value="next30">Próximos 30 días</option>
                <option value="over30">Más de 30 días</option>
              </select>
            </label>
          </div>
          <div className="lic-filter-actions">
            <button type="button" className="lic-btn-primary" onClick={applyFilters}>Aplicar</button>
            <button type="button" className="lic-btn-secondary" onClick={clearFilters}>Limpiar</button>
          </div>
        </div>
      )}

      {/* TABLA */}
      <div className="lic-table-wrap">
        {loading ? (
          <div className="lic-loading"><LoadingState message="Cargando licencias..." /></div>
        ) : rows.length === 0 ? (
          <div className="lic-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p>No se encontraron licencias con estos criterios.</p>
            <button type="button" className="lic-btn-secondary" onClick={clearFilters}>Ver todas</button>
          </div>
        ) : (
          <table className="lic-table">
            <thead>
              <tr>
                <th>Licencia / Producto</th>
                <th>ID Comercial</th>
                <th>Estado</th>
                <th>Custodio</th>
                <th>Prioridad</th>
                <th style={{ width: '52px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className={`lic-row ${row.status}`}>
                  <td>
                    <div className="lic-cell-main">
                      <strong>{row.name || row.product_name || '—'}</strong>
                      <span>{row.variant_name || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <code className="lic-id-code">{row.commercial_identifier || '—'}</code>
                  </td>
                  <td>
                    <span className={STATUS_CLASS[row.status] || 'lic-badge'}>{STATUS_LABELS[row.status] || row.status}</span>
                  </td>
                  <td>
                    <span className="lic-custodian">{row.responsible_user_name || '—'}</span>
                  </td>
                  <td>
                    {row.activation_priority_date ? (
                      <span className="lic-priority-date">{String(row.activation_priority_date).slice(0, 10)}</span>
                    ) : (
                      <span className="lic-no-date">—</span>
                    )}
                  </td>
                  <td>
                    <div className="lic-row-actions">
                      {/* ACCIÓN PRIMARIA */}
                      {(row.status === 'available' || row.status === 'reserved') && canActivate && (
                        <button
                          type="button"
                          className="lic-action-activate"
                          onClick={() => setActivationRow(row)}
                          title="Activar licencia"
                        >
                          Activar
                        </button>
                      )}

                      {/* MENÚ DE OPCIONES */}
                      <div className="lic-menu-wrap">
                        <button
                          type="button"
                          className="lic-menu-trigger"
                          onClick={() => setActiveMenuId(activeMenuId === row.id ? null : row.id)}
                          title="Más opciones"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" focusable="false">
                            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                          </svg>
                        </button>
                        {activeMenuId === row.id && (
                          <div className="lic-dropdown-menu">
                            {canRead && (
                              <button type="button" onClick={() => { setDetailRow(row); setActiveMenuId(null) }}>
                                Ver ficha
                              </button>
                            )}
                            {canUpdate && (
                              <button type="button" onClick={() => { setEditRow(row); setActiveMenuId(null) }}>
                                Editar datos
                              </button>
                            )}
                            {row.status === 'reserved' && (
                              <button type="button" onClick={() => releaseReservation(row)}>
                                Liberar reserva
                              </button>
                            )}
                            {row.status === 'available' && (
                              <button type="button" onClick={() => { setReservationRow(row); setActiveMenuId(null) }}>
                                Reservar
                              </button>
                            )}
                            <hr />
                            {canUpdate && (
                              <button type="button" className="danger" onClick={() => markExpired(row)}>
                                Marcar expirada
                              </button>
                            )}
                            {canUpdate && (
                              <button type="button" className="danger" onClick={() => cancelLicense(row)}>
                                Cancelar licencia
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* PAGINACIÓN */}
      {!loading && pagination && (
        <div className="lic-pagination">
          <span>{pagination.total} registros · Página {pagination.page} de {totalPages}</span>
          <div className="lic-page-buttons">
            <button type="button" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(undefined, undefined, p) }}>
              ← Anterior
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(undefined, undefined, p) }}>
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showWizard && (
        <LicenseWizard api={api} setError={setError} initialValues={{}}
          onClose={() => setShowWizard(false)}
          onCreated={async () => { setShowWizard(false); await load() }}
        />
      )}
      {activationRow && (
        <ActivationModal api={api} license={activationRow} setError={setError} user={user}
          onClose={() => setActivationRow(null)}
          onActivated={async () => { setActivationRow(null); await load() }}
        />
      )}
      {reservationRow && (
        <ReservationModal api={api} license={reservationRow} setError={setError} user={user}
          onClose={() => setReservationRow(null)}
          onReserved={async () => { setReservationRow(null); await load(); setError('Licencia reservada.', 'success') }}
        />
      )}
      {detailRow && (
        <LicenseDetailModal api={api} license={detailRow} setError={setError}
          onClose={() => setDetailRow(null)}
        />
      )}
      {editRow && (
        <EntityModal
          api={api} config={tableConfig.licenses} formConfig={formConfig.licenses}
          mode="edit" row={editRow} setError={setError}
          onClose={() => setEditRow(null)}
          onSaved={async () => { setEditRow(null); await load() }}
        />
      )}
      {reasonAction && (
        <ReasonModal
          title={reasonAction.title} description={reasonAction.description}
          confirmLabel={reasonAction.confirmLabel} danger={reasonAction.danger}
          onClose={() => setReasonAction(null)} onConfirm={async (r) => {
            try { await reasonAction.onConfirm(r) } catch (err) { setError(err.message) }
          }}
        />
      )}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title} description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel} danger={confirmAction.danger}
          onClose={() => setConfirmAction(null)} onConfirm={confirmAction.onConfirm}
        />
      )}

      {/* Cerrar menú al hacer click fuera */}
      {activeMenuId && (
        <div className="lic-menu-backdrop" onClick={() => setActiveMenuId(null)} />
      )}
    </div>
  )
}

export default LicensesView
