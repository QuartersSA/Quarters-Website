import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

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
    queryKey: queryKeys.lowStock(),
    queryFn: async () => {
      const response = await adminFetch("/api/items/low-stock");
      if (!response.ok) throw new Error("Failed to fetch low stock items");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches(),
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
    // Derive every counter from the same `getLowStockStatus` classifier
    // the table renders. Previously the stat filters re-implemented the
    // logic with strict `=== 0` / `> 0` comparisons, while the table
    // label fell back to 0 on falsy values via `Number(x) || 0`. If a
    // row's `current_quantity` ever became `undefined` / NaN, the table
    // would label it "غير متوفر" but the stat counter would skip it
    // (NaN === 0 is false), producing visible drift between the cards
    // and the table on the same screen.
    let outOfStock = 0;
    let criticalItems = 0;
    for (const item of filteredItems) {
      const severity = getLowStockStatus(item).severity;
      if (severity === "out") outOfStock += 1;
      else if (severity === "critical") criticalItems += 1;
    }

    return {
      totalLowStock: filteredItems.length,
      outOfStock,
      criticalItems,
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
