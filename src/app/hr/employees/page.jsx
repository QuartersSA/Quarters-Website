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
import HREmployeeStats from "@/components/HR/HREmployeeStats";
import HREmployeeFilters from "@/components/HR/HREmployeeFilters";
import HREmployeeExportMenu from "@/components/HR/HREmployeeExportMenu";
import { HREmployeeTable } from "@/components/HR/HREmployeeTable";
import { HREmployeeModal } from "@/components/HR/HREmployeeModal";
import { HREmployeeLogsModal } from "@/components/HR/HREmployeeLogsModal";
import SuspensionModal from "@/components/HR/SuspensionModal";
import { toast } from "sonner";

/* Bucket an ISO date against Riyadh today / +30d windows. */
function expiryBucket(dateStr, todayRiyadh, soonRiyadh) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  if (d < todayRiyadh) return "expired";
  if (d <= soonRiyadh) return "soon";
  return null;
}

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
      iqama_expiry_calendar: "gregory",
      iqama_expiry_hijri: "",
      sponsorship_transferred: false,
      work_card_issued: false,
      medical_check_issued: false,
      health_card_issued: false,
      health_card_expiry_date: "",
      health_card_expiry_calendar: "gregory",
      health_card_expiry_hijri: "",
      position: "",
      // Array of branch ids (strings, to match GlassMultiSelect's
      // value model). Multi-branch employees keep every assignment
      // across saves instead of being silently reduced to one.
      branchIds: [],
      base_salary: "",
      other_allowances: "",
      start_date: "",
    }),
    [],
  );

  const [formData, setFormData] = useState(emptyForm);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [branchFilter, setBranchFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");

  const [logsEmployee, setLogsEmployee] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  const [suspensionEmployee, setSuspensionEmployee] = useState(null);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);

  const handleOpenModal = (employee = null) => {
    if (employee) {
      // Pre-load the FULL list of branch assignments. The previous
      // `firstBranchId` shortcut silently dropped every additional
      // branch on save (the form replaced all assignments with the
      // single selected one). Multi-branch employees are explicit
      // about this in HR, so the form has to round-trip them.
      const branchesList = Array.isArray(employee.branches)
        ? employee.branches
        : [];
      const branchIds = branchesList
        .map((b) => (b?.id == null ? "" : String(b.id)))
        .filter(Boolean);

      setEditingEmployee(employee);
      setFormData({
        name: employee.name || "",
        phone: employee.phone || "",
        iqama_number: employee.iqama_number || "",
        iqama_expiry_date: toInputDate(employee.iqama_expiry_date),
        iqama_expiry_calendar: employee.iqama_expiry_calendar || "gregory",
        iqama_expiry_hijri: employee.iqama_expiry_hijri || "",
        sponsorship_transferred: !!employee.sponsorship_transferred,
        work_card_issued: !!employee.work_card_issued,
        medical_check_issued: !!employee.medical_check_issued,
        health_card_issued: !!employee.health_card_issued,
        health_card_expiry_date: toInputDate(employee.health_card_expiry_date),
        health_card_expiry_calendar:
          employee.health_card_expiry_calendar || "gregory",
        health_card_expiry_hijri: employee.health_card_expiry_hijri || "",
        position: employee.position || "",
        branchIds,
        base_salary:
          employee.base_salary === null || employee.base_salary === undefined
            ? ""
            : String(employee.base_salary),
        other_allowances:
          employee.other_allowances === null ||
          employee.other_allowances === undefined
            ? ""
            : String(employee.other_allowances),
        start_date: toInputDate(employee.start_date),
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

  const handleOpenSuspension = (employee) => {
    if (!employee) return;
    setSuspensionEmployee(employee);
    setShowSuspensionModal(true);
  };

  const handleCloseSuspension = () => {
    setShowSuspensionModal(false);
    setSuspensionEmployee(null);
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

    // Pull every selected branch id, not just the first. Without this,
    // editing a multi-branch employee from the modal would silently
    // delete every assignment except the one currently shown.
    const branchIds = Array.isArray(formData.branchIds)
      ? formData.branchIds
          .map((v) => Number(v))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

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
      iqama_expiry_calendar: formData.iqama_expiry_calendar || "gregory",
      iqama_expiry_hijri: formData.iqama_expiry_hijri || null,
      sponsorship_transferred: !!formData.sponsorship_transferred,
      work_card_issued: !!formData.work_card_issued,
      medical_check_issued: !!formData.medical_check_issued,
      health_card_issued: !!formData.health_card_issued,
      health_card_expiry_date: formData.health_card_issued
        ? formData.health_card_expiry_date || null
        : null,
      health_card_expiry_calendar: formData.health_card_issued
        ? formData.health_card_expiry_calendar || "gregory"
        : null,
      health_card_expiry_hijri: formData.health_card_issued
        ? formData.health_card_expiry_hijri || null
        : null,
      position: formData.position ? String(formData.position) : null,
      base_salary: baseSalaryValue,
      other_allowances: otherAllowancesValue,
      start_date: formData.start_date || null,
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

  // Riyadh today / +30d windows (plain YYYY-MM-DD; lexicographic
  // compare works for ISO dates).
  const todayRiyadh = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }),
    [],
  );
  const soonRiyadh = useMemo(
    () =>
      new Date(Date.now() + 30 * 864e5).toLocaleDateString("en-CA", {
        timeZone: "Asia/Riyadh",
      }),
    [],
  );

  // Distinct positions for the filter dropdown.
  const positions = useMemo(() => {
    const set = new Set();
    for (const e of employees || []) {
      const p = (e.position || "").trim();
      if (p) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [employees]);

  // search → branch → position → status → sort.
  const displayedEmployees = useMemo(() => {
    let list = filterEmployees(employees, searchTerm);

    if (branchFilter) {
      list = list.filter((e) =>
        (Array.isArray(e.branches) ? e.branches : []).some(
          (b) => String(b?.id) === String(branchFilter),
        ),
      );
    }

    if (positionFilter) {
      list = list.filter((e) => (e.position || "") === positionFilter);
    }

    if (statusFilter) {
      list = list.filter((e) => {
        const iq = expiryBucket(e.iqama_expiry_date, todayRiyadh, soonRiyadh);
        const hc = e.health_card_issued
          ? expiryBucket(e.health_card_expiry_date, todayRiyadh, soonRiyadh)
          : null;
        switch (statusFilter) {
          case "iqama_expired":
            return iq === "expired";
          case "iqama_soon":
            return iq === "soon";
          case "health_expired":
            return hc === "expired";
          case "health_soon":
            return hc === "soon";
          case "docs_complete":
            return (
              e.work_card_issued &&
              e.medical_check_issued &&
              e.health_card_issued
            );
          default:
            return true;
        }
      });
    }

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const sorted = [...list];
    switch (sortBy) {
      case "salary_desc":
        sorted.sort(
          (a, b) =>
            num(b.base_salary) +
            num(b.other_allowances) -
            (num(a.base_salary) + num(a.other_allowances)),
        );
        break;
      case "salary_asc":
        sorted.sort(
          (a, b) =>
            num(a.base_salary) +
            num(a.other_allowances) -
            (num(b.base_salary) + num(b.other_allowances)),
        );
        break;
      case "start_desc":
        sorted.sort((a, b) =>
          String(b.start_date || "").localeCompare(String(a.start_date || "")),
        );
        break;
      case "iqama_soonest":
        // Nulls sort last; otherwise ascending by expiry date.
        sorted.sort((a, b) => {
          const av = a.iqama_expiry_date
            ? String(a.iqama_expiry_date).slice(0, 10)
            : "9999-99-99";
          const bv = b.iqama_expiry_date
            ? String(b.iqama_expiry_date).slice(0, 10)
            : "9999-99-99";
          return av.localeCompare(bv);
        });
        break;
      case "name_asc":
      default:
        sorted.sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "ar"),
        );
        break;
    }

    return sorted;
  }, [
    employees,
    searchTerm,
    branchFilter,
    positionFilter,
    statusFilter,
    sortBy,
    todayRiyadh,
    soonRiyadh,
  ]);

  const hasActiveFilters = !!(
    searchTerm ||
    branchFilter ||
    positionFilter ||
    statusFilter ||
    sortBy !== "name_asc"
  );

  const resetFilters = () => {
    setSearchTerm("");
    setBranchFilter("");
    setPositionFilter("");
    setStatusFilter("");
    setSortBy("name_asc");
  };

  if (!checked) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center p-6"
        dir="rtl"
      >
        <div className={`${ws.glass} ${ws.card} p-6 max-w-lg w-full`}>
          <div className="text-slate-900 dark:text-white font-bold text-lg mb-2">
            جاري التحقق من الصلاحيات…
          </div>
          <div className="text-slate-600 dark:text-white/60 text-sm leading-relaxed">لحظات.</div>
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
          <div className="text-slate-900 dark:text-white font-bold text-lg mb-2">{title}</div>
          <div className="text-slate-600 dark:text-white/60 text-sm leading-relaxed">{body}</div>
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
              <Users className="w-8 h-8 sm:w-10 sm:h-10 text-amber-700 dark:text-amber-200" />
              إدارة الموظفين
            </h1>
            <p className={ws.muted}>بيانات الموظفين (HR)</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <HREmployeeExportMenu
              employees={displayedEmployees}
              todayRiyadh={todayRiyadh}
            />
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className={`${ws.btnPrimary} px-6 py-3 justify-center w-full sm:w-auto`}
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">إضافة موظف</span>
            </button>
          </div>
        </div>

        {loadErrorMessage ? (
          <div
            className={`${ws.glass} ${ws.card} p-4 mb-6 border border-red-500/20`}
          >
            <div className="text-red-800 dark:text-red-100 font-semibold">{loadErrorMessage}</div>
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

        <HREmployeeStats employees={displayedEmployees} />

        <div className="mb-6">
          <HREmployeeFilters
            branches={branches}
            positions={positions}
            branchFilter={branchFilter}
            onBranchChange={setBranchFilter}
            positionFilter={positionFilter}
            onPositionChange={setPositionFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <HRSearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
        </div>

        <HREmployeeTable
          employees={displayedEmployees}
          isLoading={isLoadingEmployees}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
          onViewLogs={handleOpenLogs}
          onSuspend={handleOpenSuspension}
        />
      </main>

      <HREmployeeModal
        isOpen={showModal}
        isEditing={!!editingEmployee}
        employeeId={editingEmployee?.id || null}
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

      <SuspensionModal
        open={showSuspensionModal}
        employee={suspensionEmployee}
        onClose={handleCloseSuspension}
      />
    </div>
  );
}
