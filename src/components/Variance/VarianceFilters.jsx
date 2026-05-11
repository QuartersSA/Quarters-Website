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
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-white/55 mb-1">الفرع</label>
          <GlassSelect
            value={selectedBranch}
            onChange={onBranchChange}
            options={branchOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1">الصنف</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 z-10 pointer-events-none" />
            <input
              type="text"
              value={itemSearch}
              onChange={(e) => onItemSearchChange(e.target.value)}
              placeholder="ابحث عن صنف…"
              className={`${ws.input} pr-10 pl-3 py-3`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1">
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
          <label className="block text-xs text-white/55 mb-1">من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className={`${ws.input} px-3 py-3 w-full`}
          />
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1">إلى تاريخ</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className={`${ws.input} px-3 py-3 flex-1`}
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
        </div>
      </div>
    </div>
  );
}
