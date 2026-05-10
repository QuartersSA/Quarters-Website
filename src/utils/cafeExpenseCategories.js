/**
 * Preset expense categories tailored for café/coffee-bar operations.
 * Used to bulk-seed `expense_types` for new accounts so the operator
 * doesn't have to type "إيجار / رواتب / حليب / بن / ..." themselves.
 *
 * `kind` is informational — both kinds use the same expense_types table;
 * the variable expense form just consumes the names.
 */

export const CAFE_EXPENSE_CATEGORIES = [
  // ── المصروفات الثابتة (fixed) ──
  { name: "إيجار", kind: "fixed" },
  { name: "رواتب", kind: "fixed" },
  { name: "اشتراكات (نت / POS / محاسبة)", kind: "fixed" },
  { name: "اشتراكات تطبيقات التوصيل", kind: "fixed" },
  { name: "تأمين", kind: "fixed" },
  { name: "صيانة دورية", kind: "fixed" },
  { name: "رسوم بلدية وتراخيص", kind: "fixed" },

  // ── المواد الخام (raw materials) ──
  { name: "بن", kind: "variable" },
  { name: "حليب", kind: "variable" },
  { name: "شراب ونكهات", kind: "variable" },
  { name: "سكر", kind: "variable" },
  { name: "شوكلت", kind: "variable" },
  { name: "فواكه", kind: "variable" },

  // ── تشغيلية متغيّرة ──
  { name: "أكواب وتغليف", kind: "variable" },
  { name: "صيانة طارئة", kind: "variable" },
  { name: "تنظيف", kind: "variable" },
  { name: "مواصلات وتوصيل", kind: "variable" },
  { name: "تسويق", kind: "variable" },
  { name: "ضيافة وعينات", kind: "variable" },
  { name: "نثريات", kind: "variable" },
];

export function isCategoryPresent(name, types) {
  if (!Array.isArray(types) || !name) return false;
  const normalized = String(name).trim();
  return types.some((t) => String(t?.name || "").trim() === normalized);
}

/** Returns the preset categories that don't already exist in `types`. */
export function getMissingPresetCategories(types) {
  return CAFE_EXPENSE_CATEGORIES.filter(
    (c) => !isCategoryPresent(c.name, types),
  );
}
