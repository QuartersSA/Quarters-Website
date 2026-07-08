"use client";

import { useRef, useState } from "react";
import { Download, ChevronDown, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassPopover from "@/components/Workspace/GlassPopover";
import {
  exportToExcelHTML,
  exportToPDF,
  formatDateTime,
} from "@/utils/exportUtils";
import { todayRiyadhDateKey } from "@/utils/dateUtils";

const COUNTRY_LABELS = {
  SA: "السعودية",
  AE: "الإمارات",
  BH: "البحرين",
  KW: "الكويت",
  OM: "عُمان",
  QA: "قطر",
  EG: "مصر",
  JO: "الأردن",
  LB: "لبنان",
  TR: "تركيا",
  OTHER: "أخرى",
};

function countryLabel(code) {
  if (!code) return "-";
  return COUNTRY_LABELS[code] || code;
}

function vatLabel(value) {
  return value ? "مسجلة" : "غير مسجلة";
}

function activeLabel(value) {
  return value === false ? "موقوف" : "نشط";
}

function rateLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00%";
  return `${n.toFixed(2)}%`;
}

export default function ContactsExportMenu({ contacts }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const excelColumns = [
    { header: "اسم المنشأة", accessor: (c) => c.name },
    { header: "البلد", accessor: (c) => countryLabel(c.country) },
    {
      header: "التسجيل الضريبي",
      accessor: (c) => vatLabel(c.vat_registered),
    },
    { header: "رقم الضريبة", accessor: (c) => c.vat_number || "-" },
    {
      header: "معدل الضريبة الافتراضي",
      accessor: (c) => rateLabel(c.default_tax_rate),
    },
    { header: "ملاحظات", accessor: (c) => c.notes || "-" },
    { header: "الحالة", accessor: (c) => activeLabel(c.is_active) },
    {
      header: "تاريخ الإضافة",
      accessor: (c) => c.created_at,
      format: (v) => formatDateTime(v),
    },
  ];

  // PDF leaves out long-form columns (notes + creation timestamp)
  // so each row fits on a printed page without wrapping.
  const pdfColumns = [
    { header: "اسم المنشأة", accessor: (c) => c.name },
    { header: "البلد", accessor: (c) => countryLabel(c.country) },
    {
      header: "تسجيل ضريبي",
      accessor: (c) => vatLabel(c.vat_registered),
    },
    { header: "رقم الضريبة", accessor: (c) => c.vat_number || "-" },
    {
      header: "الضريبة الافتراضية",
      accessor: (c) => rateLabel(c.default_tax_rate),
    },
    { header: "الحالة", accessor: (c) => activeLabel(c.is_active) },
  ];

  const handleExportExcel = () => {
    exportToExcelHTML(
      contacts || [],
      `جهات_الاتصال_${todayRiyadhDateKey()}`,
      excelColumns,
      "جهات الاتصال - قسم المشتريات",
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    exportToPDF(
      contacts || [],
      `جهات_الاتصال_${todayRiyadhDateKey()}`,
      pdfColumns,
      "جهات الاتصال - قسم المشتريات",
    );
    setShowExportMenu(false);
  };

  return (
    <div>
      <button
        ref={exportBtnRef}
        type="button"
        onClick={() => setShowExportMenu((s) => !s)}
        className={`${ws.btnNeutral} px-3 py-2`}
        aria-expanded={showExportMenu}
        disabled={!contacts || contacts.length === 0}
        title={
          !contacts || contacts.length === 0
            ? "لا توجد بيانات للتصدير"
            : "تصدير القائمة"
        }
      >
        <Download className="w-4 h-4" />
        <span>تصدير</span>
        <ChevronDown className="w-3.5 h-3.5" />
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
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          <FileText className="w-5 h-5 text-[#0e7a5f] dark:text-emerald-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              Excel
            </p>
            <p className="text-xs text-slate-500 dark:text-white/45">
              للتحليل والمعالجة
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors border-t border-slate-200 dark:border-white/10"
        >
          <FileText className="w-5 h-5 text-red-700 dark:text-red-200" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">
              PDF
            </p>
            <p className="text-xs text-slate-500 dark:text-white/45">
              للطباعة والأرشفة
            </p>
          </div>
        </button>
      </GlassPopover>
    </div>
  );
}
