import { Search, RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export function ItemsSummaryFilters({
  searchQuery,
  setSearchQuery,
  selectedBranch,
  setSelectedBranch,
  selectedStatus,
  setSelectedStatus,
  branchOptions,
  statusOptions,
  onRefresh,
}) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/35" />
          <input
            type="text"
            placeholder="البحث عن صنف…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${ws.input} pr-12 pl-4 py-3`}
          />
        </div>

        <div className="min-w-[180px]">
          <GlassSelect
            value={selectedBranch}
            onChange={setSelectedBranch}
            options={branchOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div className="min-w-[180px]">
          <GlassSelect
            value={selectedStatus}
            onChange={setSelectedStatus}
            options={statusOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

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
