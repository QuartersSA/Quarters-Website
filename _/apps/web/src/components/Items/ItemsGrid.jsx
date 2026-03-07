import { Package } from "lucide-react";
import { ItemCard } from "./ItemCard";

export function ItemsGrid({
  items,
  isLoading,
  searchTerm,
  onEdit,
  onDelete,
  onViewStock,
}) {
  if (isLoading) {
    return (
      <div className="col-span-full flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-gray-400">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <span>جاري التحميل...</span>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="col-span-full text-center py-20">
        <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-500">
          {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد أصناف حتى الآن"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewStock={onViewStock}
        />
      ))}
    </div>
  );
}
