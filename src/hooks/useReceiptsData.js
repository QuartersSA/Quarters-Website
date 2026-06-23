import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import { queryKeys } from "../utils/queryKeys.js";

/**
 * Fetches purchase receipts with optional filters and groups by receipt_batch_id.
 *
 * Returns:
 *   rows         — raw receipt rows
 *   groups       — array of { batchId | null, receivedAt, branchId, branchName,
 *                              items[], totalItems, employeeName, note, isLegacy }
 *   isLoading    — loading flag
 *   error        — error or null
 *   refetch      — re-fetch
 */
export function useReceiptsData({
  isAuthenticated,
  branchId,
  itemId,
  dateFrom,
  dateTo,
}) {
  const query = useQuery({
    queryKey: queryKeys.purchaseReceipts(branchId,itemId,dateFrom,dateTo),
    enabled: isAuthenticated,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (branchId) qs.set("branchId", branchId);
      if (itemId) qs.set("itemId", itemId);
      if (dateFrom) qs.set("from", dateFrom);
      if (dateTo) qs.set("to", dateTo);

      const url = `/api/purchase-receipts${qs.toString() ? `?${qs.toString()}` : ""}`;
      const res = await adminFetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch receipts");
      }
      return Array.isArray(data?.rows) ? data.rows : [];
    },
  });

  const rows = query.data || [];

  const groups = useMemo(() => {
    const byBatch = new Map();
    const singles = [];

    for (const r of rows) {
      if (r.receipt_batch_id) {
        if (!byBatch.has(r.receipt_batch_id)) {
          byBatch.set(r.receipt_batch_id, []);
        }
        byBatch.get(r.receipt_batch_id).push(r);
      } else {
        singles.push(r);
      }
    }

    const result = [];

    for (const [batchId, items] of byBatch.entries()) {
      const first = items[0];
      result.push({
        key: `batch-${batchId}`,
        batchId,
        isLegacy: false,
        receivedAt: first.received_at,
        branchId: first.branch_id,
        branchName: first.branch_name,
        items: items,
        totalItems: items.length,
        totalQty: items.reduce((s, x) => s + Number(x.quantity || 0), 0),
        employeeName: first.created_by_employee_name,
        note: first.note,
        createdAt: first.created_at,
      });
    }

    for (const r of singles) {
      result.push({
        key: `single-${r.id}`,
        batchId: null,
        isLegacy: true,
        receivedAt: r.received_at,
        branchId: r.branch_id,
        branchName: r.branch_name,
        items: [r],
        totalItems: 1,
        totalQty: Number(r.quantity || 0),
        employeeName: r.created_by_employee_name,
        note: r.note,
        createdAt: r.created_at,
      });
    }

    // Sort by receivedAt DESC
    result.sort((a, b) => {
      const ta = new Date(a.receivedAt).getTime();
      const tb = new Date(b.receivedAt).getTime();
      return tb - ta;
    });

    return result;
  }, [rows]);

  return {
    rows,
    groups,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
