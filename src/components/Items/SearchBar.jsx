import {
  Search,
  Plus,
  Download,
  ChevronDown,
  FileText,
  Layers,
  Filter,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import GlassSelect from "@/components/Workspace/GlassSelect";

export function SearchBar({
  searchTerm,
  onSearchChange,
  onAddClick,
  onExportExcel,
  onExportPDF,
  onManageCategories,
  // filter props
  categories,
  selectedCategory,
  onCategoryChange,
  selectedStatus,
  onStatusChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  onClearFilters,
}) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportBtnRef = useRef(null);

  const categoryOptions = [
    { value: "", label: "جميع الفئات" },
    ...(categories || []).map((c) => ({ value: String(c.id), label: c.name })),
  ];

  const statusOptions = [
    { value: "", label: "جميع الحالات" },
    { value: "available", label: "متوفر" },
    { value: "low_stock", label: "منخفض" },
    { value: "out_of_stock", label: "نفد" },
    { value: "disabled", label: "معطّل" },
  ];

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/40" />
          <input
            type="text"
            placeholder="البحث عن صنف..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`${ws.input} pr-12 pl-4 py-3`}
          />
        </div>

        {/* Filter toggle */}
        {onToggleFilters ? (
          <button
            type="button"
            onClick={onToggleFilters}
            className={`${hasActiveFilters ? ws.btnPrimary : ws.btnNeutral} px-5 py-3 justify-center relative`}
          >
            <Filter className="w-5 h-5" />
            <span>فلتر</span>
            {hasActiveFilters ? (
              <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                !
              </span>
            ) : null}
          </button>
        ) : null}

        {/* Export Button with Dropdown */}
        {onExportExcel && onExportPDF ? (
          <div>
            <button
              ref={exportBtnRef}
              type="button"
              onClick={() => setShowExportMenu((s) => !s)}
              className={`${ws.btnNeutral} px-6 py-3 min-w-[140px] justify-center`}
              aria-expanded={showExportMenu}
            >
              <Download className="w-5 h-5" />
              <span>تصدير</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            <GlassPopover
              open={showExportMenu}
              anchorRef={exportBtnRef}
              onClose={() => setShowExportMenu(false)}
              style={{ width: 224 }}
            >
              <button
                type="button"
                onClick={() => {
                  onExportExcel();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-slate-800 dark:text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white">Excel</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45">للتحليل والمعالجة</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  onExportPDF();
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-right text-slate-800 dark:text-slate-800 dark:text-slate-800 dark:text-white/85 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors border-t border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10"
              >
                <FileText className="w-5 h-5 text-red-700 dark:text-red-700 dark:text-red-200" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white">PDF</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45">للطباعة والأرشفة</p>
                </div>
              </button>
            </GlassPopover>
          </div>
        ) : null}

        {onManageCategories ? (
          <button
            type="button"
            onClick={onManageCategories}
            className={`${ws.btnNeutral} px-6 py-3 min-w-[140px] justify-center`}
          >
            <Layers className="w-5 h-5" />
            <span>الفئات</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onAddClick}
          className={`${ws.btnPrimary} px-6 py-3 justify-center`}
        >
          <Plus className="w-5 h-5" />
          <span className="font-semibold">إضافة صنف جديد</span>
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters ? (
        <div className={`${ws.glassSoft} ${ws.card} p-4 sm:p-5`}>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-xs font-semibold mb-2">
                الفئة
              </label>
              <GlassSelect
                value={selectedCategory}
                onChange={onCategoryChange}
                options={categoryOptions}
                buttonClassName="px-4 py-2.5"
              />
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="block text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-xs font-semibold mb-2">
                حالة المخزون
              </label>
              <GlassSelect
                value={selectedStatus}
                onChange={onStatusChange}
                options={statusOptions}
                buttonClassName="px-4 py-2.5"
              />
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={onClearFilters}
                className={`${ws.btnNeutral} px-4 py-2.5 text-sm justify-center`}
              >
                <X className="w-4 h-4" />
                <span>مسح الفلتر</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
