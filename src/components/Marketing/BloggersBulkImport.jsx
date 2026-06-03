"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Papa from "papaparse";
import { ws } from "@/components/Workspace/ui";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Bulk blogger import via CSV.
 *
 * Workflow:
 *   1. Admin clicks "تحميل القالب" → CSV with header row downloads
 *   2. Admin fills the rows in Excel / Numbers / Sheets and saves as CSV
 *   3. Admin clicks "رفع ملف" → file picker → parsed client-side via
 *      papaparse → sent as a single POST to /api/marketing/bloggers/bulk
 *   4. Response summary shown: created vs skipped (with reasons)
 *
 * Headers (English keys, Arabic display row in template):
 *   name (مطلوب) | handle | phone | note
 */

// Template column keys. The downloadable template lists these plus
// an Arabic guidance row so non-technical users know what to fill.
const COLUMNS = [
  { key: "name", labelAr: "الاسم (مطلوب)", example: "أحمد الفلاني" },
  {
    key: "handle",
    labelAr: "رابط صفحة البلوقر",
    example: "https://www.instagram.com/ahmed.travel",
  },
  { key: "phone", labelAr: "الجوال", example: "0501234567" },
  { key: "note", labelAr: "ملاحظة", example: "بلوقر سفر" },
];

function buildTemplateCsv() {
  const header = COLUMNS.map((c) => c.key).join(",");
  // BOM so Excel renders the Arabic guidance row + future user input
  // correctly when the file is opened.
  const BOM = "﻿";
  // Two helper rows for clarity, all commented out via "#" — papaparse
  // can ignore comment rows on parse.
  const guidanceAr = COLUMNS.map((c) => `"# ${c.labelAr}"`).join(",");
  const example = COLUMNS.map((c) => `"${c.example}"`).join(",");
  return `${BOM}${header}\n${guidanceAr}\n${example}\n`;
}

function downloadTemplate() {
  const csv = buildTemplateCsv();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quarters-bloggers-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function BloggersBulkImport({ onClose }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [parsedRows, setParsedRows] = useState(null); // [{name, handle, ...}]
  const [parseError, setParseError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [result, setResult] = useState(null); // { created, skipped, counts }

  const uploadMutation = useMutation({
    mutationFn: async (bloggers) => {
      const r = await adminFetch("/api/marketing/bloggers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloggers }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "فشل الرفع");
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["marketing-bloggers"] });
    },
  });

  const handleFile = (file) => {
    setParseError(null);
    setResult(null);
    setParsedRows(null);
    setFileName(file?.name || null);
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      // Drop guidance rows that start with "#" in the name column.
      transformHeader: (h) => String(h || "").trim(),
      complete: (parsed) => {
        if (parsed.errors?.length) {
          setParseError(parsed.errors[0]?.message || "فشل قراءة الملف");
          return;
        }
        const rows = [];
        for (const row of parsed.data || []) {
          const name = String(row.name || "").trim();
          // Skip empty rows + guidance row that starts with "# "
          if (!name) continue;
          if (name.startsWith("#")) continue;
          rows.push({
            name,
            handle: row.handle ? String(row.handle).trim() : "",
            phone: row.phone ? String(row.phone).trim() : "",
            note: row.note ? String(row.note).trim() : "",
          });
        }
        if (rows.length === 0) {
          setParseError("الملف فارغ أو لا يحتوي على أعمدة صالحة (name مطلوب)");
          return;
        }
        if (rows.length > 500) {
          setParseError("الحد الأقصى 500 صف في كل رفعة");
          return;
        }
        setParsedRows(rows);
      },
      error: (err) => {
        setParseError(err?.message || "فشل قراءة الملف");
      },
    });
  };

  const handleSubmit = () => {
    if (!parsedRows || parsedRows.length === 0) return;
    uploadMutation.mutate(parsedRows);
  };

  const reset = () => {
    setParsedRows(null);
    setParseError(null);
    setFileName(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl ${ws.glass} ${ws.card} my-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`p-5 sm:p-6 border-b ${ws.divider} flex items-start justify-between gap-3`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`${ws.iconBox} w-12 h-12 text-pink-700 dark:text-pink-200`}>
              <Upload className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                رفع البلوقرز من ملف
              </h2>
              <div className="text-sm text-slate-600 dark:text-white/55 mt-0.5">
                حمّل القالب، عبّ الأسماء، ثم ارفع الملف لإضافتهم دفعة واحدة.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={ws.iconButton}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Step 1: template */}
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl p-4`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}
                >
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">
                    القالب (CSV)
                  </div>
                  <div className="text-slate-600 dark:text-white/55 text-xs">
                    الأعمدة: name | handle | phone | note
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className={`${ws.btnNeutral} px-4 py-2 text-sm`}
              >
                <Download className="w-4 h-4" />
                <span>تحميل القالب</span>
              </button>
            </div>
          </div>

          {/* Step 2: upload */}
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl p-4`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-200`}>
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-900 dark:text-white font-semibold text-sm">
                    ارفع الملف بعد التعبئة
                  </div>
                  <div className="text-slate-600 dark:text-white/55 text-xs">
                    احفظه كـ CSV من Excel أو Sheets
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`${ws.btnNeutral} px-4 py-2 text-sm`}
              >
                <Upload className="w-4 h-4" />
                <span>{fileName ? "اختيار ملف آخر" : "اختيار ملف"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>

            {fileName ? (
              <div className="text-slate-700 dark:text-white/70 text-xs flex items-center gap-2">
                <span className="text-slate-500 dark:text-white/45">الملف:</span>
                <span dir="ltr">{fileName}</span>
              </div>
            ) : null}

            {parseError ? (
              <div className="mt-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            ) : null}

            {parsedRows && parsedRows.length > 0 && !result ? (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-100 text-sm">
                جاهز: تم قراءة <b>{parsedRows.length}</b> بلوقر من الملف.
              </div>
            ) : null}
          </div>

          {/* Preview table */}
          {parsedRows && parsedRows.length > 0 && !result ? (
            <div
              className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 text-slate-800 dark:text-white/80 text-sm font-semibold">
                معاينة أول 10 صفوف
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/[0.04] sticky top-0">
                      <th className="text-right px-3 py-2 text-slate-600 dark:text-white/65 font-semibold">
                        الاسم
                      </th>
                      <th className="text-right px-3 py-2 text-slate-600 dark:text-white/65 font-semibold">
                        الرابط
                      </th>
                      <th className="text-right px-3 py-2 text-slate-600 dark:text-white/65 font-semibold">
                        الجوال
                      </th>
                      <th className="text-right px-3 py-2 text-slate-600 dark:text-white/65 font-semibold">
                        ملاحظة
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-t border-slate-100 dark:border-white/5">
                        <td className="px-3 py-2 text-slate-900 dark:text-white">{row.name}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-white/70 truncate max-w-[18rem]" dir="ltr">
                          {row.handle || ""}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-white/70" dir="ltr">
                          {row.phone}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-white/70">
                          {row.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 ? (
                <div className="px-4 py-2 text-slate-500 dark:text-white/45 text-xs border-t border-slate-100 dark:border-white/5">
                  … و {parsedRows.length - 10} صف إضافي
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Result */}
          {result ? (
            <div
              className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden`}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center gap-2 text-slate-800 dark:text-white/80 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
                نتيجة الرفع
              </div>
              <div className="p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55">إجمالي</div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">
                    {result.counts?.total ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55">تم إضافتهم</div>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-200">
                    {result.counts?.created ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-600 dark:text-white/55">تم تخطيهم</div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                    {result.counts?.skipped ?? 0}
                  </div>
                </div>
              </div>
              {Array.isArray(result.skipped) && result.skipped.length > 0 ? (
                <div className="px-4 pb-4">
                  <div className="text-slate-600 dark:text-white/55 text-xs mb-2">
                    أسباب التخطي:
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {result.skipped.slice(0, 50).map((s, i) => (
                      <div
                        key={i}
                        className="text-xs text-amber-700 dark:text-amber-200/80 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-1.5"
                      >
                        الصف {s.row}: {s.reason}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {uploadMutation.isError ? (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-200 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{uploadMutation.error?.message || "فشل الرفع"}</span>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div
          className={`p-4 sm:p-5 border-t ${ws.divider} flex items-center gap-2 sm:gap-3 flex-shrink-0`}
        >
          {result ? (
            <>
              <button
                type="button"
                onClick={reset}
                className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
              >
                <span>رفع ملف آخر</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center`}
              >
                <span>إغلاق</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={uploadMutation.isPending}
                className={`${ws.btnNeutral} flex-1 px-4 py-3 justify-center`}
              >
                <span>إلغاء</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  !parsedRows ||
                  parsedRows.length === 0 ||
                  uploadMutation.isPending
                }
                className={`${ws.btnPrimary} flex-1 px-4 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {uploadMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-400 dark:border-white/40 border-t-transparent rounded-full animate-spin" />
                    <span>جاري الرفع…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>رفع البلوقرز</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
