"use client";

import { useRef, useState } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";

function isoDate(value) {
  if (!value) return "-";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function yesNo(value) {
  return value ? "نعم" : "لا";
}

function money(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "-";
}

function branchNames(item) {
  const branches = Array.isArray(item.branches) ? item.branches : [];
  return branches.length ? branches.map((b) => b.name).join("، ") : "-";
}

/* Shared column set — accessor functions read the raw employee row.
 * Used for both Excel and PDF so the two exports never drift. */
function buildColumns() {
  return [
    { header: "الاسم", accessor: (i) => i.name || "-" },
    { header: "الجوال", accessor: (i) => i.phone || "-" },
    { header: "رقم الإقامة", accessor: (i) => i.iqama_number || "-" },
    { header: "انتهاء الإقامة", accessor: (i) => isoDate(i.iqama_expiry_date) },
    { header: "نقل الكفالة", accessor: (i) => yesNo(i.sponsorship_transferred) },
    { header: "كرت عمل", accessor: (i) => yesNo(i.work_card_issued) },
    { header: "كشف طبي", accessor: (i) => yesNo(i.medical_check_issued) },
    { header: "كرت صحي", accessor: (i) => yesNo(i.health_card_issued) },
    {
      header: "انتهاء الكرت الصحي",
      accessor: (i) => isoDate(i.health_card_expiry_date),
    },
    { header: "المنصب", accessor: (i) => i.position || "-" },
    { header: "الفرع", accessor: (i) => branchNames(i) },
    { header: "الراتب الأساسي", accessor: (i) => money(i.base_salary) },
    { header: "بدلات أخرى", accessor: (i) => money(i.other_allowances) },
    { header: "تاريخ المباشرة", accessor: (i) => isoDate(i.start_date) },
  ];
}

export default function HREmployeeExportMenu({ employees, todayRiyadh }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  const filename = `الموظفين_${todayRiyadh}`;
  const title = "قائمة الموظفين - HR";
  const list = Array.isArray(employees) ? employees : [];

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
        className={`${ws.btnNeutral} px-5 py-3 min-w-[140px] justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-expanded={open}
      >
        <Download className="w-5 h-5" />
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
