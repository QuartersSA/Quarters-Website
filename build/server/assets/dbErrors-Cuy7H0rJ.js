// خطأ قاعدة البيانات → رسالة عربية مفهومة + التفاصيل الأصلية وكود
// Postgres، بدل رسالة عامة («Failed to update …») لا تدل على السبب.
// تُستخدم في catch مسارات الكتابة.
function describeDbError(error, fallback) {
  const code = String(error?.code || "");
  const detail = String(error?.detail || error?.message || "");
  const constraint = error?.constraint ? ` (${error.constraint})` : "";
  let message = fallback;
  let status = 500;
  if (code === "23503") {
    message = `السجل مرتبط بسجلات أخرى تمنع هذا التعديل${constraint}`;
    status = 409;
  } else if (code === "23505") {
    message = `قيمة مكررة — يوجد سجل آخر بنفس البيانات${constraint}`;
    status = 409;
  } else if (code === "23502") {
    message = `حقل مطلوب فارغ${error?.column ? ` (${error.column})` : ""}`;
    status = 400;
  } else if (code === "23514") {
    message = `قيمة لا تحقق شرط التحقق${constraint}`;
    status = 400;
  } else if (code === "22003") {
    message = "قيمة رقمية أكبر من المسموح";
    status = 400;
  } else if (code === "22P02" || code === "22007" || code === "22008") {
    message = "قيمة غير صالحة في أحد الحقول";
    status = 400;
  } else if (code === "42703") {
    message = "عمود غير موجود في قاعدة البيانات — أعد تحميل الصفحة وحاول مجددًا";
    status = 500;
  }
  return {
    message,
    status,
    code: code || null,
    details: detail || null
  };
}
function dbErrorResponse(error, fallback) {
  const {
    message,
    status,
    code,
    details
  } = describeDbError(error, fallback);
  return Response.json({
    error: message,
    code,
    details
  }, {
    status
  });
}

export { dbErrorResponse as d };
