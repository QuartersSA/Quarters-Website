import { Banknote } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function StockValueHeader() {
  return (
    <div className="mb-8 mt-6 lg:mt-0">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${ws.iconBox} text-emerald-200`}>
          <Banknote className="w-6 h-6" />
        </div>
        <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>قيمة المخزون</h1>
      </div>
      <p className={ws.muted}>
        قيمة كل صنف = الكمية الإجمالية عبر كل الفروع × سعر التكلفة. الإجمالي
        أسفل البطاقات هو قيمة المخزون المالية الكاملة في النظام.
      </p>
    </div>
  );
}
