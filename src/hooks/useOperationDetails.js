import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

export function useOperationDetails() {
  const [selectedOperation, setSelectedOperation] = useState(null);

  const { data: operationDetails } = useQuery({
    queryKey: queryKeys.operationDetails(selectedOperation?.id),
    queryFn: async () => {
      const response = await adminFetch(
        `/api/inventory-operations?id=${selectedOperation.id}`,
      );
      if (!response.ok) throw new Error("Failed to fetch operation details");
      return response.json();
    },
    enabled: !!selectedOperation,
  });

  return {
    selectedOperation,
    setSelectedOperation,
    operationDetails,
  };
}
