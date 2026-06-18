"use client";

import { useMemo } from "react";
import {
  Users,
  Wallet,
  CreditCard,
  HeartPulse,
  FileWarning,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  try {
    return new Intl.NumberFormat("ar-SA-u-ca-gregory-nu-latn", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function expiryBucket(dateStr, todayRiyadh, soonRiyadh) {
  if (!dateStr) return null;
  const d = String(dateStr).slice(0, 10);
  if (d < todayRiyadh) return "expired";
  if (d <= soonRiyadh) return "soon";
  return null;
}

/**
 * Responsive grid of glass stat cards computed from the (already
 * filtered) employee list. Expiry windows use Riyadh calendar days.
 */
export default function HREmployeeStats({ employees }) {
  const { todayRiyadh, soonRiyadh } = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Riyadh",
    });
    const soon = new Date(Date.now() + 30 * 864e5).toLocaleDateString("en-CA", {
      timeZone: "Asia/Riyadh",
    });
    return { todayRiyadh: today, soonRiyadh: soon };
  }, []);

  const stats = useMemo(() => {
    const list = Array.isArray(employees) ? employees : [];

    let totalSalary = 0;
    let iqamaExpired = 0;
    let iqamaSoon = 0;
    let healthExpired = 0;
    let healthSoon = 0;
    let missingDocs = 0;

    for (const e of list) {
      totalSalary += num(e.base_salary) + num(e.other_allowances);

      const iq = expiryBucket(e.iqama_expiry_date, todayRiyadh, soonRiyadh);
      if (iq === "expired") iqamaExpired += 1;
      else if (iq === "soon") iqamaSoon += 1;

      if (e.health_card_issued) {
        const hc = expiryBucket(
          e.health_card_expiry_date,
          todayRiyadh,
          soonRiyadh,
        );
        if (hc === "expired") healthExpired += 1;
        else if (hc === "soon") healthSoon += 1;
      }

      if (
        !e.work_card_issued ||
        !e.medical_check_issued ||
        !e.health_card_issued
      ) {
        missingDocs += 1;
      }
    }

    return {
      total: list.length,
      totalSalary,
      iqamaExpired,
      iqamaSoon,
      healthExpired,
      healthSoon,
      missingDocs,
    };
  }, [employees, todayRiyadh, soonRiyadh]);

  const iqamaAlert = stats.iqamaExpired + stats.iqamaSoon > 0;
  const healthAlert = stats.healthExpired + stats.healthSoon > 0;
  const docsAlert = stats.missingDocs > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
      <StatCard
        icon={Users}
        label="إجمالي الموظفين"
        value={stats.total}
        tone="neutral"
      />

      <StatCard
        icon={Wallet}
        label="إجمالي الرواتب الشهرية"
        value={formatMoney(stats.totalSalary)}
        suffix="ر.س"
        tone="emerald"
      />

      <ExpiryCard
        icon={CreditCard}
        label="الإقامات"
        expired={stats.iqamaExpired}
        soon={stats.iqamaSoon}
        alert={iqamaAlert}
      />

      <ExpiryCard
        icon={HeartPulse}
        label="الكروت الصحية"
        expired={stats.healthExpired}
        soon={stats.healthSoon}
        alert={healthAlert}
      />

      <StatCard
        icon={FileWarning}
        label="وثائق ناقصة"
        value={stats.missingDocs}
        tone={docsAlert ? "amber" : "emerald"}
      />
    </div>
  );
}

const TONE = {
  neutral: {
    card: `${ws.glass}`,
    icon: "text-slate-400 dark:text-white/40",
    value: "text-slate-900 dark:text-white",
  },
  emerald: {
    card: `${ws.glass}`,
    icon: "text-emerald-500 dark:text-emerald-300/70",
    value: "text-emerald-700 dark:text-emerald-200",
  },
  amber: {
    card:
      "bg-amber-50 border border-amber-200 rounded-3xl " +
      "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(245,158,11,0.08)] " +
      "dark:bg-amber-400/10 dark:border-amber-400/25 dark:shadow-none",
    icon: "text-amber-500 dark:text-amber-300/80",
    value: "text-amber-700 dark:text-amber-200",
  },
  red: {
    card:
      "bg-red-50 border border-red-200 rounded-3xl " +
      "shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_1px_2px_rgba(220,38,38,0.08)] " +
      "dark:bg-red-500/10 dark:border-red-500/25 dark:shadow-none",
    icon: "text-red-500 dark:text-red-300/80",
    value: "text-red-700 dark:text-red-200",
  },
};

function StatCard({ icon: Icon, label, value, suffix, tone = "neutral" }) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div className={`${t.card} ${ws.card} p-4`}>
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55">
        {Icon ? <Icon className={`w-4 h-4 ${t.icon}`} /> : null}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${t.value}`} dir="ltr">
        {value}
        {suffix ? (
          <span className="text-sm font-semibold mr-1">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function ExpiryCard({ icon: Icon, label, expired, soon, alert }) {
  // Expired drives the strongest accent; expiring-soon is amber;
  // a clean slate is emerald.
  const tone = expired > 0 ? "red" : soon > 0 ? "amber" : "emerald";
  const t = TONE[tone];
  return (
    <div className={`${t.card} ${ws.card} p-4`}>
      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-white/55">
        {Icon ? <Icon className={`w-4 h-4 ${t.icon}`} /> : null}
        {label}
      </div>
      {alert ? (
        <div className="mt-1 flex items-end gap-3">
          <div>
            <div className="text-2xl font-bold text-red-700 dark:text-red-200" dir="ltr">
              {expired}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">
              منتهية
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-200" dir="ltr">
              {soon}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-white/45">
              قريبة الانتهاء
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-200" dir="ltr">
          0
          <span className="text-sm font-semibold mr-1">سليمة</span>
        </div>
      )}
    </div>
  );
}
