import { useEffect, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import EntityModal from './EntityModal'
import { LoadingState } from './StateMessage'
import { formConfig, rolePermissions, tableConfig } from '../config/modules'
import { formatValue } from '../utils/formatters'

function UsersView({ api, setError, user, initialTab = 'users' }) {
  const [activeTab, setActiveTab] = useState(initialTab) // 'users' | 'roles' | 'audit'
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, totalRoles: 0, totalAudit: 0 })
  const [auditCleanupPreview, setAuditCleanupPreview] = useState(null)

  // Modal states
  const [modalMode, setModalMode] = useState(null) // 'create' | 'edit'
  const [selectedRow, setSelectedRow] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)

  const currentTab = activeTab === 'roles' ? 'roles' : activeTab === 'audit' ? 'audit' : 'users'
  const modulePerms = rolePermissions[user?.role?.name]?.[currentTab] || []
  const canCreate = modulePerms.includes('create')
  const canUpdate = modulePerms.includes('update')

  useEffect(() => {
    if (initialTab && ['users', 'roles', 'audit'].includes(initialTab) && initialTab !== activeTab) {
      setActiveTab(initialTab)
      setSearch('')
      setPage(1)
    }
  }, [initialTab])

  // Summary stats
  async function fetchStats() {
    try {
      const [uRes, rRes, aRes] = await Promise.all([
        api.request('/users?limit=200'),
        api.request('/roles?limit=100'),
        api.request('/audit-logs?limit=1'),
      ])
      const uList = uRes.data || []
      const activeU = uList.filter((u) => u.active !== false).length

      setStats({
        totalUsers: uRes.pagination?.total ?? uList.length,
        activeUsers: activeU,
        totalRoles: rRes.pagination?.total ?? (rRes.data || []).length,
        totalAudit: aRes.pagination?.total ?? 0,
      })
    } catch (_) {
      // Ignore stats error
    }
  }

  // Load table data
  async function loadData(overSearch, overPage, overTab) {
    setLoading(true)
    const targetTab = overTab || currentTab
    const endpoint = targetTab === 'users' ? '/users' : targetTab === 'roles' ? '/roles' : '/audit-logs'
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
    setAuditCleanupPreview(null)
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
    const isInactive = row.active === false
    const verb = isInactive ? 'reactivar' : 'desactivar'
    const itemLabel = currentTab === 'roles' ? 'rol' : 'usuario'

    setConfirmAction({
      title: `${isInactive ? 'Reactivar' : 'Desactivar'} ${itemLabel}`,
      description: `¿Estás seguro de que deseas ${verb} a "${row.name}"?`,
      confirmLabel: isInactive ? 'Reactivar' : 'Desactivar',
      danger: !isInactive,
      onConfirm: async () => {
        try {
          const endpoint = currentTab === 'roles' ? `/roles/${row.id}` : `/users/${row.id}`
          await api.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ active: isInactive }),
          })
          setConfirmAction(null)
          await loadData()
          await fetchStats()
          setError(`${currentTab === 'roles' ? 'Rol' : 'Usuario'} ${isInactive ? 'reactivado' : 'desactivado'} con éxito.`, 'success')
        } catch (err) {
          setError(err.message)
        }
      },
    })
  }

  async function previewAuditCleanup() {
    try {
      const body = await api.request('/audit-logs/cleanup-preview?retentionDays=365')
      setAuditCleanupPreview(body.data)
      setError(`Registros candidatos para limpieza: ${body.data.candidateCount}`, 'info')
    } catch (err) {
      setError(err.message)
    }
  }

  function confirmAuditCleanup() {
    setConfirmAction({
      title: 'Limpiar auditoría antigua',
      description: 'Se eliminarán registros de auditoría no críticos con más de 365 días. La auditoría operativa de licencias se conservará.',
      confirmLabel: 'Limpiar auditoría',
      danger: true,
      onConfirm: async () => {
        try {
          const body = await api.request('/audit-logs/cleanup', {
            method: 'POST',
            body: JSON.stringify({ retentionDays: 365 }),
          })
          setConfirmAction(null)
          setAuditCleanupPreview(null)
          await loadData()
          await fetchStats()
          setError(`Auditoría limpiada. Registros eliminados: ${body.data.deletedCount}`, 'success')
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
          <h2>Configuración del Sistema</h2>
          <p>Administración de usuarios, roles de acceso y registros de auditoría</p>
        </div>
        <div className="cat-header-actions">
          {currentTab !== 'audit' && canCreate && (
            <button type="button" className="lic-btn-primary" onClick={handleCreate}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" focusable="false">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {currentTab === 'roles' ? 'Crear rol' : 'Crear usuario'}
            </button>
          )}
          {currentTab === 'audit' && (
            <>
              <button type="button" className="lic-btn-secondary" onClick={previewAuditCleanup}>
                Simular limpieza
              </button>
              <button type="button" className="lic-btn-secondary" style={{ color: '#dc2626', borderColor: '#fca5a5' }} onClick={confirmAuditCleanup}>
                Limpiar antigua (&gt;365d)
              </button>
            </>
          )}
        </div>
      </div>

      {/* PREVIEW LIMPIEZA AUDITORÍA */}
      {currentTab === 'audit' && auditCleanupPreview && (
        <div className="mf-hint mf-hint-info" style={{ marginBottom: '16px' }}>
          Candidatos para limpieza (&gt;365 días): <strong>{auditCleanupPreview.candidateCount}</strong> registros.
          {auditCleanupPreview.oldestDate && ` Más antiguo: ${String(auditCleanupPreview.oldestDate).slice(0, 10)}.`}
        </div>
      )}

      {/* STATS STRIP */}
      <div className="lic-stats-strip">
        <div
          className={`lic-stat ${currentTab === 'users' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('users')}
          style={{ cursor: 'pointer' }}
        >
          <span>Usuarios</span>
          <strong className="ok">{stats.totalUsers}</strong>
        </div>
        <div
          className={`lic-stat ${currentTab === 'users' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('users')}
          style={{ cursor: 'pointer' }}
        >
          <span>Activos</span>
          <strong>{stats.activeUsers}</strong>
        </div>
        <div
          className={`lic-stat ${currentTab === 'roles' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('roles')}
          style={{ cursor: 'pointer' }}
        >
          <span>Roles de Acceso</span>
          <strong>{stats.totalRoles}</strong>
        </div>
        <div
          className={`lic-stat ${currentTab === 'audit' ? 'active-stat' : ''}`}
          onClick={() => handleTabSwitch('audit')}
          style={{ cursor: 'pointer' }}
        >
          <span>Registros Auditoría</span>
          <strong className="warn">{stats.totalAudit}</strong>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="cat-tabs">
        <button
          type="button"
          className={`cat-tab ${currentTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('users')}
        >
          Usuarios
        </button>
        <button
          type="button"
          className={`cat-tab ${currentTab === 'roles' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('roles')}
        >
          Roles de Acceso
        </button>
        <button
          type="button"
          className={`cat-tab ${currentTab === 'audit' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('audit')}
        >
          Auditoría y Logs
        </button>
      </div>

      {/* TOOLBAR */}
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
            placeholder={
              currentTab === 'users'
                ? 'Buscar por nombre o correo...'
                : currentTab === 'roles'
                  ? 'Buscar rol...'
                  : 'Buscar en logs por usuario, entidad o acción...'
            }
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
          <div className="lic-loading"><LoadingState message="Cargando información..." /></div>
        ) : rows.length === 0 ? (
          <div className="lic-empty">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" focusable="false">
              <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p>No se encontraron registros en esta sección.</p>
            {currentTab !== 'audit' && canCreate && (
              <button type="button" className="lic-btn-primary" onClick={handleCreate}>
                {currentTab === 'roles' ? 'Crear rol' : 'Crear usuario'}
              </button>
            )}
          </div>
        ) : (
          <table className="lic-table">
            <thead>
              {renderHeader(currentTab)}
            </thead>
            <tbody>
              {rows.map((row) => renderRow(currentTab, row, { canUpdate, handleEdit, handleToggleActive }))}
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
          config={tableConfig[currentTab]}
          formConfig={formConfig[currentTab]}
          mode={modalMode}
          row={selectedRow}
          setError={setError}
          guideText={formConfig[currentTab]?.guideText}
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

function renderHeader(tab) {
  if (tab === 'users') {
    return (
      <tr>
        <th>Usuario</th>
        <th>Correo</th>
        <th>Rol de Acceso</th>
        <th>Último Ingreso</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  if (tab === 'roles') {
    return (
      <tr>
        <th>Nombre del Rol</th>
        <th>Descripción</th>
        <th>Estado</th>
        <th style={{ width: '130px', textAlign: 'right' }}>Acciones</th>
      </tr>
    )
  }
  if (tab === 'audit') {
    return (
      <tr>
        <th>Acción</th>
        <th>Usuario</th>
        <th>Entidad afect.</th>
        <th>IP</th>
        <th>Fecha y Hora</th>
      </tr>
    )
  }
  return null
}

function renderRow(tab, row, { canUpdate, handleEdit, handleToggleActive }) {
  const isInactive = row.active === false

  if (tab === 'users') {
    return (
      <tr key={row.id} className={isInactive ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <div className="lic-cell-main">
            <strong>{row.name}</strong>
          </div>
        </td>
        <td>
          <span className="lic-custodian">{row.email}</span>
        </td>
        <td>
          <span className="lic-badge available" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            {row.role_name || formatValue(row.role_id) || 'Usuario'}
          </span>
        </td>
        <td>
          <span>{row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Sin registros'}</span>
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

  if (tab === 'roles') {
    return (
      <tr key={row.id} className={isInactive ? 'lic-row cancelled' : 'lic-row'}>
        <td>
          <div className="lic-cell-main">
            <strong>{row.name}</strong>
          </div>
        </td>
        <td>
          <span className="lic-custodian">{row.description || 'Sin descripción'}</span>
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

  if (tab === 'audit') {
    return (
      <tr key={row.id} className="lic-row">
        <td>
          <span className={`lic-badge ${getAuditBadgeClass(row.action)}`}>
            {formatValue(row.action)}
          </span>
        </td>
        <td>
          <div className="lic-cell-main">
            <strong>{row.user_name || 'Sistema'}</strong>
            <span>{row.user_email || ''}</span>
          </div>
        </td>
        <td>
          <code>{row.entity_name} #{row.entity_id}</code>
        </td>
        <td>
          <span className="lic-custodian">{row.ip_address || '—'}</span>
        </td>
        <td>
          <span>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</span>
        </td>
      </tr>
    )
  }

  return null
}

function getAuditBadgeClass(action) {
  if (action === 'create' || action === 'activate') return 'available'
  if (action === 'update') return 'reserved'
  if (action === 'delete' || action === 'cancel') return 'expired'
  return 'cancelled'
}

export default UsersView
