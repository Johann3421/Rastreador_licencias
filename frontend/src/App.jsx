import { useEffect, useMemo, useState } from 'react'
import Dashboard from './components/Dashboard'
import DataModule from './components/DataModule'
import LicensesView from './components/LicensesView'
import LoginScreen from './components/LoginScreen'
import ProductsView from './components/ProductsView'
import CustomersView from './components/CustomersView'
import UsersView from './components/UsersView'
import NotificationCenter from './components/NotificationCenter'
import NotificationModule from './components/NotificationModule'
import { modules, rolePermissions } from './config/modules'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const navIconPaths = {
  dashboard:        { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', extra: 'M9 22V12h6v10' },
  licenses:         { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', extra: 'M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
  catalog:          { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  products:         { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  variants:         { d: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  batches:          { d: 'M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' },
  customers:        { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', extra: 'M23 21v-2a4 4 0 0 0-3-3.87 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  settings:         { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', extra: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z' },
  providers:        { d: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', extra: 'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  users:            { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', extra: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  audit:            { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', extra: 'M14 2v6h6 M16 13H8 M16 17H8 M10 9H8' },
}

function NavIcon({ moduleId }) {
  const icon = navIconPaths[moduleId] || navIconPaths.dashboard
  return (
    <span className={`nav-icon nav-icon-${moduleId}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d={icon.d} />
        {icon.extra && <path d={icon.extra} />}
      </svg>
    </span>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tracksaas_token'))
  const [user, setUser] = useState(null)
  const [activeModule, setActiveModule] = useState(() => {
    const hash = window.location.hash.replace('#/', '').replace('#', '')
    return hash || sessionStorage.getItem('tracksaas_module') || 'dashboard'
  })
  const [previousModule, setPreviousModule] = useState('dashboard')
  const [openGroups, setOpenGroups] = useState({ catalog: false })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationHistory, setNotificationHistory] = useState([])

  // Sincronizar cambios de Hash / URL con las rutas activas
  useEffect(() => {
    function handleHashChange() {
      const hash = window.location.hash.replace('#/', '').replace('#', '')
      if (hash && hash !== activeModule) {
        setActiveModule(hash)
        sessionStorage.setItem('tracksaas_module', hash)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [activeModule])

  const api = useMemo(() => {
    async function request(path, options = {}) {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      })

      const text = await response.text()
      const body = text ? JSON.parse(text) : null

      if (!response.ok) {
        throw new Error(body?.message || 'No se pudo completar la solicitud')
      }

      return body
    }

    return { request }
  }, [token])

  useEffect(() => {
    if (!token) return

    api
      .request('/auth/me')
      .then((body) => setUser(body.user))
      .catch(() => {
        localStorage.removeItem('tracksaas_token')
        setToken(null)
        setUser(null)
      })
  }, [api, token])

  function notify(message, type = 'error') {
    if (!message) return

    const notification = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      type,
      createdAt: new Date().toISOString(),
      duration: type === 'error' ? 7000 : type === 'alert' ? 6500 : type === 'success' ? 4500 : 5000,
    }

    setNotifications((current) => [...current, notification])
    setNotificationHistory((current) => [notification, ...current].slice(0, 60))
  }

  function dismissNotification(id) {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }

  function removeNotificationHistory(id) {
    setNotificationHistory((current) => current.filter((notification) => notification.id !== id))
  }

  function clearNotificationHistory() {
    setNotificationHistory([])
  }

  function handleLogin(nextToken, nextUser) {
    localStorage.setItem('tracksaas_token', nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setNotifications([])
    setNotificationHistory([])
  }

  function logout() {
    localStorage.removeItem('tracksaas_token')
    setToken(null)
    setUser(null)
    setActiveModule('dashboard')
    setPreviousModule('dashboard')
    setOpenGroups({})
    setSidebarOpen(false)
  }

  function selectModule(moduleId) {
    if (moduleId === 'notifications' && activeModule !== 'notifications') {
      setPreviousModule(activeModule)
    }
    setActiveModule(moduleId)
    sessionStorage.setItem('tracksaas_module', moduleId)
    window.location.hash = `#/${moduleId}`
    setSidebarOpen(false)
  }

  function closeNotificationsModule() {
    setActiveModule(previousModule || 'dashboard')
  }

  function canReadModule(moduleId) {
    if (moduleId === 'notifications') return true
    if (moduleId === 'dashboard') return rolePermissions[user?.role?.name]?.dashboard?.includes('read')
    if (moduleId === 'expiredLicenses') return rolePermissions[user?.role?.name]?.licenses?.includes('read')
    if (moduleId === 'cancelledLicenses') return rolePermissions[user?.role?.name]?.licenses?.includes('read')
    if (moduleId === 'audit') return rolePermissions[user?.role?.name]?.audit?.includes('read')
    return rolePermissions[user?.role?.name]?.[moduleId]?.includes('read')
  }

  const visibleModules = modules
    .map((module) => {
      if (!module.children?.length) return canReadModule(module.id) ? module : null
      const visibleChildren = module.children.filter((child) => canReadModule(child.id))
      return visibleChildren.length ? { ...module, children: visibleChildren } : null
    })
    .filter(Boolean)

  useEffect(() => {
    if (!user) return
    if (!canReadModule(activeModule)) {
      setActiveModule('dashboard')
    }
  }, [user, activeModule])

  const activeModuleLabel = useMemo(() => {
    for (const module of visibleModules) {
      if (module.id === activeModule) return module.label
      const child = module.children?.find((item) => item.id === activeModule)
      if (child) return child.label
    }
    if (activeModule === 'notifications') {
      return 'Notificaciones'
    }
    return 'Dashboard'
  }, [activeModule, visibleModules])

  if (!token) {
    return <LoginScreen apiUrl={API_URL} onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
        >
          Menú
        </button>
        <strong>{activeModuleLabel}</strong>
        <button
          type="button"
          className="mobile-notification-button"
          onClick={() => selectModule('notifications')}
          aria-label="Ver notificaciones"
        >
          Avisos
          {notificationHistory.length > 0 && <span>{notificationHistory.length}</span>}
        </button>
      </header>

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">TS</div>
          <div>
            <h1>TrackSaaS</h1>
            <p>Control de licencias</p>
          </div>
          <button
            type="button"
            className="sidebar-close-button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            Cerrar
          </button>
        </div>

        <nav className="nav-list" aria-label="Módulos">
          {visibleModules.map((module) => {
            const isGroup = Boolean(module.children?.length)
            const isOpen = openGroups[module.id]
            const hasActiveChild = module.children?.some((child) => child.id === activeModule)

            if (isGroup) {
              return (
                <div key={module.id} className="nav-group">
                  <button
                    type="button"
                    className={hasActiveChild ? 'active' : ''}
                    aria-expanded={Boolean(isOpen)}
                    onClick={() => {
                      setOpenGroups((current) => ({ ...current, [module.id]: !current[module.id] }))
                    }}
                  >
                    <span className="nav-item-label">
                      <NavIcon moduleId={module.id} />
                      <span>{module.label}</span>
                    </span>
                    <span className="nav-chevron">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="nav-sublist">
                      {module.children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          className={activeModule === child.id ? 'active' : ''}
                          onClick={() => selectModule(child.id)}
                        >
                          <span className="nav-item-label">
                            <NavIcon moduleId={child.id} />
                            <span>{child.label}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <button
                key={module.id}
                type="button"
                className={activeModule === module.id ? 'active' : ''}
                onClick={() => {
                  selectModule(module.id)
                }}
              >
                <span className="nav-item-label">
                  <NavIcon moduleId={module.id} />
                  <span>{module.label}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-session">
          <div className="session-user-info">
            <div className="user-avatar">
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{user?.name || 'Usuario'}</strong>
              <span>{user?.email || 'operador'}</span>
            </div>
          </div>
          <button
            type="button"
            className="logout-icon-button"
            onClick={logout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <NotificationCenter notifications={notifications} onDismiss={dismissNotification} />
        <div className="main-topbar-header">
          <button
            type="button"
            className={`topbar-notification-button ${activeModule === 'notifications' ? 'active' : ''}`}
            onClick={() => selectModule('notifications')}
            title="Centro de notificaciones"
            aria-label="Notificaciones"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="notification-label">Notificaciones</span>
            {notificationHistory.length > 0 && (
              <span className="notification-pill-badge">{notificationHistory.length}</span>
            )}
          </button>
        </div>

        {activeModule === 'notifications' ? (
          <NotificationModule
            notifications={notificationHistory}
            onRemove={removeNotificationHistory}
            onClear={clearNotificationHistory}
            onBack={closeNotificationsModule}
          />
        ) : activeModule === 'dashboard' ? (
          <Dashboard api={api} setError={notify} onNavigate={selectModule} />
        ) : activeModule === 'licenses' ? (
          <LicensesView api={api} setError={notify} user={user} />
        ) : ['products', 'variants', 'batches', 'providers'].includes(activeModule) ? (
          <ProductsView api={api} setError={notify} user={user} initialTab={activeModule} />
        ) : ['customers', 'activations'].includes(activeModule) ? (
          <CustomersView api={api} setError={notify} user={user} initialTab={activeModule} />
        ) : ['users', 'roles', 'audit'].includes(activeModule) ? (
          <UsersView api={api} setError={notify} user={user} initialTab={activeModule} />
        ) : (
          <DataModule
            api={api}
            moduleId={activeModule}
            setError={notify}
            user={user}
          />
        )}
      </main>
    </div>
  )
}

export default App
