import { useRef, useState, useCallback } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { toast } from "sonner";

export function PayrollExportMenu({
  entries,
  exportColumns,
  month,
  monthHint,
  run,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const handleExportExcel = useCallback(() => {
    if (!month || !run) {
      toast.error("اختر الشهر ثم أنشئ/حدّث المسير أولاً");
      return;
    }

    const filename = `مسير_الرواتب_${String(month)}`;
    const title = `مسير الرواتب - ${monthHint}`;

    exportToExcelHTML(entries, filename, exportColumns, title);
    setShowExportMenu(false);
  }, [entries, exportColumns, month, monthHint, run]);

  const handleExportPDF = useCallback(() => {
    if (!month || !run) {
      toast.error("اختر الشهر ثم أنشئ/حدّث المسير أولاً");
      return;
    }

    const filename = `مسير_الرواتب_${String(month)}`;
    const title = `مسير الرواتب - ${monthHint}`;

    exportToPDF(entries, filename, exportColumns, title);
    setShowExportMenu(false);
  }, [entries, exportColumns, month, monthHint, run]);

  return (
    <div className="w-full sm:w-auto">
      <button
        ref={exportBtnRef}
        type="button"
        onClick={() => setShowExportMenu((s) => !s)}
        className={`${ws.btnNeutral} px-4 py-2 justify-center w-full sm:w-auto`}
        aria-expanded={showExportMenu}
      >
        <Download className="w-4 h-4" />
        <span className="font-semibold">تصدير</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      <GlassPopover
        open={showExportMenu}
        anchorRef={exportBtnRef}
        onClose={() => setShowExportMenu(false)}
        style={{ width: 220 }}
      >
        <button
          type="button"
          onClick={handleExportExcel}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-200" />
          <div>
            <p className="font-semibold text-white">Excel</p>
            <p className="text-xs text-white/45">ملف .xls</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handleExportPDF}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors border-t border-white/10"
        >
          <FileText className="w-5 h-5 text-red-200" />
          <div>
            <p className="font-semibold text-white">PDF</p>
            <p className="text-xs text-white/45">للطباعة والأرشفة</p>
          </div>
        </button>
      </GlassPopover>
    </div>
  );
}
