"use client";

import React, { useMemo, useState } from "react";
import { MessageSquareText, Trash2, UserRound } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { useDeleteBranchProjectUpdate } from "@/hooks/useBranchProjects";
import { EmptyState } from "./shared";
import UpdateComposer from "./UpdateComposer";

// تبويب التطورات: محرر + خط زمني.

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 16).replace("T", " ");
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function UpdatesTab({ project }) {
  const deleteMut = useDeleteBranchProjectUpdate();
  const [phaseFilter, setPhaseFilter] = useState("all");

  const phases = useMemo(() => {
    const list = Array.isArray(project?.phases) ? [...project.phases] : [];
    list.sort((a, b) => (Number(a?.sort_order) || 0) - (Number(b?.sort_order) || 0));
    return list;
  }, [project?.phases]);

  const phaseById = useMemo(() => new Map(phases.map((p) => [String(p.id), p])), [phases]);

  const filterOptions = useMemo(
    () => [{ value: "all", label: "كل التطورات" }, { value: "none", label: "عام (بلا قسم)" }, ...phases.map((p) => ({ value: String(p.id), label: p.name }))],
    [phases],
  );

  const updates = useMemo(() => {
    const list = Array.isArray(project?.updates) ? [...project.updates] : [];
    list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return list.filter((u) => {
      if (phaseFilter === "all") return true;
      if (phaseFilter === "none") return u.phase_id == null;
      return String(u.phase_id) === phaseFilter;
    });
  }, [project?.updates, phaseFilter]);

  function handleDelete(update) {
    if (!project?.id) return;
    if (!window.confirm("حذف هذا التطوّر؟")) return;
    deleteMut.mutate({ project_id: project.id, id: update.id });
  }

  return (
    <div className="space-y-4">
      <UpdateComposer project={project} />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageSquareText className="w-4 h-4 text-[#0e7a5f] dark:text-emerald-200" />
          الخط الزمني
          <span className="text-xs font-normal text-slate-500 dark:text-white/45 tabular-nums">({updates.length})</span>
        </div>
        <div className="flex-1" />
        <div className="w-full sm:w-56">
          <GlassSelect value={phaseFilter} onChange={setPhaseFilter} options={filterOptions} placeholder="القسم" buttonClassName="text-sm py-2 px-3" />
        </div>
      </div>

      {updates.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="لا تطورات بعد" hint="سجّل أول تحديث من الموقع أعلاه." />
      ) : (
        <ol className="relative space-y-3 pr-4 before:absolute before:right-[7px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
          {updates.map((update) => {
            const phase = update.phase_id != null ? phaseById.get(String(update.phase_id)) : null;
            const photos = Array.isArray(update.photos) ? update.photos : [];
            return (
              <li key={update.id} className="relative">
                <span
                  className="absolute -right-4 top-4 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#132044]"
                  style={{ background: phase?.color || "#94a3b8" }}
                />
                <div className={`${ws.glass} ${ws.card} p-4 space-y-2`}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 dark:text-white/45 min-w-0 flex-1">
                      <span className="tabular-nums" dir="ltr">
                        {formatDateTime(update.created_at)}
                      </span>
                      {update.created_by_name ? (
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="w-3 h-3" />
                          {update.created_by_name}
                        </span>
                      ) : null}
                      {phase ? (
                        <span className={`${ws.chip} px-2 py-0.5 text-[11px]`}>
                          <span className="w-2 h-2 rounded-full" style={{ background: phase.color || "#94a3b8" }} />
                          {phase.name}
                        </span>
                      ) : (
                        <span className={`${ws.chip} px-2 py-0.5 text-[11px]`}>عام</span>
                      )}
                    </div>
                    <button type="button" onClick={() => handleDelete(update)} className={`${ws.iconButton} w-8 h-8 text-rose-600 dark:text-rose-300`} title="حذف">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {update.body ? <div className="text-sm text-slate-900 dark:text-white whitespace-pre-line leading-relaxed">{update.body}</div> : null}
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {photos.map((url, index) => (
                        <a
                          key={`${url}-${index}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block aspect-square rounded-[10px] overflow-hidden border border-slate-200 dark:border-white/10"
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
