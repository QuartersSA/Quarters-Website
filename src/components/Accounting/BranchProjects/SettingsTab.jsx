"use client";

import React, { useState } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Building2, Loader2, Pencil, ToggleLeft, Trash2 } from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import { useDeleteBranchProject, useUpdateBranchProject } from "@/hooks/useBranchProjects";
import { PROJECT_STATUS_LABELS } from "@/utils/branchProjectMath";
import { SectionCard, StatusPill, formatDate, formatMoney } from "./shared";
import ProjectModal from "./ProjectModal";

// تبويب الإعدادات: بيانات المشروع، الحالة، منطقة الخطر.

const EDITABLE_STATUSES = ["planning", "in_progress", "on_hold", "cancelled"];

function InfoRow({ label, value, ltr }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-slate-500 dark:text-white/45 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white text-left truncate" dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </span>
    </div>
  );
}

export default function SettingsTab({ project }) {
  const navigate = useNavigate();
  const updateMut = useUpdateBranchProject();
  const deleteMut = useDeleteBranchProject();
  const [editOpen, setEditOpen] = useState(false);

  const isOpened = project?.status === "opened";

  function handleStatus(status) {
    if (!project?.id || isOpened || status === project.status || updateMut.isPending) return;
    if (status === "cancelled" && !window.confirm("إلغاء المشروع؟ يمكنك إعادته لاحقاً من هنا.")) return;
    updateMut.mutate({ id: project.id, status });
  }

  function handleDelete() {
    if (!project?.id || deleteMut.isPending) return;
    const ok = window.confirm(
      `حذف المشروع «${project.name}» نهائياً مع كل أقسامه ومهامه وفواتيره ومرفقاته؟ لا يمكن التراجع.`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: project.id }, { onSuccess: () => navigate("/accounting/branch-projects") });
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="بيانات المشروع"
        icon={Building2}
        action={
          <button type="button" onClick={() => setEditOpen(true)} className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}>
            <Pencil className="w-3.5 h-3.5" />
            تعديل
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="الكود" value={project?.code} ltr />
            <InfoRow label="الاسم" value={project?.name} />
            <InfoRow label="المدينة" value={project?.city} />
            <InfoRow label="الحي" value={project?.district} />
            <InfoRow label="العنوان" value={project?.address} />
            <InfoRow label="المساحة" value={project?.area_sqm != null ? `${project.area_sqm} م²` : ""} />
          </div>
          <div>
            <InfoRow label="توقيع العقد" value={formatDate(project?.contract_signed_date)} ltr />
            <InfoRow label="الافتتاح المستهدف" value={formatDate(project?.target_opening_date)} ltr />
            <InfoRow label="الافتتاح الفعلي" value={project?.actual_opening_date ? formatDate(project.actual_opening_date) : ""} ltr />
            <InfoRow label="الميزانية الإجمالية" value={formatMoney(project?.budget_total)} ltr />
            <InfoRow label="مدير المشروع" value={project?.manager_name} />
            <InfoRow label="رقم عقد الإيجار" value={project?.lease_contract_number} ltr />
          </div>
        </div>
        {project?.notes ? (
          <div className={`mt-3 ${ws.innerCard} px-3 py-2 text-xs text-slate-700 dark:text-white/70 whitespace-pre-line`}>{project.notes}</div>
        ) : null}
      </SectionCard>

      <SectionCard title="الحالة" icon={ToggleLeft} action={<StatusPill status={project?.status} />}>
        {isOpened ? (
          <div className="text-sm text-slate-600 dark:text-white/60">
            المشروع مُفتتح منذ <span className="tabular-nums" dir="ltr">{formatDate(project?.actual_opening_date)}</span>. الحالة نهائية ولا تُعدَّل من هنا؛ الافتتاح يُؤكَّد عبر زر «تأكيد الافتتاح» في رأس الصفحة.
          </div>
        ) : (
          <>
            <div className={`${ws.segWrap} flex-wrap`}>
              {EDITABLE_STATUSES.map((status) => {
                const active = project?.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatus(status)}
                    disabled={updateMut.isPending}
                    className={`${ws.segBtn} text-xs disabled:opacity-60 ${active ? ws.segActive : ws.segInactive}`}
                  >
                    {updateMut.isPending && updateMut.variables?.status === status ? <Loader2 className="w-3.5 h-3.5 animate-spin inline-block ml-1" /> : null}
                    {PROJECT_STATUS_LABELS?.[status] || status}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45 mt-2">
              حالة «مُفتتح» لا تُختار يدوياً — استخدم زر «تأكيد الافتتاح» في رأس الصفحة بعد اكتمال المعالم.
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="منطقة الخطر" icon={AlertTriangle} className="border-rose-200 dark:border-rose-400/25">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-slate-700 dark:text-white/70">
            حذف المشروع يزيل كل الأقسام والمهام والفواتير والتطورات والمرفقات المرتبطة به.
          </div>
          <button type="button" onClick={handleDelete} disabled={deleteMut.isPending} className={`${ws.btnDanger} px-4 py-2 text-sm disabled:opacity-60`}>
            {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            حذف المشروع
          </button>
        </div>
      </SectionCard>

      <ProjectModal open={editOpen} project={project} onClose={() => setEditOpen(false)} />
    </div>
  );
}
