import { ArrowLeft } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function ItemsSummaryHeader() {
  return (
    <div className="mb-8 mt-6 lg:mt-0">
      <div className="flex items-center gap-3 mb-4">
        <a
          href="/admin"
          className="text-slate-600 dark:text-white/55 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>
          ملخص الأصناف الشامل
        </h1>
      </div>
      <p className={ws.muted}>
        عرض شامل لجميع الأصناف مع تفاصيل آخر عمليات الجرد في كل فرع
      </p>
    </div>
  );
}
