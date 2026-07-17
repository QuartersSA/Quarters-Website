"use client";

import { useMemo, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useLowStockData } from "@/hooks/useLowStockData";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";
import { LowStockHeader } from "@/components/LowStock/LowStockHeader";
import { LowStockStats } from "@/components/LowStock/LowStockStats";
import { LowStockFilters } from "@/components/LowStock/LowStockFilters";
import { LowStockTable } from "@/components/LowStock/LowStockTable";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { todayRiyadhDateKey } from "@/utils/dateUtils";

export default function LowStockPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");

  const { branches, categories, filteredItems, stats, isLoading, refetch } =
    useLowStockData({
      isAuthenticated,
      searchQuery,
      selectedBranch,
      selectedCategory,
      selectedSeverity,
    });

  const branchOptions = useMemo(
    () => [
      { value: "", label: "جميع الفروع" },
      ...branches.map((b) => ({ value: String(b.id), label: b.name })),
    ],
    [branches],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "كل الفئات" },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories],
  );

  const handleExportExcel = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الفئة", accessor: (item) => item.category_name || "-" },
      { header: "الفرع", accessor: (item) => item.branch_name },
      { header: "الموقع", accessor: (item) => item.branch_location || "-" },
      {
        header: "الكمية الحالية",
        accessor: (item) => Number(item.current_quantity) || 0,
      },
      {
        header: "الحد الأدنى للفرع",
        accessor: (item) => Number(item.min_stock_threshold) || 0,
      },
      {
        header: "نوع الحد",
        accessor: (item) =>
          item.branch_specific_threshold ? "خاص بالفرع" : "افتراضي الصنف",
      },
      {
        header: "النقص",
        accessor: (item) =>
          (Number(item.min_stock_threshold) || 0) -
          (Number(item.current_quantity) || 0),
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const q = Number(item.current_quantity) || 0;
          const t = Number(item.min_stock_threshold) || 0;
          if (q === 0) return "غير متوفر";
          if (q < t * 0.5) return "حرج";
          return "منخفض";
        },
      },
    ];

    exportToExcelHTML(
      filteredItems,
      `الأصناف_منخفضة_الكمية_${todayRiyadhDateKey()}`,
      columns,
      "تقرير الأصناف منخفضة الكمية",
    );
  };

  const handleExportPDF = () => {
    const columns = [
      { header: "اسم الصنف", accessor: (item) => item.name },
      { header: "الفرع", accessor: (item) => item.branch_name },
      {
        header: "الكمية",
        accessor: (item) => Number(item.current_quantity) || 0,
      },
      {
        header: "الحد الأدنى",
        accessor: (item) => Number(item.min_stock_threshold) || 0,
      },
      {
        header: "النقص",
        accessor: (item) =>
          (Number(item.min_stock_threshold) || 0) -
          (Number(item.current_quantity) || 0),
      },
      {
        header: "الحالة",
        accessor: (item) => {
          const q = Number(item.current_quantity) || 0;
          const t = Number(item.min_stock_threshold) || 0;
          if (q === 0) return "غير متوفر";
          if (q < t * 0.5) return "حرج";
          return "منخفض";
        },
      },
    ];

    exportToPDF(
      filteredItems,
      `الأصناف_منخفضة_الكمية_${todayRiyadhDateKey()}`,
      columns,
      "تقرير الأصناف منخفضة الكمية",
    );
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="low-stock" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="low-stock" />

        <LowStockHeader />

        <LowStockStats stats={stats} />

        <LowStockFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
          branchOptions={branchOptions}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categoryOptions={categoryOptions}
          selectedSeverity={selectedSeverity}
          onSeverityChange={setSelectedSeverity}
          onRefresh={refetch}
        />

        <LowStockTable
          items={filteredItems}
          isLoading={isLoading}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      </main>
    </div>
  );
}
