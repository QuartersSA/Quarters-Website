"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Admin/Sidebar";
import { Users, Plus } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useEmployeesAuth } from "@/hooks/useEmployeesAuth";
import { useEmployeesData } from "@/hooks/useEmployeesData";
import { useEmployeeMutations } from "@/hooks/useEmployeeMutations";
import { useEmployeeForm } from "@/hooks/useEmployeeForm";
import { filterEmployees, calculateEmployeeStats } from "@/utils/employeeUtils";
import { EmployeeStatistics } from "@/components/Employees/EmployeeStatistics";
import { EmployeeSearchBar } from "@/components/Employees/EmployeeSearchBar";
import { EmployeeExportMenu } from "@/components/Employees/EmployeeExportMenu";
import { EmployeeTable } from "@/components/Employees/EmployeeTable";
import { EmployeeModal } from "@/components/Employees/EmployeeModal/EmployeeModal";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Dashboard/Breadcrumb";

export default function EmployeesPage() {
  const { isAuthenticated, handleLogout } = useEmployeesAuth();
  const {
    employees,
    isLoadingEmployees,
    branches,
    employeesError,
    branchesError,
  } = useEmployeesData(isAuthenticated);
  const { createMutation, updateMutation, deleteMutation } =
    useEmployeeMutations();
  const {
    formData,
    setFormData,
    editingEmployee,
    resetForm,
    loadEmployee,
    toggleBranch,
  } = useEmployeeForm();

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleOpenModal = (employee = null) => {
    if (employee) {
      loadEmployee(employee);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const hasBranch = Array.isArray(formData.branchIds)
      ? formData.branchIds.length > 0
      : false;

    const needsBranch =
      formData.role !== "Admin" &&
      (!!formData.can_do_inventory || !!formData.can_close_shift);

    if (needsBranch && !hasBranch) {
      toast.error("لا يمكن إضافة/تحديث الموظف بدون تحديد فرع واحد على الأقل");
      return;
    }

    if (editingEmployee) {
      updateMutation.mutate(
        { id: editingEmployee.id, data: formData },
        {
          onSuccess: () => {
            setShowModal(false);
            resetForm();
          },
        },
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => {
          setShowModal(false);
          resetForm();
        },
      });
    }
  };

  const handleDelete = (id) => {
    if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleWorkspaceAccessQuick = (employee) => {
    updateMutation.mutate({
      id: employee.id,
      data: { can_access_workspace: !employee.can_access_workspace },
    });
  };

  const filteredEmployees = filterEmployees(employees, searchTerm);
  const { totalEmployees, adminCount, employeeCount } =
    calculateEmployeeStats(employees);

  if (!isAuthenticated) {
    return null;
  }

  const loadErrorMessage = employeesError
    ? "تعذر تحميل الموظفين. تأكد من تشغيل السيرفر ثم حدّث الصفحة."
    : branchesError
      ? "تعذر تحميل الفروع."
      : null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <Sidebar onLogout={handleLogout} activePage="employees" />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <Breadcrumb activePage="employees" />
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-6 lg:mt-0">
          <div>
            <h1
              className={`text-3xl sm:text-4xl ${ws.title} mb-2 flex items-center gap-3`}
            >
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200" />
              إدارة الموظفين
            </h1>
            <p className={ws.muted}>إدارة حسابات الموظفين وصلاحياتهم</p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className={`${ws.btnPrimary} px-6 py-3 justify-center w-full sm:w-auto`}
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">إضافة موظف</span>
          </button>
        </div>

        {loadErrorMessage ? (
          <div
            className={`${ws.glass} ${ws.card} p-4 mb-6 border border-red-500/20`}
          >
            <div className="text-red-100 font-semibold">{loadErrorMessage}</div>
            <div className="text-slate-600 dark:text-slate-600 dark:dark:text-slate-600 dark:dark:dark:text-white/60 text-sm mt-1">
              إذا استمرت المشكلة، افتح صفحة /api/employees في تبويب جديد وشوف هل
              ترجع بيانات أو خطأ.
            </div>
          </div>
        ) : null}

        {/* Statistics Cards */}
        <EmployeeStatistics
          totalEmployees={totalEmployees}
          adminCount={adminCount}
          employeeCount={employeeCount}
        />

        {/* Search Bar and Export */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <EmployeeSearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
          <EmployeeExportMenu employees={filteredEmployees} />
        </div>

        {/* Employees Table */}
        <EmployeeTable
          employees={filteredEmployees}
          isLoading={isLoadingEmployees}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          onToggleWorkspace={toggleWorkspaceAccessQuick}
        />
      </main>

      {/* Add/Edit Modal */}
      <EmployeeModal
        isOpen={showModal}
        isEditing={!!editingEmployee}
        formData={formData}
        setFormData={setFormData}
        branches={branches}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
        onToggleBranch={toggleBranch}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
