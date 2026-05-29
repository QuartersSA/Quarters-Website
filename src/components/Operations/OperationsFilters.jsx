import { Filter, Search, X } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

export function OperationsFilters({
  searchQuery,
  setSearchQuery,
  selectedBranch,
  setSelectedBranch,
  selectedType,
  setSelectedType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  showFilters,
  setShowFilters,
  clearFilters,
  hasActiveFilters,
  branches,
}) {
  const cardClass = `${ws.glassSoft} ${ws.card} p-4 sm:p-6 mb-6`;
  const labelClass = "block text-xs font-semibold text-slate-600 dark:text-white/55 mb-2";

  const branchOptions = [
    { value: "", label: "جميع الفروع" },
    ...(branches || []).map((branch) => ({
      value: String(branch.id),
      label: branch.name,
    })),
  ];

  const typeOptions = [
    { value: "", label: "جميع الأنواع" },
    { value: "Daily", label: "يومي" },
    { value: "Weekly", label: "أسبوعي" },
    { value: "Transfer", label: "تحويل" },
    { value: "Receipt", label: "وارد" },
    { value: "Opening", label: "مخزون افتتاحي" },
  ];

  return (
    <div className={cardClass} dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`${ws.iconBox} w-11 h-11`}>
            <Filter className="w-5 h-5 text-slate-700 dark:text-white/70" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              الفلاتر والبحث
            </h2>
            <div className="text-xs text-slate-500 dark:text-white/50">فلتر بسرعة وبشكل مرتب</div>
          </div>
          {hasActiveFilters ? (
            <span className={`${ws.chip} hidden sm:inline-flex`}>نشط</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`${ws.btnDanger} px-4 py-2 text-sm justify-center`}
            >
              <X className="w-4 h-4" />
              <span>مسح</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`${ws.btnNeutral} px-4 py-2 text-sm justify-center`}
          >
            <Filter className="w-4 h-4" />
            <span>{showFilters ? "إخفاء" : "عرض"}</span>
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/35" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث برقم الجرد…"
          className={`${ws.input} pr-12 pl-4 py-3`}
        />
      </div>

      {showFilters ? (
        <div
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t ${ws.divider}`}
        >
          <div>
            <label className={labelClass}>الفرع</label>
            <GlassSelect
              value={selectedBranch}
              onChange={setSelectedBranch}
              options={branchOptions}
              buttonClassName="px-4 py-3"
            />
          </div>

          <div>
            <label className={labelClass}>نوع الجرد</label>
            <GlassSelect
              value={selectedType}
              onChange={setSelectedType}
              options={typeOptions}
              buttonClassName="px-4 py-3"
            />
          </div>

          <div>
            <label className={labelClass}>التاريخ من</label>
            <GlassDatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              buttonClassName="px-4 py-3"
            />
          </div>

          <div>
            <label className={labelClass}>التاريخ إلى</label>
            <GlassDatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="اختر التاريخ"
              buttonClassName="px-4 py-3"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
