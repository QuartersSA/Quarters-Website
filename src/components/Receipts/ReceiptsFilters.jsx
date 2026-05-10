import { RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

export function ReceiptsFilters({
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
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className={`${ws.input} px-3 py-3 w-full`}
          />
        </div>

        <div>
          <label className="block text-xs text-white/55 mb-1">&nbsp;</label>
          <button
            type="button"
            onClick={onRefresh}
            className={`${ws.btnNeutral} px-4 py-3 justify-center w-full`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث</span>
          </button>
        </div>
      </div>
    </div>
  );
}
