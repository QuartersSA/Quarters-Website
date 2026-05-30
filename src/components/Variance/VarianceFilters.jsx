import { Search, RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export function VarianceFilters({
  branchOptions,
  itemOptions,
  selectedBranch,
  onBranchChange,
  selectedItem,
  onItemChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onRefresh,
  itemSearch,
  onItemSearchChange,
}) {
  // itemOptions[0] is the "اختر الصنف" placeholder — actual matches = length-1.
  // Surfaces "no matches" state so user doesn't think search broke.
  const matchCount = Math.max(0, (itemOptions?.length || 0) - 1);
  const hasSearch = !!(itemSearch && itemSearch.trim());
  // Date range sanity: from > to is a typo, swap visually with red border.
  const dateRangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo);
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-600 dark:dark:text-white/55 mb-1">الفرع</label>
          <GlassSelect
            value={selectedBranch}
            onChange={onBranchChange}
            options={branchOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-600 dark:dark:text-white/55 mb-1">الصنف</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-400 dark:dark:text-white/35 z-10 pointer-events-none" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => onItemSearchChange(e.target.value)}
              placeholder="ابحث عن صنف…"
              className={`${ws.input} pr-10 pl-3 py-3`}
            />
          </div>
          {hasSearch ? (
            <p
              className={`mt-1 text-xs ${
                matchCount === 0 ? "text-red-700 dark:text-red-700 dark:dark:text-red-200" : "text-slate-500 dark:text-slate-500 dark:dark:text-white/45"
              }`}
            >
              {matchCount === 0
                ? "لا توجد نتائج"
                : `${matchCount} نتيجة`}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-600 dark:dark:text-white/55 mb-1">
            اختر الصنف
          </label>
          <GlassSelect
            value={selectedItem}
            onChange={onItemChange}
            options={itemOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-600 dark:dark:text-white/55 mb-1">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={`${ws.input} px-3 py-3 w-full ${
              dateRangeInvalid ? "ring-1 ring-red-400/60" : ""
            }`}
          />
        </div>

        <div>
          <label className="block text-xs text-slate-600 dark:text-slate-600 dark:dark:text-white/55 mb-1">إلى تاريخ</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className={`${ws.input} px-3 py-3 flex-1 ${
                dateRangeInvalid ? "ring-1 ring-red-400/60" : ""
              }`}
            />
            <button
              type="button"
              onClick={onRefresh}
              className={`${ws.btnNeutral} px-3 py-3 justify-center`}
              title="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {dateRangeInvalid ? (
            <p className="mt-1 text-xs text-red-700 dark:text-red-700 dark:dark:text-red-200">
              ⚠ "من" أحدث من "إلى"
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
