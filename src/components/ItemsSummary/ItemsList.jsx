import { Package, FileText } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { ItemCard } from "./ItemCard";
import { ItemsSummaryExportMenu } from "./ItemsSummaryExportMenu";

export function ItemsList({
  filteredItems,
  isLoading,
  expandedItems,
  onToggleExpansion,
  onExportExcel,
  onExportPDF,
}) {
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  return (
    <div className={sectionCard}>
      <div
        className={`p-5 sm:p-6 border-b ${ws.divider} flex items-center justify-between gap-3`}
      >
        <h2 className="text-xl font-bold text-white flex items-center gap-3 tracking-tight">
          <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
            <FileText className="w-5 h-5" />
          </div>
          تفاصيل الأصناف ({filteredItems.length})
        </h2>

        <ItemsSummaryExportMenu
          onExportExcel={onExportExcel}
          onExportPDF={onExportPDF}
        />
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-white/55">
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" />
            <span>جاري التحميل…</span>
          </div>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="divide-y divide-white/5">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isExpanded={expandedItems.has(item.id)}
              onToggle={() => onToggleExpansion(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center text-white/45">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p className="text-lg mb-2">لا توجد أصناف</p>
          <p className="text-sm">جرب تغيير الفلاتر أو إضافة أصناف جديدة</p>
        </div>
      )}
    </div>
  );
}
