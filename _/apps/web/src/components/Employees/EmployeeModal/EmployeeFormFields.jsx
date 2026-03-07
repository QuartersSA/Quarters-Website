import {
  User,
  Phone,
  Mail,
  UserCog,
  Lock,
  Shield,
  Building2,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Calculator,
  Briefcase,
  Users,
  Bell,
  DollarSign,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function EmployeeFormFields({
  formData,
  setFormData,
  isEditing,
  branches,
  onToggleBranch,
}) {
  const isAdminRole = formData.role === "Admin";
  const showEmployeeOptions = formData.role === "Employee";
  const showAdminOptions = formData.role === "Admin";
  const showBranches = !isAdminRole;

  const needsBranch =
    formData.role === "Employee" &&
    (!!formData.can_do_inventory || !!formData.can_close_shift);

  const employeeInventoryBtnClass = formData.can_do_inventory
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const employeeShiftCloseBtnClass = formData.can_close_shift
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminWorkspaceBtnClass = formData.can_access_workspace
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminInventoryBtnClass = formData.can_manage_inventory
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminAccountingBtnClass = formData.can_manage_accounting
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminEmployeesBtnClass = formData.can_manage_employees
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminHrBtnClass = formData.can_access_hr
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminDeductionsBtnClass = formData.can_manage_deductions
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  // WhatsApp notification preferences
  const notifyShiftCloseWaBtnClass = formData.notify_shift_close_wa
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const notifyInventoryWaBtnClass = formData.notify_inventory_operation_wa
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <User className="w-4 h-4 inline ml-2" />
          الاسم الكامل *
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`${ws.input} px-4 py-3`}
          placeholder="أدخل اسم الموظف"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <Phone className="w-4 h-4 inline ml-2" />
          رقم الجوال
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className={`${ws.input} px-4 py-3`}
          placeholder="+9665xxxxxxxx أو 05xxxxxxxx"
          dir="ltr"
        />
        <p className="text-xs text-white/45 mt-2">
          يستخدم لإشعارات واتساب (مثلاً: تقفيلة الشفت / جرد جديد / تحديثات
          المهام).
        </p>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <Mail className="w-4 h-4 inline ml-2" />
          البريد الإلكتروني
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={`${ws.input} px-4 py-3`}
          placeholder="example@company.com"
        />
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <UserCog className="w-4 h-4 inline ml-2" />
          اسم المستخدم *
        </label>
        <input
          type="text"
          required
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
          className={`${ws.input} px-4 py-3`}
          placeholder="اسم المستخدم للدخول"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <Lock className="w-4 h-4 inline ml-2" />
          كلمة المرور {isEditing ? "" : "*"}
        </label>
        <input
          type="password"
          required={!isEditing}
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className={`${ws.input} px-4 py-3`}
          placeholder={
            isEditing ? "اتركه فارغاً لعدم التغيير" : "أدخل كلمة المرور"
          }
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-semibold text-white/70 mb-2">
          <Shield className="w-4 h-4 inline ml-2" />
          الصلاحية *
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                role: "Admin",
                // المدير لا يحتاج ربط فروع
                branchIds: [],
                // صلاحيات الموظف
                can_do_inventory: false,
                can_close_shift: false,
                // صلاحيات أقسام الإدارة (افتراضيًا: مفعلة)
                can_access_workspace: true,
                can_manage_inventory: true,
                can_manage_accounting: true,
                can_manage_employees: true,
                can_access_hr: true,
                // NEW: deductions permission (off by default)
                can_manage_deductions: false,
                // إشعارات واتساب (افتراضيًا: غير مفعلة)
                notify_shift_close_wa: false,
                notify_inventory_operation_wa: false,
              })
            }
            className={`p-4 rounded-2xl border transition-colors ${
              formData.role === "Admin"
                ? "bg-white/10 text-white border-white/20"
                : `${ws.glassSoft} text-white/60 hover:bg-white/[0.06]`
            }`}
          >
            <Shield className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">مدير</p>
            <p className="text-xs opacity-70">حدد أقسام الإدارة</p>
          </button>

          <button
            type="button"
            onClick={() =>
              setFormData({
                ...formData,
                role: "Employee",
                // صلاحيات أقسام الإدارة
                can_access_workspace: false,
                can_manage_inventory: false,
                can_manage_accounting: false,
                can_manage_employees: false,
                can_access_hr: false,
                can_manage_deductions: false,
                // إشعارات واتساب
                notify_shift_close_wa: false,
                notify_inventory_operation_wa: false,
              })
            }
            className={`p-4 rounded-2xl border transition-colors ${
              formData.role === "Employee"
                ? "bg-white/10 text-white border-white/20"
                : `${ws.glassSoft} text-white/60 hover:bg-white/[0.06]`
            }`}
          >
            <User className="w-6 h-6 mx-auto mb-2" />
            <p className="font-semibold">موظف</p>
            <p className="text-xs opacity-70">حدد صلاحيات الموظف</p>
          </button>
        </div>
      </div>

      {/* Admin options */}
      {showAdminOptions ? (
        <div
          className={`${ws.glassSoft} border border-white/10 rounded-2xl p-4`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-semibold">صلاحيات أقسام الإدارة</p>
              <p className="text-sm text-white/50 mt-1">
                هذه الصلاحيات تحدد أي الأقسام تظهر بعد تسجيل الدخول.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_access_workspace: !p.can_access_workspace,
                  }))
                }
                className={adminWorkspaceBtnClass}
              >
                {formData.can_access_workspace ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Briefcase className="w-4 h-4" />
                Workspace
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_inventory: !p.can_manage_inventory,
                  }))
                }
                className={adminInventoryBtnClass}
              >
                {formData.can_manage_inventory ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <ClipboardList className="w-4 h-4" />
                إدارة الجرد
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_accounting: !p.can_manage_accounting,
                  }))
                }
                className={adminAccountingBtnClass}
              >
                {formData.can_manage_accounting ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Calculator className="w-4 h-4" />
                Accounting
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_employees: !p.can_manage_employees,
                  }))
                }
                className={adminEmployeesBtnClass}
              >
                {formData.can_manage_employees ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Users className="w-4 h-4" />
                الموظفين (الإدارة)
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_deductions: !p.can_manage_deductions,
                  }))
                }
                className={adminDeductionsBtnClass}
                title="صلاحية دخول صفحة الخصميات فقط"
              >
                {formData.can_manage_deductions ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <DollarSign className="w-4 h-4" />
                الخصميات
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_access_hr: !p.can_access_hr,
                  }))
                }
                className={adminHrBtnClass}
              >
                {formData.can_access_hr ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Users className="w-4 h-4" />
                HR
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* NEW: Admin WhatsApp notification preferences */}
      {showAdminOptions ? (
        <div
          className={`${ws.glassSoft} border border-white/10 rounded-2xl p-4`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-semibold">إشعارات واتساب</p>
              <p className="text-sm text-white/50 mt-1">
                تصل على رقم الجوال المسجل أعلاه.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    notify_shift_close_wa: !p.notify_shift_close_wa,
                  }))
                }
                className={notifyShiftCloseWaBtnClass}
              >
                {formData.notify_shift_close_wa ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Bell className="w-4 h-4" />
                تقفيلة الشفت
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    notify_inventory_operation_wa:
                      !p.notify_inventory_operation_wa,
                  }))
                }
                className={notifyInventoryWaBtnClass}
              >
                {formData.notify_inventory_operation_wa ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Bell className="w-4 h-4" />
                جرد جديد
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Employee options */}
      {showEmployeeOptions ? (
        <div
          className={`${ws.glassSoft} border border-white/10 rounded-2xl p-4`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-semibold">صلاحيات الموظف</p>
              <p className="text-sm text-white/50 mt-1">
                تقدر تختار أكثر من صلاحية لنفس الموظف.
              </p>
              {needsBranch ? (
                <p className="text-xs text-amber-200/90 mt-2">
                  تنبيه: لازم تختار فرع واحد على الأقل عند تفعيل (تسجيل الجرد)
                  أو (تسجيل تقفيل الشفت).
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_do_inventory: !p.can_do_inventory,
                  }))
                }
                className={employeeInventoryBtnClass}
              >
                {formData.can_do_inventory ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <ClipboardList className="w-4 h-4" />
                تسجيل الجرد
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_close_shift: !p.can_close_shift,
                  }))
                }
                className={employeeShiftCloseBtnClass}
              >
                {formData.can_close_shift ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Calculator className="w-4 h-4" />
                تسجيل تقفيل الشفت
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Branches (not needed for Admin) */}
      {showBranches ? (
        <div>
          <label className="block text-sm font-semibold text-white/70 mb-2">
            <Building2 className="w-4 h-4 inline ml-2" />
            الفروع
          </label>
          <div
            className={`${ws.glassSoft} border border-white/10 rounded-2xl p-4 max-h-48 overflow-y-auto`}
          >
            <div className="grid grid-cols-2 gap-3">
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex items-center gap-3 p-3 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl cursor-pointer transition-colors border border-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={formData.branchIds.includes(branch.id)}
                      onChange={() => onToggleBranch(branch.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">
                        {branch.name}
                      </p>
                      <p className="text-white/45 text-xs">{branch.location}</p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="col-span-2 text-center text-white/45 py-4">
                  لا توجد فروع متاحة
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-white/45 mt-2">
            {formData.branchIds.length} فرع محدد
          </p>
        </div>
      ) : (
        <div
          className={`${ws.glassSoft} border border-white/10 rounded-2xl p-4`}
        >
          <p className="text-white/70 text-sm">المدير لا يحتاج تحديد فروع.</p>
        </div>
      )}
    </div>
  );
}
