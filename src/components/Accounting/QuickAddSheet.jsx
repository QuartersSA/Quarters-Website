import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { ExpenseForm } from "@/components/Accounting/ExpenseForm";

/**
 * Modal wrapper that renders ExpenseForm on top of any expenses tab.
 * - Mobile (< lg): full-height bottom sheet that slides from below
 * - Desktop (≥ lg): centered dialog with overlay
 *
 * Closes on Escape, on overlay click, and after a successful submit
 * (handled by the wrapped onSubmit callback).
 */
export function QuickAddSheet({
  open,
  onClose,
  types,
  onSubmit,
  isSubmitting,
  onCreateType,
}) {
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // After a successful create, close.
  useEffect(() => {
    if (submittingRef.current && !isSubmitting) {
      submittingRef.current = false;
      onClose();
    }
    if (isSubmitting) submittingRef.current = true;
  }, [isSubmitting, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label="إضافة مصروف سريع"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`${ws.glass} ${ws.card} relative z-10 w-full lg:w-[640px] max-h-[92svh] overflow-y-auto p-5 rounded-t-3xl lg:rounded-3xl m-0 lg:m-4 shadow-2xl`}
      >
        <div className="flex items-center justify-between mb-4 sticky top-0 bg-transparent">
          <div>
            <div className="font-bold text-white tracking-tight">
              + إضافة مصروف سريع
            </div>
            <div className="text-xs text-white/55 mt-0.5">
              اكتب التفاصيل واحفظ — الإضافة تُسجَّل فوراً.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className={`${ws.iconButton}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ExpenseForm
          types={types}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          onCreateType={onCreateType}
        />
      </div>
    </div>
  );
}
