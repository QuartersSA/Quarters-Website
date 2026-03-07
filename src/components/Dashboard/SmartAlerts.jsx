import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { ws } from "@/components/Workspace/ui";

const ALERT_STYLES = {
  danger: {
    bg: "bg-red-500/10 border-red-500/20",
    text: "text-red-200",
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  warning: {
    bg: "bg-amber-500/10 border-amber-500/20",
    text: "text-amber-200",
    icon: <AlertCircle className="w-5 h-5" />,
  },
  info: {
    bg: "bg-sky-500/10 border-sky-500/20",
    text: "text-sky-200",
    icon: <Info className="w-5 h-5" />,
  },
};

export function SmartAlerts({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());

  if (!alerts || alerts.length === 0) return null;

  const visibleAlerts = alerts.filter((_, i) => !dismissed.has(i));
  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert, i) => {
        if (dismissed.has(i)) return null;
        const style = ALERT_STYLES[alert.type] || ALERT_STYLES.info;
        const isExpanded = expanded.has(i);
        const hasItems = alert.items && alert.items.length > 0;

        return (
          <div
            key={i}
            className={`flex items-start gap-3 p-4 rounded-2xl border ${style.bg} ${style.text}`}
          >
            <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{alert.message}</p>
                {hasItems && (
                  <button
                    onClick={() => {
                      const next = new Set(expanded);
                      if (isExpanded) next.delete(i);
                      else next.add(i);
                      setExpanded(next);
                    }}
                    className="opacity-70 hover:opacity-100 transition-opacity"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {hasItems && isExpanded && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {alert.items.map((item, j) => (
                    <span
                      key={j}
                      className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium border ${style.bg}`}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, i]))}
              className="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
