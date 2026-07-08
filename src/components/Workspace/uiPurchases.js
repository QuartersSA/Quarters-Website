// ثيم قسم المشتريات — تطبيق حرفي للوحة مستند «مفهوم واجهة نظام
// المشتريات»: أرضية #F6F8F7، سطوح بيضاء بحدود #E2E7E4، حبر #1A2332،
// أخضر كوارترز #0E7A5F للأزرار الرئيسية والأخضر العميق #0B3D31
// للحالات النشطة، وزوايا 10px بدل 24px.
//
// نفس مفاتيح `ws` في Workspace/ui.js حتى يكون التحويل تبديل استيراد
// فقط. قيم الوضع الفاتح وحدها تغيّرت — كل سلاسل dark: منسوخة حرفياً
// من الثيم الأصلي فيبقى الوضع الداكن مطابقاً لبقية النظام.
//
// النطاق: صفحات وقوالب المشتريات فقط (بما فيها صفحة الموظف الميدانية
// وقوائم الموردين/المستفيدين المستخدمة داخل القسم حصراً). GlassSelect
// وأخواتها مشتركة نظاماً فتبقى على الثيم العام — سطوحها بيضاء أصلاً
// فتمتزج بلا نشاز.

export const ws = {
  appBg:
    "[color-scheme:light] dark:[color-scheme:dark] " +
    "bg-[#f6f8f7] text-[#1a2332] font-inter " +
    "dark:from-[#1a2540] dark:via-[#1f2c52] dark:to-[#16203a] dark:text-white " +
    "dark:bg-gradient-to-b",

  glass:
    "bg-white border border-[#e2e7e4] " +
    "shadow-[0_1px_2px_rgba(26,35,50,0.04),0_12px_32px_rgba(26,35,50,0.07)] " +
    "dark:bg-[#132044]/70 dark:supports-[backdrop-filter]:bg-[#132044]/50 dark:border-white/10 " +
    "dark:backdrop-blur-xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_18px_50px_rgba(0,0,0,0.35)]",
  glassSoft:
    "bg-[#fafbfa] border border-[#e2e7e4] " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/40 dark:border-white/10 " +
    "dark:backdrop-blur-xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]",

  popover:
    "bg-white border border-[#e2e7e4] " +
    "shadow-[0_8px_24px_-4px_rgba(26,35,50,0.12),0_32px_72px_-16px_rgba(26,35,50,0.18)] " +
    "dark:bg-[#132044]/92 dark:supports-[backdrop-filter]:bg-[#132044]/75 dark:border-white/15 " +
    "dark:backdrop-blur-2xl " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_20px_70px_rgba(0,0,0,0.55)]",

  topBar:
    "bg-white/90 supports-[backdrop-filter]:bg-white/80 border-b border-[#e2e7e4] backdrop-blur-xl " +
    "dark:bg-[#132044]/55 dark:border-white/10",

  title: "text-[#1a2332] dark:text-white font-bold tracking-tight",
  muted: "text-[#4a5568] dark:text-white/60",

  input:
    "w-full appearance-none rounded-[10px] bg-[#fafbfa] border border-[#e2e7e4] text-[#1a2332] placeholder:text-[#8a94a4] " +
    "transition-colors transition-shadow " +
    "hover:border-[#c9d3ce] hover:bg-white " +
    "focus:outline-none focus:border-[#0e7a5f] focus:ring-2 focus:ring-[#0e7a5f]/15 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white dark:placeholder:text-white/35 " +
    "dark:shadow-none dark:hover:border-white/15 dark:hover:bg-[#132044]/55 dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55 " +
    "[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#1a2332] " +
    "dark:[&:-webkit-autofill]:shadow-[0_0_0_1000px_rgba(19,32,68,0.55)_inset] dark:[&:-webkit-autofill]:[-webkit-text-fill-color:rgba(255,255,255,0.95)]",
  select:
    "w-full appearance-none rounded-[10px] bg-[#fafbfa] border border-[#e2e7e4] text-[#1a2332] " +
    "transition-colors transition-shadow " +
    "hover:border-[#c9d3ce] hover:bg-white " +
    "focus:outline-none focus:border-[#0e7a5f] focus:ring-2 focus:ring-[#0e7a5f]/15 focus:bg-white " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "dark:bg-[#132044]/55 dark:supports-[backdrop-filter]:bg-[#132044]/35 dark:border-white/10 dark:text-white " +
    "dark:shadow-none dark:hover:border-white/15 dark:hover:bg-[#132044]/55 dark:focus:border-white/20 dark:focus:ring-emerald-400/10 dark:focus:bg-[#132044]/55",

  btnPrimary:
    "inline-flex items-center gap-2 rounded-[10px] " +
    "bg-[#0e7a5f] text-white border border-[#0e7a5f] font-bold " +
    "shadow-[0_2px_6px_rgba(14,122,95,0.22)] " +
    "transition-colors transition-shadow " +
    "hover:bg-[#0c6950] hover:border-[#0c6950] hover:shadow-[0_4px_12px_rgba(14,122,95,0.28)] " +
    "active:bg-[#0b3d31] active:border-[#0b3d31] " +
    "dark:bg-emerald-400/15 dark:text-emerald-200 dark:border-emerald-400/25 dark:shadow-none " +
    "dark:hover:bg-emerald-400/20 dark:hover:shadow-none dark:active:bg-emerald-400/25",
  btnNeutral:
    "inline-flex items-center gap-2 rounded-[10px] " +
    "bg-white text-[#4a5568] border border-[#e2e7e4] font-semibold " +
    "transition-colors " +
    "hover:bg-[#f6f8f7] hover:border-[#c9d3ce] hover:text-[#1a2332] " +
    "active:bg-[#eef1ef] " +
    "dark:bg-white/[0.05] dark:text-white/85 dark:border-white/10 dark:shadow-none " +
    "dark:hover:bg-white/[0.07] dark:hover:border-white/10 dark:hover:text-white/85 dark:active:bg-white/[0.09]",
  btnDanger:
    "inline-flex items-center gap-2 rounded-[10px] " +
    "bg-[#f9ebe9] text-[#b5443c] border border-[#e8c4bf] font-semibold " +
    "transition-colors " +
    "hover:bg-[#f4ded9] hover:border-[#ddaba4] active:bg-[#eed1cb] " +
    "dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/25 dark:shadow-none " +
    "dark:hover:bg-red-500/20 dark:hover:border-red-500/25 dark:active:bg-red-500/25",

  pill:
    "inline-flex px-3 py-1 rounded-full text-xs font-bold border " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",

  card: "rounded-[10px]",
  divider: "border-[#e2e7e4] dark:border-white/10",

  innerCard:
    "rounded-[10px] bg-[#fafbfa] border border-[#e2e7e4] " +
    "dark:bg-white/[0.03] dark:border-white/10 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
  sectionHeader:
    "px-4 py-3 bg-[#fafbfa] border-b border-[#e2e7e4] " +
    "dark:bg-white/[0.03] dark:border-white/10",
  iconBox:
    "w-11 h-11 rounded-[10px] " +
    "bg-[#e7f2ee] border border-[#d3e5dd] " +
    "flex items-center justify-center " +
    "dark:bg-white/[0.05] dark:bg-none dark:border-white/10 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  iconButton:
    "inline-flex items-center justify-center w-11 h-11 rounded-[10px] touch-manipulation " +
    "bg-white text-[#4a5568] border border-[#e2e7e4] " +
    "transition-colors " +
    "hover:bg-[#f6f8f7] hover:border-[#c9d3ce] hover:text-[#1a2332] " +
    "dark:bg-white/[0.03] dark:text-white dark:border-white/10 dark:shadow-none " +
    "dark:hover:bg-white/[0.06] dark:hover:border-white/10",
  chip:
    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full " +
    "bg-white border border-[#e2e7e4] text-xs font-semibold text-[#4a5568] " +
    "dark:bg-white/[0.04] dark:border-white/10 dark:text-white/70 dark:shadow-none",

  segWrap:
    "bg-[#eef1ef] border border-[#e2e7e4] rounded-[10px] p-1 " +
    "inline-flex items-center gap-1 " +
    "dark:bg-white/[0.03] dark:border-white/10",
  segBtn:
    "px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0e7a5f]/30",
  // الرقاقة النشطة بالأخضر العميق — حرفياً chip.on في المستند.
  segActive:
    "bg-[#0b3d31] text-white border border-[#0b3d31] " +
    "dark:bg-white/10 dark:text-white dark:border-white/20 " +
    "dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
  segInactive:
    "bg-transparent text-[#4a5568] hover:text-[#1a2332] hover:bg-white " +
    "dark:text-white/70 dark:hover:bg-white/[0.05] dark:hover:text-white/70",
};
