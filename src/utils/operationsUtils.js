export function calculateOperationStats(filteredOperations) {
  const ops = filteredOperations || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  return {
    total: ops.length,
    receipts: ops.filter((op) => op.inventory_type === "Receipt").length,
    daily: ops.filter((op) => op.inventory_type === "Daily").length,
    transfers: ops.filter((op) => op.inventory_type === "Transfer").length,
    today: ops.filter(
      (op) =>
        (op.operation_date || op.created_at || "").slice(0, 10) === todayStr,
    ).length,
  };
}

export function getOperationItemStats(details) {
  if (!details?.items) return null;

  const totalItems = details.items.length;
  const availableItems = details.items.filter(
    (item) => Number(item.quantity) > 0,
  ).length;
  const unavailableItems = totalItems - availableItems;
  const availabilityRate =
    totalItems > 0 ? ((availableItems / totalItems) * 100).toFixed(1) : 0;
  const totalQuantity = details.items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );

  return {
    totalItems,
    availableItems,
    unavailableItems,
    availabilityRate,
    totalQuantity,
  };
}
