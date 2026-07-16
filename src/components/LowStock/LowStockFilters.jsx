import { Search, RefreshCw } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";

// فلاتر صفحة النواقص: بحث + فرع + فئة + حالة الخطورة — كلها تعمل
// على الحد الفعّال لكل فرع (حد الفرع الخاص وإلا الافتراضي للصنف).
const SEVERITY_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "out", label: "غير متوفر" },
  { value: "critical", label: "حرج (أقل من نصف الحد)" },
  { value: "low", label: "منخفض" },
];

export function LowStockFilters({
  searchQuery,
  onSearchChange,
  selectedBranch,
  onBranchChange,
  branchOptions,
  selectedCategory,
  onCategoryChange,
  categoryOptions,
  selectedSeverity,
  onSeverityChange,
  onRefresh,
}) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`}>
      <div className="flex flex-col md:flex-row gap-4 md:flex-wrap">
        <div className="flex-1 min-w-[220px] relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/35" />
          <input
            type="text"
            placeholder="البحث عن صنف…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${ws.input} pr-12 pl-4 py-3`}
          />
        </div>

        <div className="min-w-[180px]">
          <GlassSelect
            value={selectedBranch}
            onChange={onBranchChange}
            options={branchOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div className="min-w-[180px]">
          <GlassSelect
            value={selectedCategory}
            onChange={onCategoryChange}
            options={categoryOptions}
            buttonClassName="px-4 py-3"
          />
        </div>

        <div className="min-w-[200px]">
          <GlassSelect
            value={selectedSeverity}
            onChange={onSeverityChange}
            options={SEVERITY_OPTIONS}
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
