import { useRef, useState } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";

export function LowStockExportMenu({ onExportExcel, onExportPDF }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  const handleExcel = () => {
    onExportExcel();
    setOpen(false);
  };
  const handlePDF = () => {
    onExportPDF();
    setOpen(false);
  };

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        className={`${ws.btnNeutral} px-4 py-2 text-sm justify-center`}
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
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-white/85 hover:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-emerald-200" />
          <div>
            <p className="font-semibold text-white">Excel</p>
            <p className="text-xs text-white/45">للتحليل والمعالجة</p>
          </div>
        </button>
        <button
          type="button"
          onClick={handlePDF}
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
