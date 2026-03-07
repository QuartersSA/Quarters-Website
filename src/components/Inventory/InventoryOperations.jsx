import { useQuery } from "@tanstack/react-query";
import { Package, User, Calendar, AlertCircle } from "lucide-react";
import { adminFetch } from "@/utils/apiAuth";

export default function InventoryOperations({ selectedBranch }) {
  const {
    data: operations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["inventory-operations", selectedBranch],
    queryFn: async () => {
      const url = selectedBranch
        ? `/api/inventory-operations?branchId=${selectedBranch}`
        : "/api/inventory-operations";

      const response = await adminFetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch inventory operations");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>Failed to load inventory operations</p>
        </div>
      </div>
    );
  }

  if (!operations || operations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2" />
          <p>No inventory operations found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Inventory Operations
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {operations.length} operation{operations.length !== 1 ? "s" : ""}{" "}
          found
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {operations.map((operation) => (
          <div
            key={operation.id}
            className="p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {operation.inventory_number}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span>{operation.inventory_type} Inventory</span>
                  </div>

                  {operation.branch_name && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Branch:</span>
                      <span>{operation.branch_name}</span>
                    </div>
                  )}

                  {operation.employee_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span>{operation.employee_name}</span>
                    </div>
                  )}
                </div>

                {operation.created_at && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {new Date(operation.created_at).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
