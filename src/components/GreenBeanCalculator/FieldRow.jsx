export function FieldRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-2 md:gap-5 py-4 border-t border-slate-200/70 dark:border-white/10 first:border-t-0">
      <div className="min-w-0">
        <div className="text-slate-900 dark:text-white/85 font-semibold tracking-tight">
          {label}
        </div>
        {hint ? (
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-relaxed">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 self-center">{children}</div>
    </div>
  );
}
