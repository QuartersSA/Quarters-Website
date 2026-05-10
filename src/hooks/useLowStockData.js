import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Data + derived state for the /admin/low-stock page.
 *
 * Returns:
 *   lowStockItems     — raw rows from /api/items/low-stock
 *   branches          — for the branch filter
 *   filteredItems     — after applying searchQuery + selectedBranch
 *   stats             — { totalLowStock, outOfStock, criticalItems, branches }
 *   isLoading         — query in flight
 *   refetch           — re-fetch the items
 */
export function useLowStockData({ isAuthenticated, searchQuery, selectedBranch }) {
  const {
    data: lowStockItems = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["low-stock-items"],
    queryFn: async () => {
      const response = await adminFetch("/api/items/low-stock");
      if (!response.ok) throw new Error("Failed to fetch low stock items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const response = await adminFetch("/api/branches");
      if (!response.ok) throw new Error("Failed to fetch branches");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const filteredItems = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    return lowStockItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q));
      const matchesBranch =
        !selectedBranch || item.branch_id === parseInt(selectedBranch);
      return matchesSearch && matchesBranch;
    });
  }, [lowStockItems, searchQuery, selectedBranch]);

  const stats = useMemo(() => {
    return {
      totalLowStock: filteredItems.length,
      outOfStock: filteredItems.filter(
        (item) => Number(item.current_quantity) === 0,
      ).length,
      criticalItems: filteredItems.filter(
        (item) =>
          Number(item.current_quantity) > 0 &&
          Number(item.current_quantity) < Number(item.min_stock_threshold) * 0.5,
      ).length,
      branches: [...new Set(filteredItems.map((item) => item.branch_id))].length,
    };
  }, [filteredItems]);

  return {
    lowStockItems,
    branches,
    filteredItems,
    stats,
    isLoading,
    refetch,
  };
}

/**
 * Status helper used by the table (pure function).
 * Returns { label, color, severity } without JSX so the consumer can pick the icon.
 */
export function getLowStockStatus(item) {
  const qty = Number(item.current_quantity) || 0;
  const threshold = Number(item.min_stock_threshold) || 0;

  if (qty === 0) {
    return {
      label: "غير متوفر",
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      severity: "out",
    };
  }
  if (qty < threshold * 0.5) {
    return {
      label: "حرج",
      color: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      severity: "critical",
    };
  }
  return {
    label: "منخفض",
    color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    severity: "low",
  };
}
