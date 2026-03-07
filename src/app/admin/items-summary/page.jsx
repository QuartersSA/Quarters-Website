"use client";

import { useMemo, useState } from "react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";
import { useItemsSummary } from "@/hooks/useItemsSummary";
import { useItemsSummaryFilters } from "@/hooks/useItemsSummaryFilters";
import { calculateItemsSummaryStats } from "@/utils/itemsSummaryCalculations";
import {
  exportItemsSummaryToExcel,
  exportItemsSummaryToPDF,
} from "@/utils/itemsSummaryExport";
import { ItemsSummaryHeader } from "@/components/ItemsSummary/ItemsSummaryHeader";
import { ItemsSummaryStats } from "@/components/ItemsSummary/ItemsSummaryStats";
import { ItemsSummaryFilters } from "@/components/ItemsSummary/ItemsSummaryFilters";
import { ItemsList } from "@/components/ItemsSummary/ItemsList";

export default function ItemsSummaryPage() {
  const { isAuthenticated, logout } = useAdminAuth({
    requiredPermission: "can_manage_inventory",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [expandedItems, setExpandedItems] = useState(new Set());

  const { groupedItems, branches, isLoading, refetch } =
    useItemsSummary(isAuthenticated);

  const filteredItems = useItemsSummaryFilters(
    groupedItems,
    searchQuery,
    selectedBranch,
    selectedStatus,
  );

  // Calculate statistics
  const stats = useMemo(() => {
    return calculateItemsSummaryStats(groupedItems, branches);
  }, [groupedItems, branches]);

  const toggleItemExpansion = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Export handlers
  const handleExportExcel = () => {
    exportItemsSummaryToExcel(filteredItems);
  };

  const handleExportPDF = () => {
    exportItemsSummaryToPDF(filteredItems);
  };

  // Build select options
  const branchOptions = [
    { value: "", label: "جميع الفروع" },
    ...branches.map((b) => ({ value: String(b.id), label: b.name })),
  ];

  const statusOptions = [
    { value: "", label: "جميع الحالات" },
    { value: "in-stock", label: "متوفر" },
    { value: "low-stock", label: "منخفض" },
    { value: "out-of-stock", label: "غير متوفر" },
  ];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar activePage="items-summary" onLogout={logout} />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="items-summary" />

        <ItemsSummaryHeader />

        <ItemsSummaryStats stats={stats} />

        <ItemsSummaryFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          branchOptions={branchOptions}
          statusOptions={statusOptions}
          onRefresh={refetch}
        />

        <ItemsList
          filteredItems={filteredItems}
          isLoading={isLoading}
          expandedItems={expandedItems}
          onToggleExpansion={toggleItemExpansion}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      </main>
    </div>
  );
}
