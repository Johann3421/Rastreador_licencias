function Modal({ title, badge, children, onClose, size = 'default' }) {
  return (
    <div className="m-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className={`m-panel ${size === 'large' ? 'm-panel-lg' : size === 'sm' ? 'm-panel-sm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="m-header">
          <div className="m-header-left">
            {badge && <span className="m-badge">{badge}</span>}
            <h3 className="m-title">{title}</h3>
          </div>
          <button type="button" className="m-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" focusable="false">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="m-body">
          {children}
        </div>
      </section>
    </div>
  )
}

export default Modal
