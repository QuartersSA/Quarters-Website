"use client";

// صفحة مستقلة: العد التنازلي لافتتاح فرع «الواحة» — quarters.sa/alwaha
// أسلوب ملصق تحريري لعلامة قهوة: ورق كريمي، أخضر كوارترز الداكن، أرقام
// ضخمة، ختم دائري، شريط متحرك. بلا تسجيل دخول، للجوال والكمبيوتر.

import { useEffect, useMemo, useState } from "react";

const BRAND_LOGO =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/";

// موعد الافتتاح: 11 نوفمبر 2026 — بداية اليوم بتوقيت الرياض.
const OPENING_ISO = "2026-11-11T00:00:00+03:00";
const OPENING_AT = new Date(OPENING_ISO).getTime();
const ANNOUNCED_AT = new Date("2026-09-01T00:00:00+03:00").getTime();
const PAGE_URL = "https://quarters.sa/alwaha";
const PAGE_TITLE = "افتتاح فرع الواحة — Quarters";

const INK = "#10261f"; // أخضر كوارترز الداكن (حبر)
const PAPER = "#F3EDE2"; // ورق كريمي
const CLAY = "#B8552F"; // طيني — لمسة واحدة فقط

export function meta() {
  return [
    { title: PAGE_TITLE },
    { name: "description", content: "العد التنازلي لافتتاح فرع الواحة — كوارترز، 11 نوفمبر 2026." },
  ];
}

function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function diffParts(now) {
  const total = Math.max(OPENING_AT - now, 0);
  const s = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return { ...diffParts(now), mounted, now };
}

function calendarHref() {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quarters//Alwaha Opening//AR",
    "BEGIN:VEVENT",
    "UID:alwaha-opening-2026@quarters.sa",
    "DTSTAMP:20260901T000000Z",
    "DTSTART;VALUE=DATE:20261111",
    "DTEND;VALUE=DATE:20261112",
    "SUMMARY:افتتاح فرع الواحة — Quarters",
    "LOCATION:الدمام — حي الواحة",
    `DESCRIPTION:الفرع الرابع لكوارترز — ${PAGE_URL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

// رقم واحد من العدّاد: ضخم، بخط Changa، وتحته التسمية بخط صغير متباعد.
function Digit({ value, label, last = false }) {
  return (
    <div
      className={`relative flex flex-col items-center px-3 sm:px-6 md:px-8 py-2 ${
        last ? "" : "sm:border-l sm:border-[#10261f]/20"
      }`}
    >
      <span
        className="font-changa font-bold leading-none tabular-nums text-[64px] sm:text-[104px] md:text-[136px] lg:text-[160px] tracking-tight"
        style={{ color: INK }}
        dir="ltr"
      >
        {value}
      </span>
      <span
        className="mt-1 sm:mt-2 font-tajawal text-[11px] sm:text-sm"
        style={{ color: `${INK}99` }}
      >
        {label}
      </span>
    </div>
  );
}

// ختم دائري يدور ببطء: نص على مسار دائري + التاريخ في المنتصف.
function Stamp({ opened }) {
  return (
    <div className="relative w-[128px] h-[128px] sm:w-[168px] sm:h-[168px]">
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full animate-[alwahaSpin_28s_linear_infinite]"
        aria-hidden="true"
      >
        <defs>
          <path id="alwaha-ring" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
        </defs>
        <circle cx="100" cy="100" r="96" fill="none" stroke={INK} strokeWidth="2" />
        <circle cx="100" cy="100" r="60" fill="none" stroke={INK} strokeWidth="1" strokeDasharray="2 4" />
        <text
          fontSize="15"
          fontWeight="700"
          fill={INK}
          letterSpacing="3"
          direction="ltr"
          style={{ fontFamily: "Tajawal, Cairo, sans-serif", direction: "ltr", unicodeBidi: "isolate" }}
        >
          <textPath href="#alwaha-ring" startOffset="0">
            QUARTERS • ALWAHA • QUARTERS • ALWAHA •
          </textPath>
        </text>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-changa font-bold leading-none text-[30px] sm:text-[40px]" style={{ color: CLAY }} dir="ltr">
          {opened ? "✓" : "11.11"}
        </span>
        <span className="font-tajawal text-[10px] sm:text-xs" style={{ color: INK }}>
          {opened ? "افتتحنا" : "فرع الواحة"}
        </span>
      </div>
    </div>
  );
}

const TICKER = "افتتاح فرع الواحة  ✦  11 نوفمبر 2026  ✦  QUARTERS ALWAHA  ✦  الفرع الرابع لكوارترز  ✦  الدمام — حي الواحة  ✦  ";

export default function AlwahaOpeningPage() {
  const { days, hours, minutes, seconds, total, mounted, now } = useCountdown();
  const opened = mounted && total <= 0;

  const progress = useMemo(() => {
    const span = OPENING_AT - ANNOUNCED_AT;
    const done = Math.min(Math.max(now - ANNOUNCED_AT, 0), span);
    return span > 0 ? done / span : 1;
  }, [now]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = PAGE_TITLE;
    const upsert = (attr, key, content) => {
      let el = document.head.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    upsert("name", "description", "العد التنازلي لافتتاح فرع الواحة — كوارترز، 11 نوفمبر 2026.");
    upsert("property", "og:title", PAGE_TITLE);
    upsert("property", "og:description", "الفرع الرابع لكوارترز — الدمام، حي الواحة. نلتقيكم في 11 نوفمبر 2026.");
    upsert("property", "og:image", BRAND_LOGO);
    upsert("property", "og:url", PAGE_URL);
    upsert("name", "theme-color", PAPER);
  }, []);

  const share = async () => {
    const data = { title: PAGE_TITLE, text: "افتتاح فرع الواحة — 11 نوفمبر 2026", url: PAGE_URL };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(PAGE_URL);
        alert("تم نسخ الرابط");
      }
    } catch {
      // أُلغيت المشاركة
    }
  };

  return (
    <main
      dir="rtl"
      className="relative min-h-[100svh] overflow-hidden w-full max-w-[100vw] font-tajawal"
      style={{ backgroundColor: PAPER, color: INK }}
    >
      <style>{`
        @keyframes alwahaSpin { to { transform: rotate(360deg); } }
        @keyframes alwahaTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes alwahaBlink { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .15; } }
        @keyframes alwahaIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .alwaha-in { animation: alwahaIn .8s cubic-bezier(.2,.7,.2,1) both; }
        html, body { overflow-x: hidden; max-width: 100vw; }
        .alwaha-strip { overflow: hidden; overflow-x: clip; contain: paint; }
        @media (prefers-reduced-motion: reduce) {
          .alwaha-in, [class*="animate-["] { animation: none !important; }
        }
      `}</style>

      {/* حبيبات ورق خفيفة + بقعة فنجان قهوة (حلقة) في الزاوية */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />
      <svg
        className="pointer-events-none absolute top-[38%] left-[22%] w-[260px] h-[260px] sm:w-[420px] sm:h-[420px] opacity-[0.08]"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <circle cx="100" cy="100" r="82" fill="none" stroke="#5a3a24" strokeWidth="9" strokeDasharray="230 40 120 30" strokeLinecap="round" />
        <circle cx="103" cy="97" r="76" fill="none" stroke="#5a3a24" strokeWidth="3" strokeDasharray="60 90 200 20" />
      </svg>

      {/* الترويسة — خط رفيع أعلى وأسفل كصحيفة */}
      <header className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        <div className="alwaha-in flex items-center justify-between py-4 border-b" style={{ borderColor: `${INK}33` }}>
          <a href="https://quarters.sa" className="flex items-center">
            <img src={BRAND_LOGO} alt="Quarters — كوارترز" className="h-12 sm:h-16 w-auto object-contain" />
          </a>
          <div className="hidden sm:block text-xs" style={{ color: `${INK}99` }}>
            الدمام — حي الواحة
          </div>
          <div className="text-xs sm:text-sm font-bold">
            {opened ? "افتتحنا" : "قريبًا"}
          </div>
        </div>
      </header>

      {/* المحتوى */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-6 md:gap-10">
          <div className="alwaha-in" style={{ animationDelay: ".1s" }}>
            <p className="text-sm sm:text-base font-bold" style={{ color: CLAY }}>
              نستعد لافتتاح فرعنا الرابع
            </p>
            <h1 className="mt-1 font-changa font-bold leading-[0.95] text-[72px] sm:text-[120px] md:text-[150px] lg:text-[190px]">
              <span className="block text-[0.32em] font-tajawal font-medium" style={{ color: `${INK}B3` }}>
                فرع
              </span>
              الواحة
            </h1>
          </div>
          <div className="alwaha-in justify-self-start md:justify-self-end md:mb-4" style={{ animationDelay: ".25s" }}>
            <Stamp opened={opened} />
          </div>
        </div>

        {/* سطر التاريخ */}
        <div
          className="alwaha-in mt-6 sm:mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-y py-3"
          style={{ borderColor: `${INK}33`, animationDelay: ".35s" }}
        >
          <span className="text-xs sm:text-sm" style={{ color: `${INK}99` }}>
            موعد الافتتاح
          </span>
          <span className="font-changa font-bold text-2xl sm:text-4xl leading-none">
            الأربعاء ١١ نوفمبر ٢٠٢٦
          </span>
          <span className="mr-auto font-changa text-base sm:text-xl" dir="ltr" style={{ color: CLAY }}>
            11 / 11 / 2026
          </span>
        </div>
        <div className="alwaha-in mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm sm:text-base" style={{ animationDelay: ".4s" }}>
          <span className="font-bold">الفرع الرابع لكوارترز</span>
          <span style={{ color: `${INK}99` }}>الموقع: الدمام — حي الواحة</span>
        </div>

        {/* العدّاد */}
        <div className="alwaha-in mt-6 sm:mt-10" style={{ animationDelay: ".45s" }} role="timer" aria-live="off">
          {opened ? (
            <div className="py-10 text-center">
              <div className="font-changa font-bold text-5xl sm:text-7xl">أهلًا بكم في فرع الواحة</div>
              <div className="mt-3 text-base sm:text-lg" style={{ color: `${INK}B3` }}>
                أبوابنا مفتوحة من اليوم — نتشرف بزيارتكم.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:flex sm:justify-between sm:items-stretch">
              <Digit value={pad2(days)} label="يوم" />
              <Digit value={pad2(hours)} label="ساعة" />
              <Digit value={pad2(minutes)} label="دقيقة" />
              <Digit value={pad2(seconds)} label="ثانية" last />
            </div>
          )}
        </div>

        {/* شريط التقدم + الأزرار */}
        <div
          className="alwaha-in mt-6 sm:mt-10 grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-6 border-t pt-6"
          style={{ borderColor: `${INK}33`, animationDelay: ".55s" }}
        >
          <div className="max-w-xl">
            <div className="flex items-center justify-between text-[11px] sm:text-xs mb-2" style={{ color: `${INK}99` }}>
              <span>الإعلان</span>
              <span>{Math.round(progress * 100)}٪</span>
              <span>الافتتاح</span>
            </div>
            <div className="h-[6px] w-full" style={{ backgroundColor: `${INK}1A` }}>
              <div
                className="h-full transition-[width] duration-1000"
                style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: INK }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={calendarHref()}
              download="alwaha-opening.ics"
              className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold transition hover:opacity-90 active:translate-y-px"
              style={{ backgroundColor: INK, color: PAPER }}
            >
              أضف الموعد إلى التقويم
            </a>
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-bold border-2 transition hover:bg-black/5 active:translate-y-px"
              style={{ borderColor: INK, color: INK }}
            >
              شارك
            </button>
          </div>
        </div>
      </section>

      {/* شريط متحرك أسفل الصفحة */}
      <div className="alwaha-strip relative z-10 mt-10 sm:mt-14 w-full max-w-[100vw] border-y" style={{ backgroundColor: INK, borderColor: INK }} dir="ltr">
        <div
          className="flex w-max whitespace-nowrap py-3 font-changa text-sm sm:text-lg animate-[alwahaTicker_40s_linear_infinite]"
          style={{ color: PAPER }}
          dir="ltr"
          aria-hidden="true"
        >
          <span className="px-4">{TICKER.repeat(4)}</span>
          <span className="px-4">{TICKER.repeat(4)}</span>
        </div>
      </div>

      <footer className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-6 flex items-center justify-between text-[11px] sm:text-xs" style={{ color: `${INK}80` }}>
        <span><span style={{ letterSpacing: "0.2em" }}>QUARTERS</span> · كوارترز</span>
        <a href="https://quarters.sa" className="hover:opacity-70">quarters.sa</a>
      </footer>
    </main>
  );
}
