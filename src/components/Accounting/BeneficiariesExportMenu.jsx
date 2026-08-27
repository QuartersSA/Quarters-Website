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

function formatIban(iban) {
  if (!iban) return "-";
  return String(iban).replace(/(.{4})/g, "$1 ").trim();
}
function activeLabel(value) {
  return value === false ? "موقوف" : "نشط";
}
function isGovernment(b) {
  return b.beneficiary_type === "government";
}
function typeLabel(b) {
  return isGovernment(b) ? "مدفوعات حكومية" : "حساب بنكي";
}
// حكومي = رقم حساب؛ بنكي = آيبان.
function accountCell(b) {
  return isGovernment(b) ? b.account_number || "-" : formatIban(b.iban);
}

export default function BeneficiariesExportMenu({ beneficiaries }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const excelColumns = [
    { header: "اسم المستفيد", accessor: (b) => b.name },
    { header: "النوع", accessor: (b) => typeLabel(b) },
    { header: "جهة الاتصال", accessor: (b) => b.contact_name || "—" },
    { header: "الآيبان / رقم الحساب", accessor: (b) => accountCell(b) },
    { header: "اسم البنك", accessor: (b) => (isGovernment(b) ? "-" : b.bank_name || "-") },
    { header: "العملة", accessor: (b) => (isGovernment(b) ? "-" : b.currency || "SAR") },
    { header: "السويفت SWIFT", accessor: (b) => (isGovernment(b) ? "-" : b.swift || "-") },
    { header: "ملاحظات", accessor: (b) => b.notes || "-" },
    { header: "الحالة", accessor: (b) => activeLabel(b.is_active) },
    {
      header: "تاريخ الإضافة",
      accessor: (b) => b.created_at,
      format: (v) => formatDateTime(v),
    },
  ];

  const pdfColumns = [
    { header: "اسم المستفيد", accessor: (b) => b.name },
    { header: "النوع", accessor: (b) => typeLabel(b) },
    { header: "جهة الاتصال", accessor: (b) => b.contact_name || "—" },
    { header: "الآيبان / رقم الحساب", accessor: (b) => accountCell(b) },
    { header: "البنك", accessor: (b) => (isGovernment(b) ? "-" : b.bank_name || "-") },
    { header: "العملة", accessor: (b) => (isGovernment(b) ? "-" : b.currency || "SAR") },
    { header: "SWIFT", accessor: (b) => (isGovernment(b) ? "-" : b.swift || "-") },
    { header: "الحالة", accessor: (b) => activeLabel(b.is_active) },
  ];

  const handleExportExcel = () => {
    exportToExcelHTML(
      beneficiaries || [],
      `المستفيدون_${todayRiyadhDateKey()}`,
      excelColumns,
      "المستفيدون - قسم المشتريات",
    );
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    exportToPDF(
      beneficiaries || [],
      `المستفيدون_${todayRiyadhDateKey()}`,
      pdfColumns,
      "المستفيدون - قسم المشتريات",
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
        disabled={!beneficiaries || beneficiaries.length === 0}
        title={
          !beneficiaries || beneficiaries.length === 0
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
