import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";

// Wraps the /api/items/stock-value query + applies client-side search,
// sort, and the "hide rows without cost" toggle. Aggregates stats over
// the *filtered* set so the cards match the visible table — same pattern
// as the Items page after the StatsCards fix.
export function useStockValueData({
  isAuthenticated,
  searchQuery,
  sortBy,
  hideMissingCost,
}) {
  const {
    data: rows = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["stock-value"],
    queryFn: async () => {
      const res = await adminFetch("/api/items/stock-value");
      if (!res.ok) throw new Error("Failed to fetch stock value");
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
      out = out.filter((r) => r.cost != null && Number.isFinite(Number(r.cost)));
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
      if (r.cost == null || !Number.isFinite(Number(r.cost))) {
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
    stats,
    isLoading,
    refetch,
  };
}
