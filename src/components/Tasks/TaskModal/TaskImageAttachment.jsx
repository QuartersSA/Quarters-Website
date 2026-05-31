import { Upload, Trash2, Paperclip, FileText, X } from "lucide-react";
import { FormRowLabel } from "../FormRowLabel";
import { ws } from "@/components/Workspace/ui";

export function TaskImageAttachment({
  attachments,
  error,
  uploading,
  fileInputRef,
  onPickFiles,
  onFilesSelected,
  removeAt,
  clearAll,
  summaryText,
  maxCount,
  maxMb,
}) {
  const safe = Array.isArray(attachments) ? attachments : [];
  const hasAny = safe.length > 0;

  const labelIcon = <Paperclip className="w-4 h-4" />;

  const renderAttachment = (a, idx) => {
    const url = a?.url ? String(a.url) : "";
    const mime = a?.mimeType ? String(a.mimeType) : "";
    const name = a?.name ? String(a.name) : "ملف";
    const isImage = !!mime && mime.startsWith("image/");

    if (!url) {
      return null;
    }

    const openTarget = (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {isImage ? (
          <img
            src={url}
            alt={name}
            className="w-full h-[140px] object-cover rounded-2xl border border-slate-200 dark:border-white/10"
          />
        ) : (
          <div
            className={`flex items-center justify-between gap-3 ${ws.glass} ${ws.card} px-4 py-3 border border-slate-200 dark:border-white/10`}
          >
            <span className="inline-flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-slate-700 dark:text-white/70" />
              <span className="text-sm text-slate-800 dark:text-white/85 truncate">{name}</span>
            </span>
            <span className="text-xs text-slate-600 dark:text-white/55">فتح</span>
          </div>
        )}
      </a>
    );

    return (
      <div key={`${url}-${idx}`} className="relative">
        {openTarget}
        <button
          type="button"
          onClick={() => removeAt(idx)}
          className="absolute top-2 left-2 w-9 h-9 rounded-2xl bg-black/50 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-800 dark:text-white/80 hover:bg-black/60"
          title="إزالة"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <FormRowLabel icon={labelIcon} label="المرفقات" />

      <div className="mt-1 text-xs text-slate-500 dark:text-white/50">
        الحد الأقصى: {maxCount} ملفات — {maxMb}MB لكل ملف
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        onChange={onFilesSelected}
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />

      <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={uploading}
          className={`${ws.btnNeutral} px-4 py-3 justify-center disabled:opacity-50`}
        >
          <span className="inline-flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {uploading ? "جاري الرفع…" : "اختر ملفات"}
          </span>
        </button>

        {hasAny ? (
          <button
            type="button"
            onClick={clearAll}
            className={`${ws.btnDanger} px-4 py-3 justify-center`}
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              إزالة الكل
            </span>
          </button>
        ) : null}
      </div>

      <div className="mt-2 text-sm text-slate-600 dark:text-white/60">{summaryText}</div>

      {error ? <div className="mt-2 text-sm text-red-300">{error}</div> : null}

      {hasAny ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {safe.map(renderAttachment)}
        </div>
      ) : (
        <div className="mt-2 text-sm text-slate-600 dark:text-white/55">لا يوجد مرفقات.</div>
      )}
    </div>
  );
}
