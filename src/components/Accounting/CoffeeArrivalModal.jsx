"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, Loader2, PackageCheck, Undo2, X } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import {
  computeCoffeeLine,
  numOrNull,
  wasteFlag,
  WASTE_CONFIRM,
} from "@/utils/coffeeMath";

// نافذة تسجيل وصول بنود البن لفاتورة مشتريات: الكمية الواصلة لكل
// بند، تاريخ الوصول، «الوصول مكتمل»، ملاحظة، والإيداع في المخزون.
// المعاينة الحية (الهدر، صافي الكيلو شامل الضريبة) بنفس معادلات
// الخادم. المعتمِد يحفظ فعليًا؛ موظف الإدخال الميداني يبلّغ فقط.

function todayKey() {
  const now = new Date();
  const riyadh = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return riyadh.toISOString().slice(0, 10);
}

function fmt(value, digits = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function rowsFromInvoice(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  return items
    .filter((item) => item.roast_enabled)
    .map((item) => ({
      id: item.id,
      name: item.bean_name || item.description || `بند #${item.id}`,
      raw_kg: numOrNull(item.raw_kg) ?? 0,
      sacks: numOrNull(item.sacks),
      quantity_unit: item.quantity_unit,
      line_subtotal: Number(item.line_subtotal) || 0,
      line_tax: Number(item.line_tax) || 0,
      line_discount: Number(item.line_discount) || 0,
      line_net: Number(item.line_net) || 0,
      quantity: Number(item.quantity) || 0,
      kg_per_sack: numOrNull(item.kg_per_sack),
      roast_per_kg: numOrNull(item.roast_per_kg) ?? 0,
      roast_tax_rate: numOrNull(item.roast_tax_rate) ?? 0,
      extra_cost: numOrNull(item.extra_cost) ?? 0,
      deposited_kg: numOrNull(item.deposited_kg),
      reported_kg: numOrNull(item.arrival_reported_kg),
      reported_by: item.arrival_reported_by || null,
      // حقول النموذج
      received_kg:
        item.received_kg != null
          ? String(Number(item.received_kg))
          : item.arrival_reported_kg != null
            ? String(Number(item.arrival_reported_kg))
            : "",
      arrival_date: item.arrival_date || "",
      arrival_complete: !!item.arrival_complete,
      arrival_note: item.arrival_note || "",
      confirm_high_waste: false,
      was_received: item.received_kg != null,
    }));
}

export default function CoffeeArrivalModal({
  invoice,
  branches = [],
  canFinalize = true,
  isSubmitting = false,
  onClose,
  onSubmit,
  onReverseDeposit,
}) {
  const [rows, setRows] = useState(() => rowsFromInvoice(invoice));
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [depositBranchId, setDepositBranchId] = useState(
    invoice?.branch_id ? String(invoice.branch_id) : "",
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    setRows(rowsFromInvoice(invoice));
    setDepositBranchId(invoice?.branch_id ? String(invoice.branch_id) : "");
  }, [invoice]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const updateRow = (id, patch) => {
    setError(null);
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const calcs = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const received = numOrNull(row.received_kg);
      map.set(
        row.id,
        computeCoffeeLine({
          quantity: row.quantity,
          quantityUnit: row.quantity_unit,
          kgPerSack: row.kg_per_sack,
          lineSubtotal: row.line_subtotal,
          lineTax: row.line_tax,
          lineDiscount: row.line_discount,
          discountFactor: row.line_subtotal > 0 ? row.line_net / row.line_subtotal : 1,
          roastPerKg: row.roast_per_kg,
          roastTaxRate: row.roast_tax_rate,
          extraCost: row.extra_cost,
          receivedKg: received,
          arrivalComplete: row.arrival_complete,
        }),
      );
    }
    return map;
  }, [rows]);

  const anyComplete = rows.some(
    (row) => row.arrival_complete && numOrNull(row.received_kg) > 0,
  );
  const anyDeposited = rows.some((row) => (row.deposited_kg || 0) > 0);
  const needsHighWasteConfirm = rows.some((row) => {
    const c = calcs.get(row.id);
    return c?.arrivalComplete && c.wastePercent > WASTE_CONFIRM && !row.confirm_high_waste;
  });

  const handleSubmit = (event) => {
    event?.preventDefault?.();
    setError(null);
    const lines = [];
    for (const row of rows) {
      const received = numOrNull(row.received_kg);
      // فارغ + لم يكن مسجّلًا = لا تغيير؛ فارغ + كان مسجّلًا = إلغاء.
      if (received === null && !row.was_received) continue;
      if (received !== null && received > row.raw_kg + 0.0005) {
        setError(
          `«${row.name}»: الواصل (${received} كغ) أكبر من الكيلو الخام (${row.raw_kg} كغ)`,
        );
        return;
      }
      lines.push({
        id: row.id,
        received_kg: received,
        arrival_date: row.arrival_date || todayKey(),
        arrival_complete: received !== null && !!row.arrival_complete,
        arrival_note: row.arrival_note.trim() || null,
        confirm_high_waste: !!row.confirm_high_waste,
      });
    }
    if (!lines.length) {
      setError("أدخل الكمية الواصلة لبند واحد على الأقل");
      return;
    }
    if (canFinalize && depositEnabled && anyComplete && !depositBranchId) {
      setError("اختر فرع الإيداع أو أطفئ الإيداع");
      return;
    }
    onSubmit({
      invoice_id: invoice.id,
      expected_updated_at: invoice.updated_at || undefined,
      lines,
      deposit:
        canFinalize && depositEnabled && anyComplete
          ? { enabled: true, branch_id: Number(depositBranchId) }
          : null,
    });
  };

  if (typeof document === "undefined") return null;

  const tile = "rounded-lg bg-white/70 dark:bg-white/[0.04] border border-amber-200/60 dark:border-amber-400/15 px-2 py-1 min-w-0";
  const tileLabel = "text-[10px] text-slate-500 dark:text-white/45 truncate";
  const tileValue = "text-xs font-bold tabular-nums text-slate-800 dark:text-white/85";

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div
        className={`${ws.glassSoft} ${ws.card} w-full max-w-3xl max-h-[92svh] flex flex-col overflow-hidden`}
      >
        <div className={`flex items-center gap-2 px-4 py-3 border-b ${ws.divider} shrink-0`}>
          <Flame className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className={`${ws.title} text-sm truncate`}>
              تسجيل وصول البن — {invoice?.invoice_number}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45 truncate">
              {invoice?.contact_name || invoice?.supplier_name || "بدون مورد"}
              {!canFinalize ? " · وضع الإبلاغ (بانتظار اعتماد الإدارة)" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-8 h-8`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-4 space-y-3">
          {rows.length === 0 ? (
            <div className={`${ws.muted} text-sm text-center py-6`}>
              لا بنود بن في هذه الفاتورة.
            </div>
          ) : null}

          {rows.map((row) => {
            const c = calcs.get(row.id);
            const flag = c ? wasteFlag(c.wastePercent) : null;
            const received = numOrNull(row.received_kg);
            return (
              <div
                key={row.id}
                className="rounded-xl border border-amber-300/70 dark:border-amber-400/25 bg-amber-50/70 dark:bg-amber-400/[0.05] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {row.name}
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-white/55" dir="ltr">
                    {row.sacks != null && row.quantity_unit !== "kg"
                      ? `${row.sacks} × ${row.kg_per_sack ?? "?"} كغ = `
                      : ""}
                    {row.raw_kg} كغ خام
                  </div>
                </div>

                {row.reported_kg != null && !row.was_received ? (
                  <div className="text-[11px] text-sky-700 dark:text-sky-200">
                    بلاغ ميداني: {row.reported_kg} كغ
                    {row.reported_by ? ` — ${row.reported_by}` : ""} (يُعتمد بالحفظ)
                  </div>
                ) : null}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <label className="block">
                    <span className="text-[10px] text-slate-500 dark:text-white/45 block mb-0.5">
                      الكمية الواصلة (كغ)
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.received_kg}
                      onChange={(event) =>
                        updateRow(row.id, { received_kg: event.target.value })
                      }
                      className={`${ws.input} px-2 py-1.5 text-sm text-center`}
                      dir="ltr"
                      placeholder={row.was_received ? "فارغ = إلغاء الوصول" : "لم يصل"}
                      disabled={(row.deposited_kg || 0) > 0}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] text-slate-500 dark:text-white/45 block mb-0.5">
                      تاريخ الوصول
                    </span>
                    <input
                      type="date"
                      value={row.arrival_date}
                      max={todayKey()}
                      onChange={(event) =>
                        updateRow(row.id, { arrival_date: event.target.value })
                      }
                      className={`${ws.input} px-2 py-1.5 text-sm`}
                      disabled={(row.deposited_kg || 0) > 0}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-white/70 cursor-pointer select-none pb-2">
                    <input
                      type="checkbox"
                      checked={row.arrival_complete}
                      onChange={(event) =>
                        updateRow(row.id, { arrival_complete: event.target.checked })
                      }
                      className="accent-[#0e7a5f]"
                      disabled={(row.deposited_kg || 0) > 0 || !canFinalize}
                    />
                    الوصول مكتمل
                  </label>
                  <div className={tile}>
                    <div className={tileLabel}>الهدر · صافي/كغ شامل</div>
                    <div
                      className={`${tileValue} ${
                        flag === "high" || flag === "confirm" || flag === "over"
                          ? "text-rose-700 dark:text-rose-200"
                          : flag === "low"
                            ? "text-amber-700 dark:text-amber-200"
                            : ""
                      }`}
                      dir="ltr"
                    >
                      {c?.arrivalComplete
                        ? `${fmt(c.wastePercent, 2)}% · ${fmt(c.netInclPerKg)}`
                        : received !== null && received > 0
                          ? "جزئي"
                          : "—"}
                    </div>
                  </div>
                </div>

                {c?.arrivalComplete && (flag === "high" || flag === "low") ? (
                  <div className="text-[11px] text-amber-700 dark:text-amber-200">
                    نسبة الهدر {fmt(c.wastePercent, 2)}% خارج المعتاد (5–30%) — تحقق من الكمية.
                  </div>
                ) : null}
                {c?.arrivalComplete && flag === "over" ? (
                  <div className="text-[11px] text-rose-700 dark:text-rose-200">
                    الواصل أكبر من الخام — الهدر سالب. تحقق من الكيلو الخام أو الواصل.
                  </div>
                ) : null}
                {c?.arrivalComplete && flag === "confirm" ? (
                  <label className="flex items-start gap-2 text-[11px] text-rose-700 dark:text-rose-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={row.confirm_high_waste}
                      onChange={(event) =>
                        updateRow(row.id, { confirm_high_waste: event.target.checked })
                      }
                      className="accent-rose-500 mt-0.5"
                    />
                    <span>
                      هدر {fmt(c.wastePercent, 2)}% غير اعتيادي (أكثر من {WASTE_CONFIRM}%) —
                      أكّده مع ملاحظة.
                    </span>
                  </label>
                ) : null}

                <input
                  type="text"
                  value={row.arrival_note}
                  onChange={(event) => updateRow(row.id, { arrival_note: event.target.value })}
                  className={`${ws.input} px-2.5 py-1.5 text-xs`}
                  placeholder="ملاحظة (اختياري) — مثال: خيشة تالفة"
                />

                {(row.deposited_kg || 0) > 0 ? (
                  <div className="text-[11px] text-sky-700 dark:text-sky-200">
                    مودَع في المخزون {row.deposited_kg} كغ — لتعديل الواصل اعكس الإيداع أولًا.
                  </div>
                ) : null}
              </div>
            );
          })}

          {canFinalize && rows.length > 0 ? (
            <div className={`${ws.glass} ${ws.card} p-3 space-y-2`}>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-white/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={depositEnabled}
                  onChange={(event) => setDepositEnabled(event.target.checked)}
                  className="accent-[#0e7a5f]"
                />
                <PackageCheck className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
                إيداع الكمية الواصلة في المخزون عند اكتمال الوصول
              </label>
              {depositEnabled ? (
                <GlassSelect
                  value={depositBranchId}
                  onChange={setDepositBranchId}
                  options={[
                    { value: "", label: "اختر فرع الإيداع…" },
                    ...branches.map((branch) => ({
                      value: String(branch.id),
                      label: branch.name,
                    })),
                  ]}
                  placeholder="اختر فرع الإيداع…"
                  buttonClassName="text-sm py-2 px-3"
                />
              ) : null}
              <div className="text-[11px] text-slate-500 dark:text-white/45 leading-relaxed">
                الإيداع بالكمية الواصلة (بعد الهدر) وبتاريخ الوصول، وتكلفة الصنف
                تُحدَّث إلى صافي الكيلو شامل الضريبة من آخر فاتورة مكتملة الوصول.
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-rose-300 dark:border-rose-400/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200">
              {error}
            </div>
          ) : null}
        </form>

        <div className={`flex items-center gap-2 px-4 py-3 border-t ${ws.divider} shrink-0 flex-wrap`}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rows.length === 0 || needsHighWasteConfirm}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-50`}
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            {canFinalize ? "حفظ الوصول" : "إبلاغ الكمية"}
          </button>
          {canFinalize && anyDeposited && onReverseDeposit ? (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "عكس إيداع هذه الفاتورة من المخزون؟ تُحذف إيصالات الإيداع ويُعاد حساب تكلفة الصنف.",
                  )
                ) {
                  onReverseDeposit({
                    invoice_id: invoice.id,
                    expected_updated_at: invoice.updated_at || undefined,
                    reverse_deposit: true,
                  });
                }
              }}
              disabled={isSubmitting}
              className={`${ws.btnNeutral} px-4 py-2 text-sm hover:text-rose-700 dark:hover:text-rose-200`}
            >
              <Undo2 className="w-4 h-4" />
              عكس الإيداع
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} px-4 py-2 text-sm mr-auto`}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
