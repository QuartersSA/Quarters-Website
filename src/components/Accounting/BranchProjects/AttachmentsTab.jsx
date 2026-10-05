"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  ExternalLink,
  File as FileIcon,
  FileBadge,
  FileSignature,
  Loader2,
  Paperclip,
  PenTool,
  Plus,
  ReceiptText,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import useUpload from "@/utils/useUpload";
import { useAddBranchProjectAttachment, useDeleteBranchProjectAttachment } from "@/hooks/useBranchProjects";
import { ATTACHMENT_KINDS, ATTACHMENT_KIND_LABELS } from "@/utils/branchProjectMath";
import { EmptyState, FieldLabel, SectionCard } from "./shared";
import { formatRiyadhDateForInput } from "@/utils/dateUtils";

// تبويب المرفقات: إضافة + مجموعات حسب النوع.

const KIND_ICONS = {
  contract: FileSignature,
  permit: FileBadge,
  design: PenTool,
  quote: ReceiptText,
  photo: Camera,
  other: FileIcon,
};

const inputCls = `${ws.input} px-3 py-2 text-sm`;

function kindsList() {
  if (Array.isArray(ATTACHMENT_KINDS) && ATTACHMENT_KINDS.length) return ATTACHMENT_KINDS;
  return Object.keys(ATTACHMENT_KIND_LABELS || {});
}

function formatTimestampDay(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return formatRiyadhDateForInput(d);
}

export default function AttachmentsTab({ project }) {
  const [upload, { loading: uploading }] = useUpload();
  const addMut = useAddBranchProjectAttachment();
  const deleteMut = useDeleteBranchProjectAttachment();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState("other");
  const [phaseId, setPhaseId] = useState("");
  const [error, setError] = useState("");

  const phases = useMemo(() => {
    const list = Array.isArray(project?.phases) ? [...project.phases] : [];
    list.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return list;
  }, [project?.phases]);
  const phaseById = useMemo(() => new Map(phases.map((p) => [String(p.id), p])), [phases]);

  const kindOptions = useMemo(() => kindsList().map((k) => ({ value: k, label: ATTACHMENT_KIND_LABELS?.[k] || k })), []);
  const phaseOptions = useMemo(
    () => [{ value: "", label: "عام (بلا قسم)" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))],
    [phases],
  );

  const groups = useMemo(() => {
    const items = Array.isArray(project?.attachments) ? project.attachments : [];
    const map = new Map();
    for (const k of kindsList()) map.set(k, []);
    for (const item of items) {
      const k = map.has(item.kind) ? item.kind : "other";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return [...map.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([k, list]) => ({
        kind: k,
        label: ATTACHMENT_KIND_LABELS?.[k] || k,
        items: list.slice().sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))),
      }));
  }, [project?.attachments]);

  const total = (project?.attachments || []).length;

  function handlePick(picked) {
    if (!picked) return;
    setFile(picked);
    if (!label.trim()) setLabel(picked.name.replace(/\.[^.]+$/, ""));
    if (/^image\//.test(picked.type || "") && kind === "other") setKind("photo");
  }

  async function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || uploading || addMut.isPending) return;
    if (!file) {
      setError("اختر ملفاً أولاً");
      return;
    }
    if (!label.trim()) {
      setError("التسمية مطلوبة");
      return;
    }
    setError("");
    const result = await upload({ file, unoptimized: !/^image\//.test(file.type || "") });
    if (result?.error || !result?.url) {
      toast.error(`فشل رفع الملف: ${result?.error || "خطأ غير معروف"}`);
      return;
    }
    addMut.mutate(
      {
        project_id: project.id,
        phase_id: phaseId ? Number(phaseId) : null,
        url: result.url,
        label: label.trim(),
        kind,
      },
      {
        onSuccess: () => {
          setFile(null);
          setLabel("");
          setKind("other");
          setPhaseId("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      },
    );
  }

  function handleDelete(item) {
    if (!project?.id) return;
    if (!window.confirm(`حذف المرفق «${item.label}»؟`)) return;
    deleteMut.mutate({ project_id: project.id, id: item.id });
  }

  const busy = uploading || addMut.isPending;

  return (
    <div className="space-y-4">
      <SectionCard title="إضافة مرفق" icon={Plus}>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handlePick(e.target.files?.[0])} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`${ws.innerCard} w-full px-3 py-3 flex items-center gap-3 text-right hover:border-[#c9d3ce] dark:hover:border-white/20 transition-colors`}
            >
              <div className={`${ws.iconBox} w-10 h-10 shrink-0 text-[#0e7a5f] dark:text-emerald-200`}>
                <Upload className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{file ? file.name : "اختر ملفاً"}</div>
                <div className="text-[11px] text-slate-500 dark:text-white/45">
                  {file ? `${(file.size / 1024).toFixed(0)} KB` : "PDF، صور، مستندات — حتى 90MB"}
                </div>
              </div>
            </button>
          </div>
          <div>
            <FieldLabel>التسمية *</FieldLabel>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="مثال: رخصة البلدية" />
          </div>
          <div>
            <FieldLabel>النوع</FieldLabel>
            <GlassSelect value={kind} onChange={setKind} options={kindOptions} placeholder="النوع" buttonClassName="text-sm py-2 px-3" />
          </div>
          <div>
            <FieldLabel hint="اختياري">القسم</FieldLabel>
            <GlassSelect value={phaseId} onChange={setPhaseId} options={phaseOptions} placeholder="عام" buttonClassName="text-sm py-2 px-3" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className={`${ws.btnPrimary} px-4 py-2 text-sm w-full justify-center disabled:opacity-60`}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              {uploading ? "جاري الرفع…" : "إضافة"}
            </button>
          </div>
          {error ? <div className="sm:col-span-2 text-[11px] text-rose-600 dark:text-rose-300">{error}</div> : null}
        </form>
      </SectionCard>

      {total === 0 ? (
        <EmptyState icon={Paperclip} title="لا مرفقات بعد" hint="أرفق العقود والتراخيص والمخططات وعروض الأسعار لتبقى في مكان واحد." />
      ) : (
        groups.map((group) => {
          const Icon = KIND_ICONS[group.kind] || FileIcon;
          return (
            <SectionCard key={group.kind} title={group.label} icon={Icon} description={`${group.items.length}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const phase = item.phase_id != null ? phaseById.get(String(item.phase_id)) : null;
                  const isImage = group.kind === "photo" || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item.url || "");
                  return (
                    <div key={item.id} className={`${ws.innerCard} p-3 flex items-start gap-3`}>
                      {isImage ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-[10px] overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
                          <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      ) : (
                        <div className={`${ws.iconBox} w-12 h-12 shrink-0 text-[#0e7a5f] dark:text-emerald-200`}>
                          <Icon className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.label}</div>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
                          {phase ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ background: phase.color || "#94a3b8" }} />
                              {phase.name}
                            </span>
                          ) : (
                            <span>عام</span>
                          )}
                          <span className="tabular-nums" dir="ltr">
                            {formatTimestampDay(item.created_at)}
                          </span>
                          {item.created_by_name ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="w-3 h-3" />
                              {item.created_by_name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={item.url} target="_blank" rel="noreferrer" className={`${ws.btnNeutral} px-2.5 py-1.5 text-xs`}>
                          <ExternalLink className="w-3.5 h-3.5" />
                          فتح
                        </a>
                        <button type="button" onClick={() => handleDelete(item)} className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`} title="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
