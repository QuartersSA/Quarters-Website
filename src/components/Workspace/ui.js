// Workspace UI theme tokens (used across Workspace + Admin + HR pages)
//
// Two themes are supported:
//   - Light: the default styling (no class on parent)
//   - Dark : applied when an ancestor carries class="dark"
//            (Tailwind darkMode: 'class')
//
// Light-mode polish (v2): softer slate-blue tints, multi-layer shadows
// for real depth, gentler borders that fade to translucent, and
// stronger primary/active states so the eye finds them quickly.

export const ws = {
  // Background — soft slate→cyan-tinted gradient instead of the
  // flat slate-50 / white / slate-100 stack. The tinted stops add
  // just enough color to feel premium without losing the clean
  // "documents on a desk" feel.
  appBg:
    "[color-scheme:light] dark:[color-scheme:dark] " +
    "bg-gradient-to-b from-slate-50 via-white to-slate-100/80 text-slate-900 font-inter " +
    "dark:from-[#0d1426] dark:via-[#101c38] dark:to-[#090f1f] dark:text-white",

  // Surfaces — frosted-glass cards. Light uses a near-white
  // background + soft translucent slate border + a layered shadow:
  // a tight 1-px stroke up top (highlight) and a wide diffuse drop
  // shadow below (lift). Dark unchanged.
  glass:
    "bg-white/85 supports-[backdrop-filter]:bg-white/70 border border-slate-200/70 backdrop-blur-xl " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04),0_20px_40px_-12px_rgba(15,23,42,0.08)] " +
    "dark:bg-[#132044]/70 dark:supports-[backdrop-filter]:bg-[#132044]/50 dark:border-white/10 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_50px_rgba(0,0,0,0.35)]",
  glassSoft:
    "bg-white/70 supports-[backdrop-filter]:bg-white/55 border border-slate-200/60 backdrop-blur-xl " +
    "shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_1px_2px_rgba(15,23,42,0.03)] " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/40 dark:border-white/10 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",

  // Popovers / Menus — heavier shadow so they read as floating above
  // the surface beneath them. Light uses a more saturated drop.
  popover:
    "bg-white/95 supports-[backdrop-filter]:bg-white/90 backdrop-blur-2xl " +
    "border border-slate-200/60 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_24px_-4px_rgba(15,23,42,0.12),0_24px_60px_-12px_rgba(15,23,42,0.18)] " +
    "dark:bg-[#132044]/92 dark:supports-[backdrop-filter]:bg-[#132044]/75 dark:border-white/15 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_70px_rgba(0,0,0,0.55)]",

  // Top bars
  topBar:
    "bg-white/75 supports-[backdrop-filter]:bg-white/60 border-b border-slate-200/60 backdrop-blur-xl " +
    "dark:bg-[#132044]/55 dark:border-white/10",

  // Typography
  title: "text-slate-900 dark:text-white font-bold tracking-tight",
  muted: "text-slate-600 dark:text-white/60",

  // Inputs — slightly more rounded feel + an emerald focus ring
  // that's visible against light bg without being garish.
  input:
    "w-full appearance-none rounded-2xl bg-white/90 supports-[backdrop-filter]:bg-white/75 border border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
    "transition-colors transition-shadow " +
    "focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white dark:placeholder:text-white/35 " +
    "dark:shadow-none dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55 " +
    "[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] " +
    "dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(19,32,68,0.55)_inset] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgba(255,255,255,0.95)]",
  select:
    "w-full appearance-none rounded-2xl bg-white/90 supports-[backdrop-filter]:bg-white/75 border border-slate-200 text-slate-900 " +
    "shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
    "transition-colors transition-shadow " +
    "focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white " +
    "dark:shadow-none dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55",

  // Buttons — emerald primary uses a stronger, more saturated light
  // pair so it pops on white surfaces. Neutral / danger get gentler
  // borders and a soft inner highlight.
  btnPrimary:
    "inline-flex items-center gap-2 rounded-2xl " +
    "bg-emerald-500 text-white border border-emerald-500 font-semibold " +
    "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_2px_6px_rgba(16,185,129,0.25)] " +
    "transition-colors transition-shadow " +
    "hover:bg-emerald-600 hover:border-emerald-600 hover:shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_4px_12px_rgba(16,185,129,0.30)] " +
    "active:bg-emerald-700 active:border-emerald-700 " +
    "dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25 dark:shadow-none " +
    "dark:hover:bg-emerald-400/20 dark:hover:shadow-none dark:active:bg-emerald-400/25",
  btnNeutral:
    "inline-flex items-center gap-2 rounded-2xl " +
    "bg-white text-slate-700 border border-slate-200 font-semibold " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04)] " +
    "transition-colors " +
    "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 " +
    "active:bg-slate-100 " +
    "dark:bg-white/[0.05] dark:text-white/85 dark:border-white/10 dark:shadow-none " +
    "dark:hover:bg-white/[0.07] dark:hover:border-white/10 dark:hover:text-white/85 dark:active:bg-white/[0.09]",
  btnDanger:
    "inline-flex items-center gap-2 rounded-2xl " +
    "bg-red-50 text-red-700 border border-red-200 font-semibold " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(220,38,38,0.06)] " +
    "transition-colors " +
    "hover:bg-red-100 hover:border-red-300 active:bg-red-200 " +
    "dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/25 dark:shadow-none " +
    "dark:hover:bg-red-500/20 dark:hover:border-red-500/25 dark:active:bg-red-500/25",

  // Pills
  pill:
    "inline-flex px-3 py-1 rounded-full text-xs font-bold border backdrop-blur " +
    "shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",

  // Common building blocks
  card: "rounded-3xl",
  divider: "border-slate-200/60 dark:border-white/10",
  // Icon container — used for the big rounded squares that hold a
  // single icon (sidebar item icons, modal headers, etc). Light
  // version has a subtle vertical gradient + tighter border so the
  // icon sits on a real surface, not a flat fill.
  iconBox:
    "w-11 h-11 rounded-2xl " +
    "bg-gradient-to-b from-white to-slate-100 border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04)] " +
    "flex items-center justify-center " +
    "dark:bg-white/[0.05] dark:bg-none dark:border-white/10 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  iconButton:
    "inline-flex items-center justify-center w-10 h-10 rounded-2xl " +
    "bg-white text-slate-700 border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(15,23,42,0.04)] " +
    "transition-colors " +
    "hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 " +
    "dark:bg-white/[0.03] dark:text-white dark:border-white/10 dark:shadow-none " +
    "dark:hover:bg-white/[0.06] dark:hover:border-white/10",
  chip:
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full " +
    "bg-white border border-slate-200 text-xs font-semibold text-slate-700 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] " +
    "dark:bg-white/[0.04] dark:border-white/10 dark:text-white/70 dark:shadow-none",

  // Segmented controls — light uses a soft slate well + an elevated
  // white "thumb" on the active segment for a real depth read.
  segWrap:
    "bg-slate-100/80 border border-slate-200/70 rounded-2xl p-1 " +
    "inline-flex items-center gap-1 backdrop-blur-xl " +
    "dark:bg-white/[0.03] dark:border-white/10",
  segBtn:
    "px-4 py-2 rounded-xl font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/30",
  segActive:
    "bg-white text-slate-900 border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_3px_rgba(15,23,42,0.08)] " +
    "dark:bg-white/10 dark:text-white dark:border-white/20 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  segInactive:
    "bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/50 " +
    "dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white/70",
};
