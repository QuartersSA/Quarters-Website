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
  Megaphone,
  Trash2,
  ReceiptText,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

// أنواع إشعارات الواتساب لكل موظف — مقسمة: المحاسبة والجرد. المفاتيح
// تُخزن في employees.wa_prefs (JSONB) ويقرؤها محرك waNotify.
const WA_PREF_GROUPS = [
  {
    key: "accounting",
    label: "المحاسبة",
    Icon: Calculator,
    options: [
      {
        key: "acc_payment_receipt",
        label: "إيصال التحويل",
        hint: "عند تسجيل دفعة على فاتورة أنشأها هذا الموظف",
      },
      {
        key: "acc_invoice_created",
        label: "فاتورة مشتريات جديدة",
        hint: "عند إنشاء أي فاتورة مشتريات",
      },
      {
        key: "acc_invoice_overdue",
        label: "الفواتير المتأخرة",
        hint: "ملخص يومي بعد 8 صباحاً عند وجود متأخرات",
      },
    ],
  },
  {
    key: "inventory",
    label: "الجرد",
    Icon: ClipboardList,
    options: [
      {
        key: "inv_stocktake",
        label: "عملية جرد",
        hint: "عند إنشاء عملية جرد (يومي/أسبوعي/افتتاحي)",
      },
      {
        key: "inv_transfer",
        label: "عملية تحويل",
        hint: "عند التحويل بين الفروع",
      },
      {
        key: "inv_receipt",
        label: "عملية وارد",
        hint: "عند تسجيل وارد جديد للمخزون",
      },
      {
        key: "inv_low_stock",
        label: "بلوغ الحد الأدنى",
        hint: "عندما يهبط صنف إلى حده الأدنى بعد أي عملية",
      },
    ],
  },
];

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

  const waPrefs = Array.isArray(formData.wa_prefs) ? formData.wa_prefs : [];
  const toggleWaPref = (key) => {
    setFormData((prev) => {
      const current = Array.isArray(prev.wa_prefs) ? prev.wa_prefs : [];
      return {
        ...prev,
        wa_prefs: current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key],
      };
    });
  };

  const needsBranch =
    formData.role === "Employee" &&
    (!!formData.can_do_inventory ||
      !!formData.can_close_shift ||
      !!formData.can_log_waste);

  const employeeInventoryBtnClass = formData.can_do_inventory
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const employeeShiftCloseBtnClass = formData.can_close_shift
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const employeeWasteBtnClass = formData.can_log_waste
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const employeePurchaseInvoiceBtnClass = formData.can_add_purchase_invoices
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const employeeSuppliersBtnClass = formData.can_manage_suppliers
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

  const adminMarketingBtnClass = formData.can_manage_marketing
    ? `${ws.btnPrimary} px-4 py-2`
    : `${ws.btnNeutral} px-4 py-2`;

  const adminPurchasesBtnClass = formData.can_manage_purchases
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
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
          <User className="w-4 h-4 inline ml-2" />
          الاسم الرسمي *
        </label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`${ws.input} px-4 py-3`}
          placeholder="أدخل الاسم الرسمي للموظف"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
          <User className="w-4 h-4 inline ml-2" />
          الاسم الدارج
        </label>
        <input
          type="text"
          value={formData.display_name || ""}
          onChange={(e) =>
            setFormData({ ...formData, display_name: e.target.value })
          }
          className={`${ws.input} px-4 py-3`}
          placeholder="الاسم الذي يظهر داخل النظام"
        />
        <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 mt-2">
          إذا تركته فارغًا سيظهر الاسم الرسمي في النظام.
        </p>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
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
        <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 mt-2">
          يستخدم لإشعارات واتساب (مثلاً: تقفيلة الشفت / جرد جديد / تحديثات
          المهام).
        </p>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
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
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
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
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
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
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
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
                can_log_waste: false,
                // رفع فاتورة مشتريات متاح للدورين — الـspread يبقيه كما هو
                // صلاحيات أقسام الإدارة (افتراضيًا: مفعلة)
                can_access_workspace: true,
                can_manage_inventory: true,
                // قسم المشتريات فقط — افتراضياً غير مفعّل (المحاسبة
                // الكاملة تغنيه)
                can_manage_purchases: false,
                can_manage_accounting: true,
                can_manage_employees: true,
                can_access_hr: true,
                // NEW: deductions permission (off by default)
                can_manage_deductions: false,
                // Marketing — separate section, off by default
                can_manage_marketing: false,
                // إشعارات واتساب (افتراضيًا: غير مفعلة)
                notify_shift_close_wa: false,
                notify_inventory_operation_wa: false,
              })
            }
            className={`p-4 rounded-2xl border transition-colors ${
              formData.role === "Admin"
                ? "bg-slate-200 dark:bg-slate-200 dark:bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white border-slate-300 dark:border-slate-300 dark:border-slate-300 dark:border-white/20"
                : `${ws.glassSoft} text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]`
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
                can_manage_purchases: false,
                can_manage_accounting: false,
                can_manage_employees: false,
                can_access_hr: false,
                can_manage_deductions: false,
                can_manage_marketing: false,
                // إشعارات واتساب
                notify_shift_close_wa: false,
                notify_inventory_operation_wa: false,
              })
            }
            className={`p-4 rounded-2xl border transition-colors ${
              formData.role === "Employee"
                ? "bg-slate-200 dark:bg-slate-200 dark:bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white border-slate-300 dark:border-slate-300 dark:border-slate-300 dark:border-white/20"
                : `${ws.glassSoft} text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]`
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
          className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-2xl p-4`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white font-semibold">صلاحيات أقسام الإدارة</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/50 mt-1">
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

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_marketing: !p.can_manage_marketing,
                  }))
                }
                className={adminMarketingBtnClass}
              >
                {formData.can_manage_marketing ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Megaphone className="w-4 h-4" />
                التسويق
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_purchases: !p.can_manage_purchases,
                  }))
                }
                className={adminPurchasesBtnClass}
                title="وصول لقسم المشتريات فقط بدون بقية المحاسبة"
              >
                {formData.can_manage_purchases ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <ShoppingCart className="w-4 h-4" />
                قسم المشتريات
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_add_purchase_invoices: !p.can_add_purchase_invoices,
                  }))
                }
                className={employeePurchaseInvoiceBtnClass}
              >
                {formData.can_add_purchase_invoices ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <ReceiptText className="w-4 h-4" />
                رفع فاتورة مشتريات
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_suppliers: !p.can_manage_suppliers,
                  }))
                }
                className={employeeSuppliersBtnClass}
              >
                {formData.can_manage_suppliers ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Truck className="w-4 h-4" />
                إضافة / تعديل مورد
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* إشعارات واتساب — لكل الأدوار: مجموعتا المحاسبة والجرد
          بأنواع تفصيلية تُحفظ في wa_prefs. */}
      <div
        className={`${ws.glassSoft} border border-slate-200 dark:border-white/10 rounded-2xl p-4`}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
          <p className="text-slate-900 dark:text-white font-semibold">
            إشعارات واتساب
          </p>
        </div>
        <p className="text-sm text-slate-500 dark:text-white/50 mt-1">
          تصل على رقم الجوال المسجل أعلاه — اختر القسم ثم نوع الإشعار.
        </p>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {WA_PREF_GROUPS.map((group) => {
            const GroupIcon = group.Icon;
            const activeCount = group.options.filter((option) =>
              waPrefs.includes(option.key),
            ).length;
            return (
              <div
                key={group.key}
                className="rounded-xl border border-slate-200 dark:border-white/10 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <GroupIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-200" />
                  <span className="font-semibold text-slate-800 dark:text-white/85 text-sm">
                    {group.label}
                  </span>
                  {activeCount > 0 ? (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {activeCount} مفعّل
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  {group.options.map((option) => {
                    const active = waPrefs.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleWaPref(option.key)}
                        className={`w-full text-right rounded-lg border px-2.5 py-1.5 flex items-start gap-2 transition-colors ${
                          active
                            ? "border-emerald-300 dark:border-emerald-400/30 bg-emerald-50 dark:bg-emerald-400/10"
                            : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                        }`}
                      >
                        {active ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-300" />
                        ) : (
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-300 dark:text-white/25" />
                        )}
                        <span className="min-w-0">
                          <span
                            className={`block text-sm font-semibold ${active ? "text-emerald-900 dark:text-emerald-100" : "text-slate-700 dark:text-white/70"}`}
                          >
                            {option.label}
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-white/40 leading-snug">
                            {option.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* إشعارات النظام القديمة (تقفيلة الشفت وجرد الإدارة) — للمدراء */}
        {showAdminOptions ? (
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
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
              جرد جديد (إشعار الإدارة)
            </button>
          </div>
        ) : null}
      </div>

      {/* Employee options */}
      {showEmployeeOptions ? (
        <div
          className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-2xl p-4`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white font-semibold">صلاحيات الموظف</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/50 mt-1">
                تقدر تختار أكثر من صلاحية لنفس الموظف.
              </p>
              {needsBranch ? (
                <p className="text-xs text-amber-700 dark:text-amber-700 dark:text-amber-200/90 mt-2">
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

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_log_waste: !p.can_log_waste,
                  }))
                }
                className={employeeWasteBtnClass}
              >
                {formData.can_log_waste ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Trash2 className="w-4 h-4" />
                تسجيل الهدر
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_add_purchase_invoices: !p.can_add_purchase_invoices,
                  }))
                }
                className={employeePurchaseInvoiceBtnClass}
              >
                {formData.can_add_purchase_invoices ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <ReceiptText className="w-4 h-4" />
                رفع فاتورة مشتريات
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((p) => ({
                    ...p,
                    can_manage_suppliers: !p.can_manage_suppliers,
                  }))
                }
                className={employeeSuppliersBtnClass}
              >
                {formData.can_manage_suppliers ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <Truck className="w-4 h-4" />
                إضافة / تعديل مورد
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Branches (not needed for Admin) */}
      {showBranches ? (
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 mb-2">
            <Building2 className="w-4 h-4 inline ml-2" />
            الفروع
          </label>
          <div
            className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-2xl p-4 max-h-48 overflow-y-auto`}
          >
            <div className="grid grid-cols-2 gap-3">
              {branches && branches.length > 0 ? (
                branches.map((branch) => (
                  <label
                    key={branch.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-50 dark:bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-2xl cursor-pointer transition-colors border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10"
                  >
                    <input
                      type="checkbox"
                      checked={formData.branchIds.includes(branch.id)}
                      onChange={() => onToggleBranch(branch.id)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <p className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white text-sm font-medium">
                        {branch.name}
                      </p>
                      <p className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 text-xs">{branch.location}</p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="col-span-2 text-center text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 py-4">
                  لا توجد فروع متاحة
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 mt-2">
            {formData.branchIds.length} فرع محدد
          </p>
        </div>
      ) : (
        <div
          className={`${ws.glassSoft} border border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 rounded-2xl p-4`}
        >
          <p className="text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 text-sm">المدير لا يحتاج تحديد فروع.</p>
        </div>
      )}
    </div>
  );
}
