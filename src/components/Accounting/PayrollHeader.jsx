import { Wallet } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

export function PayrollMobileHeader() {
  return (
    <div className={`lg:hidden sticky top-0 z-20 ${ws.topBar}`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`${ws.iconBox} w-10 h-10`}>
            <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
              المحاسبة
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 truncate">مسير الرواتب</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PayrollDesktopHeader() {
  return (
    <div className="hidden lg:flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={ws.iconBox}>
          <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            المحاسبة
          </div>
          <div className="text-slate-600 dark:text-white/55 mt-1">مسير الرواتب</div>
        </div>
      </div>
    </div>
  );
}
