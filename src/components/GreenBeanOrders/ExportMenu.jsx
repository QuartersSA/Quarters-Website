import { useRef, useState, useCallback } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";

export default function ExportMenu({ onExcel, onPDF, disabled, label }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  const handleExcel = useCallback(() => {
    onExcel?.();
    setOpen(false);
  }, [onExcel]);

  const handlePDF = useCallback(() => {
    onPDF?.();
    setOpen(false);
  }, [onPDF]);

  const buttonLabel = label || "تصدير";

  return (
    <div className="w-full sm:w-auto">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`${ws.btnNeutral} px-4 py-2 justify-center w-full sm:w-auto`}
        aria-expanded={open}
        disabled={disabled}
      >
        <Download className="w-4 h-4" />
        <span className="font-semibold">{buttonLabel}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      <GlassPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        style={{ width: 220 }}
      >
        <button
          type="button"
          onClick={handleExcel}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Excel</p>
            <p className="text-xs text-slate-500 dark:text-white/45">ملف .xls</p>
          </div>
        </button>

        <button
          type="button"
          onClick={handlePDF}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:bg-white/[0.06] transition-colors border-t border-slate-200 dark:border-white/10"
        >
          <FileText className="w-5 h-5 text-red-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">PDF</p>
            <p className="text-xs text-slate-500 dark:text-white/45">للطباعة والأرشفة</p>
          </div>
        </button>
      </GlassPopover>
    </div>
  );
}
