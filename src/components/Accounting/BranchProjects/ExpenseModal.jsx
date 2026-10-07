"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { useSaveBranchProjectInvoice } from "@/hooks/useBranchProjects";
import { ESTABLISHMENT_ACCOUNTS } from "@/utils/branchProjectMath";
import { queryKeys } from "@/utils/queryKeys";
import { ModalShell, FieldLabel, formatMoney } from "./shared";

// نافذة «القسم والحساب» لفاتورة مرتبطة بالمشروع: الفاتورة نفسها تُنشأ
// وتُعدَّل من فواتير المشتريات؛ هنا فقط نسبتها إلى قسم وحساب تأسيس (53).
// PUT /api/accounting/branch-projects/[id]/invoices/[invoiceId]
// { phase_id, expense_account_code }

function knownAccountCode(code) {
  const text = String(code || "");
  return (ESTABLISHMENT_ACCOUNTS || []).some((a) => String(a.code) === text) ? text : "";
}

export default function ExpenseModal({ open, project, invoice, onClose }) {
  const queryClient = useQueryClient();
  const saveMut = useSaveBranchProjectInvoice();
  const [phaseId, setPhaseId] = useState("");
  const [accountCode, setAccountCode] = useState("");

  useEffect(() => {
    if (!open) return;
    setPhaseId(invoice?.phase_id != null ? String(invoice.phase_id) : "");
    setAccountCode(knownAccountCode(invoice?.expense_account_code));
  }, [open, invoice]);

  const phaseOptions = useMemo(() => {
    const phases = Array.isArray(project?.phases) ? [...project.phases] : [];
    phases.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return [{ value: "", label: "بلا قسم" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))];
  }, [project?.phases]);

  const accountOptions = useMemo(
    () => [
      { value: "", label: "إبقاء الحساب الحالي" },
      ...(Array.isArray(ESTABLISHMENT_ACCOUNTS) ? ESTABLISHMENT_ACCOUNTS : []).map((a) => ({
        value: String(a.code),
        label: `${a.code} — ${a.name}`,
      })),
    ],
    [],
  );

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || !invoice?.id || saveMut.isPending) return;
    const payload = {
      project_id: project.id,
      id: invoice.id,
      phase_id: phaseId ? Number(phaseId) : null,
    };
    if (accountCode) payload.expense_account_code = accountCode;
    saveMut.mutate(payload, {
      onSuccess: () => {
        // قائمة فواتير المشتريات تعرض القسم والحساب أيضاً.
        queryClient.invalidateQueries({ queryKey: queryKeys.accountingPurchaseInvoices() });
        onClose?.();
      },
    });
  }

  const currentAccount = invoice?.expense_account_code
    ? `${invoice.expense_account_code}${invoice.expense_account_name ? ` — ${invoice.expense_account_name}` : ""}`
    : "غير مصنّف";

  return (
    <ModalShell
      open={open}
      title="القسم والحساب"
      description="تعديل بيانات الفاتورة نفسها (المبالغ، المورد…) يكون من فواتير المشتريات"
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={`${ws.btnNeutral} px-4 py-2 text-sm`}>
            إلغاء
          </button>
          <button
            type="submit"
            form="branch-expense-form"
            disabled={saveMut.isPending}
            className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </button>
        </>
      }
    >
      <form id="branch-expense-form" onSubmit={handleSubmit} className="space-y-3">
        <div className={`${ws.innerCard} px-3 py-2 text-xs grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1`}>
          <span className="text-slate-500 dark:text-white/50">الفاتورة</span>
          <span className="font-mono text-slate-900 dark:text-white text-left" dir="ltr">{invoice?.invoice_number || "—"}</span>
          <span className="text-slate-500 dark:text-white/50">المورد</span>
          <span className="text-slate-900 dark:text-white">{invoice?.supplier_name || "—"}</span>
          <span className="text-slate-500 dark:text-white/50">الإجمالي</span>
          <span className="tabular-nums font-semibold text-slate-900 dark:text-white text-left" dir="ltr">{formatMoney(invoice?.total_amount)}</span>
          <span className="text-slate-500 dark:text-white/50">الحساب الحالي</span>
          <span className="text-slate-900 dark:text-white">{currentAccount}</span>
        </div>

        <div>
          <FieldLabel>القسم</FieldLabel>
          <GlassSelect value={phaseId} onChange={setPhaseId} options={phaseOptions} placeholder="بلا قسم" buttonClassName="text-sm py-2 px-3" />
        </div>
        <div>
          <FieldLabel hint="حسابات التأسيس 53">حساب المصروف</FieldLabel>
          <GlassSelect
            value={accountCode}
            onChange={setAccountCode}
            options={accountOptions}
            placeholder="إبقاء الحساب الحالي"
            buttonClassName="text-sm py-2 px-3"
            menuWidth={320}
          />
          <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
            اختيار حساب يحدّث رأس الفاتورة وكل بنودها إلى هذا الحساب.
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
