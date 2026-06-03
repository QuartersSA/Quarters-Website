import {
  Users,
  User,
  Shield,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Calculator,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function EmployeeTable({
  employees,
  isLoading,
  onEdit,
  onDelete,
  onToggleWorkspace,
}) {
  const sectionCard = `${ws.glass} ${ws.card} overflow-hidden`;

  const renderRoleLabel = (employee) => {
    if (employee.role === "Admin") {
      return "مدير";
    }
    return "موظف";
  };

  const renderTasks = (employee) => {
    if (employee.role === "Admin") {
      const tasks = [];
      if (employee.can_manage_inventory) tasks.push("إدارة الجرد");
      if (employee.can_manage_accounting) tasks.push("Accounting");
      if (employee.can_access_workspace) tasks.push("Workspace");
      if (employee.can_manage_deductions) tasks.push("الخصميات");
      if (employee.can_access_hr) tasks.push("HR");
      if (employee.can_manage_marketing) tasks.push("التسويق");
      return tasks;
    }

    const tasks = [];
    if (employee.can_do_inventory) tasks.push("تسجيل الجرد");
    if (employee.can_close_shift) tasks.push("تسجيل تقفيل الشفت");
    return tasks;
  };

  if (isLoading) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الاسم
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  اسم المستخدم
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الجوال
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  البريد الإلكتروني
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الصلاحية
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  المهام
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفروع
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  Workspace
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan="9"
                  className="px-6 py-12 text-center text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55"
                >
                  جاري التحميل…
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!employees || employees.length === 0) {
    return (
      <div className={sectionCard}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الاسم
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  اسم المستخدم
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الجوال
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  البريد الإلكتروني
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الصلاحية
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  المهام
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الفروع
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  Workspace
                </th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan="9"
                  className="px-6 py-12 text-center text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45"
                >
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>لا يوجد موظفين</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={sectionCard}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04]">
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                الاسم
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                اسم المستخدم
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                الجوال
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                البريد الإلكتروني
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                الصلاحية
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                المهام
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                الفروع
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                Workspace
              </th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const rolePillClass =
                employee.role === "Admin"
                  ? `${ws.pill} bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-700 dark:text-fuchsia-200 border-fuchsia-500/20`
                  : `${ws.pill} bg-sky-500/10 text-sky-700 dark:text-sky-700 dark:text-sky-200 border-sky-500/20`;

              const workspaceBtnClass = employee.can_access_workspace
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-700 dark:text-emerald-200 border-emerald-500/25 hover:bg-emerald-500/20"
                : "bg-slate-100 dark:bg-slate-100 dark:bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/60 border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.06]";

              const tasks = renderTasks(employee);

              return (
                <tr
                  key={employee.id}
                  className="border-t border-slate-100 dark:border-slate-100 dark:border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-slate-800 dark:text-slate-800 dark:text-white/85`}>
                        <User className="w-5 h-5" />
                      </div>
                      <span className="text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white font-medium">
                        {employee.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/75">
                    {employee.username || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/75" dir="ltr">
                    {employee.phone || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55">
                    {employee.email || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`${rolePillClass} inline-flex items-center gap-2`}
                    >
                      {employee.role === "Admin" ? (
                        <Shield className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                      {renderRoleLabel(employee)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {tasks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tasks.map((t) => {
                          const icon =
                            t === "تسجيل الجرد" || t === "إدارة الجرد" ? (
                              <ClipboardList className="w-3.5 h-3.5" />
                            ) : t === "Accounting" ||
                              t === "تسجيل تقفيل الشفت" ? (
                              <Calculator className="w-3.5 h-3.5" />
                            ) : t === "Workspace" ? (
                              <Briefcase className="w-3.5 h-3.5" />
                            ) : t === "HR" ? (
                              <Users className="w-3.5 h-3.5" />
                            ) : t === "الخصميات" ? (
                              <DollarSign className="w-3.5 h-3.5" />
                            ) : null;

                          return (
                            <span
                              key={t}
                              className={`${ws.pill} bg-slate-50 dark:bg-slate-50 dark:bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10 inline-flex items-center gap-1`}
                            >
                              {icon}
                              <span>{t}</span>
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {employee.branches && employee.branches.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {employee.branches.map((branch) => (
                          <span
                            key={branch.id}
                            className={`${ws.pill} bg-slate-50 dark:bg-slate-50 dark:bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-700 dark:text-slate-700 dark:text-white/70 border-slate-200 dark:border-slate-200 dark:border-slate-200 dark:border-white/10`}
                          >
                            {branch.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-500 dark:text-slate-500 dark:text-white/45 text-sm">
                        لا يوجد فروع
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      onClick={() => onToggleWorkspace(employee)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border ${workspaceBtnClass}`}
                      title="تفعيل/إلغاء Workspace"
                    >
                      {employee.can_access_workspace ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span>
                        {employee.can_access_workspace ? "مفعل" : "غير مفعل"}
                      </span>
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(employee)}
                        className={`${ws.iconButton} text-sky-700 dark:text-sky-700 dark:text-sky-200`}
                        aria-label="تعديل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(employee.id)}
                        className={`${ws.iconButton} text-red-700 dark:text-red-700 dark:text-red-200`}
                        aria-label="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
