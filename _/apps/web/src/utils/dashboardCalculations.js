export function calculateDashboardStats(
  operations,
  branches,
  items,
  employees,
) {
  const totalOperations = operations?.length || 0;
  const completedOperations =
    operations?.filter(
      (op) => op.status === "Completed" && op.inventory_type !== "Receipt",
    ).length || 0;
  const pendingOperations =
    operations?.filter((op) => op.status === "Pending").length || 0;
  const totalBranches = branches?.length || 0;
  const totalItems = items?.length || 0;
  const totalEmployees = employees?.length || 0;
  const adminCount =
    employees?.filter((emp) => emp.role === "Admin").length || 0;

  const completionRate =
    totalOperations > 0
      ? Math.round((completedOperations / totalOperations) * 100)
      : 0;

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfLast7 = new Date(startOfToday);
  startOfLast7.setDate(startOfLast7.getDate() - 6);

  const operationsToday =
    operations?.filter((op) => new Date(op.created_at) >= startOfToday)
      .length || 0;

  const operationsLast7 =
    operations?.filter((op) => new Date(op.created_at) >= startOfLast7)
      .length || 0;

  return {
    totalOperations,
    completedOperations,
    pendingOperations,
    totalBranches,
    totalItems,
    totalEmployees,
    adminCount,
    completionRate,
    operationsToday,
    operationsLast7,
  };
}

export function getActiveItems(items) {
  return (items || []).filter((i) => i.show_in_inventory !== false);
}

export function getSelectedItemName(selectedItemId, activeItems) {
  if (!selectedItemId) {
    return "";
  }
  const idNum = parseInt(selectedItemId);
  const match = activeItems.find((it) => it.id === idNum);
  return match?.name || "";
}
