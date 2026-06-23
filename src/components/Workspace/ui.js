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
    // Light: near-white surface, the faintest hint of slate at the
    // very bottom only — operator complained the previous
    // slate-50/100 gradient read as flat grey.
    "bg-white text-slate-900 font-inter " +
    "bg-gradient-to-b from-white via-white to-slate-50/40 " +
    // Dark: lifted-navy gradient. The previous #0d1426 → #090f1f range
    // read as near-black; the operator asked for it to be lightened.
    // These shades stay clearly "dark" while keeping enough luminance
    // that cards and content read as floating ON the surface.
    "dark:from-[#1a2540] dark:via-[#1f2c52] dark:to-[#16203a] dark:text-white",

  // Surfaces — frosted glass.
  //
  // Light mode is now fully opaque (bg-white instead of /85) so any
  // card that lands above a dark modal backdrop reads as a real
  // sheet of paper, not a translucent foggy panel. Borders are
  // tighter (slate-200, not /70) and the shadow is the layered
  // 3-stop "highlight + tight + diffuse" stack that gives the
  // card real depth.
  //
  // Dark unchanged — it always looked correct.
  glass:
    "bg-white border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_1px_2px_rgba(15,23,42,0.05),0_24px_48px_-16px_rgba(15,23,42,0.15)] " +
    "dark:bg-[#132044]/70 dark:supports-[backdrop-filter]:bg-[#132044]/50 dark:border-white/10 " +
    "dark:backdrop-blur-xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_50px_rgba(0,0,0,0.35)]",
  glassSoft:
    "bg-white/95 border border-slate-200/80 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_1px_2px_rgba(15,23,42,0.03)] " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/40 dark:border-white/10 " +
    "dark:backdrop-blur-xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",

  // Popovers / Menus / Modals — fully opaque white in light so they
  // never blend into the backdrop behind them. Heavier shadow gives
  // them clear "floating above the page" depth.
  popover:
    "bg-white border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_8px_24px_-4px_rgba(15,23,42,0.15),0_32px_72px_-16px_rgba(15,23,42,0.22)] " +
    "dark:bg-[#132044]/92 dark:supports-[backdrop-filter]:bg-[#132044]/75 dark:border-white/15 " +
    "dark:backdrop-blur-2xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_70px_rgba(0,0,0,0.55)]",

  // Top bars
  topBar:
    "bg-white/75 supports-[backdrop-filter]:bg-white/60 border-b border-slate-200/60 backdrop-blur-xl " +
    "dark:bg-[#132044]/55 dark:border-white/10",

  // Typography
  title: "text-slate-900 dark:text-white font-bold tracking-tight",
  muted: "text-slate-600 dark:text-white/60",

  // Inputs — slightly off-white surface so the field reads as a real
  // input on top of a white card (without the contrast feeling
  // aggressive). Focus state bumps to pure white + emerald ring so
  // the active control is unmistakable.
  input:
    "w-full appearance-none rounded-2xl bg-slate-50/70 supports-[backdrop-filter]:bg-slate-50/60 border border-slate-200 text-slate-900 placeholder:text-slate-400 " +
    "shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
    "transition-colors transition-shadow " +
    "hover:border-slate-300 hover:bg-white " +
    "focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white dark:placeholder:text-white/35 " +
    "dark:shadow-none dark:hover:border-white/15 dark:hover:bg-[#132044]/55 dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55 " +
    "[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a] " +
    "dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(19,32,68,0.55)_inset] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgba(255,255,255,0.95)]",
  select:
    "w-full appearance-none rounded-2xl bg-slate-50/70 supports-[backdrop-filter]:bg-slate-50/60 border border-slate-200 text-slate-900 " +
    "shadow-[0_1px_2px_rgba(15,23,42,0.03)] " +
    "transition-colors transition-shadow " +
    "hover:border-slate-300 hover:bg-white " +
    "focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/20 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white " +
    "dark:shadow-none dark:hover:border-white/15 dark:hover:bg-[#132044]/55 dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55",

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

  // Inner card — for tinted output panels / nested value boxes
  // sitting INSIDE a `ws.glass` shell. Plain `ws.glass` on top of
  // another `ws.glass` looks flat (white-on-white in light), so this
  // token gives those inner surfaces a subtle slate tint that reads
  // as "this is data, not chrome".
  innerCard:
    "rounded-2xl bg-slate-50 border border-slate-200 " +
    "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] " +
    "dark:bg-white/[0.03] dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
  // Soft section header bar — used at the top of a card or above a
  // grouped form row. Pairs with `innerCard` for grouped panels.
  sectionHeader:
    "px-4 py-3 bg-slate-50/80 border-b border-slate-200/70 " +
    "dark:bg-white/[0.03] dark:border-white/10",
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
    "inline-flex items-center justify-center w-11 h-11 rounded-2xl touch-manipulation " +
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
