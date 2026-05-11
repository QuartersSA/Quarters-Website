import { ArrowLeft } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function LowStockHeader() {
  return (
    <div className="mb-8 mt-6 lg:mt-0">
      <div className="flex items-center gap-3 mb-4">
        <a
          href="/admin"
          className="text-white/55 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>
          الأصناف منخفضة الكمية
        </h1>
      </div>
      <p className={ws.muted}>
        متابعة الأصناف التي تحتاج إلى إعادة تعبئة بناءً على الحد الأدنى
        للمخزون
      </p>
    </div>
  );
}
