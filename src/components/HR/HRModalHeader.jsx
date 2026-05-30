import { X, BadgeCheck } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export default function HRModalHeader({ isEditing, onClose }) {
  return (
    <div
      className={`p-6 flex items-center justify-between sticky top-0 z-10 ${ws.topBar}`}
    >
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
        <div className={`${ws.iconBox} w-10 h-10 text-slate-800 dark:text-white/80`}>
          <BadgeCheck className="w-5 h-5" />
        </div>
        {isEditing ? "تعديل بيانات موظف" : "إضافة موظف"}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className={ws.iconButton}
        aria-label="إغلاق"
      >
        <X className="w-5 h-5 text-slate-600 dark:text-white/60" />
      </button>
    </div>
  );
}
