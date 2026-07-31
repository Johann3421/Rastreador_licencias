import { useEffect, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import EntityModal from './EntityModal'
import { LoadingState } from './StateMessage'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'
import { formatValue } from '../utils/formatters'

const TAB_CONFIGS = {
  products: {
    title: 'Productos',
    createLabel: 'Crear producto',
    endpoint: '/products',
    moduleKey: 'products',
  },
  variants: {
    title: 'Variantes',
    createLabel: 'Crear variante',
    endpoint: '/variants',
    moduleKey: 'variants',
  },
  batches: {
    title: 'Lotes de compra',
    createLabel: 'Crear lote',
    endpoint: '/batches',
    moduleKey: 'batches',
  },
  providers: {
    title: 'Proveedores',
    createLabel: 'Crear proveedor',
    endpoint: '/providers',
    moduleKey: 'providers',
  },
}

function ProductsView({ api, setError, user, initialTab = 'products' }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ products: 0, variants: 0, batches: 0, providers: 0 })

  // Modal states
  const [modalMode, setModalMode] = useState(null) // 'create' | 'edit'
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const currentTabConfig = TAB_CONFIGS[activeTab] || TAB_CONFIGS.products
  const modulePerms = rolePermissions[user?.role?.name]?.[currentTabConfig.moduleKey] || []
  const canCreate = modulePerms.includes('create')
  const canUpdate = modulePerms.includes('update')
  const canDelete = modulePerms.includes('delete')

  // Keep activeTab in sync if initialTab prop changes from route
  useEffect(() => {
    if (initialTab && TAB_CONFIGS[initialTab] && initialTab !== activeTab) {
      setActiveTab(initialTab)
      setSearch('')
      setPage(1)
    }
  }, [initialTab])

  // Fetch summary counts for the stats strip
  async function fetchStats() {
    try {
      const [pRes, vRes, bRes, prRes] = await Promise.all([
        api.request('/products?limit=1'),
        api.request('/variants?limit=1'),
        api.request('/batches?limit=1'),
        api.request('/providers?limit=1'),
      ])
      setStats({
        products: pRes.pagination?.total ?? pRes.data?.length ?? 0,
        variants: vRes.pagination?.total ?? vRes.data?.length ?? 0,
        batches: bRes.pagination?.total ?? bRes.data?.length ?? 0,
        providers: prRes.pagination?.total ?? prRes.data?.length ?? 0,
      })
    } catch (_) {
      // Ignore stats fetch failure silently
    }
  }

  // Load current tab data
  async function loadData(overSearch, overPage, overTab) {
    setLoading(true)
    const targetTab = overTab || activeTab
    const tabCfg = TAB_CONFIGS[targetTab] || TAB_CONFIGS.products
    try {
      const q = new URLSearchParams()
      q.set('page', overPage || (overTab ? 1 : page))
      q.set('limit', 25)
      const s = typeof overSearch === 'string' ? overSearch : search
      if (s.trim()) q.set('search', s.trim())

      const body = await api.request(`${tabCfg.endpoint}?${q.toString()}`)
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

  function handleCreate() {
    setSelectedRow(null)
    setModalMode('create')
  }

  function handleEdit(row) {
    setSelectedRow(row)
    setModalMode('edit')
  }

  function handleToggleActive(row) {
    const isInactive = row.active === false || row.status === 'cancelled'
    const verb = isInactive ? 'reactivar' : 'desactivar'
    const title = isInactive ? `Reactivar ${currentTabConfig.title.toLowerCase().slice(0, -1)}` : `Desactivar ${currentTabConfig.title.toLowerCase().slice(0, -1)}`

    setConfirmAction({
      title,
      description: `¿Estás seguro de que deseas ${verb} "${row.name || row.batch_number || 'este registro'}"?`,
      confirmLabel: isInactive ? 'Reactivar' : 'Desactivar',
      danger: !isInactive,
      onConfirm: async () => {
        try {
          const endpoint = `${currentTabConfig.endpoint}/${row.id}`
          if (activeTab === 'batches') {
            await api.request(endpoint, {
              method: 'PUT',
              body: JSON.stringify({ active: isInactive }),
            })
          } else {
            await api.request(endpoint, {
              method: 'PUT',
              body: JSON.stringify({ active: isInactive }),
            })
          }
          setConfirmAction(null)
          await loadData()
          await fetchStats()
          setError(`Registro ${isInactive ? 'reactivado' : 'desactivado'} con éxito.`, 'success')
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
          <h2>Catálogo y Productos</h2>
          <p>Administración del catálogo de software, variantes, lotes de compra y proveedores</p>
        </div>
        <div className="cat-header-actions">
          {canCreate && (
            <button type="button" className="lic-btn-primary" onClick={handleCreate}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" focusable="false">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {currentTabConfig.createLabel}
            </button>
          )}
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="lic-stats-strip">
        <div className={`lic-stat ${activeTab === 'products' ? 'active-stat' : ''}`} onClick={() => handleTabSwitch('products')} style={{ cursor: 'pointer' }}>
          <span>Productos</span>
          <strong className="ok">{stats.products}</strong>
        </div>
        <div className={`lic-stat ${activeTab === 'variants' ? 'active-stat' : ''}`} onClick={() => handleTabSwitch('variants')} style={{ cursor: 'pointer' }}>
          <span>Variantes</span>
          <strong>{stats.variants}</strong>
        </div>
        <div className={`lic-stat ${activeTab === 'batches' ? 'active-stat' : ''}`} onClick={() => handleTabSwitch('batches')} style={{ cursor: 'pointer' }}>
          <span>Lotes de Compra</span>
          <strong className="warn">{stats.batches}</strong>
        </div>
        <div className={`lic-stat ${activeTab === 'providers' ? 'active-stat' : ''}`} onClick={() => handleTabSwitch('providers')} style={{ cursor: 'pointer' }}>
          <span>Proveedores</span>
          <strong>{stats.providers}</strong>
        </div>
      </div>

      {/* PESTAÑAS (SUB-NAVEGACIÓN) */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`cat-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('products')}
        >
          Productos
        </button>
        <button
          type="button"
          className={`cat-tab ${activeTab === 'variants' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('variants')}
        >
          Variantes
        </button>
        <button
          type="button"
          className={`cat-tab ${activeTab === 'batches' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('batches')}
        >
          Lotes de compra
        </button>
        <button
          type="button"
          className={`cat-tab ${activeTab === 'providers' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('providers')}
        >
          Proveedores
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
            placeholder={`Buscar en ${currentTabConfig.title.toLowerCase()}...`}
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
          <div className="lic-loading"><LoadingState message={`Cargando ${currentTabConfig.title.toLowerCase()}...`} /></div>
        ) : rows.length === 0 ? (
          <div className="lic-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p>No se encontraron registros en {currentTabConfig.title.toLowerCase()}.</p>
            {canCreate && (
              <button type="button" className="lic-btn-primary" onClick={handleCreate}>
                {currentTabConfig.createLabel}
              </button>
            )}
          </div>
        ) : (
          <table className="lic-table">
            <thead>
              {renderTableHeader(activeTab)}
            </thead>
            <tbody>
              {rows.map((row) => renderTableRow(activeTab, row, { canUpdate, canDelete, handleEdit, handleToggleActive }))}
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

      {/* MODAL CREAR / EDITAR */}
      {modalMode && (
        <EntityModal
          api={api}
          config={tableConfig[activeTab]}
          formConfig={formConfig[activeTab]}
          mode={modalMode}
          row={selectedRow}
          setError={setError}
          guideText={formConfig[activeTab]?.guideText}
          onClose={() => { setModalMode(null); setSelectedRow(null) }}
          onSaved={async () => {
            setModalMode(null)
            setSelectedRow(null)
            await loadData()
            await fetchStats()
            setError(`Registro ${modalMode === 'create' ? 'creado' : 'actualizado'} con éxito.`, 'success')
          }}
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

function renderTableHeader(tab) {
  if (tab === 'products') {
    return (
      <tr>
        <th>Nombre del Producto</th>
        <th>Descripción</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  if (tab === 'variants') {
    return (
      <tr>
        <th>Producto</th>
        <th>Variante</th>
        <th>Código</th>
        <th>Ciclo</th>
        <th>Costo Ref.</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  if (tab === 'batches') {
    return (
      <tr>
        <th>Nº Lote</th>
        <th>Producto / Variante</th>
        <th>Proveedor</th>
        <th>Compradas</th>
        <th>Disponibles</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  if (tab === 'providers') {
    return (
      <tr>
        <th>Proveedor</th>
        <th>Contacto</th>
        <th>Correo</th>
        <th>Teléfono</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  return null
}

function renderTableRow(tab, row, { canUpdate, handleEdit, handleToggleActive }) {
  const isInactive = row.active === false || row.status === 'cancelled'

  if (tab === 'products') {
    return (
      <tr key={row.id} className={isInactive ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <div className="lic-cell-main">
            <strong>{row.name}</strong>
          </div>
        </td>
        <td>
          <span className="lic-custodian">{row.description || '—'}</span>
        </td>
        <td>
          <span className={`lic-badge ${row.active !== false ? 'available' : 'cancelled'}`}>
            {row.active !== false ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <div className="lic-row-actions">
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleEdit(row)}>
                Editar
              </button>
            )}
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleToggleActive(row)}>
                {row.active !== false ? 'Desactivar' : 'Reactivar'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (tab === 'variants') {
    return (
      <tr key={row.id} className={isInactive ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <strong>{row.product_name || '—'}</strong>
        </td>
        <td>
          <div className="lic-cell-main">
            <strong>{row.name}</strong>
          </div>
        </td>
        <td>
          <code className="lic-id-code">{row.default_code || '—'}</code>
        </td>
        <td>
          <span>{formatValue(row.billing_cycle)}</span>
        </td>
        <td>
          <strong>{row.currency_code || 'PEN'} {Number(row.default_cost || 0).toFixed(2)}</strong>
        </td>
        <td>
          <span className={`lic-badge ${row.active !== false ? 'available' : 'cancelled'}`}>
            {row.active !== false ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <div className="lic-row-actions">
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleEdit(row)}>
                Editar
              </button>
            )}
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleToggleActive(row)}>
                {row.active !== false ? 'Desactivar' : 'Reactivar'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (tab === 'batches') {
    const isConfirmed = row.status === 'confirmed'
    const isDraft = row.status === 'draft'
    const batchBadgeClass = isConfirmed ? 'available' : isDraft ? 'reserved' : 'cancelled'

    return (
      <tr key={row.id} className={row.status === 'cancelled' ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <code className="lic-id-code">{row.batch_number}</code>
        </td>
        <td>
          <div className="lic-cell-main">
            <strong>{row.product_name || '—'}</strong>
            <span>{row.variant_name || '—'}</span>
          </div>
        </td>
        <td>
          <span className="lic-custodian">{row.provider_name || '—'}</span>
        </td>
        <td>
          <strong>{row.quantity}</strong>
        </td>
        <td>
          <span className="lic-priority-date">{row.available_to_register} dispo</span>
        </td>
        <td>
          <span className={`lic-badge ${batchBadgeClass}`}>
            {formatValue(row.status)}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <div className="lic-row-actions">
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleEdit(row)}>
                Editar
              </button>
            )}
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleToggleActive(row)}>
                {row.active !== false ? 'Desactivar' : 'Reactivar'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (tab === 'providers') {
    return (
      <tr key={row.id} className={isInactive ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <div className="lic-cell-main">
            <strong>{row.name}</strong>
            {row.tax_id && <span>RUC/Doc: {row.tax_id}</span>}
          </div>
        </td>
        <td>
          <span>{row.contact_name || '—'}</span>
        </td>
        <td>
          <span>{row.email || '—'}</span>
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
              <button type="button" className="lic-btn-secondary" onClick={() => handleEdit(row)}>
                Editar
              </button>
            )}
            {canUpdate && (
              <button type="button" className="lic-btn-secondary" onClick={() => handleToggleActive(row)}>
                {row.active !== false ? 'Desactivar' : 'Reactivar'}
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return null
}

export default ProductsView
