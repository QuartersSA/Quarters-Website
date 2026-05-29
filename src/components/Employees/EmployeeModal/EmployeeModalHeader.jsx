import { X, UserCog } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function EmployeeModalHeader({ isEditing, onClose }) {
  return (
    <div
      className={`p-6 flex items-center justify-between sticky top-0 z-10 ${ws.topBar}`}
    >
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-900 dark:dark:text-white flex items-center gap-3 tracking-tight">
        <div className={`${ws.iconBox} w-10 h-10 text-white/80`}>
          <UserCog className="w-5 h-5" />
        </div>
        {isEditing ? "تعديل موظف" : "إضافة موظف جديد"}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className={ws.iconButton}
        aria-label="إغلاق"
      >
        <X className="w-5 h-5 text-slate-600 dark:text-slate-600 dark:dark:text-white/60" />
      </button>
    </div>
  );
}
