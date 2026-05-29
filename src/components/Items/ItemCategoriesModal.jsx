import { useMemo, useState } from "react";
import { Layers, Plus, X, Languages, Pencil, Check, Ban } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export default function ItemCategoriesModal({
  isOpen,
  onClose,
  categories,
  createMutation,
  updateMutation,
}) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [localError, setLocalError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  const sorted = useMemo(() => {
    const list = Array.isArray(categories) ? categories : [];
    return [...list].sort((a, b) =>
      String(a.name).localeCompare(String(b.name)),
    );
  }, [categories]);

  if (!isOpen) {
    return null;
  }

  const startEdit = (c) => {
    setLocalError(null);
    setEditingId(c.id);
    setEditName(c.name || "");
    setEditNameEn(c.name_en || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditNameEn("");
  };

  const onCreate = async (e) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedAr = String(name || "").trim();
    const trimmedEn = String(nameEn || "").trim();

    if (!trimmedAr) {
      setLocalError("اسم الفئة (عربي) مطلوب");
      return;
    }

    if (!trimmedEn) {
      setLocalError("اسم الفئة (إنجليزي) مطلوب");
      return;
    }

    try {
      await createMutation.mutateAsync({ name: trimmedAr, name_en: trimmedEn });
      setName("");
      setNameEn("");
    } catch (err) {
      console.error(err);
      setLocalError(err?.message || "فشل إضافة الفئة");
    }
  };

  const onSaveEdit = async (id) => {
    setLocalError(null);

    const trimmedAr = String(editName || "").trim();
    const trimmedEn = String(editNameEn || "").trim();

    if (!trimmedAr) {
      setLocalError("اسم الفئة (عربي) مطلوب");
      return;
    }

    if (!trimmedEn) {
      setLocalError("اسم الفئة (إنجليزي) مطلوب");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id,
        name: trimmedAr,
        name_en: trimmedEn,
      });
      cancelEdit();
    } catch (err) {
      console.error(err);
      setLocalError(err?.message || "فشل تعديل الفئة");
    }
  };

  const saving = createMutation?.isPending;
  const updating = updateMutation?.isPending;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      dir="rtl"
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-xl shadow-2xl my-8 flex flex-col`}
        style={{ maxHeight: "calc(100vh - 64px)" }}
      >
        <div
          className={`p-6 flex items-center justify-between shrink-0 ${ws.topBar}`}
        >
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
              <Layers className="w-5 h-5" />
            </div>
            إدارة فئات الأصناف
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={onCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${ws.input} px-4 py-3`}
                placeholder="اسم الفئة (عربي) — مثال: بن القهوة"
                disabled={saving}
                dir="rtl"
              />
              <div className="relative">
                <Languages className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/35" />
                <input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className={`${ws.input} pl-11 pr-4 py-3`}
                  placeholder="Category name (English) — Example: Coffee beans"
                  disabled={saving}
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`${ws.btnPrimary} px-5 py-3 justify-center disabled:opacity-50 w-full sm:w-auto`}
            >
              <Plus className="w-5 h-5" />
              {saving ? "جاري الإضافة…" : "إضافة"}
            </button>
          </form>

          {localError ? (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-200 text-sm">
              {localError}
            </div>
          ) : null}

          <div className="mt-6">
            <div className="text-sm text-slate-600 dark:text-white/55 mb-3">
              الفئات ({sorted.length})
            </div>

            {sorted.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-white/45 border border-slate-200 dark:border-white/10 rounded-3xl bg-slate-50 dark:bg-white/[0.03]">
                ما فيه فئات حتى الآن. أضف أول فئة.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sorted.map((c) => {
                  const isEditing = editingId === c.id;

                  return (
                    <div
                      key={c.id}
                      className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3`}
                    >
                      {!isEditing ? (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-white/90 font-semibold truncate">
                              {c.name}
                            </div>
                            <div
                              className="text-slate-600 dark:text-white/55 text-sm mt-1 truncate"
                              dir="ltr"
                            >
                              {c.name_en || "-"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => startEdit(c)}
                            className={`${ws.iconButton} text-sky-200`}
                            aria-label="تعديل"
                            title="تعديل"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={`${ws.input} px-4 py-2`}
                            placeholder="اسم الفئة (عربي)"
                            disabled={updating}
                            dir="rtl"
                          />
                          <input
                            value={editNameEn}
                            onChange={(e) => setEditNameEn(e.target.value)}
                            className={`${ws.input} px-4 py-2`}
                            placeholder="Category name (English)"
                            disabled={updating}
                            dir="ltr"
                          />

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => onSaveEdit(c.id)}
                              disabled={updating}
                              className={`${ws.btnPrimary} px-4 py-2 justify-center flex-1 disabled:opacity-50`}
                            >
                              <Check className="w-4 h-4" />
                              {updating ? "جاري الحفظ…" : "حفظ"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={updating}
                              className={`${ws.btnNeutral} px-4 py-2 justify-center disabled:opacity-50`}
                              title="إلغاء"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 text-xs text-slate-500 dark:text-white/40">
              ملاحظة: حذف الفئات غير مفعّل حاليًا لتجنب مشاكل مع الأصناف المرتبطة.
            </div>
          </div>

          <div className={`mt-6 pt-4 border-t ${ws.divider} flex gap-3`}>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-6 py-3 justify-center flex-1`}
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
