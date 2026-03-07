"use client";

import { useMemo, useState } from "react";
import { Users, Plus } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import HRSidebar from "@/components/HR/Sidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useHREmployeesData } from "@/hooks/useHREmployeesData";
import { useHREmployeeMutations } from "@/hooks/useHREmployeeMutations";
import { filterEmployees } from "@/utils/employeeUtils";
import HRSearchBar from "@/components/HR/HRSearchBar";
import { HREmployeeTable } from "@/components/HR/HREmployeeTable";
import { HREmployeeModal } from "@/components/HR/HREmployeeModal";
import { HREmployeeLogsModal } from "@/components/HR/HREmployeeLogsModal";
import { toast } from "sonner";

function toInputDate(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

export default function HREmployeesPage() {
  const { isAuthenticated, logout, checked, reason } = useAdminAuth({
    requiredPermission: "can_access_hr",
    redirect: false,
  });

  const {
    employees,
    isLoadingEmployees,
    branches,
    employeesError,
    employeesErrorStatus,
    branchesError,
    branchesErrorStatus,
  } = useHREmployeesData(isAuthenticated);

  const { createMutation, updateMutation, deleteMutation } =
    useHREmployeeMutations();

  const emptyForm = useMemo(
    () => ({
      name: "",
      phone: "",
      iqama_number: "",
      iqama_expiry_date: "",
      sponsorship_transferred: false,
      work_card_issued: false,
      medical_check_issued: false,
      health_card_issued: false,
      position: "",
      branchId: "",
      base_salary: "",
      other_allowances: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(emptyForm);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [logsEmployee, setLogsEmployee] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  const handleOpenModal = (employee = null) => {
    if (employee) {
      const branchesList = Array.isArray(employee.branches)
        ? employee.branches
        : [];
      const firstBranchId = branchesList?.[0]?.id;

      setEditingEmployee(employee);
      setFormData({
        name: employee.name || "",
        phone: employee.phone || "",
        iqama_number: employee.iqama_number || "",
        iqama_expiry_date: toInputDate(employee.iqama_expiry_date),
        sponsorship_transferred: !!employee.sponsorship_transferred,
        work_card_issued: !!employee.work_card_issued,
        medical_check_issued: !!employee.medical_check_issued,
        health_card_issued: !!employee.health_card_issued,
        position: employee.position || "",
        branchId: firstBranchId ? String(firstBranchId) : "",
        base_salary:
          employee.base_salary === null || employee.base_salary === undefined
            ? ""
            : String(employee.base_salary),
        other_allowances:
          employee.other_allowances === null ||
          employee.other_allowances === undefined
            ? ""
            : String(employee.other_allowances),
      });
    } else {
      setEditingEmployee(null);
      setFormData(emptyForm);
    }

    setShowModal(true);
  };

  const handleOpenLogs = (employee) => {
    if (!employee) return;
    setLogsEmployee(employee);
    setShowLogsModal(true);
  };

  const handleCloseLogs = () => {
    setShowLogsModal(false);
    setLogsEmployee(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEmployee(null);
    setFormData(emptyForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const nameValue = (formData.name || "").trim();
    if (!nameValue) {
      toast.error("الاسم مطلوب");
      return;
    }

    const branchIds = formData.branchId ? [Number(formData.branchId)] : [];

    const baseSalaryValue =
      formData.base_salary === "" ? null : Number(formData.base_salary);

    const otherAllowancesValue =
      formData.other_allowances === ""
        ? null
        : Number(formData.other_allowances);

    const payload = {
      name: nameValue,
      phone: formData.phone ? String(formData.phone) : null,
      iqama_number: formData.iqama_number
        ? String(formData.iqama_number)
        : null,
      iqama_expiry_date: formData.iqama_expiry_date || null,
      sponsorship_transferred: !!formData.sponsorship_transferred,
      work_card_issued: !!formData.work_card_issued,
      medical_check_issued: !!formData.medical_check_issued,
      health_card_issued: !!formData.health_card_issued,
      position: formData.position ? String(formData.position) : null,
      base_salary: baseSalaryValue,
      other_allowances: otherAllowancesValue,
      branchIds,
    };

    if (editingEmployee) {
      updateMutation.mutate(
        { id: editingEmployee.id, data: payload },
        {
          onSuccess: () => {
            setShowModal(false);
            setEditingEmployee(null);
            setFormData(emptyForm);
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setShowModal(false);
          setEditingEmployee(null);
          setFormData(emptyForm);
        },
      });
    }
  };

  const handleDelete = (id) => {
    if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
      deleteMutation.mutate(id);
    }
  };

  const filteredEmployees = filterEmployees(employees, searchTerm);

  if (!checked) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="text-white font-bold text-lg mb-2">
            جاري التحقق من الصلاحيات…
          </div>
          <div className="text-white/60 text-sm leading-relaxed">لحظات.</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const title =
      reason === "missing_permission" ? "لا تملك صلاحية HR" : "غير مسجل دخول";

    const body =
      reason === "missing_permission"
        ? "لازم تفعيل صلاحية HR لحسابك من إدارة الموظفين (الإدارة)، وبعدها سجل خروج/دخول."
        : "سجل دخول كمدير عشان تقدر تفتح صفحة الموظفين في HR.";

    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="text-white font-bold text-lg mb-2">{title}</div>
          <div className="text-white/60 text-sm leading-relaxed">{body}</div>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <a
              href="/admin/login"
              className={`${ws.btnPrimary} px-4 py-2 justify-center`}
            >
              تسجيل الدخول
            </a>
            <a
              href="/admin/employees"
              className={`${ws.btnNeutral} px-4 py-2 justify-center`}
            >
              إدارة الموظفين (الإدارة)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const loadErrorMessage = employeesError
    ? employeesErrorStatus === 401
      ? "جلسة الدخول انتهت. سجل خروج ثم دخول مرة ثانية."
      : employeesErrorStatus === 403
        ? "ما عندك صلاحية HR لتحميل الموظفين. فعّل صلاحية HR لحسابك ثم سجل خروج/دخول."
        : "تعذر تحميل الموظفين. تأكد من تشغيل السيرفر ثم حدّث الصفحة."
    : branchesError
      ? branchesErrorStatus === 401
        ? "جلسة الدخول انتهت. سجل خروج ثم دخول مرة ثانية."
        : "تعذر تحميل الفروع."
      : null;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <HRSidebar onLogout={logout} active="employees" />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-6 lg:mt-0">
          <div>
            <h1
              className={`text-3xl sm:text-4xl ${ws.title} mb-2 flex items-center gap-3`}
            >
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-amber-200" />
              إدارة الموظفين
            </h1>
            <p className={ws.muted}>بيانات الموظفين (HR)</p>
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
            {employeesErrorStatus === 401 || branchesErrorStatus === 401 ? (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <a
                  href="/admin/login"
                  className={`${ws.btnPrimary} px-4 py-2 justify-center`}
                >
                  تسجيل الدخول
                </a>
              </div>
            ) : null}
            {employeesErrorStatus === 403 ? (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <a
                  href="/admin/employees"
                  className={`${ws.btnNeutral} px-4 py-2 justify-center`}
                >
                  إدارة الموظفين (الإدارة)
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <HRSearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        </div>

        <HREmployeeTable
          employees={filteredEmployees}
          isLoading={isLoadingEmployees}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          onViewLogs={handleOpenLogs}
        />
      </main>

      <HREmployeeModal
        isOpen={showModal}
        isEditing={!!editingEmployee}
        formData={formData}
        setFormData={setFormData}
        branches={branches}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <HREmployeeLogsModal
        isOpen={showLogsModal}
        employee={logsEmployee}
        onClose={handleCloseLogs}
      />
    </div>
  );
}
