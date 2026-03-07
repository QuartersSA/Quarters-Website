import { useState, useEffect } from "react";
import { Sparkles, AlertTriangle, Clock, TrendingDown } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "مساء الخير";
  if (h < 12) return "صباح الخير";
  if (h < 18) return "مساء الخير";
  return "مساء الخير";
}

export function WelcomeBanner({ stats, analytics }) {
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("adminUser");
      if (raw) {
        const u = JSON.parse(raw);
        setAdminName(u?.name || "");
      }
    } catch {
      // ignore
    }
  }, []);

  const greeting = getGreeting();
  const pendingOps = stats?.pendingOperations || 0;
  const lowStockCount =
    analytics?.branchPerformance?.reduce(
      (s, b) => s + (b.low_stock_count || 0),
      0,
    ) || 0;
  const todayOps = stats?.operationsToday || 0;

  const summaryParts = [];
  if (pendingOps > 0) {
    summaryParts.push(`${pendingOps} عمليات قيد الانتظار`);
  }
  if (lowStockCount > 0) {
    summaryParts.push(`${lowStockCount} أصناف منخفضة`);
  }
  if (todayOps > 0) {
    summaryParts.push(`${todayOps} عمليات اليوم`);
  }

  return (
    <div className={`${ws.glass} ${ws.card} p-6 mb-6 relative overflow-hidden`}>
      {/* Subtle gradient accent */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={`${ws.iconBox} w-14 h-14 text-emerald-200 flex-shrink-0`}
        >
          <Sparkles className="w-7 h-7" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {greeting} {adminName ? `يا ${adminName}` : ""} 👋
          </h2>

          {summaryParts.length > 0 ? (
            <div className="flex flex-wrap gap-3 mt-3">
              {pendingOps > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  {pendingOps} قيد الانتظار
                </span>
              )}
              {lowStockCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-200 text-sm font-semibold">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {lowStockCount} منخفضة
                </span>
              )}
              {todayOps > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-sm font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  {todayOps} عمليات اليوم
                </span>
              )}
            </div>
          ) : (
            <p className="text-white/50 mt-1">
              كل شي تمام! لا توجد تنبيهات حالياً
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
