import { ArrowLeft, BarChart3 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function VarianceHeader() {
  return (
    <div className="mb-8 mt-6 lg:mt-0">
      <div className="flex items-center gap-3 mb-4">
        <a
          href="/admin"
          className="text-slate-600 dark:text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div className={`${ws.iconBox} text-amber-700 dark:text-amber-700 dark:text-amber-200`}>
          <BarChart3 className="w-6 h-6" />
        </div>
        <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>تقرير الانحراف</h1>
      </div>
      <p className={ws.muted}>
        مقارنة الكميات المتوقعة بالفعلية لكشف الفاقد أو الزيادة في المخزون
      </p>
    </div>
  );
}
