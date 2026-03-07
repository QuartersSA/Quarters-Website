import { Users } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function AdminInfoBanner({ adminCount, totalEmployees }) {
  if (adminCount === 0) {
    return null;
  }

  return (
    <div className={`mb-6 ${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-center gap-3">
        <div className={`${ws.iconBox} text-purple-200`}>
          <Users className="w-5 h-5" />
        </div>
        <div>
          <p className="text-white font-semibold tracking-tight">
            حسابات المدراء المتوفرة
          </p>
          <p className="text-white/60 text-sm">
            يوجد <span className="text-white font-bold">{adminCount}</span> حساب
            admin في قاعدة البيانات • إجمالي الموظفين:{" "}
            <span className="text-white font-bold">{totalEmployees}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
