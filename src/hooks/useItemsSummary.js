import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

export function useItemsSummary(isAuthenticated) {
  const {
    data: itemsSummary = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["items-summary"],
    queryFn: async () => {
      const response = await adminFetch("/api/items/summary");
      if (!response.ok) throw new Error("Failed to fetch items summary");
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

  // Group data by item
  const groupedItems = useMemo(() => {
    const grouped = {};
    itemsSummary.forEach((record) => {
      if (!grouped[record.id]) {
        grouped[record.id] = {
          id: record.id,
          name: record.name,
          // English name + unit propagated so exports can include them
          // without re-fetching from /api/items.
          name_en: record.name_en,
          unit: record.unit,
          description: record.description,
          min_stock_threshold: record.min_stock_threshold,
          is_active: record.is_active,
          created_at: record.created_at,
          branches: [],
        };
      }
      grouped[record.id].branches.push({
        branch_id: record.branch_id,
        branch_name: record.branch_name,
        branch_location: record.branch_location,
        operation_id: record.operation_id,
        inventory_number: record.inventory_number,
        inventory_type: record.inventory_type,
        operation_status: record.operation_status,
        operation_date: record.operation_date,
        employee_name: record.employee_name,
        current_quantity: record.current_quantity,
        last_inventory_quantity: record.last_inventory_quantity,
        receipts_since_last_inventory: record.receipts_since_last_inventory,
        total_operations: record.total_operations,
      });
    });
    return Object.values(grouped);
  }, [itemsSummary]);

  return {
    groupedItems,
    branches,
    isLoading,
    refetch,
  };
}
