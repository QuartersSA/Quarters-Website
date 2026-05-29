// Workspace UI theme tokens (used across Workspace + Admin + HR pages)
//
// Two themes are supported:
//   - Light: the default styling (no class on parent)
//   - Dark : applied when an ancestor carries class="dark"
//            (Tailwind darkMode: 'class')
//
// Non-admin sections (workspace, hr, accounting, employee) wrap
// their root in <div className="dark"> so they always render the
// established dark-glass look. The admin section drives the class
// from user preference via useAdminTheme, so the admin can switch
// between dark and light at will.

export const ws = {
  // Background
  appBg:
    // [color-scheme] tells the browser which native controls to use
    // (scrollbars, date pickers, autofill). Light by default + dark
    // override so Safari/iOS doesn't force light-mode chrome on the
    // dark theme.
    "[color-scheme:light] dark:[color-scheme:dark] " +
    "bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 font-inter " +
    "dark:from-[#0d1426] dark:via-[#101c38] dark:to-[#090f1f] dark:text-white",

  // Surfaces (Apple-like glass)
  glass:
    "bg-white/80 supports-[backdrop-filter]:bg-white/65 border border-slate-200/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_18px_50px_rgba(15,23,42,0.10)] " +
    "dark:bg-[#132044]/70 dark:supports-[backdrop-filter]:bg-[#132044]/50 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_50px_rgba(0,0,0,0.35)]",
  glassSoft:
    "bg-white/65 supports-[backdrop-filter]:bg-white/45 border border-slate-200/70 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/40 dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",

  // Popovers / Menus
  popover:
    "bg-white/95 supports-[backdrop-filter]:bg-white/85 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_20px_70px_rgba(15,23,42,0.18)] " +
    "dark:bg-[#132044]/92 dark:supports-[backdrop-filter]:bg-[#132044]/75 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_70px_rgba(0,0,0,0.55)]",

  // Bars
  topBar:
    "bg-white/70 border-b border-slate-200/80 backdrop-blur-xl " +
    "dark:bg-[#132044]/55 dark:border-white/10",

  // Typography
  title: "text-slate-900 dark:text-white font-bold tracking-tight",
  muted: "text-slate-600 dark:text-white/60",

  // Inputs
  input:
    "w-full appearance-none rounded-2xl bg-white/80 supports-[backdrop-filter]:bg-white/60 border border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white dark:placeholder:text-white/35 " +
    "dark:focus:border-white/20 dark:focus:ring-emerald-400/10 " +
    "[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] " +
    "dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(19,32,68,0.55)_inset] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgba(255,255,255,0.95)]",
  select:
    "w-full appearance-none rounded-2xl bg-white/80 supports-[backdrop-filter]:bg-white/60 border border-slate-200 text-slate-900 " +
    "focus:outline-none focus:border-slate-300 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white " +
    "dark:focus:border-white/20 dark:focus:ring-emerald-400/10",

  // Buttons
  btnPrimary:
    "inline-flex items-center gap-2 rounded-2xl bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-semibold hover:bg-emerald-500/25 active:bg-emerald-500/30 " +
    "dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25 dark:hover:bg-emerald-400/20 dark:active:bg-emerald-400/25",
  btnNeutral:
    "inline-flex items-center gap-2 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 font-semibold hover:bg-slate-200 active:bg-slate-300 " +
    "dark:bg-white/[0.05] dark:text-white/85 dark:border-white/10 dark:hover:bg-white/[0.07] dark:active:bg-white/[0.09]",
  btnDanger:
    "inline-flex items-center gap-2 rounded-2xl bg-red-500/15 text-red-700 border border-red-500/30 font-semibold hover:bg-red-500/25 active:bg-red-500/30 " +
    "dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/25 dark:hover:bg-red-500/20 dark:active:bg-red-500/25",

  // Pills
  pill:
    "inline-flex px-3 py-1 rounded-full text-xs font-bold border backdrop-blur shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",

  // Common building blocks
  card: "rounded-3xl",
  divider: "border-slate-200 dark:border-white/10",
  iconBox:
    "w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] flex items-center justify-center " +
    "dark:bg-white/[0.05] dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  iconButton:
    "inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 " +
    "dark:bg-white/[0.03] dark:border-white/10 dark:text-white dark:hover:bg-white/[0.06]",
  chip:
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 " +
    "dark:bg-white/[0.04] dark:border-white/10 dark:text-white/70",

  // Segmented controls
  segWrap:
    "bg-slate-100 border border-slate-200 rounded-2xl p-1 inline-flex items-center gap-1 backdrop-blur-xl " +
    "dark:bg-white/[0.03] dark:border-white/10",
  segBtn:
    "px-4 py-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25",
  segActive:
    "bg-white text-slate-900 border border-slate-200 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] " +
    "dark:bg-white/10 dark:text-white dark:border-white/20 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  segInactive:
    "bg-transparent text-slate-600 hover:bg-slate-200/60 " +
    "dark:text-white/70 dark:hover:bg-white/[0.05]",
};
