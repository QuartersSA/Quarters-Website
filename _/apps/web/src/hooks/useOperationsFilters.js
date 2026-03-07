import { useState, useMemo } from "react";

export function useOperationsFilters(operations) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filteredOperations = useMemo(() => {
    return operations?.filter((op) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNumber = op.inventory_number?.toLowerCase().includes(q);
        const matchReceipt = op.receipt_item_name?.toLowerCase().includes(q);
        if (!matchNumber && !matchReceipt) {
          return false;
        }
      }

      if (selectedBranch && op.branch_id !== parseInt(selectedBranch)) {
        return false;
      }

      if (selectedType && op.inventory_type !== selectedType) {
        return false;
      }

      const filterDate = op.operation_date || op.created_at;

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (new Date(filterDate) < fromDate) {
          return false;
        }
      }

      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(filterDate) > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [operations, searchQuery, selectedBranch, selectedType, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedBranch("");
    setSelectedType("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    searchQuery || selectedBranch || selectedType || dateFrom || dateTo;

  return {
    searchQuery,
    setSearchQuery,
    selectedBranch,
    setSelectedBranch,
    selectedType,
    setSelectedType,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    filteredOperations,
    clearFilters,
    hasActiveFilters,
  };
}
