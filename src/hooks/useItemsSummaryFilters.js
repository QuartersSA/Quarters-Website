import { useMemo } from "react";

// Filter items + reduce each item's `branches[]` to only the matching
// rows, so the on-screen card AND the Excel/PDF export reflect the
// active filter. The previous version kept items where ANY branch
// matched but left `branches` intact — the table and export then
// showed all branches anyway, making the filter look broken.
export function useItemsSummaryFilters(
  groupedItems,
  searchQuery,
  selectedBranch,
  selectedStatus,
) {
  const filteredItems = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    const branchId = selectedBranch ? parseInt(selectedBranch, 10) : null;

    const matchesSearch = (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q));

    const matchesBranchRow = (branch) =>
      branchId == null || Number(branch.branch_id) === branchId;

    const matchesStatusRow = (branch, threshold) => {
      if (!selectedStatus) return true;
      const qty = Number(branch.current_quantity) || 0;
      const min = Number(threshold) || 0;
      if (selectedStatus === "out-of-stock") return qty === 0;
      if (selectedStatus === "low-stock") return qty > 0 && qty < min;
      if (selectedStatus === "in-stock") return qty >= min;
      return true;
    };

    const result = [];
    for (const item of groupedItems) {
      if (!matchesSearch(item)) continue;

      const sourceBranches = Array.isArray(item.branches)
        ? item.branches
        : [];

      // Reduce branches to only those that pass BOTH per-branch filters.
      const filteredBranches = sourceBranches.filter(
        (b) =>
          matchesBranchRow(b) && matchesStatusRow(b, item.min_stock_threshold),
      );

      // If no branch survives the per-row filters, drop the item.
      if (filteredBranches.length === 0) continue;

      result.push({
        ...item,
        branches: filteredBranches,
      });
    }

    return result;
  }, [groupedItems, searchQuery, selectedBranch, selectedStatus]);

  return filteredItems;
}
