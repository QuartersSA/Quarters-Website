export function FieldRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-2 md:gap-4 py-3 border-t border-slate-200 dark:border-white/10">
      <div className="min-w-0">
        <div className="text-slate-800 dark:text-white/80 font-semibold">{label}</div>
        {hint ? <div className="text-xs text-slate-500 dark:text-white/45 mt-1">{hint}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
