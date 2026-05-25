import {
  ClipboardList,
  CheckCircle,
  Clock,
  AlertTriangle,
  Truck,
  ArrowLeftRight,
  Calendar,
  PackagePlus,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

const TYPE_META = {
  Daily: {
    label: "يومي",
    color: "text-sky-200",
    bgColor: "bg-sky-500/10 border-sky-500/20",
    icon: ClipboardList,
  },
  Weekly: {
    label: "أسبوعي",
    color: "text-purple-200",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    icon: Calendar,
  },
  Transfer: {
    label: "تحويل",
    color: "text-amber-200",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    icon: ArrowLeftRight,
  },
  Receipt: {
    label: "وارد",
    color: "text-emerald-200",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    icon: Truck,
  },
  Opening: {
    label: "افتتاحي",
    color: "text-teal-200",
    bgColor: "bg-teal-500/10 border-teal-500/20",
    icon: PackagePlus,
  },
};

const STATUS_ICON = {
  Completed: { icon: CheckCircle, color: "text-emerald-300" },
  Pending: { icon: Clock, color: "text-amber-300" },
  "In Progress": { icon: AlertTriangle, color: "text-sky-300" },
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  if (hours < 24) return `قبل ${hours} ساعة`;
  if (days < 7) return `قبل ${days} يوم`;
  return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}

export function OperationsTimeline({ timeline }) {
  const items = timeline || [];

  return (
    <div className={`${ws.glass} ${ws.card} overflow-hidden mb-8`}>
      <div className={`p-6 border-b ${ws.divider}`}>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
          <span className="text-emerald-200">
            <ClipboardList className="w-6 h-6" />
          </span>
          آخر العمليات
        </h2>
        <p className="text-white/45 text-sm mt-1">
          الشريط الزمني لآخر العمليات
        </p>
      </div>

      <div className="p-6">
        {items.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-white/20" />
            <p className="text-white/50">لا توجد عمليات بعد</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-[23px] top-0 bottom-0 w-px bg-white/10" />

            <div className="space-y-1">
              {items.map((item, i) => {
                const meta = TYPE_META[item.type] || TYPE_META.Daily;
                const statusMeta =
                  STATUS_ICON[item.status] || STATUS_ICON.Completed;
                const StatusIcon = statusMeta.icon;
                const TypeIcon = meta.icon;

                return (
                  <div
                    key={item.id || i}
                    className="relative flex gap-4 py-3 group"
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 flex-shrink-0">
                      <div
                        className={`w-[46px] h-[46px] rounded-2xl border flex items-center justify-center ${meta.bgColor}`}
                      >
                        <TypeIcon className={`w-5 h-5 ${meta.color}`} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-3 border-b border-white/5 group-last:border-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`${ws.pill} ${meta.bgColor} ${meta.color}`}
                          >
                            {meta.label}
                          </span>
                          <StatusIcon
                            className={`w-4 h-4 ${statusMeta.color}`}
                          />
                        </div>
                        <span className="text-white/40 text-xs">
                          {formatRelativeTime(item.date)} •{" "}
                          {formatTime(item.date)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {item.branch && (
                          <span className="text-white/70">
                            📍 {item.branch}
                          </span>
                        )}
                        {item.employee && (
                          <span className="text-white/50">
                            👤 {item.employee}
                          </span>
                        )}
                        {item.number && (
                          <span className="text-white/35 font-mono text-xs">
                            {item.number}
                          </span>
                        )}
                      </div>

                      {item.type === "Receipt" && item.itemName && (
                        <div className="mt-1 text-xs text-emerald-200/70">
                          {item.itemName} — الكمية: {item.quantity}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
