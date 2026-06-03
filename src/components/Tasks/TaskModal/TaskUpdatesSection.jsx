import { Clock, FileText } from "lucide-react";
import { FormRowLabel } from "../FormRowLabel";
import { ws } from "@/components/Workspace/ui";
import { TaskImageAttachment } from "./TaskImageAttachment";
import { formatDateTime } from "@/utils/taskHistoryFormatters";

export function TaskUpdatesSection({
  mode,
  taskId,
  viewerEmployeeId,
  updates,
  isLoading,
  error,
  draftBody,
  setDraftBody,
  attachments,
  attachmentsError,
  uploadingAttachments,
  fileInputRef,
  onPickFiles,
  onFilesSelected,
  removeAt,
  clearAll,
  summaryText,
  maxCount,
  maxMb,
}) {
  const renderAttachment = (a, idx) => {
    const url = a?.url ? String(a.url) : "";
    const mime = a?.mimeType ? String(a.mimeType) : "";
    const name = a?.name ? String(a.name) : "ملف";
    const isImage = !!mime && mime.startsWith("image/");
    if (!url) return null;

    if (isImage) {
      return (
        <a
          key={`${url}-${idx}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={url}
            alt={name}
            className="w-full h-[160px] object-cover rounded-2xl border border-slate-200 dark:border-white/10"
          />
        </a>
      );
    }

    return (
      <a
        key={`${url}-${idx}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`flex items-center justify-between gap-3 ${ws.glass} ${ws.card} px-4 py-3 border border-slate-200 dark:border-white/10`}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-slate-700 dark:text-white/70" />
          <span className="text-sm text-slate-800 dark:text-white/85 truncate">{name}</span>
        </span>
        <span className="text-xs text-slate-600 dark:text-white/55">فتح</span>
      </a>
    );
  };

  const renderUpdate = (u) => {
    const author = u?.author_name ? String(u.author_name) : "—";
    const at = formatDateTime(u?.created_at);
    const bodyText = u?.body ? String(u.body) : "";

    const list = Array.isArray(u?.attachments) ? u.attachments : [];
    const hasAttachments = list.length > 0;

    const attachmentsView = !hasAttachments ? null : (
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {list.map(renderAttachment)}
      </div>
    );

    return (
      <div
        key={u.id}
        className={`${ws.glassSoft} ${ws.card} p-4 border border-slate-200 dark:border-white/10`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {author}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-1">{at}</div>
          </div>
          <span
            className={`${ws.pill} border bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-white/70 border-slate-200 dark:border-white/10`}
          >
            تحديث
          </span>
        </div>

        {bodyText ? (
          <div className="mt-3 text-sm text-slate-800 dark:text-white/80 whitespace-pre-wrap leading-6">
            {bodyText}
          </div>
        ) : null}

        {attachmentsView}
      </div>
    );
  };

  if (mode !== "edit" || !taskId) {
    return (
      <div className={`${ws.glassSoft} ${ws.card} p-4`}>
        <FormRowLabel
          icon={<Clock className="w-4 h-4" />}
          label="ملاحظات وتحديثات"
        />
        <div className="mt-3 text-sm text-slate-600 dark:text-white/60">
          بعد حفظ المهمة، تقدر تضيف ملاحظات وتحديثات هنا.
        </div>
      </div>
    );
  }

  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <FormRowLabel
        icon={<Clock className="w-4 h-4" />}
        label="ملاحظات وتحديثات"
      />

      <div className="mt-3">
        <div className="text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
          اكتب تحديث (سيتم حفظه عند الضغط على زر "تحديث المهمة")
        </div>
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          className={`${ws.input} px-4 py-3 min-h-[110px] resize-y`}
          placeholder="اكتب ملاحظة أو تحديث…"
        />

        <TaskImageAttachment
          attachments={attachments}
          error={attachmentsError}
          uploading={uploadingAttachments}
          fileInputRef={fileInputRef}
          onPickFiles={onPickFiles}
          onFilesSelected={onFilesSelected}
          removeAt={removeAt}
          clearAll={clearAll}
          summaryText={summaryText}
          maxCount={maxCount}
          maxMb={maxMb}
        />

        {attachmentsError ? (
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">{attachmentsError}</div>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
          آخر التحديثات
        </div>

        {!viewerEmployeeId ? (
          <div className="text-sm text-slate-600 dark:text-white/60">
            لا يمكن تحميل التحديثات بدون هوية المستخدم
          </div>
        ) : isLoading ? (
          <div className="text-sm text-slate-600 dark:text-white/60">جاري تحميل التحديثات…</div>
        ) : error ? (
          <div className="text-sm text-red-700 dark:text-red-300">
            {error?.message || "فشل تحميل التحديثات"}
          </div>
        ) : updates.length === 0 ? (
          <div className="text-sm text-slate-600 dark:text-white/60">لا يوجد تحديثات حتى الآن.</div>
        ) : (
          <div className="space-y-3">{updates.map(renderUpdate)}</div>
        )}
      </div>
    </div>
  );
}
