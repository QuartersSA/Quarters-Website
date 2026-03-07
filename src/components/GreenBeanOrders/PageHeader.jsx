import { ArrowLeft, Leaf } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function MobileHeader() {
  const topBarClass = ws.topBar;

  return (
    <div className={`lg:hidden sticky top-0 z-20 ${topBarClass}`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${ws.iconBox} w-10 h-10`}>
            <Leaf className="w-5 h-5 text-emerald-200" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white tracking-tight truncate">
              المحاسبة
            </div>
            <div className="text-xs text-white/50 truncate">
              توريد البن الأخضر
            </div>
          </div>
        </div>
        <a href="/accounting" className={`${ws.btnNeutral} px-3 py-2 text-sm`}>
          <ArrowLeft className="w-4 h-4" />
          لوحة المحاسبة
        </a>
      </div>
    </div>
  );
}

export function DesktopHeader() {
  return (
    <div className="hidden lg:flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={ws.iconBox}>
          <Leaf className="w-5 h-5 text-emerald-200" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tight">
            المحاسبة
          </div>
          <div className="text-white/55 mt-1">طلبات توريد البن الأخضر</div>
        </div>
      </div>
      <a href="/accounting" className={`${ws.btnNeutral} px-4 py-2`}>
        <ArrowLeft className="w-4 h-4" />
        رجوع
      </a>
    </div>
  );
}
