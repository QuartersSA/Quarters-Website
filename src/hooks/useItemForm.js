import { useState } from "react";

// Empty form starts with a single placeholder unit row — the
// ItemUnitsPanel will flag it as base + both defaults on first
// mount. Stays empty when the modal is closed; loadItem hydrates
// it from the server-returned `units` array when editing.
const EMPTY_FORM = {
  name: "",
  name_en: "",
  description: "",
  min_stock_threshold: 10,
  max_stock_threshold: null,
  is_active: true,
  unit: "حبة",
  category_id: null,
  cost: "",
  base_purchase_cost: "",
  units: [],
  show_in_inventory: true,
  linked_green_bean_id: null,
};

export function useItemForm() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingItem, setEditingItem] = useState(null);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingItem(null);
  };

  const loadItem = (item) => {
    setEditingItem(item);
    const showInInventory = item.show_in_inventory !== false;
    // Map server units → panel rows. The two default_* flags on
    // each row are derived from the item's default_*_unit_id
    // pointers so the dropdowns highlight the correct row on edit.
    const serverUnits = Array.isArray(item.units) ? item.units : [];
    const mappedUnits = serverUnits.map((u) => ({
      unit_id: u.unit_id,
      name_ar: u.name_ar,
      name_en: u.name_en || null,
      conversion_factor: Number(u.conversion_factor) || 1,
      is_base: !!u.is_base,
      default_purchase: u.id === item.default_purchase_unit_id,
      default_inventory: u.id === item.default_inventory_unit_id,
    }));
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
      is_active: item.is_active !== false,
      unit: item.unit || "حبة",
      category_id: item.category_id || null,
      cost: item.cost != null ? item.cost : "",
      base_purchase_cost:
        item.base_purchase_cost != null
          ? item.base_purchase_cost
          : item.cost != null
            ? item.cost
            : "",
      units: mappedUnits,
      show_in_inventory: showInInventory,
      linked_green_bean_id: item.linked_green_bean_id || null,
    });
  };

  return {
    formData,
    setFormData,
    editingItem,
    resetForm,
    loadItem,
  };
}
