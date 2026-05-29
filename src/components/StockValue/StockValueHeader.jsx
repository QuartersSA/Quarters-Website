import { Banknote, Building2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function StockValueHeader({ branchLabel }) {
  return (
    <div className="mb-8 mt-6 lg:mt-0">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className={`${ws.iconBox} text-emerald-700 dark:text-emerald-700 dark:dark:text-emerald-200`}>
          <Banknote className="w-6 h-6" />
        </div>
        <h1 className={`text-3xl sm:text-4xl ${ws.title}`}>قيمة المخزون</h1>
        {/* Highlight branch context so the user can tell at a glance
            that the numbers below are scoped, not system-wide. */}
        {branchLabel ? (
          <span
            className={`${ws.pill} inline-flex items-center gap-2 bg-sky-400/10 border-sky-400/25 text-sky-700 dark:text-sky-700 dark:dark:text-sky-200 text-sm font-bold`}
          >
            <Building2 className="w-4 h-4" />
            {branchLabel}
          </span>
        ) : null}
      </div>
      <p className={ws.muted}>
        {branchLabel
          ? `قيمة المخزون داخل فرع "${branchLabel}" فقط = الكمية الموجودة في الفرع × سعر التكلفة. غيّر الفلتر إلى "جميع الفروع" للحصول على الإجمالي الكامل.`
          : "قيمة كل صنف = الكمية الإجمالية عبر كل الفروع × سعر التكلفة. الإجمالي أسفل البطاقات هو قيمة المخزون المالية الكاملة في النظام."}
      </p>
    </div>
  );
}
