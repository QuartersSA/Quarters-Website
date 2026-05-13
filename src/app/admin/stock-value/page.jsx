"use client";

import { useMemo, useState } from "react";
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
  // "" = جميع الفروع (default). Numeric string = single-branch slice.
  const [selectedBranch, setSelectedBranch] = useState("");

  const { filteredItems, stats, branches, isLoading, refetch } =
    useStockValueData({
      isAuthenticated,
      searchQuery,
      sortBy,
      hideMissingCost,
      selectedBranch,
    });

  const branchOptions = useMemo(
    () => [
      { value: "", label: "جميع الفروع" },
      ...((Array.isArray(branches) ? branches : []).map((b) => ({
        value: String(b.id),
        label: b.name,
      }))),
    ],
    [branches],
  );

  const branchLabel = useMemo(() => {
    if (!selectedBranch) return "";
    const b = (branches || []).find(
      (br) => String(br.id) === String(selectedBranch),
    );
    return b?.name || "";
  }, [branches, selectedBranch]);

  // Export columns mirror the on-screen table 1-to-1 so the file
  // reflects exactly what the user saw, including the current sort
  // and branch filter.
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
      // Export the effective cost (i.cost OR fallback to latest bean
      // order price). Matches the on-screen column + dashboard math so
      // the exported total reconciles with what the user saw.
      accessor: (r) =>
        r.effective_cost == null
          ? "غير محدد"
          : Number(r.effective_cost) || 0,
    },
    {
      header: "القيمة الإجمالية (ر.س)",
      accessor: (r) =>
        r.total_value == null ? "—" : Number(r.total_value) || 0,
    },
  ];

  const handleExportExcel = () => {
    const dateSlug = new Date().toISOString().split("T")[0];
    const scope = branchLabel ? `_${branchLabel}` : "";
    const titleSuffix = branchLabel
      ? ` — فرع "${branchLabel}"`
      : "";
    exportToExcelHTML(
      filteredItems,
      `قيمة_المخزون${scope}_${dateSlug}`,
      exportColumns,
      `تقرير قيمة المخزون${titleSuffix} — إجمالي ${stats.totalValue.toFixed(2)} ر.س`,
    );
  };

  const handleExportPDF = () => {
    const dateSlug = new Date().toISOString().split("T")[0];
    const scope = branchLabel ? `_${branchLabel}` : "";
    const titleSuffix = branchLabel
      ? ` — فرع "${branchLabel}"`
      : "";
    exportToPDF(
      filteredItems,
      `قيمة_المخزون${scope}_${dateSlug}`,
      exportColumns,
      `تقرير قيمة المخزون${titleSuffix} — إجمالي ${stats.totalValue.toFixed(2)} ر.س`,
    );
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="stock-value" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="stock-value" />

        <StockValueHeader branchLabel={branchLabel} />

        <StockValueStats stats={stats} />

        <StockValueFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          hideMissingCost={hideMissingCost}
          onHideMissingCostChange={setHideMissingCost}
          onRefresh={refetch}
          branchOptions={branchOptions}
          selectedBranch={selectedBranch}
          onBranchChange={setSelectedBranch}
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
