import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

/**
 * Mutation for creating an inventory transfer between branches.
 * Encapsulates the POST /api/inventory-transfers call + cache invalidation.
 *
 * Usage:
 *   const transferMutation = useCreateTransfer({
 *     onSuccess: (data) => { ... },
 *     onError: (err) => { ... },
 *   });
 *   transferMutation.mutate({ fromBranchId, toBranchId, items, note, operationDate });
 *
 * Payload shape:
 *   {
 *     fromBranchId: number,
 *     toBranchId: number,
 *     items: [{ itemId: number, quantity: number }, ...],
 *     note?: string | null,
 *     operationDate?: string | null   // ISO datetime
 *   }
 */
export function useCreateTransfer({ onSuccess, onError } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const response = await adminFetch("/api/inventory-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranchId: payload.fromBranchId,
          toBranchId: payload.toBranchId,
          items: payload.items,
          note: payload.note ? String(payload.note).trim() || null : null,
          operationDate: payload.operationDate || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "فشل في تنفيذ التحويل");
      }

      return data;
    },
    onSuccess: (data) => {
      // Every downstream query that derives from inventory_items /
      // inventory_operations must invalidate so the UI reflects the
      // new stock distribution. Previously variance / stock-value /
      // over-stock / dashboard-analytics were stale until manual
      // refresh, which made the post-transfer numbers look wrong on
      // those screens.
      queryClient.invalidateQueries({ queryKey: ["inventory-operations"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["items-summary"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock"] });
      queryClient.invalidateQueries({ queryKey: ["low-stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["over-stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-value"] });
      queryClient.invalidateQueries({ queryKey: ["variance"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["operation-details"] });
      onSuccess?.(data);
    },
    onError: (err) => {
      console.error("useCreateTransfer error", err);
      onError?.(err);
    },
  });
}
