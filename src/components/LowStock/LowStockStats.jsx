import { TrendingDown, XCircle, AlertTriangle, Building2 } from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const statCard = `${ws.glass} ${ws.card} p-6`;

export function LowStockStats({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <StatCard
        icon={<TrendingDown className="w-6 h-6" />}
        iconColor="text-amber-200"
        label="إجمالي الأصناف المنخفضة"
        value={stats.totalLowStock}
      />
      <StatCard
        icon={<XCircle className="w-6 h-6" />}
        iconColor="text-red-200"
        label="غير متوفر"
        value={stats.outOfStock}
      />
      <StatCard
        icon={<AlertTriangle className="w-6 h-6" />}
        iconColor="text-orange-200"
        label="حالات حرجة"
        value={stats.criticalItems}
      />
      <StatCard
        icon={<Building2 className="w-6 h-6" />}
        iconColor="text-sky-200"
        label="الفروع المتأثرة"
        value={stats.branches}
      />
    </div>
  );
}

function StatCard({ icon, iconColor, label, value }) {
  return (
    <div className={statCard}>
      <div className="flex items-center justify-between mb-4">
        <div className={`${ws.iconBox} ${iconColor}`}>{icon}</div>
      </div>
      <p className="text-white/55 text-sm mb-1">{label}</p>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  );
}
