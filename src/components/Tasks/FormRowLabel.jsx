export function FormRowLabel({ icon, label }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-white/70">
      <span className="text-white/60">{icon}</span>
      {label}
    </div>
  );
}
