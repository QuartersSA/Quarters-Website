export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ar-SA-u-nu-latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function monthLabel(month) {
  const value = month ? String(month) : "";
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;

  const year = Number(m[1]);
  const idx = Number(m[2]) - 1;

  const monthsAr = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  const name = monthsAr[idx] || value;
  return `${name} ${year}`;
}

export function buildRecentMonthOptions(count = 24) {
  const now = new Date();
  const options = [{ value: "", label: "اختر الشهر" }];

  for (let i = 0; i < count; i += 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const value = `${y}-${m}`;
    options.push({ value, label: monthLabel(value) });
  }

  return options;
}
