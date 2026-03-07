import { Info } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function PayrollInfoCard() {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`${ws.iconBox} w-10 h-10`}>
          <Info className="w-5 h-5 text-sky-200" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white tracking-tight">ملاحظة</div>
          <div className="text-sm text-white/60 mt-1 leading-6">
            من هذه الصفحة تقدر تضيف بونص للموظفين، وبعدها نحدّث مسير الرواتب لنفس
            الشهر تلقائيًا.
          </div>
        </div>
      </div>
    </div>
  );
}
