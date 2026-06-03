import { Users, Shield, User } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function EmployeeStatistics({
  totalEmployees,
  adminCount,
  employeeCount,
}) {
  const statCard = `${ws.glass} ${ws.card} p-6`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-slate-800 dark:text-white/80`}>
            <Users className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">إجمالي الموظفين</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {totalEmployees}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-fuchsia-700 dark:text-fuchsia-700 dark:text-fuchsia-200`}>
            <Shield className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">المدراء</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {adminCount}
        </p>
      </div>

      <div className={statCard}>
        <div className="flex items-center justify-between mb-4">
          <div className={`${ws.iconBox} text-sky-700 dark:text-sky-700 dark:text-sky-200`}>
            <User className="w-6 h-6" />
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-600 dark:text-slate-600 dark:text-white/55 text-sm mb-1">موظفي الجرد</p>
        <p className="text-3xl font-bold text-slate-900 dark:text-slate-900 dark:text-slate-900 dark:text-white tracking-tight">
          {employeeCount}
        </p>
      </div>
    </div>
  );
}
