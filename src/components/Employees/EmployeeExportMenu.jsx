import { useRef, useState } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import {
  exportToExcelHTML,
  exportToPDF,
  formatRole,
  formatDateTime,
} from "@/utils/exportUtils";

export function EmployeeExportMenu({ employees }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const handleExportExcel = () => {
    const columns = [
      { header: "الاسم", accessor: (item) => item.name },
      { header: "اسم المستخدم", accessor: (item) => item.username || "-" },
      {
        header: "رقم الجوال",
        accessor: (item) => item.phone || "-",
      },
      {
        header: "البريد الإلكتروني",
        accessor: (item) => item.email || "-",
      },
      {
        header: "الصلاحية",
        accessor: (item) => item.role,
        format: (value) => formatRole(value),
      },
      {
        header: "الفروع",
        accessor: (item) =>
          item.branches && item.branches.length > 0
            ? item.branches.map((b) => b.name).join(", ")
            : "لا يوجد فروع",
      },
      {
        header: "تاريخ الإضافة",
        accessor: (item) => item.created_at,
        format: (value) => formatDateTime(value),
      },
    ];

    exportToExcelHTML(
      employees,
      `قائمة_الموظفين_${new Date().toISOString().split("T")[0]}`,
      columns,
      "قائمة الموظفين - نظام إدارة المخزون",
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "الاسم", accessor: (item) => item.name },
      { header: "اسم المستخدم", accessor: (item) => item.username || "-" },
      {
        header: "الجوال",
        accessor: (item) => item.phone || "-",
      },
      {
        header: "البريد",
        accessor: (item) => item.email || "-",
      },
      {
        header: "الصلاحية",
        accessor: (item) => item.role,
        format: (value) => formatRole(value),
      },
      {
        header: "الفروع",
        accessor: (item) =>
          item.branches && item.branches.length > 0
            ? item.branches.map((b) => b.name).join(", ")
            : "لا يوجد",
      },
    ];

    exportToPDF(
      employees,
      `قائمة_الموظفين_${new Date().toISOString().split("T")[0]}`,
      columns,
      "قائمة الموظفين - نظام إدارة المخزون",
    );
    setShowExportMenu(false);
  };

  return (
    <div>
      <button
        ref={exportBtnRef}
        type="button"
        onClick={() => setShowExportMenu((s) => !s)}
        className={`${ws.btnNeutral} px-6 py-3 min-w-[140px] justify-center`}
        aria-expanded={showExportMenu}
      >
        <Download className="w-5 h-5" />
        <span>تصدير</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      <GlassPopover
        open={showExportMenu}
        anchorRef={exportBtnRef}
        onClose={() => setShowExportMenu(false)}
        style={{ width: 224 }}
      >
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-slate-800 dark:text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white">Excel</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45">للتحليل والمعالجة</p>
          </div>
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-slate-800 dark:text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors border-t border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10"
        >
          <FileText className="w-5 h-5 text-red-700 dark:text-red-700 dark:text-red-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white">PDF</p>
            <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45">للطباعة والأرشفة</p>
          </div>
        </button>
      </GlassPopover>
    </div>
  );
}
