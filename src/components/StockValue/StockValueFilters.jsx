import { Search, RefreshCw, ArrowUpDown, Building2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

const SORT_OPTIONS = [
  { value: "value_desc", label: "القيمة (الأعلى أولاً)" },
  { value: "value_asc", label: "القيمة (الأقل أولاً)" },
  { value: "qty_desc", label: "الكمية (الأكبر أولاً)" },
  { value: "qty_asc", label: "الكمية (الأقل أولاً)" },
  { value: "name_asc", label: "الاسم (أ → ي)" },
  { value: "name_desc", label: "الاسم (ي → أ)" },
];

export function StockValueFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  hideMissingCost,
  onHideMissingCostChange,
  onRefresh,
  // Branch picker — empty string / "" means "all branches" (server-wide
  // total). Numeric id means slice to that single branch.
  branchOptions,
  selectedBranch,
  onBranchChange,
}) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-400 dark:text-white/35" />
          <input
            type="text"
            placeholder="البحث عن صنف…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${ws.input} pr-12 pl-4 py-3`}
          />
        </div>

        {/* Branch picker — drives server-side per-branch slice. */}
        <div className="min-w-[200px] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/45 shrink-0" />
          <GlassSelect
            value={selectedBranch}
            onChange={onBranchChange}
            options={branchOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div className="min-w-[220px] flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-slate-500 dark:text-slate-500 dark:text-white/45 shrink-0" />
          <GlassSelect
            value={sortBy}
            onChange={onSortChange}
            options={SORT_OPTIONS}
            buttonClassName="px-4 py-3"
          />
        </div>

        <button
          type="button"
          onClick={() => onHideMissingCostChange(!hideMissingCost)}
          className={`${
            hideMissingCost ? ws.btnPrimary : ws.btnNeutral
          } px-4 py-3 justify-center whitespace-nowrap`}
          title="إخفاء الأصناف التي لا تملك سعر تكلفة"
        >
          {hideMissingCost ? "✓ " : ""}بدون أسعار مفقودة
        </button>

        <button
          type="button"
          onClick={onRefresh}
          className={`${ws.btnNeutral} px-6 py-3 justify-center`}
        >
          <RefreshCw className="w-5 h-5" />
          <span>تحديث</span>
        </button>
      </div>
    </div>
  );
}
