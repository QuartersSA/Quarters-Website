// GET /api/alwaha/opening.ics — ملف تقويم موعد افتتاح فرع الواحة.
// عام (بلا مصادقة): iOS Safari لا يفتح روابط data:text/calendar، بل يحتاج
// ملفًا حقيقيًا بنوع text/calendar ليعرض «إضافة إلى التقويم».

const PAGE_URL = "https://quarters.sa/alwaha";
const MAP_URL = "https://maps.app.goo.gl/3w1HQiLNErsxoY3F8";

function icsEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export async function GET() {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quarters//Alwaha Opening//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:alwaha-opening-2026@quarters.sa",
    "DTSTAMP:20260901T000000Z",
    "DTSTART;VALUE=DATE:20261111",
    "DTEND;VALUE=DATE:20261112",
    `SUMMARY:${icsEscape("افتتاح فرع الواحة — Quarters")}`,
    `LOCATION:${icsEscape(`الدمام — حي الواحة — ${MAP_URL}`)}`,
    `DESCRIPTION:${icsEscape(`الفرع الرابع لكوارترز\nالموقع على الخريطة: ${MAP_URL}\n${PAGE_URL}`)}`,
    `URL:${PAGE_URL}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape("غدًا افتتاح فرع الواحة — Quarters")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const body = lines.join("\r\n") + "\r\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="alwaha-opening.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
