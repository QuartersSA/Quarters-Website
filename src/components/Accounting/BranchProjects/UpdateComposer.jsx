"use client";

import React, { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import useUpload from "@/utils/useUpload";
import { useAddBranchProjectUpdate } from "@/hooks/useBranchProjects";
import { FieldLabel } from "./shared";

// محرر تطوّر جديد: نص + قسم اختياري + صور.

export default function UpdateComposer({ project, onDone }) {
  const [upload, { loading: uploading }] = useUpload();
  const addMut = useAddBranchProjectUpdate();
  const fileInputRef = useRef(null);

  const [body, setBody] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");

  const phaseOptions = useMemo(() => {
    const phases = Array.isArray(project?.phases) ? [...project.phases] : [];
    phases.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return [{ value: "", label: "عام (بلا قسم)" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))];
  }, [project?.phases]);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f && /^image\//.test(f.type || ""));
    if (files.length === 0) return;
    for (const file of files) {
      const result = await upload({ file });
      if (result?.error) {
        toast.error(`فشل رفع ${file.name}: ${result.error}`);
        continue;
      }
      if (result?.url) setPhotos((prev) => [...prev, result.url]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(event) {
    event?.preventDefault?.();
    if (!project?.id || addMut.isPending || uploading) return;
    if (!body.trim() && photos.length === 0) {
      setError("اكتب نصاً أو أرفق صورة");
      return;
    }
    setError("");
    addMut.mutate(
      {
        project_id: project.id,
        phase_id: phaseId ? Number(phaseId) : null,
        body: body.trim(),
        photos,
      },
      {
        onSuccess: () => {
          setBody("");
          setPhotos([]);
          setPhaseId("");
          onDone?.();
        },
      },
    );
  }

  const busy = addMut.isPending || uploading;

  return (
    <form onSubmit={handleSubmit} className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
      <div>
        <FieldLabel>تطوّر جديد</FieldLabel>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className={`${ws.input} px-3 py-2 text-sm resize-y`}
          placeholder="ماذا حدث اليوم في الموقع؟"
        />
        {error ? <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">{error}</div> : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <FieldLabel hint="اختياري">القسم</FieldLabel>
          <GlassSelect value={phaseId} onChange={setPhaseId} options={phaseOptions} placeholder="عام" buttonClassName="text-sm py-2 px-3" />
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className={`${ws.btnNeutral} px-3 py-2 text-sm w-full justify-center disabled:opacity-60`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            {uploading ? "جاري الرفع…" : "إضافة صور"}
          </button>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {photos.map((url, index) => (
            <div key={`${url}-${index}`} className="relative w-20 h-20 rounded-[10px] overflow-hidden border border-slate-200 dark:border-white/10">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                title="إزالة"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={busy} className={`${ws.btnPrimary} px-4 py-2 text-sm disabled:opacity-60`}>
          {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          نشر
        </button>
      </div>
    </form>
  );
}
