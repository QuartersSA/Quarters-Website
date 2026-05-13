"use client";

import { useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useStockValueData } from "@/hooks/useStockValueData";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";
import { StockValueHeader } from "@/components/StockValue/StockValueHeader";
import { StockValueStats } from "@/components/StockValue/StockValueStats";
import { StockValueFilters } from "@/components/StockValue/StockValueFilters";
import { StockValueTable } from "@/components/StockValue/StockValueTable";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";

export default function StockValuePage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("value_desc");
  const [hideMissingCost, setHideMissingCost] = useState(false);

  const { filteredItems, stats, isLoading, refetch } = useStockValueData({
    isAuthenticated,
    searchQuery,
    sortBy,
    hideMissingCost,
  });

  // Export columns mirror the on-screen table 1-to-1 so the file
  // reflects exactly what the user saw, including the current sort.
  const exportColumns = [
    { header: "#", accessor: (_r, idx) => idx + 1 },
    { header: "الصنف", accessor: (r) => r.name },
    { header: "الفئة", accessor: (r) => r.category_name || "-" },
    {
      header: "الكمية الإجمالية",
      accessor: (r) => Number(r.total_quantity) || 0,
    },
    { header: "الوحدة", accessor: (r) => r.unit || "-" },
    {
      header: "سعر التكلفة (ر.س)",
      accessor: (r) => (r.cost == null ? "غير محدد" : Number(r.cost) || 0),
    },
    {
      header: "القيمة الإجمالية (ر.س)",
      accessor: (r) =>
        r.total_value == null ? "—" : Number(r.total_value) || 0,
    },
  ];

  const handleExportExcel = () => {
    const dateSlug = new Date().toISOString().split("T")[0];
    exportToExcelHTML(
      filteredItems,
      `قيمة_المخزون_${dateSlug}`,
      exportColumns,
      `تقرير قيمة المخزون — إجمالي ${stats.totalValue.toFixed(2)} ر.س`,
    );
  };

  const handleExportPDF = () => {
    const dateSlug = new Date().toISOString().split("T")[0];
    exportToPDF(
      filteredItems,
      `قيمة_المخزون_${dateSlug}`,
      exportColumns,
      `تقرير قيمة المخزون — إجمالي ${stats.totalValue.toFixed(2)} ر.س`,
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="stock-value" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="stock-value" />

        <StockValueHeader />

        <StockValueStats stats={stats} />

        <StockValueFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          hideMissingCost={hideMissingCost}
          onHideMissingCostChange={setHideMissingCost}
          onRefresh={refetch}
        />

        <StockValueTable
          items={filteredItems}
          totalValue={stats.totalValue}
          isLoading={isLoading}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      </main>
    </div>
  );
}
