import { LOCALE } from "./dateUtils";

export const formatDateTime = (dateString) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateString);
  }
};

export const formatDateOnly = (dateString) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString(LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateString);
  }
};

export const statusLabel = (value) => {
  if (!value) return "—";
  if (value === "Todo") return "للإنجاز";
  if (value === "In Progress") return "قيد التنفيذ";
  if (value === "Done") return "مكتملة";
  return String(value);
};

export const priorityLabel = (value) => {
  if (!value) return "—";
  if (value === "Low") return "منخفضة";
  if (value === "Normal") return "عادية";
  if (value === "High") return "عالية";
  if (value === "Urgent") return "عاجلة";
  return String(value);
};

export const safeMeta = (raw) => {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
};

export const stringifyMaybeArray = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) {
    const cleaned = v.map((x) => String(x)).filter(Boolean);
    return cleaned.length ? cleaned.join(", ") : "—";
  }
  return String(v);
};

export const buildChangeLines = (diff, helpers) => {
  const { spaceNameById, userNameById } = helpers;
  const entries = diff && typeof diff === "object" ? Object.entries(diff) : [];

  const lines = [];

  for (const [key, change] of entries) {
    const fromVal = change?.from ?? null;
    const toVal = change?.to ?? null;

    let label = "";
    let fromText = "—";
    let toText = "—";

    if (key === "title") {
      label = "العنوان";
      fromText = stringifyMaybeArray(fromVal);
      toText = stringifyMaybeArray(toVal);
    } else if (key === "description") {
      label = "الوصف";
      fromText = stringifyMaybeArray(fromVal);
      toText = stringifyMaybeArray(toVal);
    } else if (key === "status") {
      label = "الحالة";
      fromText = statusLabel(fromVal);
      toText = statusLabel(toVal);
    } else if (key === "priority") {
      label = "الأولوية";
      fromText = priorityLabel(fromVal);
      toText = priorityLabel(toVal);
    } else if (key === "due_date") {
      label = "تاريخ الاستحقاق";
      fromText = formatDateOnly(fromVal);
      toText = formatDateOnly(toVal);
    } else if (key === "tags") {
      label = "الوسوم";
      fromText = stringifyMaybeArray(fromVal);
      toText = stringifyMaybeArray(toVal);
    } else if (key === "space_id") {
      label = "المساحة";
      fromText = spaceNameById(fromVal);
      toText = spaceNameById(toVal);
    } else if (key === "assignees") {
      label = "المكلفون";
      const fromIds = Array.isArray(fromVal) ? fromVal : [];
      const toIds = Array.isArray(toVal) ? toVal : [];
      const fromNames = fromIds.map(userNameById).join(", ") || "—";
      const toNames = toIds.map(userNameById).join(", ") || "—";
      fromText = fromNames;
      toText = toNames;
    } else if (key === "image_url") {
      label = "المرفق";
      fromText = fromVal ? "مرفق" : "—";
      toText = toVal ? "مرفق" : "—";
    } else if (key === "image_name") {
      label = "اسم المرفق";
      fromText = stringifyMaybeArray(fromVal);
      toText = stringifyMaybeArray(toVal);
    } else if (key === "closed_not_completed") {
      label = "إغلاق المهمة";
      fromText = fromVal ? "نعم" : "لا";
      toText = toVal ? "نعم" : "لا";
    }

    if (label) {
      lines.push({ label, fromText, toText });
    }
  }

  return lines;
};
