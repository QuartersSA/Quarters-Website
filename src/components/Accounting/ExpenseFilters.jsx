"use client";

import { Filter, Search, RotateCcw, ArrowDownWideNarrow } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

/**
 * Filter / search / sort bar for the variable-expense lists (register +
 * review tabs). State is OWNED BY THE PAGE — this is a controlled
 * component. The page derives `filteredExpenses` from these values via a
 * useMemo and feeds the result to ExpenseTable.
 *
 * Sort options:
 *   amount_desc  المبلغ: الأعلى
 *   amount_asc   المبلغ: الأقل
 *   name_asc     الاسم أ-ي
 *   status       الحالة (بانتظار أولاً)
 */

export const EXPENSE_SORT_OPTIONS = [
  { value: "amount_desc", label: "المبلغ: الأعلى" },
  { value: "amount_asc", label: "المبلغ: الأقل" },
  { value: "name_asc", label: "الاسم أ-ي" },
  { value: "status", label: "الحالة" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "confirmed", label: "مؤكد" },
  { value: "pending", label: "بانتظار" },
];

export default function ExpenseFilters({
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  typeOptions, // [{ value, label }] derived from the month's expenses
  onReset,
  hasActiveFilters,
}) {
  const types = [{ value: "", label: "كل الأنواع" }, ...(typeOptions || [])];

  return (
    <div className={`${ws.glass} ${ws.card} p-4`}>
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex items-center gap-2 text-slate-600 dark:text-white/55 text-xs lg:mb-2.5">
          <Filter className="w-4 h-4" />
          تصفية
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              بحث
            </label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/35 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="اسم المصروف…"
                className={`${ws.input} text-sm py-2 pr-9 pl-3`}
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              النوع
            </label>
            <GlassSelect
              value={typeFilter}
              onChange={onTypeFilterChange}
              options={types}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              الحالة
            </label>
            <GlassSelect
              value={statusFilter}
              onChange={onStatusFilterChange}
              options={STATUS_OPTIONS}
              buttonClassName="text-sm py-2 px-3"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-white/45 mb-1">
              <span className="inline-flex items-center gap-1">
                <ArrowDownWideNarrow className="w-3 h-3" />
                ترتيب
              </span>
            </label>
            <GlassSelect
              value={sort}
              onChange={onSortChange}
              options={EXPENSE_SORT_OPTIONS}
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
