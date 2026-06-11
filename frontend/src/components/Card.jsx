// A frosted panel used as the building block for every dashboard section.
export default function Card({ title, subtitle, icon: Icon, action, className = '', children }) {
  return (
    <section
      className={`rounded-2xl border border-panelborder bg-panel/80 backdrop-blur p-5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-eco-neon/10 text-eco-neon">
                <Icon size={18} />
              </span>
            )}
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
              {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}
