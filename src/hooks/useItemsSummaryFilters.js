import { useMemo } from "react";

export function useItemsSummaryFilters(
  groupedItems,
  searchQuery,
  selectedBranch,
  selectedStatus,
) {
  const filteredItems = useMemo(() => {
    return groupedItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchesBranch = true;
      if (selectedBranch) {
        matchesBranch = item.branches.some(
          (b) => b.branch_id === parseInt(selectedBranch),
        );
      }

      let matchesStatus = true;
      if (selectedStatus) {
        if (selectedStatus === "out-of-stock") {
          matchesStatus = item.branches.some(
            (b) => Number(b.current_quantity) === 0,
          );
        } else if (selectedStatus === "low-stock") {
          matchesStatus = item.branches.some(
            (b) =>
              Number(b.current_quantity) > 0 &&
              Number(b.current_quantity) < item.min_stock_threshold,
          );
        } else if (selectedStatus === "in-stock") {
          matchesStatus = item.branches.every(
            (b) => Number(b.current_quantity) >= item.min_stock_threshold,
          );
        }
      }

      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [groupedItems, searchQuery, selectedBranch, selectedStatus]);

  return filteredItems;
}
