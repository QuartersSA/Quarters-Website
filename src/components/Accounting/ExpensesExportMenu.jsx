"use client";

import { useRef, useState } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { formatMoney, monthLabel } from "@/utils/payrollFormatters";

/* Confirmed amount falls back to the original when no override exists. */
function confirmedValue(item) {
  if (
    item.confirmed_amount !== null &&
    item.confirmed_amount !== undefined &&
    item.confirmed_amount !== ""
  ) {
    return item.confirmed_amount;
  }
  return item.is_confirmed ? item.amount : null;
}

/* Shared column set — accessor reads the raw expense row; format adds the
 * Arabic presentation. One set drives both Excel and PDF so they never
 * drift. */
function buildColumns() {
  return [
    { header: "اسم المصروف", accessor: (i) => i.expense_name || "-" },
    { header: "النوع", accessor: (i) => i.expense_type_name || "-" },
    {
      header: "المبلغ الأصلي",
      accessor: (i) => i.amount,
      format: (v) => formatMoney(v),
    },
    {
      header: "المبلغ المؤكد",
      accessor: (i) => confirmedValue(i),
      format: (v) => (v === null || v === undefined ? "-" : formatMoney(v)),
    },
    {
      header: "الحالة",
      accessor: (i) => i.is_confirmed,
      format: (v) => (v ? "مؤكد" : "بانتظار"),
    },
    { header: "ملاحظة التأكيد", accessor: (i) => i.confirmed_note || "-" },
  ];
}

export default function ExpensesExportMenu({ expenses, month, todayRiyadh }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  const list = Array.isArray(expenses) ? expenses : [];
  const filename = `مصروفات_${month || ""}_${todayRiyadh}`;
  const title = `المصروفات — ${monthLabel(month) || month || ""}`;

  const handleExcel = () => {
    exportToExcelHTML(list, filename, buildColumns(), title);
    setOpen(false);
  };

  const handlePDF = () => {
    exportToPDF(list, filename, buildColumns(), title);
    setOpen(false);
  };

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={list.length === 0}
        className={`${ws.btnNeutral} px-4 py-2 justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-expanded={open}
      >
        <Download className="w-4 h-4" />
        <span>تصدير</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      <GlassPopover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        style={{ width: 224 }}
      >
        <button
          type="button"
          onClick={handleExcel}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Excel</p>
            <p className="text-xs text-slate-500 dark:text-white/45">
              للتحليل والمعالجة
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={handlePDF}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors border-t border-slate-200 dark:border-white/10"
        >
          <FileText className="w-5 h-5 text-red-700 dark:text-red-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">PDF</p>
            <p className="text-xs text-slate-500 dark:text-white/45">
              للطباعة والأرشفة
            </p>
          </div>
        </button>
      </GlassPopover>
    </div>
  );
}
