export function calculateItemsSummaryStats(groupedItems, branches) {
  const totalItems = groupedItems.length;
  const totalBranches = branches.length;

  let totalStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  groupedItems.forEach((item) => {
    item.branches.forEach((branch) => {
      const qty = Number(branch.current_quantity) || 0;
      totalStock += qty;
      if (qty === 0) {
        outOfStockCount++;
      } else if (qty < item.min_stock_threshold) {
        lowStockCount++;
      }
    });
  });

  return {
    totalItems,
    totalBranches,
    totalStock,
    lowStockCount,
    outOfStockCount,
  };
}

export function getStockStatus(quantity, threshold) {
  const qty = Number(quantity) || 0;
  if (qty === 0) {
    return {
      label: "غير متوفر",
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: "XCircle",
    };
  } else if (qty < threshold) {
    return {
      label: "منخفض",
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      icon: "TrendingDown",
    };
  } else {
    return {
      label: "متوفر",
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: "CheckCircle",
    };
  }
}

export function getUnitIcon(unit) {
  const icons = {
    حبة: "📦",
    كيلو: "⚖️",
    كرتون: "📦",
    شدة: "🎁",
  };
  return icons[unit] || "📦";
}
