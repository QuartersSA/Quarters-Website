"use client";

// صفحة مستقلة: العد التنازلي لافتتاح فرع «الواحة» — quarters.sa/alwaha
// بلا تسجيل دخول، داكنة بلمسة ذهبية/زمردية، متوافقة مع الجوال والكمبيوتر.

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MapPin, Share2, Sparkles } from "lucide-react";

const BRAND_LOGO =
  "https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/";

// موعد الافتتاح: 11 نوفمبر 2026 — بداية اليوم بتوقيت الرياض.
const OPENING_ISO = "2026-11-11T00:00:00+03:00";
const OPENING_AT = new Date(OPENING_ISO).getTime();
const BRANCH_NAME = "فرع الواحة";
const PAGE_URL = "https://quarters.sa/alwaha";

export function meta() {
  return [
    { title: "افتتاح فرع الواحة — Quarters" },
    {
      name: "description",
      content: "العد التنازلي لافتتاح فرع الواحة — كوارترز، 11 نوفمبر 2026.",
    },
    { property: "og:title", content: "افتتاح فرع الواحة — Quarters" },
    {
      property: "og:description",
      content: "نلتقيكم في 11 نوفمبر 2026. تابعوا العد التنازلي.",
    },
    { property: "og:image", content: BRAND_LOGO },
    { property: "og:url", content: PAGE_URL },
    { name: "theme-color", content: "#07110e" },
  ];
}

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function pad2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function diffParts(now) {
  const total = Math.max(OPENING_AT - now, 0);
  const seconds = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

function useCountdown() {
  // نبدأ بقيمة الخادم نفسها ثم نُحدّث كل ثانية على العميل — لا اختلاف
  // بين HTML الأولي والعميل (hydration).
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return { ...diffParts(now), mounted };
}

// بطاقة رقم واحدة (أيام/ساعات/…) مع وميض خفيف عند تغيّر القيمة.
function Unit({ value, label, accent = false }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 350);
    return () => clearTimeout(id);
  }, [value]);
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div
        className={`relative w-[72px] h-[84px] sm:w-[110px] sm:h-[124px] md:w-[136px] md:h-[150px] rounded-2xl sm:rounded-3xl overflow-hidden border ${
          accent
            ? "border-amber-300/40 bg-gradient-to-b from-amber-200/15 to-amber-500/5"
            : "border-white/10 bg-white/[0.04]"
        } backdrop-blur-xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.9)]`}
      >
        {/* خط المنتصف كأرقام الساعة القلّابة */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent" />
        <div
          className={`absolute inset-0 flex items-center justify-center font-cairo font-black tabular-nums text-[40px] sm:text-[60px] md:text-[76px] leading-none transition-transform duration-300 ${
            flash ? "scale-[1.04]" : "scale-100"
          } ${accent ? "text-amber-200" : "text-white"}`}
          dir="ltr"
        >
          {value}
        </div>
      </div>
      <span className="text-[11px] sm:text-sm md:text-base tracking-[0.25em] text-white/55 font-cairo">
        {label}
      </span>
    </div>
  );
}

function Separator() {
  return (
    <div
      className="hidden sm:flex flex-col items-center justify-center gap-3 h-[124px] md:h-[150px] text-amber-200/60 text-4xl font-black animate-pulse"
      aria-hidden="true"
    >
      :
    </div>
  );
}

// ملف تقويم .ics — يُحمَّل مباشرة من المتصفح (بلا خادم).
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
    `SUMMARY:افتتاح ${BRANCH_NAME} — Quarters`,
    `DESCRIPTION:${PAGE_URL}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

const PAGE_TITLE = "افتتاح فرع الواحة — Quarters";

export default function AlwahaOpeningPage() {
  const { days, hours, minutes, seconds, total, mounted } = useCountdown();
  const opened = mounted && total <= 0;

  // العنوان ووسوم المشاركة على العميل (تصدير meta لا يُعرض في هذا القالب).
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
    upsert("property", "og:description", "نلتقيكم في 11 نوفمبر 2026. تابعوا العد التنازلي.");
    upsert("property", "og:image", BRAND_LOGO);
    upsert("property", "og:url", PAGE_URL);
    upsert("name", "theme-color", "#07110e");
  }, []);

  // نسبة التقدم من تاريخ الإعلان (1 سبتمبر 2026) إلى الافتتاح — للحلقة.
  const progress = useMemo(() => {
    const start = new Date("2026-09-01T00:00:00+03:00").getTime();
    const span = OPENING_AT - start;
    const done = Math.min(Math.max(Date.now() - start, 0), span);
    return span > 0 ? done / span : 1;
  }, [seconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    const data = {
      title: "افتتاح فرع الواحة — Quarters",
      text: "نلتقيكم في افتتاح فرع الواحة 11 نوفمبر 2026 ☕",
      url: PAGE_URL,
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(PAGE_URL);
        alert("تم نسخ الرابط");
      }
    } catch {
      // المستخدم ألغى المشاركة
    }
  };

  // أرقام بالعربية الهندية للتاريخ فقط (العداد يبقى بأرقام لاتينية للوضوح).
  const arabicDate = "١١ نوفمبر ٢٠٢٦".replace(/[0-9]/g, (d) => AR_DIGITS[d]);

  return (
    <main
      dir="rtl"
      className="relative min-h-[100svh] overflow-hidden bg-[#07110e] text-white font-cairo selection:bg-amber-300/30"
    >
      {/* خلفية: تدرّج زمردي داكن + هالات ذهبية متحركة + حبيبات */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,122,95,0.35),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(120,80,20,0.25),transparent_60%)]" />
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] sm:w-[640px] sm:h-[640px] rounded-full bg-amber-400/15 blur-[120px] animate-[alwahaFloat_14s_ease-in-out_infinite]" />
        <div className="absolute -bottom-40 -left-32 w-[460px] h-[460px] sm:w-[700px] sm:h-[700px] rounded-full bg-emerald-500/15 blur-[130px] animate-[alwahaFloat_18s_ease-in-out_infinite_reverse]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* نجيمات ذهبية */}
        {[...Array(18)].map((_, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-amber-200/70 animate-[alwahaTwinkle_4s_ease-in-out_infinite]"
            style={{
              top: `${(i * 53) % 100}%`,
              left: `${(i * 37 + 11) % 100}%`,
              animationDelay: `${(i % 7) * 0.6}s`,
              opacity: 0.35 + ((i * 13) % 50) / 100,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes alwahaFloat { 0%,100% { transform: translate(0,0) scale(1);} 50% { transform: translate(-30px,40px) scale(1.08);} }
        @keyframes alwahaTwinkle { 0%,100% { opacity: .15; transform: scale(.8);} 50% { opacity: .9; transform: scale(1.3);} }
        @keyframes alwahaRise { from { opacity: 0; transform: translateY(18px);} to { opacity: 1; transform: translateY(0);} }
        .alwaha-rise { animation: alwahaRise .9s cubic-bezier(.2,.8,.2,1) both; }
      `}</style>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col items-center justify-between px-5 py-8 sm:px-8 sm:py-10">
        {/* الترويسة */}
        <header className="alwaha-rise flex w-full items-center justify-between">
          <a href="https://quarters.sa" className="flex items-center gap-3">
            <img
              src={BRAND_LOGO}
              alt="Quarters"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl object-cover ring-1 ring-white/15"
            />
            <span className="text-base sm:text-lg font-bold tracking-wide text-white/90">
              Quarters
            </span>
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] sm:text-xs font-bold text-amber-200">
            <MapPin className="h-3.5 w-3.5" />
            قريبًا — الواحة
          </span>
        </header>

        {/* المحتوى */}
        <section className="flex w-full flex-col items-center text-center">
          <div
            className="alwaha-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs sm:text-sm text-white/70"
            style={{ animationDelay: ".1s" }}
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            {opened ? "افتتحنا أبوابنا" : "نستعد لاستقبالكم"}
          </div>

          <h1
            className="alwaha-rise mt-5 text-[34px] leading-[1.15] sm:text-6xl md:text-7xl font-black"
            style={{ animationDelay: ".2s" }}
          >
            افتتاح{" "}
            <span className="bg-gradient-to-l from-amber-200 via-amber-300 to-yellow-100 bg-clip-text text-transparent">
              فرع الواحة
            </span>
          </h1>

          <p
            className="alwaha-rise mt-4 max-w-xl text-sm sm:text-lg text-white/65 leading-relaxed"
            style={{ animationDelay: ".3s" }}
          >
            {opened
              ? "فرع الواحة يفتح أبوابه اليوم — نتشرف بزيارتكم."
              : "قهوتكم المفضلة تقترب من الواحة. نلتقيكم يوم"}
            {!opened ? (
              <span className="block mt-1 text-amber-200 font-bold text-base sm:text-xl" dir="rtl">
                الأربعاء {arabicDate}
              </span>
            ) : null}
          </p>

          {/* العدّاد */}
          <div
            className="alwaha-rise mt-8 sm:mt-12 flex items-start justify-center gap-2.5 sm:gap-4 md:gap-5"
            style={{ animationDelay: ".4s" }}
            role="timer"
            aria-live="off"
          >
            {opened ? (
              <div className="rounded-3xl border border-amber-300/40 bg-amber-300/10 px-8 py-6 text-2xl sm:text-4xl font-black text-amber-200">
                🎉 أهلًا بكم في فرع الواحة
              </div>
            ) : (
              <>
                <Unit value={pad2(days)} label="يوم" accent />
                <Separator />
                <Unit value={pad2(hours)} label="ساعة" />
                <Separator />
                <Unit value={pad2(minutes)} label="دقيقة" />
                <Separator />
                <Unit value={pad2(seconds)} label="ثانية" />
              </>
            )}
          </div>

          {/* شريط التقدم */}
          {!opened ? (
            <div
              className="alwaha-rise mt-8 w-full max-w-md"
              style={{ animationDelay: ".5s" }}
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-amber-300 to-emerald-400 transition-[width] duration-1000"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-white/40">
                <span>الإعلان</span>
                <span>الافتتاح</span>
              </div>
            </div>
          ) : null}

          {/* الأزرار */}
          <div
            className="alwaha-rise mt-8 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: ".6s" }}
          >
            <a
              href={calendarHref()}
              download="alwaha-opening.ics"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-l from-amber-300 to-yellow-200 px-5 py-3 text-sm font-bold text-[#1a1305] shadow-[0_10px_30px_-10px_rgba(251,191,36,0.6)] transition hover:brightness-105 active:scale-[0.98]"
            >
              <CalendarPlus className="h-4 w-4" />
              أضف الموعد إلى التقويم
            </a>
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white/85 backdrop-blur transition hover:bg-white/[0.09] active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              شارك الصفحة
            </button>
          </div>
        </section>

        {/* التذييل */}
        <footer
          className="alwaha-rise mt-10 flex w-full flex-col items-center gap-1 text-center text-[11px] sm:text-xs text-white/35"
          style={{ animationDelay: ".7s" }}
        >
          <span>Quarters · كوارترز</span>
          <a href="https://quarters.sa" className="hover:text-white/60 transition">
            quarters.sa
          </a>
        </footer>
      </div>
    </main>
  );
}
