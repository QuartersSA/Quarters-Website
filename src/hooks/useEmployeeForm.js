import { useState } from "react";

const initialFormState = {
  name: "",
  display_name: "",
  email: "",
  phone: "",
  username: "",
  password: "",
  role: "Employee",
  branchIds: [],
  // Admin section permissions
  can_access_workspace: false,
  can_manage_inventory: false,
  can_manage_accounting: false,
  can_manage_employees: false,
  can_access_hr: false,
  can_manage_deductions: false,
  can_manage_marketing: false,
  can_manage_purchases: false,
  // Admin notification preferences (WhatsApp)
  notify_shift_close_wa: false,
  notify_inventory_operation_wa: false,
  // Employee permissions
  can_do_inventory: false,
  can_close_shift: false,
  can_log_waste: false,
  can_add_purchase_invoices: false,
  can_manage_suppliers: false,
};

export function useEmployeeForm() {
  const [formData, setFormData] = useState(initialFormState);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingEmployee(null);
  };

  const loadEmployee = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name || "",
      display_name: employee.display_name || "",
      email: employee.email || "",
      phone: employee.phone || "",
      username: employee.username || "",
      password: "",
      role: employee.role || "Employee",
      branchIds: employee.branches?.map((b) => b.id) || [],
      // Admin section permissions
      can_access_workspace: !!employee.can_access_workspace,
      can_manage_inventory: !!employee.can_manage_inventory,
      can_manage_accounting: !!employee.can_manage_accounting,
      can_manage_employees: !!employee.can_manage_employees,
      can_access_hr: !!employee.can_access_hr,
      can_manage_deductions: !!employee.can_manage_deductions,
      can_manage_marketing: !!employee.can_manage_marketing,
      can_manage_purchases: !!employee.can_manage_purchases,
      // Admin notification preferences (WhatsApp)
      notify_shift_close_wa: !!employee.notify_shift_close_wa,
      notify_inventory_operation_wa: !!employee.notify_inventory_operation_wa,
      // Employee permissions
      can_do_inventory: !!employee.can_do_inventory,
      can_close_shift: !!employee.can_close_shift,
      can_log_waste: !!employee.can_log_waste,
      can_add_purchase_invoices: !!employee.can_add_purchase_invoices,
      can_manage_suppliers: !!employee.can_manage_suppliers,
    });
  };

  const toggleBranch = (branchId) => {
    setFormData((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter((id) => id !== branchId)
        : [...prev.branchIds, branchId],
    }));
  };

  return {
    formData,
    setFormData,
    editingEmployee,
    resetForm,
    loadEmployee,
    toggleBranch,
  };
}
