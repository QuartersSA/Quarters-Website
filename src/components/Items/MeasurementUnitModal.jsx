"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Ruler } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Small modal for adding a new measurement unit to the global
 * catalog. Fired from the unit dropdown inside ItemUnitsPanel via
 * the "+ إنشاء وحدة قياس" option. Bilingual: name_ar required,
 * name_en optional — matches the Wafeq-style screenshot.
 *
 * onSaved gets the freshly-created (or upserted) catalog row so
 * the parent can splice it into its options list and auto-select
 * it for the row that triggered the create.
 */
export default function MeasurementUnitModal({
  isOpen,
  onClose,
  onSaved,
}) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || typeof document === "undefined") return null;

  const reset = () => {
    setNameAr("");
    setNameEn("");
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nameAr.trim()) {
      setError("الاسم بالعربية مطلوب");
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch("/api/measurement-units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name_ar: nameAr.trim(),
          name_en: nameEn.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "فشل حفظ الوحدة");
      }
      const row = await res.json();
      onSaved?.(row);
      reset();
      onClose?.();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  // Portal to document.body so this modal escapes its parent
  // (which is the ItemFormModal / PurchaseItemModal <form>).
  // Without the portal the inner submit button was being treated
  // as a submit for the OUTER form — HTML disallows nested <form>
  // tags, so the browser collapsed them and the parent modal
  // closed/submitted whenever the operator added a new unit.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4"
      dir="rtl"
      onMouseDown={(e) => {
        // Backdrop click closes this modal only — don't let the
        // event bubble up and dismiss the parent modal underneath.
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          handleClose();
        }
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-md shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`p-5 flex items-center justify-between shrink-0 ${ws.topBar}`}
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
            <div className={`${ws.iconBox} w-9 h-9 text-slate-700 dark:text-white/80`}>
              <Ruler className="w-4 h-4" />
            </div>
            إضافة وحدة قياس
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
              الاسم بالعربية <span className="text-red-700 dark:text-red-300">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              className={`${ws.input} px-4 py-3`}
              placeholder="مثال: شدة"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-white/70 text-sm font-semibold mb-2">
              الاسم بالإنجليزية{" "}
              <span className="text-slate-500 dark:text-white/40 text-xs">(اختياري)</span>
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className={`${ws.input} px-4 py-3`}
              placeholder="Example: Pack"
              dir="ltr"
            />
          </div>

          {error ? (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl">
              <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50`}
            >
              {saving ? "جاري الحفظ…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
