"use client";

import { Filter, RotateCcw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

/* Document-status filter keys → Arabic labels. */
export const STATUS_LABELS = {
  iqama_expired: "إقامة منتهية",
  iqama_soon: "إقامة قريبة الانتهاء",
  health_expired: "كرت صحي منتهي",
  health_soon: "كرت صحي قريب الانتهاء",
  docs_complete: "وثائق مكتملة",
};

/* Sort keys → Arabic labels. */
export const SORT_LABELS = {
  name_asc: "الاسم (أ-ي)",
  salary_desc: "الراتب (أعلى)",
  salary_asc: "الراتب (أقل)",
  start_desc: "تاريخ المباشرة (الأحدث)",
  iqama_soonest: "انتهاء الإقامة (الأقرب)",
};

export default function HREmployeeFilters({
  branches,
  positions,
  branchFilter,
  onBranchChange,
  positionFilter,
  onPositionChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  onReset,
  hasActiveFilters,
}) {
  const branchOptions = [
    { value: "", label: "جميع الفروع" },
    ...(Array.isArray(branches) ? branches : []).map((b) => ({
      value: String(b.id),
      label: b.name,
    })),
  ];

  const positionOptions = [
    { value: "", label: "كل المناصب" },
    ...(Array.isArray(positions) ? positions : []).map((p) => ({
      value: p,
      label: p,
    })),
  ];

  const statusOptions = [
    { value: "", label: "كل الحالات" },
    { value: "iqama_expired", label: STATUS_LABELS.iqama_expired },
    { value: "iqama_soon", label: STATUS_LABELS.iqama_soon },
    { value: "health_expired", label: STATUS_LABELS.health_expired },
    { value: "health_soon", label: STATUS_LABELS.health_soon },
    { value: "docs_complete", label: STATUS_LABELS.docs_complete },
  ];

  const sortOptions = [
    { value: "name_asc", label: SORT_LABELS.name_asc },
    { value: "salary_desc", label: SORT_LABELS.salary_desc },
    { value: "salary_asc", label: SORT_LABELS.salary_asc },
    { value: "start_desc", label: SORT_LABELS.start_desc },
    { value: "iqama_soonest", label: SORT_LABELS.iqama_soonest },
  ];

  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex items-center gap-2 text-slate-600 dark:text-white/55 text-xs lg:mb-2.5">
          <Filter className="w-4 h-4" />
          تصفية
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              الفرع
            </label>
            <GlassSelect
              value={branchFilter}
              onChange={onBranchChange}
              options={branchOptions}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              المنصب
            </label>
            <GlassSelect
              value={positionFilter}
              onChange={onPositionChange}
              options={positionOptions}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              حالة الوثائق
            </label>
            <GlassSelect
              value={statusFilter}
              onChange={onStatusChange}
              options={statusOptions}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              ترتيب حسب
            </label>
            <GlassSelect
              value={sortBy}
              onChange={onSortChange}
              options={sortOptions}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className={`${ws.btnNeutral} px-4 py-2 justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <RotateCcw className="w-4 h-4" />
          إعادة تعيين
        </button>
      </div>
    </div>
  );
}
