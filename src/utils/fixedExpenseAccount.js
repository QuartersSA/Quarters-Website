// كشف حسابات «المصروف الثابت» في شجرة الحسابات.
//
// الحساب يعتبر مصروفاً ثابتاً إذا كان اسمه (أو اسم أي أب في سلسلة
// آبائه) يجمع كلمتي «مصروف/مصاريف/مصروفات» و«ثابت» — يغطي التسميات
// الشائعة: «مصروف ثابت»، «المصروفات الثابتة»، «مصاريف ثابتة»…
// الفحص بالاسم لا بالكود لأن الشجرة قابلة للتعديل من المستخدم.

const normalizeArabic = (value) => String(value || "").replace(/[أإآ]/g, "ا");

export function isFixedExpenseName(name) {
  const normalized = normalizeArabic(name);
  return /(مصروف|مصاريف)/.test(normalized) && /ثابت/.test(normalized);
}

// هل الحساب نفسه أو أحد آبائه «مصروف ثابت»؟ يمشي سلسلة parent_id
// بسقف عمق يمنع الدوران لو فسدت الشجرة.
export function isFixedExpenseAccountId(accountId, accounts = []) {
  const id = Number(accountId);
  if (!Number.isInteger(id) || id <= 0) return false;
  const byId = new Map(accounts.map((account) => [Number(account.id), account]));
  let current = byId.get(id);
  let depth = 0;
  while (current && depth < 20) {
    if (isFixedExpenseName(current.name)) return true;
    current = current.parent_id ? byId.get(Number(current.parent_id)) : null;
    depth += 1;
  }
  return false;
}

// هل أي من الحسابات المحددة (بنود الفاتورة) مصروف ثابت؟
export function hasFixedExpenseAccount(accountIds = [], accounts = []) {
  return accountIds.some((accountId) =>
    isFixedExpenseAccountId(accountId, accounts),
  );
}
