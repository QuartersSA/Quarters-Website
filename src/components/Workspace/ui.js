// Workspace UI theme tokens (used only for Workspace pages)

export const ws = {
  // Background
  appBg:
    // A bit lighter (but still dark) so the UI feels clearer while keeping the same dark-glass look.
    "bg-gradient-to-b from-[#0d1426] via-[#101c38] to-[#090f1f] text-white font-inter",

  // Surfaces (Apple-like dark glass)
  glass:
    "bg-[#132044]/70 supports-[backdrop-filter]:bg-[#132044]/50 border border-white/10 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_50px_rgba(0,0,0,0.35)]",
  glassSoft:
    "bg-[#132044]/55 supports-[backdrop-filter]:bg-[#132044]/40 border border-white/10 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",

  // Popovers / Menus (more opaque so options never look "light" on top of content)
  popover:
    "bg-[#132044]/92 supports-[backdrop-filter]:bg-[#132044]/75 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_70px_rgba(0,0,0,0.55)]",

  // Bars
  topBar: "bg-[#132044]/55 border-b border-white/10 backdrop-blur-xl",

  // Typography
  title: "text-white font-bold tracking-tight",
  muted: "text-white/60",

  // Inputs
  // NOTE: iOS/Safari + Chrome autofill can force light backgrounds. We neutralize it here.
  input:
    "w-full appearance-none rounded-2xl bg-[#132044]/55 supports-[backdrop-filter]:bg-[#132044]/35 border border-white/10 text-white placeholder:text-white/35 focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50 disabled:cursor-not-allowed [&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(19,32,68,0.55)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:rgba(255,255,255,0.95)] [&:-webkit-autofill]:caret-color:white",
  select:
    "w-full appearance-none rounded-2xl bg-[#132044]/55 supports-[backdrop-filter]:bg-[#132044]/35 border border-white/10 text-white focus:outline-none focus:border-white/20 focus:ring-2 focus:ring-emerald-400/10 disabled:opacity-50 disabled:cursor-not-allowed",

  // Buttons
  btnPrimary:
    "inline-flex items-center gap-2 rounded-2xl bg-emerald-400/15 text-emerald-200 border border-emerald-400/25 font-semibold hover:bg-emerald-400/20 active:bg-emerald-400/25",
  btnNeutral:
    "inline-flex items-center gap-2 rounded-2xl bg-white/[0.05] text-white/85 border border-white/10 font-semibold hover:bg-white/[0.07] active:bg-white/[0.09]",
  btnDanger:
    "inline-flex items-center gap-2 rounded-2xl bg-red-500/15 text-red-200 border border-red-500/25 font-semibold hover:bg-red-500/20 active:bg-red-500/25",

  // Pills
  pill: "inline-flex px-3 py-1 rounded-full text-xs font-bold border backdrop-blur shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",

  // Common building blocks (Workspace-only)
  card: "rounded-3xl",
  divider: "border-white/10",
  iconBox:
    "w-11 h-11 rounded-2xl bg-white/[0.05] border border-white/10 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] flex items-center justify-center",
  iconButton:
    "inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/10 text-white hover:bg-white/[0.06]",
  chip: "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold text-white/70",

  // Segmented controls
  segWrap:
    "bg-white/[0.03] border border-white/10 rounded-2xl p-1 inline-flex items-center gap-1 backdrop-blur-xl",
  segBtn:
    "px-4 py-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25",
  segActive:
    "bg-white/10 text-white border border-white/20 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  segInactive: "bg-transparent text-white/70 hover:bg-white/[0.05]",
};
