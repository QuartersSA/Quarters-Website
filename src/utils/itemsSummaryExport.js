import {
  exportToExcelHTML,
  exportToPDF,
  formatInventoryType,
  formatDateTime,
} from "@/utils/exportUtils";

export function exportItemsSummaryToExcel(filteredItems) {
  // Flatten data for export - one row per item-branch combination
  const exportData = [];
  filteredItems.forEach((item) => {
    item.branches.forEach((branch) => {
      const bQty = Number(branch.current_quantity) || 0;
      exportData.push({
        item_name: item.name,
        item_name_en: item.name_en || "-",
        item_unit: item.unit || "حبة",
        item_description: item.description || "-",
        branch_name: branch.branch_name,
        branch_location: branch.branch_location || "-",
        current_quantity: bQty,
        min_threshold: item.min_stock_threshold,
        status:
          bQty === 0
            ? "غير متوفر"
            : bQty < item.min_stock_threshold
              ? "منخفض"
              : "متوفر",
        inventory_number: branch.inventory_number || "-",
        inventory_type: branch.inventory_type
          ? formatInventoryType(branch.inventory_type)
          : "-",
        operation_date: branch.operation_date
          ? formatDateTime(branch.operation_date)
          : "-",
        employee_name: branch.employee_name || "-",
        total_operations: branch.total_operations || 0,
      });
    });
  });

  const columns = [
    { header: "اسم الصنف", accessor: (item) => item.item_name },
    { header: "Item Name (EN)", accessor: (item) => item.item_name_en },
    { header: "نوع المنتج", accessor: (item) => item.item_unit },
    { header: "الوصف", accessor: (item) => item.item_description },
    { header: "الفرع", accessor: (item) => item.branch_name },
    { header: "الموقع", accessor: (item) => item.branch_location },
    { header: "الكمية الحالية", accessor: (item) => item.current_quantity },
    { header: "الحد الأدنى", accessor: (item) => item.min_threshold },
    { header: "الحالة", accessor: (item) => item.status },
    { header: "رقم آخر جرد", accessor: (item) => item.inventory_number },
    { header: "نوع الجرد", accessor: (item) => item.inventory_type },
    { header: "تاريخ آخر جرد", accessor: (item) => item.operation_date },
    { header: "الموظف", accessor: (item) => item.employee_name },
    {
      header: "عدد العمليات",
      accessor: (item) => item.total_operations,
    },
  ];

  exportToExcelHTML(
    exportData,
    `ملخص_الأصناف_الشامل_${new Date().toISOString().split("T")[0]}`,
    columns,
    "ملخص الأصناف الشامل - نظام إدارة المخزون",
  );
}

export function exportItemsSummaryToPDF(filteredItems) {
  // Simplified version for PDF
  const exportData = [];
  filteredItems.forEach((item) => {
    item.branches.forEach((branch) => {
      const bQty = Number(branch.current_quantity) || 0;
      exportData.push({
        item_name: item.name,
        item_name_en: item.name_en || "-",
        item_unit: item.unit || "حبة",
        branch_name: branch.branch_name,
        current_quantity: bQty,
        min_threshold: item.min_stock_threshold,
        status:
          bQty === 0
            ? "غير متوفر"
            : bQty < item.min_stock_threshold
              ? "منخفض"
              : "متوفر",
        last_inventory: branch.inventory_number || "-",
      });
    });
  });

  const columns = [
    { header: "الصنف", accessor: (item) => item.item_name },
    { header: "Item Name (EN)", accessor: (item) => item.item_name_en },
    { header: "النوع", accessor: (item) => item.item_unit },
    { header: "الفرع", accessor: (item) => item.branch_name },
    { header: "الكمية", accessor: (item) => item.current_quantity },
    { header: "الحد الأدنى", accessor: (item) => item.min_threshold },
    { header: "الحالة", accessor: (item) => item.status },
    { header: "آخر جرد", accessor: (item) => item.last_inventory },
  ];

  exportToPDF(
    exportData,
    `ملخص_الأصناف_${new Date().toISOString().split("T")[0]}`,
    columns,
    "ملخص الأصناف الشامل",
  );
}
