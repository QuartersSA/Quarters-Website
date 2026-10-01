// تشغيل تهيئة المخطط (CREATE TABLE / ALTER TABLE…) مرة واحدة لكل عملية
// خادم بدل كل طلب: كل عبارة DDL رحلة شبكة مستقلة إلى Neon عبر HTTP، وكانت
// معظم المسارات تعيدها في كل طلب فتضيف ثواني قبل الاستعلام الفعلي.
// الوعد يُخزَّن؛ وإن فشل يُعاد في الطلب التالي حتى لا تعلق التهيئة.
export function ensureOnce(fn) {
  let promise = null;
  return function ensured() {
    if (!promise) {
      promise = Promise.resolve()
        .then(fn)
        .catch((error) => {
          promise = null;
          throw error;
        });
    }
    return promise;
  };
}
