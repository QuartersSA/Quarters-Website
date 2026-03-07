"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Send } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import HRSidebar from "@/components/HR/Sidebar";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useHRDeductionsEmployeesData } from "@/hooks/useHRDeductionsEmployeesData";
import { useHRDeductionsData } from "@/hooks/useHRDeductionsData";
import { useHRDeductionMutations } from "@/hooks/useHRDeductionMutations";
import { HRDeductionsTable } from "@/components/HR/HRDeductionsTable";
import { HRDeductionModal } from "@/components/HR/HRDeductionModal";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { adminFetch } from "@/utils/apiAuth";
import { toast } from "sonner";

function toInputDate(value) {
  if (!value) return "";
  const s = String(value);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
}

function monthLabel(month) {
  const value = month ? String(month) : "";
  const m = value.match(/^(\d{4})-(\d{2})$/);
  if (!m) return value;

  const year = Number(m[1]);
  const idx = Number(m[2]) - 1;

  const monthsAr = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ];

  const name = monthsAr[idx] || value;
  return `${name} ${year}`;
}

function buildRecentMonthOptions(count = 24) {
  const now = new Date();
  const options = [{ value: "", label: "— بدون فلترة —" }];

  for (let i = 0; i < count; i += 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const value = `${y}-${m}`;
    options.push({ value, label: monthLabel(value) });
  }

  return options;
}

export default function HRDeductionsPage() {
  // ✅ All hooks first (before any early returns)
  const { isAuthenticated, logout, checked, reason } = useAdminAuth({
    requiredAnyPermissions: ["can_access_hr", "can_manage_deductions"],
    redirect: false,
  });

  const [currentAdminName, setCurrentAdminName] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("adminUser");
      const u = raw ? JSON.parse(raw) : null;
      const name = u?.name ? String(u.name) : "";
      const username = u?.username ? String(u.username) : "";
      setCurrentAdminName(username || name || "");
    } catch (e) {
      console.error(e);
      setCurrentAdminName("");
    }
  }, []);

  const { employees, isLoadingEmployees, employeesError } =
    useHRDeductionsEmployeesData(isAuthenticated);

  const [employeeFilterId, setEmployeeFilterId] = useState("");
  const employeeFilterNumber = employeeFilterId
    ? Number(employeeFilterId)
    : null;

  const [monthFilter, setMonthFilter] = useState("");
  const monthOptions = useMemo(() => buildRecentMonthOptions(30), []);
  const monthHint = monthFilter ? monthLabel(monthFilter) : "";

  const {
    deductions,
    isLoading: isLoadingDeductions,
    error: deductionsError,
  } = useHRDeductionsData(
    isAuthenticated,
    employeeFilterNumber,
    monthFilter ? String(monthFilter) : null,
  );

  const { createMutation, updateMutation, deleteMutation } =
    useHRDeductionMutations();

  const payrollSendMutation = useMutation({
    mutationFn: async ({ month }) => {
      const response = await adminFetch("/api/accounting/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to send");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("تم الإرسال إلى المحاسبة (مسير الرواتب)");
    },
    onError: (error) => {
      console.error("Payroll send error", error);
      toast.error(`فشل الإرسال: ${error.message}`);
    },
  });

  const emptyForm = useMemo(
    () => ({
      employeeIds: [],
      violation_date: "",
      violation_category: "",
      reason: "",
      amount: "",
      image_url: "",
      image_mime_type: "",
      image_name: "",
      image_size_bytes: null,
    }),
    [],
  );

  const [formData, setFormData] = useState(emptyForm);
  const [editingDeduction, setEditingDeduction] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const employeeOptions = Array.isArray(employees) ? employees : [];

  const employeeFilterOptions = useMemo(() => {
    const base = [{ value: "", label: "— الكل —" }];
    const mapped = employeeOptions.map((emp) => ({
      value: String(emp.id),
      label: emp.name,
    }));
    return [...base, ...mapped];
  }, [employeeOptions]);

  const anyLoading = isLoadingEmployees || isLoadingDeductions;

  const employeesErrorMsg = employeesError?.message
    ? String(employeesError.message)
    : "";

  const loadErrorMessage = employeesError
    ? employeesErrorMsg.includes("[401]")
      ? "جلسة الدخول انتهت. سجل خروج ثم دخول مرة ثانية."
      : employeesErrorMsg.includes("[403]")
        ? "ما عندك صلاحية للوصول لقائمة الموظفين. فعّل صلاحية (HR) أو (الخصميات) ثم سجل خروج/دخول."
        : "تعذر تحميل الموظفين. تأكد من تشغيل السيرفر ثم حدّث الصفحة."
    : deductionsError
      ? "تعذر تحميل الخصميات."
      : null;

  const modalSourceDisplay = editingDeduction
    ? editingDeduction.source ||
      editingDeduction.created_by_employee_name ||
      "-"
    : currentAdminName || "-";

  const handleSendPayroll = useCallback(() => {
    if (!monthFilter) {
      toast.error("اختر الشهر أولاً");
      return;
    }

    const ok = confirm(
      `هل تريد إرسال ملخص الخصميات إلى المحاسبة للشهر: ${monthLabel(monthFilter)} ؟`,
    );
    if (!ok) return;

    payrollSendMutation.mutate({ month: String(monthFilter) });
  }, [monthFilter, payrollSendMutation]);

  // ✅ Now conditional returns (after all hooks)
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
      reason === "missing_permission"
        ? "لا تملك صلاحية الخصميات"
        : "غير مسجل دخول";

    const body =
      reason === "missing_permission"
        ? "لازم تفعيل صلاحية (الخصميات) لحسابك من إدارة الموظفين (الإدارة)، وبعدها سجل خروج/دخول."
        : "سجل دخول كمدير عشان تقدر تفتح صفحة الخصميات.";

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

  // ✅ Rest of component logic (handlers, etc.)
  const handleOpenModal = (deduction = null) => {
    if (deduction) {
      setEditingDeduction(deduction);
      setFormData({
        employeeIds: deduction.employee_id
          ? [String(deduction.employee_id)]
          : [],
        violation_date: toInputDate(deduction.violation_date),
        violation_category: deduction.violation_category || "",
        reason: deduction.reason || "",
        amount:
          deduction.amount === null || deduction.amount === undefined
            ? ""
            : String(deduction.amount),
        image_url: deduction.image_url || "",
        image_mime_type: deduction.image_mime_type || "",
        image_name: deduction.image_name || "",
        image_size_bytes:
          deduction.image_size_bytes === null ||
          deduction.image_size_bytes === undefined
            ? null
            : Number(deduction.image_size_bytes),
      });
    } else {
      setEditingDeduction(null);
      setFormData(emptyForm);
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDeduction(null);
    setFormData(emptyForm);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const employeeIdsRaw = Array.isArray(formData.employeeIds)
      ? formData.employeeIds
      : [];
    const employeeIdsValue = employeeIdsRaw
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);

    if (employeeIdsValue.length === 0) {
      toast.error("اختر الموظف / الموظفين");
      return;
    }

    const dateValue = (formData.violation_date || "").trim();
    if (!dateValue) {
      toast.error("تاريخ المخالفة مطلوب");
      return;
    }

    const amountRaw = String(formData.amount ?? "").trim();
    const amountValue = amountRaw === "" ? null : Number(amountRaw);
    if (
      amountValue === null ||
      !Number.isFinite(amountValue) ||
      amountValue < 0
    ) {
      toast.error("المبلغ غير صحيح");
      return;
    }

    const payloadBase = {
      violation_date: dateValue,
      violation_category: formData.violation_category
        ? String(formData.violation_category)
        : null,
      reason: formData.reason ? String(formData.reason) : null,
      amount: amountValue,
      image_url: formData.image_url ? String(formData.image_url) : null,
      image_mime_type: formData.image_mime_type
        ? String(formData.image_mime_type)
        : null,
      image_name: formData.image_name ? String(formData.image_name) : null,
      image_size_bytes:
        formData.image_size_bytes === null || formData.image_size_bytes === ""
          ? null
          : Number(formData.image_size_bytes),
    };

    if (editingDeduction) {
      const employeeIdValue = employeeIdsValue[0] || null;
      if (!employeeIdValue) {
        toast.error("اختر الموظف");
        return;
      }

      updateMutation.mutate(
        {
          id: editingDeduction.id,
          data: {
            ...payloadBase,
            employee_id: employeeIdValue,
          },
        },
        {
          onSuccess: () => {
            handleCloseModal();
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          ...payloadBase,
          employee_ids: employeeIdsValue,
        },
        {
          onSuccess: () => {
            handleCloseModal();
          },
        },
      );
    }
  };

  const handleDelete = (id) => {
    if (confirm("هل أنت متأكد من حذف هذه الخصمية؟")) {
      deleteMutation.mutate(id);
    }
  };

  const showSendPayrollCard = !!monthFilter;

  return (
    <div className="min-h-[100svh]" dir="rtl">
      <HRSidebar onLogout={logout} active="deductions" />

      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 mt-6 lg:mt-0">
          <div>
            <h1
              className={`text-3xl sm:text-4xl ${ws.title} mb-2 flex items-center gap-3`}
            >
              <DollarSign className="w-8 h-8 sm:w-10 sm:h-10 text-amber-200" />
              الخصميات
            </h1>
            <p className={ws.muted}>تسجيل خصميات ومخالفات الموظفين</p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className={`${ws.btnPrimary} px-6 py-3 justify-center w-full sm:w-auto`}
            disabled={!employees || employeeOptions.length === 0}
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">إضافة خصمية</span>
          </button>
        </div>

        {loadErrorMessage ? (
          <div
            className={`${ws.glass} ${ws.card} p-4 mb-6 border border-red-500/20`}
          >
            <div className="text-red-100 font-semibold">{loadErrorMessage}</div>
            {employeesErrorMsg.includes("[401]") ? (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <a
                  href="/admin/login"
                  className={`${ws.btnPrimary} px-4 py-2 justify-center`}
                >
                  تسجيل الدخول
                </a>
              </div>
            ) : null}
            {employeesErrorMsg.includes("[403]") ? (
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

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className={`${ws.glassSoft} ${ws.card} p-4 w-full lg:w-[380px]`}>
            <div className="text-white/70 text-sm font-semibold mb-2">
              فلتر حسب الموظف
            </div>

            <GlassSelect
              value={employeeFilterId}
              onChange={setEmployeeFilterId}
              options={employeeFilterOptions}
              disabled={anyLoading}
              placeholder="— الكل —"
            />
          </div>

          <div className={`${ws.glassSoft} ${ws.card} p-4 w-full lg:w-[380px]`}>
            <div className="text-white/70 text-sm font-semibold mb-2">
              فلتر حسب الشهر
            </div>

            <GlassSelect
              value={monthFilter}
              onChange={setMonthFilter}
              options={monthOptions}
              disabled={anyLoading}
              placeholder="اختر الشهر"
            />
          </div>

          <div className="flex-1" />
        </div>

        <HRDeductionsTable
          deductions={deductions}
          isLoading={isLoadingDeductions}
          onEdit={handleOpenModal}
          onDelete={handleDelete}
        />

        {showSendPayrollCard ? (
          <div className={`${ws.glassSoft} ${ws.card} p-4 mt-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-white font-bold">
                  إرسال إلى قسم المحاسبة
                </div>
                <div className="text-white/60 text-sm">
                  سيتم إنشاء/تحديث مسير الرواتب للشهر: {monthHint} (يشمل
                  الخصميات والبونص)
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendPayroll}
                disabled={payrollSendMutation.isPending}
                className={`${ws.btnPrimary} px-5 py-2.5 justify-center w-full sm:w-auto`}
              >
                <Send className="w-4 h-4" />
                <span className="font-semibold">
                  {payrollSendMutation.isPending
                    ? "جاري الإرسال…"
                    : "إرسال إلى مسير الرواتب"}
                </span>
              </button>
            </div>
          </div>
        ) : null}
      </main>

      <HRDeductionModal
        isOpen={showModal}
        isEditing={!!editingDeduction}
        formData={formData}
        setFormData={setFormData}
        employees={employeeOptions}
        sourceDisplay={modalSourceDisplay}
        onSubmit={handleSubmit}
        onClose={handleCloseModal}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
