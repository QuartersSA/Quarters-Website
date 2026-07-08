"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Clock3,
  Copy,
  Loader2,
  Send,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { useAccountingPurchaseInvoices } from "@/hooks/useAccountingPurchaseInvoices";
import { authedFetch } from "@/utils/apiAuth";

/**
 * مركز إشعارات المشتريات — جرس في رأس الصفحة.
 *
 * الإشعارات مشتقة لحظياً من نفس صفوف الدفتر (لا جدول إشعارات):
 * متأخرة، تستحق خلال 7 أيام، بانتظار الاعتماد، شبهة رقم مكرر.
 * النقر على مجموعة يفتح جدول الفواتير مفلتراً، وأسفل اللوحة زر
 * «تذكير واتساب» يرسل ملخص المستحقات للرقم المُدخل.
 */

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function money(value) {
  return moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PurchasesNotificationsBell({
  employeeId,
  isAdmin,
  onNavigate,
}) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const panelRef = useRef(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("purchReminderPhone");
      if (saved) setPhone(saved);
    } catch {
      // ignore
    }
  }, []);

  // إغلاق عند النقر خارج اللوحة.
  useEffect(() => {
    if (!open) return;
    const onDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const invoicesQuery = useAccountingPurchaseInvoices({ employeeId, isAdmin });
  const invoices = invoicesQuery.data || [];

  const groups = useMemo(() => {
    const today = todayRiyadh();
    const soonLimit = addDays(today, 7);
    const active = invoices.filter((invoice) => invoice.is_active !== false);

    const overdue = active.filter(
      (invoice) => invoice.computed_status === "overdue",
    );
    const dueSoon = active.filter(
      (invoice) =>
        invoice.computed_status !== "overdue" &&
        invoice.computed_status !== "paid" &&
        invoice.due_date &&
        invoice.due_date >= today &&
        invoice.due_date <= soonLimit,
    );
    const pending = active.filter(
      (invoice) => invoice.computed_status === "pending_payment",
    );

    // شبهة تكرار: نفس الرقم ونفس المورد أكثر من مرة.
    const seen = new Map();
    const dupKeys = new Set();
    for (const invoice of active) {
      const key = `${String(invoice.invoice_number || "").trim().toLowerCase()}|${invoice.contact_id || invoice.supplier_name || ""}`;
      if (seen.has(key)) dupKeys.add(key);
      else seen.set(key, invoice.id);
    }
    const dups = active.filter((invoice) => {
      const key = `${String(invoice.invoice_number || "").trim().toLowerCase()}|${invoice.contact_id || invoice.supplier_name || ""}`;
      return dupKeys.has(key);
    });

    const balanceOf = (list) =>
      list.reduce((acc, invoice) => acc + moneyValue(invoice.balance_due), 0);

    return {
      overdue,
      dueSoon,
      pending,
      dups,
      overdueBalance: balanceOf(overdue),
      dueSoonBalance: balanceOf(dueSoon),
      count: overdue.length + dueSoon.length + dups.length,
    };
  }, [invoices]);

  const rows = [
    {
      key: "overdue",
      icon: AlertTriangle,
      tone: "text-rose-700 dark:text-rose-300",
      label: "فواتير متأخرة",
      count: groups.overdue.length,
      detail:
        groups.overdue.length > 0
          ? `${money(groups.overdueBalance)} SAR مستحقة الآن`
          : null,
      onClick: () => onNavigate?.("invoices", { status: "overdue" }),
    },
    {
      key: "due-soon",
      icon: CalendarClock,
      tone: "text-amber-700 dark:text-amber-300",
      label: "تستحق خلال 7 أيام",
      count: groups.dueSoon.length,
      detail:
        groups.dueSoon.length > 0
          ? `${money(groups.dueSoonBalance)} SAR قادمة`
          : null,
      onClick: () => onNavigate?.("invoices", {}),
    },
    {
      key: "pending",
      icon: Clock3,
      tone: "text-sky-700 dark:text-sky-300",
      label: "بانتظار الاعتماد",
      count: groups.pending.length,
      detail: null,
      onClick: () => onNavigate?.("invoices", { status: "pending_payment" }),
    },
    {
      key: "dups",
      icon: Copy,
      tone: "text-purple-700 dark:text-purple-300",
      label: "شبهة رقم فاتورة مكرر",
      count: groups.dups.length,
      detail: groups.dups.length > 0 ? "نفس الرقم ونفس المورد" : null,
      onClick: () => onNavigate?.("invoices", {}),
    },
  ];

  const sendReminder = async () => {
    if (!phone.trim() || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      localStorage.setItem("purchReminderPhone", phone.trim());
    } catch {
      // ignore
    }
    try {
      const response = await authedFetch("/api/accounting/purchase-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSendResult({ ok: false, text: data?.error || "فشل الإرسال" });
      } else {
        setSendResult({
          ok: true,
          text: `أُرسل التذكير (${data.overdue} متأخرة، ${data.dueSoon} قريبة)`,
        });
      }
    } catch {
      setSendResult({ ok: false, text: "فشل الاتصال بالخادم" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${ws.iconButton} w-10 h-10 relative`}
        title="مركز الإشعارات"
        aria-label="مركز الإشعارات"
      >
        <Bell className="w-5 h-5" />
        {groups.count > 0 ? (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {groups.count > 99 ? "99+" : groups.count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute left-0 top-12 z-[500] w-80 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          dir="rtl"
        >
          <div className={`px-4 py-3 border-b ${ws.divider} font-bold text-sm text-slate-900 dark:text-white`}>
            مركز الإشعارات
          </div>
          <div className="max-h-72 overflow-y-auto">
            {groups.count === 0 && groups.pending.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-white/50">
                لا توجد تنبيهات — كل شيء تحت السيطرة 👌
              </div>
            ) : (
              rows
                .filter((row) => row.count > 0)
                .map((row) => {
                  const Icon = row.icon;
                  return (
                    <button
                      key={row.key}
                      type="button"
                      onClick={() => {
                        row.onClick();
                        setOpen(false);
                      }}
                      className="w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] border-b border-slate-100 dark:border-white/5 last:border-0"
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${row.tone}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 dark:text-white/85">
                          {row.label}
                        </span>
                        {row.detail ? (
                          <span className="block text-[11px] text-slate-500 dark:text-white/45 mt-0.5" dir="ltr">
                            {row.detail}
                          </span>
                        ) : null}
                      </span>
                      <span className={`shrink-0 text-sm font-bold ${row.tone}`}>
                        {row.count}
                      </span>
                    </button>
                  );
                })
            )}
          </div>

          {/* تذكير سداد واتساب */}
          <div className={`px-4 py-3 border-t ${ws.divider} space-y-2`}>
            <div className="text-[11px] font-bold text-slate-600 dark:text-white/55">
              تذكير سداد عبر واتساب (متأخرة + 7 أيام قادمة)
            </div>
            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="05xxxxxxxx"
                className={`${ws.input} px-2.5 py-1.5 text-sm flex-1`}
                dir="ltr"
              />
              <button
                type="button"
                onClick={sendReminder}
                disabled={!phone.trim() || sending}
                className={`${ws.btnPrimary} px-3 py-1.5 text-xs disabled:opacity-50 shrink-0`}
              >
                {sending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                إرسال
              </button>
            </div>
            {sendResult ? (
              <div
                className={`text-[11px] ${sendResult.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}
              >
                {sendResult.text}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
