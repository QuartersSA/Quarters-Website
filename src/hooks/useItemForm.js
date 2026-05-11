import { useState } from "react";

export function useItemForm() {
  const [formData, setFormData] = useState({
    name: "",
    name_en: "",
    description: "",
    min_stock_threshold: 10,
    max_stock_threshold: null,
    is_active: true,
    unit: "حبة",
    category_id: null,
    cost: "",
    show_in_inventory: true,
    linked_green_bean_id: null,
  });
  const [editingItem, setEditingItem] = useState(null);

  const resetForm = () => {
    setFormData({
      name: "",
      name_en: "",
      description: "",
      min_stock_threshold: 10,
      is_active: true,
      unit: "حبة",
      category_id: null,
      cost: "",
      show_in_inventory: true,
      linked_green_bean_id: null,
    });
    setEditingItem(null);
  };

  const loadItem = (item) => {
    setEditingItem(item);
    const showInInventory = item.show_in_inventory !== false;
    setFormData({
      name: item.name,
      name_en: item.name_en || "",
      description: item.description || "",
      min_stock_threshold: item.min_stock_threshold || 10,
      max_stock_threshold:
        item.max_stock_threshold !== undefined &&
        item.max_stock_threshold !== null
          ? item.max_stock_threshold
          : null,
      is_active: showInInventory,
      unit: item.unit || "حبة",
      category_id: item.category_id || null,
      cost: item.cost != null ? item.cost : "",
      show_in_inventory: showInInventory,
      linked_green_bean_id: item.linked_green_bean_id || null,
    });
  };

  // Wrap setFormData to keep is_active in sync with show_in_inventory
  const setFormDataSynced = (valueOrUpdater) => {
    setFormData((prev) => {
      const next =
        typeof valueOrUpdater === "function"
          ? valueOrUpdater(prev)
          : valueOrUpdater;
      // Sync is_active to match show_in_inventory
      if (next.show_in_inventory !== undefined) {
        return { ...next, is_active: next.show_in_inventory };
      }
      return next;
    });
  };

  return {
    formData,
    setFormData: setFormDataSynced,
    editingItem,
    resetForm,
    loadItem,
  };
}
