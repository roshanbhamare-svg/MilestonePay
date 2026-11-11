export default function Card({ title, subtitle, action, children, className = '', style }) {
  return (
    <section className={`card ${className}`.trim()} style={style}>
      {(title || subtitle || action) && (
        <div className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

