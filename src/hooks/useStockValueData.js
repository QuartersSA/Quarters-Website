import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

// Wraps `/api/items/stock-value` + branches list + client-side search,
// sort, hide-missing-cost. Aggregates stats over the *filtered* set so
// the cards match the visible table.
//
// `selectedBranch` is the user's branch picker. Empty string / "all"
// means "every branch" — same call as before. A numeric id triggers a
// server-side per-branch slice via the `branchId` query string.
export function useStockValueData({
  isAuthenticated,
  searchQuery,
  sortBy,
  hideMissingCost,
  selectedBranch,
}) {
  const branchFilter =
    selectedBranch && selectedBranch !== "all" ? selectedBranch : "";

  const {
    data: rows = [],
    isLoading,
    refetch,
  } = useQuery({
    // Include branch in the cache key so each branch slice is cached
    // independently. Switching between branches feels instant once
    // each has been viewed once.
    queryKey: ["stock-value", branchFilter || "all"],
    queryFn: async () => {
      const qs = branchFilter
        ? `?branchId=${encodeURIComponent(branchFilter)}`
        : "";
      const res = await adminFetch(`/api/items/stock-value${qs}`);
      if (!res.ok) throw new Error("Failed to fetch stock value");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const res = await adminFetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const filteredItems = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    let out = Array.isArray(rows) ? rows.slice() : [];

    if (q) {
      out = out.filter((r) => {
        const name = String(r.name || "").toLowerCase();
        const nameEn = String(r.name_en || "").toLowerCase();
        const cat = String(r.category_name || "").toLowerCase();
        return name.includes(q) || nameEn.includes(q) || cat.includes(q);
      });
    }

    if (hideMissingCost) {
      // "missing cost" = no effective price (direct i.cost AND green-bean
      // fallback both null). Matches the stat card + table indicator.
      out = out.filter(
        (r) =>
          r.effective_cost != null &&
          Number.isFinite(Number(r.effective_cost)),
      );
    }

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    switch (sortBy) {
      case "value_desc":
        out.sort((a, b) => num(b.total_value) - num(a.total_value));
        break;
      case "value_asc":
        out.sort((a, b) => num(a.total_value) - num(b.total_value));
        break;
      case "qty_desc":
        out.sort((a, b) => num(b.total_quantity) - num(a.total_quantity));
        break;
      case "qty_asc":
        out.sort((a, b) => num(a.total_quantity) - num(b.total_quantity));
        break;
      case "name_desc":
        out.sort((a, b) =>
          String(b.name || "").localeCompare(String(a.name || ""), "ar"),
        );
        break;
      case "name_asc":
      default:
        out.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "ar"),
        );
        break;
    }

    return out;
  }, [rows, searchQuery, sortBy, hideMissingCost]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let missingCostCount = 0;
    let topItemName = null;
    let topItemValue = 0;

    for (const r of filteredItems) {
      const v = Number(r.total_value);
      const eff = r.effective_cost;
      if (eff == null || !Number.isFinite(Number(eff))) {
        missingCostCount += 1;
        continue;
      }
      if (Number.isFinite(v)) {
        totalValue += v;
        if (v > topItemValue) {
          topItemValue = v;
          topItemName = r.name;
        }
      }
    }

    return {
      totalValue,
      itemCount: filteredItems.length,
      missingCostCount,
      topItemName,
      topItemValue,
    };
  }, [filteredItems]);

  return {
    rows,
    filteredItems,
    branches,
    stats,
    isLoading,
    refetch,
  };
}
