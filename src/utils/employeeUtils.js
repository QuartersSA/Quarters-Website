export function filterEmployees(employees, searchTerm) {
  if (!employees) return [];

  const term = (searchTerm || "").toLowerCase();
  if (!term) return employees;

  return employees.filter(
    (emp) =>
      emp.name?.toLowerCase().includes(term) ||
      emp.display_name?.toLowerCase().includes(term) ||
      emp.username?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.phone?.toLowerCase().includes(term) ||
      emp.iqama_number?.toLowerCase().includes(term),
  );
}

export function calculateEmployeeStats(employees) {
  if (!employees) {
    return {
      totalEmployees: 0,
      adminCount: 0,
      employeeCount: 0,
    };
  }

  return {
    totalEmployees: employees.length,
    adminCount: employees.filter((e) => e.role === "Admin").length,
    employeeCount: employees.filter((e) => e.role === "Employee").length,
  };
}
