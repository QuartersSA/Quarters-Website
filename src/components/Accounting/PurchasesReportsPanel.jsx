"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Clock3,
  FileSpreadsheet,
  FileText,
  Landmark,
  ListTree,
  Percent,
  Users,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import { exportToExcelHTML, exportToPDF } from "@/utils/exportUtils";
import { useAccountingPurchaseInvoices } from "@/hooks/useAccountingPurchaseInvoices";
import { useAccountingContacts } from "@/hooks/useAccountingContacts";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";
import { useAccountingBankAccounts } from "@/hooks/useAccountingBankAccounts";

/**
 * مركز التقارير — قسم المشتريات.
 *
 * Every report reads the SAME invoice rows the ledger shows (active
 * invoices with their classified lines) and aggregates client-side,
 * so numbers always match the فواتير tab. Shared period filter
 * (month presets + custom range) + per-report Excel/PDF export.
 */

const MONTH_LABELS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const REPORTS = [
  {
    key: "vat",
    label: "التقرير الضريبي",
    Icon: Percent,
    description:
      "ضريبة القيمة المضافة على المشتريات — صافي المشتريات والضريبة شهرياً خلال الفترة.",
  },
  {
    key: "by-account",
    label: "المشتريات حسب الحساب",
    Icon: ListTree,
    description:
      "إجمالي المشتريات المصنّفة على كل حساب من شجرة الحسابات خلال الفترة.",
  },
  {
    key: "by-supplier",
    label: "المشتريات حسب المورد",
    Icon: Users,
    description:
      "إجمالي الفواتير والمدفوع والمتبقي لكل مورد خلال الفترة.",
  },
  {
    key: "statement",
    label: "كشف حساب مورد",
    Icon: FileText,
    description: "فواتير مورد محدد خلال الفترة مع المدفوع والرصيد.",
  },
  {
    key: "aging",
    label: "أعمار الديون",
    Icon: Clock3,
    description:
      "الأرصدة غير المسددة للموردين موزعة حسب عمر الاستحقاق (اليوم).",
  },
  {
    key: "by-bank",
    label: "المدفوعات حسب البنك",
    Icon: Landmark,
    description:
      "مدفوعات فواتير الفترة موزعة على الحسابات البنكية المسجلة عليها.",
  },
];

function todayRiyadh() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

// Period presets resolve to a [from, to] ISO date pair (inclusive).
function resolvePeriod(preset, customFrom, customTo) {
  const today = todayRiyadh();
  const [y, m] = today.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const monthStart = (yy, mm) => `${yy}-${pad(mm)}-01`;
  const monthEnd = (yy, mm) =>
    `${yy}-${pad(mm)}-${pad(new Date(yy, mm, 0).getDate())}`;

  switch (preset) {
    case "this-month":
      return { from: monthStart(y, m), to: monthEnd(y, m) };
    case "last-month": {
      const yy = m === 1 ? y - 1 : y;
      const mm = m === 1 ? 12 : m - 1;
      return { from: monthStart(yy, mm), to: monthEnd(yy, mm) };
    }
    case "quarter": {
      const qStart = m - ((m - 1) % 3);
      return { from: monthStart(y, qStart), to: monthEnd(y, qStart + 2) };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "custom":
      return { from: customFrom || null, to: customTo || null };
    default:
      return { from: null, to: null }; // all time
  }
}

const PERIOD_OPTIONS = [
  { value: "this-month", label: "هذا الشهر" },
  { value: "last-month", label: "الشهر الماضي" },
  { value: "quarter", label: "هذا الربع" },
  { value: "year", label: "هذه السنة" },
  { value: "all", label: "كل الفترات" },
  { value: "custom", label: "فترة مخصصة" },
];

function periodLabel(preset, from, to) {
  const opt = PERIOD_OPTIONS.find((o) => o.value === preset);
  if (preset === "custom") {
    return `${from || "البداية"} → ${to || "اليوم"}`;
  }
  return opt?.label || "";
}

function KpiCard({ label, value, sub }) {
  return (
    <div className={`${ws.glassSoft} ${ws.card} p-3`}>
      <div className="text-[11px] text-slate-500 dark:text-white/45">
        {label}
      </div>
      <div
        className="text-lg font-bold text-slate-900 dark:text-white mt-0.5"
        dir="ltr"
      >
        {value}
      </div>
      {sub ? (
        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function ReportTable({ columns, rows, footer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="text-right text-[11px] text-slate-500 dark:text-white/45">
            {columns.map((col) => (
              <th
                key={col.header}
                className={`px-3 py-2 font-bold ${col.numeric ? "text-left" : ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04]"
            >
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-3 py-2 ${
                    col.numeric
                      ? "text-left font-mono tabular-nums"
                      : "text-right"
                  } text-slate-800 dark:text-white/80`}
                  dir={col.numeric ? "ltr" : undefined}
                >
                  {col.format
                    ? col.format(col.accessor(row), row)
                    : col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer ? (
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-white/20 font-bold text-slate-900 dark:text-white">
              {columns.map((col) => (
                <td
                  key={col.header}
                  className={`px-3 py-2 ${col.numeric ? "text-left font-mono tabular-nums" : "text-right"}`}
                  dir={col.numeric ? "ltr" : undefined}
                >
                  {footer[col.header] ?? ""}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export default function PurchasesReportsPanel({ employeeId, isAdmin }) {
  const [reportKey, setReportKey] = useState("vat");
  const [preset, setPreset] = useState("this-month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [supplierId, setSupplierId] = useState("");

  const invoicesQuery = useAccountingPurchaseInvoices({
    employeeId,
    isAdmin,
  });
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });
  const banksQuery = useAccountingBankAccounts({ employeeId, isAdmin });

  const invoices = invoicesQuery.data || [];
  const contacts = contactsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const banks = banksQuery.data || [];

  const { from, to } = useMemo(
    () => resolvePeriod(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  // Active invoices inside the period (inclusive, lexicographic ISO).
  const periodInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (invoice.is_active === false) return false;
      const date = invoice.invoice_date || "";
      if (from && date < from) return false;
      if (to && date > to) return false;
      return true;
    });
  }, [invoices, from, to]);

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [Number(account.id), account])),
    [accounts],
  );
  const bankById = useMemo(
    () => new Map(banks.map((bank) => [Number(bank.id), bank])),
    [banks],
  );

  const supplierOptions = useMemo(() => {
    const active = contacts.filter((contact) => contact.is_active !== false);
    return [
      { value: "", label: "اختر المورد…" },
      ...active.map((contact) => ({
        value: String(contact.id),
        label: contact.name,
      })),
    ];
  }, [contacts]);

  const activeReport =
    REPORTS.find((report) => report.key === reportKey) || REPORTS[0];

  // ── Aggregations ────────────────────────────────────────────────

  // أساس الإقرار: «الاستحقاق» (افتراضي هيئة الزكاة — كل فواتير
  // الفترة باستلام الفاتورة الضريبية) أو «النقدي» (يحتاج موافقة
  // الهيئة — الفواتير المسددة بالكامل فقط، تقريب لغياب سجل تواريخ
  // الدفعات).
  const [vatBasis, setVatBasis] = useState("accrual");

  // نموذج الإقرار الضريبي (ZATCA): خانة 7 = المشتريات الخاضعة للنسبة
  // الأساسية، خانة 10 = مشتريات بالنسبة الصفرية — من بنود الفواتير،
  // مع توزيع خصم الفاتورة تناسبياً حتى تطابق المجاميع رؤوس الفواتير.
  const vatReturn = useMemo(() => {
    let standardBase = 0;
    let standardVat = 0;
    let zeroBase = 0;
    const vatInvoices =
      vatBasis === "cash"
        ? periodInvoices.filter(
            (invoice) =>
              moneyValue(invoice.total_amount) > 0 &&
              moneyValue(invoice.paid_amount) + 0.005 >=
                moneyValue(invoice.total_amount),
          )
        : periodInvoices;
    for (const invoice of vatInvoices) {
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      if (items.length === 0) {
        const base = moneyValue(invoice.subtotal_amount);
        const vat = moneyValue(invoice.tax_amount);
        if (vat > 0) {
          standardBase += base;
          standardVat += vat;
        } else {
          zeroBase += base;
        }
        continue;
      }
      const linesBase = items.reduce(
        (acc, item) => acc + moneyValue(item.line_subtotal),
        0,
      );
      const headerBase = moneyValue(invoice.subtotal_amount);
      const factor = linesBase > 0 && headerBase > 0 ? headerBase / linesBase : 1;
      for (const item of items) {
        const base = moneyValue(item.line_subtotal) * factor;
        const vat = moneyValue(item.line_tax) * factor;
        if (moneyValue(item.tax_rate) > 0) {
          standardBase += base;
          standardVat += vat;
        } else {
          zeroBase += base;
        }
      }
    }
    return {
      standardBase: round2(standardBase),
      standardVat: round2(standardVat),
      zeroBase: round2(zeroBase),
      purchasesBase: round2(standardBase + zeroBase),
      purchasesVat: round2(standardVat),
    };
  }, [periodInvoices, vatBasis]);

  // المبيعات تُدخل يدوياً (النظام لا يتتبعها) وتُحفظ لكل فترة على
  // هذا الجهاز. خانة 1 وحدها خاضعة للضريبة — مع مفتاح شامل/غير شامل
  // يعيد الحساب فوراً.
  const salesStorageKey = `vatReturnSales:${from || "all"}:${to || "all"}`;
  const [sales, setSales] = useState({
    r1: "",
    r1IncludesTax: false,
    r2: "",
    r3: "",
    r4: "",
    r5: "",
  });
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(salesStorageKey);
      setSales(
        raw
          ? { r1: "", r1IncludesTax: false, r2: "", r3: "", r4: "", r5: "", ...JSON.parse(raw) }
          : { r1: "", r1IncludesTax: false, r2: "", r3: "", r4: "", r5: "" },
      );
    } catch {
      // ignore
    }
  }, [salesStorageKey]);
  const updateSales = (patch) => {
    setSales((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(salesStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const salesComputed = useMemo(() => {
    const entered = moneyValue(sales.r1);
    const r1Base = sales.r1IncludesTax ? entered / 1.15 : entered;
    const r1Vat = sales.r1IncludesTax ? entered - r1Base : entered * 0.15;
    const r2 = moneyValue(sales.r2);
    const r3 = moneyValue(sales.r3);
    const r4 = moneyValue(sales.r4);
    const r5 = moneyValue(sales.r5);
    return {
      r1Base: round2(r1Base),
      r1Vat: round2(r1Vat),
      r2,
      r3,
      r4,
      r5,
      salesBase: round2(r1Base + r2 + r3 + r4 + r5),
      salesVat: round2(r1Vat),
    };
  }, [sales]);

  // خانة 13: صافي الضريبة المستحقة = ضريبة المبيعات − ضريبة المشتريات.
  const netVatDue = round2(salesComputed.salesVat - vatReturn.purchasesVat);
  const netBaseDue = round2(salesComputed.salesBase - vatReturn.purchasesBase);

  // صفوف نموذج الإقرار — تُعرض وتُصدَّر بنفس ترتيب نموذج الهيئة.
  const vatReturnRows = useMemo(
    () => [
      { section: "ضريبة القيمة المضافة على الإيرادات" },
      {
        no: 1,
        label: "المبيعات الخاضعة للنسبة الأساسية",
        base: salesComputed.r1Base,
        vat: salesComputed.r1Vat,
      },
      {
        no: 2,
        label:
          "المبيعات للمواطنين (الخدمات الصحية الخاصة / التعليم الأهلي الخاص)",
        base: salesComputed.r2,
        vat: 0,
      },
      {
        no: 3,
        label: "المبيعات المحلية الخاضعة للنسبة الصفرية",
        base: salesComputed.r3,
        vat: 0,
      },
      { no: 4, label: "صادرات", base: salesComputed.r4, vat: 0 },
      { no: 5, label: "مبيعات معفاة", base: salesComputed.r5, vat: 0 },
      {
        no: 6,
        label: "إجمالي المبيعات",
        base: salesComputed.salesBase,
        vat: salesComputed.salesVat,
        isTotal: true,
      },
      { section: "ضريبة القيمة المضافة على مشتريات" },
      {
        no: 7,
        label: "المشتريات الخاضعة للنسبة الأساسية",
        base: vatReturn.standardBase,
        vat: vatReturn.standardVat,
      },
      {
        no: 8,
        label:
          "الاستيرادات الخاضعة لضريبة القيمة المضافة بالنسبة الأساسية والتي تدفع في الجمارك",
        base: 0,
        vat: 0,
      },
      {
        no: 9,
        label:
          "الاستيرادات الخاضعة لضريبة القيمة المضافة التي تطبق عليها آلية الاحتساب العكسي",
        base: 0,
        vat: 0,
      },
      {
        no: 10,
        label: "مشتريات بالنسبة الصفرية",
        base: vatReturn.zeroBase,
        vat: 0,
      },
      { no: 11, label: "مشتريات معفاة", base: 0, vat: 0 },
      {
        no: 12,
        label: "إجمالي المشتريات",
        base: vatReturn.purchasesBase,
        vat: vatReturn.purchasesVat,
        isTotal: true,
      },
      {
        no: 13,
        label: "إجمالي ضريبة القيمة المضافة المستحقة عن الفترة الضريبية الحالية",
        base: netBaseDue,
        vat: netVatDue,
        isTotal: true,
        isNet: true,
      },
    ],
    [salesComputed, vatReturn, netBaseDue, netVatDue],
  );

  const byAccountReport = useMemo(() => {
    const map = new Map();
    let unclassified = null;
    for (const invoice of periodInvoices) {
      const items = Array.isArray(invoice.items) ? invoice.items : [];
      if (items.length === 0) {
        // Legacy header-only invoice — classify on the header account.
        const id = invoice.expense_account_id
          ? Number(invoice.expense_account_id)
          : null;
        const key = id ?? "none";
        if (!map.has(key)) {
          map.set(key, { accountId: id, net: 0, tax: 0, total: 0, count: 0 });
        }
        const bucket = map.get(key);
        bucket.net += moneyValue(invoice.subtotal_amount);
        bucket.tax += moneyValue(invoice.tax_amount);
        bucket.total += moneyValue(invoice.total_amount);
        bucket.count += 1;
        continue;
      }
      for (const item of items) {
        const id = item.account_id ? Number(item.account_id) : null;
        const key = id ?? "none";
        if (!map.has(key)) {
          map.set(key, { accountId: id, net: 0, tax: 0, total: 0, count: 0 });
        }
        const bucket = map.get(key);
        bucket.net += moneyValue(item.line_subtotal);
        bucket.tax += moneyValue(item.line_tax);
        bucket.total += moneyValue(item.line_total);
        bucket.count += 1;
      }
    }
    const rows = [...map.values()]
      .map((bucket) => {
        const account = bucket.accountId
          ? accountById.get(bucket.accountId)
          : null;
        return {
          ...bucket,
          code: account?.code || "—",
          name: account?.name || "غير مصنّفة",
        };
      })
      .sort((a, b) => b.total - a.total);
    unclassified = rows.find((row) => !row.accountId) || null;
    const totals = rows.reduce(
      (acc, row) => {
        acc.net += row.net;
        acc.tax += row.tax;
        acc.total += row.total;
        return acc;
      },
      { net: 0, tax: 0, total: 0 },
    );
    return { rows, totals, unclassified };
  }, [periodInvoices, accountById]);

  const bySupplierReport = useMemo(() => {
    const map = new Map();
    for (const invoice of periodInvoices) {
      const key = invoice.contact_id
        ? `c${invoice.contact_id}`
        : `n:${invoice.supplier_name || "بدون مورد"}`;
      if (!map.has(key)) {
        map.set(key, {
          name:
            invoice.contact_name ||
            invoice.supplier_name ||
            "بدون مورد",
          count: 0,
          net: 0,
          tax: 0,
          total: 0,
          paid: 0,
          balance: 0,
        });
      }
      const bucket = map.get(key);
      bucket.count += 1;
      bucket.net += moneyValue(invoice.subtotal_amount);
      bucket.tax += moneyValue(invoice.tax_amount);
      bucket.total += moneyValue(invoice.total_amount);
      bucket.paid += moneyValue(invoice.paid_amount);
      bucket.balance += moneyValue(invoice.balance_due);
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    const totals = rows.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.paid += row.paid;
        acc.balance += row.balance;
        return acc;
      },
      { total: 0, paid: 0, balance: 0 },
    );
    return { rows, totals };
  }, [periodInvoices]);

  const statementReport = useMemo(() => {
    if (!supplierId) return { rows: [], totals: null };
    const rows = periodInvoices
      .filter((invoice) => String(invoice.contact_id) === supplierId)
      .sort((a, b) =>
        String(a.invoice_date).localeCompare(String(b.invoice_date)),
      );
    const totals = rows.reduce(
      (acc, invoice) => {
        acc.total += moneyValue(invoice.total_amount);
        acc.paid += moneyValue(invoice.paid_amount);
        acc.balance += moneyValue(invoice.balance_due);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 },
    );
    return { rows, totals };
  }, [periodInvoices, supplierId]);

  // Aging always reads ALL active unpaid invoices — a debt doesn't
  // stop existing because the filter looks at last month.
  const agingReport = useMemo(() => {
    const today = todayRiyadh();
    const msPerDay = 24 * 60 * 60 * 1000;
    const buckets = ["current", "b30", "b60", "b90", "b90plus"];
    const map = new Map();
    for (const invoice of invoices) {
      if (invoice.is_active === false) continue;
      const balance = moneyValue(invoice.balance_due);
      if (balance <= 0) continue;
      const due = invoice.due_date || invoice.invoice_date;
      const days = Math.floor(
        (new Date(today).getTime() - new Date(due).getTime()) / msPerDay,
      );
      const bucket =
        days <= 0
          ? "current"
          : days <= 30
            ? "b30"
            : days <= 60
              ? "b60"
              : days <= 90
                ? "b90"
                : "b90plus";
      const key = invoice.contact_id
        ? `c${invoice.contact_id}`
        : `n:${invoice.supplier_name || "بدون مورد"}`;
      if (!map.has(key)) {
        map.set(key, {
          name: invoice.contact_name || invoice.supplier_name || "بدون مورد",
          current: 0,
          b30: 0,
          b60: 0,
          b90: 0,
          b90plus: 0,
          total: 0,
        });
      }
      const row = map.get(key);
      row[bucket] += balance;
      row.total += balance;
    }
    const rows = [...map.values()].sort((a, b) => b.total - a.total);
    const totals = rows.reduce(
      (acc, row) => {
        for (const key of [...buckets, "total"]) acc[key] += row[key];
        return acc;
      },
      { current: 0, b30: 0, b60: 0, b90: 0, b90plus: 0, total: 0 },
    );
    return { rows, totals };
  }, [invoices]);

  const byBankReport = useMemo(() => {
    const map = new Map();
    for (const invoice of periodInvoices) {
      const paid = moneyValue(invoice.paid_amount);
      if (paid <= 0) continue;
      const id = invoice.paid_bank_account_id
        ? Number(invoice.paid_bank_account_id)
        : null;
      const key = id ?? "none";
      if (!map.has(key)) {
        const bank = id ? bankById.get(id) : null;
        map.set(key, {
          name: bank
            ? `${bank.name}${bank.bank_name ? ` — ${bank.bank_name}` : ""}`
            : invoice.paid_bank_name || "بدون تحديد حساب",
          count: 0,
          paid: 0,
        });
      }
      const bucket = map.get(key);
      bucket.count += 1;
      bucket.paid += paid;
    }
    const rows = [...map.values()].sort((a, b) => b.paid - a.paid);
    const total = rows.reduce((acc, row) => acc + row.paid, 0);
    return { rows, total };
  }, [periodInvoices, bankById]);

  // ── Export ──────────────────────────────────────────────────────

  const exportConfig = useMemo(() => {
    const label = periodLabel(preset, from, to);
    switch (reportKey) {
      case "vat":
        return {
          filename: "vat-return",
          title: `الإقرار الضريبي — ضريبة القيمة المضافة (${label})`,
          columns: [
            { header: "رقم الخانة", accessor: (row) => row.no ?? "" },
            {
              header: "البيان",
              accessor: (row) => row.section || row.label || "",
            },
            {
              header: "المبلغ الخاضع للضريبة (SAR)",
              accessor: (row) =>
                row.section ? "" : money(row.base),
            },
            {
              header: "مبلغ الضريبة (SAR)",
              accessor: (row) => (row.section ? "" : money(row.vat)),
            },
            {
              header: "تعديلات",
              accessor: (row) => (row.section ? "" : "0.00"),
            },
          ],
          rows: vatReturnRows,
        };
      case "by-account":
        return {
          filename: "purchases-by-account",
          title: `المشتريات حسب الحساب (${label})`,
          columns: [
            { header: "رقم الحساب", accessor: (row) => row.code },
            { header: "الحساب", accessor: (row) => row.name },
            { header: "عدد البنود", accessor: (row) => row.count },
            { header: "الصافي (SAR)", accessor: (row) => money(row.net) },
            { header: "الضريبة (SAR)", accessor: (row) => money(row.tax) },
            { header: "الإجمالي (SAR)", accessor: (row) => money(row.total) },
          ],
          rows: byAccountReport.rows,
        };
      case "by-supplier":
        return {
          filename: "purchases-by-supplier",
          title: `المشتريات حسب المورد (${label})`,
          columns: [
            { header: "المورد", accessor: (row) => row.name },
            { header: "عدد الفواتير", accessor: (row) => row.count },
            { header: "الإجمالي (SAR)", accessor: (row) => money(row.total) },
            { header: "المدفوع (SAR)", accessor: (row) => money(row.paid) },
            {
              header: "المتبقي (SAR)",
              accessor: (row) => money(row.balance),
            },
          ],
          rows: bySupplierReport.rows,
        };
      case "statement": {
        const supplier = contacts.find(
          (contact) => String(contact.id) === supplierId,
        );
        return {
          filename: "supplier-statement",
          title: `كشف حساب مورد — ${supplier?.name || ""} (${label})`,
          columns: [
            { header: "التاريخ", accessor: (row) => row.invoice_date },
            { header: "رقم الفاتورة", accessor: (row) => row.invoice_number },
            { header: "الإجمالي (SAR)", accessor: (row) => money(row.total_amount) },
            { header: "المدفوع (SAR)", accessor: (row) => money(row.paid_amount) },
            { header: "المتبقي (SAR)", accessor: (row) => money(row.balance_due) },
            { header: "البنك", accessor: (row) => row.paid_bank_name || "" },
          ],
          rows: statementReport.rows,
        };
      }
      case "aging":
        return {
          filename: "ap-aging",
          title: "أعمار ديون الموردين (حتى اليوم)",
          columns: [
            { header: "المورد", accessor: (row) => row.name },
            { header: "غير مستحق (SAR)", accessor: (row) => money(row.current) },
            { header: "1-30 يوم (SAR)", accessor: (row) => money(row.b30) },
            { header: "31-60 يوم (SAR)", accessor: (row) => money(row.b60) },
            { header: "61-90 يوم (SAR)", accessor: (row) => money(row.b90) },
            { header: "+90 يوم (SAR)", accessor: (row) => money(row.b90plus) },
            { header: "الإجمالي (SAR)", accessor: (row) => money(row.total) },
          ],
          rows: agingReport.rows,
        };
      case "by-bank":
        return {
          filename: "payments-by-bank",
          title: `المدفوعات حسب الحساب البنكي (${label})`,
          columns: [
            { header: "الحساب البنكي", accessor: (row) => row.name },
            { header: "عدد الفواتير", accessor: (row) => row.count },
            { header: "المدفوع (SAR)", accessor: (row) => money(row.paid) },
          ],
          rows: byBankReport.rows,
        };
      default:
        return null;
    }
  }, [
    reportKey,
    preset,
    from,
    to,
    vatReturnRows,
    byAccountReport,
    bySupplierReport,
    statementReport,
    agingReport,
    byBankReport,
    contacts,
    supplierId,
  ]);

  const handleExportExcel = () => {
    if (!exportConfig) return;
    exportToExcelHTML(
      exportConfig.rows,
      exportConfig.filename,
      exportConfig.columns,
      exportConfig.title,
    );
  };
  const handleExportPdf = () => {
    if (!exportConfig) return;
    exportToPDF(
      exportConfig.rows,
      exportConfig.filename,
      exportConfig.columns,
      exportConfig.title,
    );
  };

  // ── Render ──────────────────────────────────────────────────────

  if (invoicesQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل بيانات التقارير…
      </div>
    );
  }

  const showPeriodFilter = reportKey !== "aging";
  const canExport =
    (exportConfig?.rows?.length || 0) > 0 &&
    (reportKey !== "statement" || !!supplierId);

  return (
    <>
      {/* Report picker */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {REPORTS.map((report) => {
          const Icon = report.Icon;
          const isActive = report.key === reportKey;
          return (
            <button
              key={report.key}
              type="button"
              onClick={() => setReportKey(report.key)}
              className={`${ws.glass} ${ws.card} p-3 text-right transition-colors ${
                isActive
                  ? "ring-2 ring-emerald-500/60"
                  : "hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              }`}
              title={report.description}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`${ws.iconBox} w-8 h-8 shrink-0 ${
                    isActive
                      ? "text-emerald-700 dark:text-emerald-200"
                      : "text-slate-500 dark:text-white/50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-white/85 leading-tight">
                  {report.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters + export */}
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-slate-500 dark:text-white/50 shrink-0" />
            {showPeriodFilter ? (
              <div className="w-40">
                <GlassSelect
                  value={preset}
                  onChange={setPreset}
                  options={PERIOD_OPTIONS}
                  buttonClassName="text-sm py-2 px-3"
                />
              </div>
            ) : (
              <span className="text-xs text-slate-500 dark:text-white/50">
                يُحتسب دائماً حتى تاريخ اليوم
              </span>
            )}
          </div>

          {showPeriodFilter && preset === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className={`${ws.input} px-2.5 py-1.5 text-sm w-40`}
                dir="ltr"
              />
              <span className="text-slate-400 dark:text-white/35">←</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className={`${ws.input} px-2.5 py-1.5 text-sm w-40`}
                dir="ltr"
              />
            </div>
          ) : null}

          {reportKey === "statement" ? (
            <div className="w-56">
              <GlassSelect
                value={supplierId}
                onChange={setSupplierId}
                options={supplierOptions}
                placeholder="اختر المورد…"
                buttonClassName="text-sm py-2 px-3"
                searchable
                searchPlaceholder="ابحث عن مورد…"
              />
            </div>
          ) : null}

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={!canExport}
            className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!canExport}
            className={`${ws.btnNeutral} px-3 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Report body */}
      <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
        <div
          className={`px-4 py-3 border-b ${ws.divider} flex items-center justify-between gap-3`}
        >
          <div>
            <div className="text-slate-900 dark:text-white font-bold">
              {activeReport.label}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {activeReport.description}
            </div>
          </div>
          <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {reportKey === "vat" ? (
            <>
              {/* أساس الإقرار */}
              <div className={`${ws.glassSoft} ${ws.card} p-3 flex items-center gap-3 flex-wrap`}>
                <div className="text-sm font-bold text-slate-900 dark:text-white shrink-0">
                  أساس الإقرار
                </div>
                <div className={ws.segWrap}>
                  <button
                    type="button"
                    onClick={() => setVatBasis("accrual")}
                    className={`${ws.segBtn} text-[11px] ${vatBasis === "accrual" ? ws.segActive : ws.segInactive}`}
                  >
                    الاستحقاق — كل فواتير الفترة
                  </button>
                  <button
                    type="button"
                    onClick={() => setVatBasis("cash")}
                    className={`${ws.segBtn} text-[11px] ${vatBasis === "cash" ? ws.segActive : ws.segInactive}`}
                  >
                    النقدي — المسددة بالكامل فقط
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-white/45">
                  {vatBasis === "accrual"
                    ? "الافتراضي نظاماً: ضريبة المدخلات تُخصم باستلام الفاتورة الضريبية ولو لم تُسدد."
                    : "يتطلب موافقة الهيئة (إيرادات أقل من 5م ريال). تُحتسب الفواتير المسددة بالكامل فقط."}
                </div>
              </div>

              {/* إدخال المبيعات — تُحسب الضريبة فوراً وتُحفظ للفترة */}
              <div className={`${ws.glassSoft} ${ws.card} p-4 space-y-3`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    إدخال المبيعات للفترة
                  </div>
                  <div className={ws.segWrap}>
                    <button
                      type="button"
                      onClick={() => updateSales({ r1IncludesTax: false })}
                      className={`${ws.segBtn} text-[11px] ${!sales.r1IncludesTax ? ws.segActive : ws.segInactive}`}
                    >
                      المبلغ غير شامل الضريبة
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSales({ r1IncludesTax: true })}
                      className={`${ws.segBtn} text-[11px] ${sales.r1IncludesTax ? ws.segActive : ws.segInactive}`}
                    >
                      المبلغ شامل الضريبة
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  {[
                    { key: "r1", label: "مبيعات النسبة الأساسية (15%)" },
                    { key: "r2", label: "مبيعات للمواطنين (صحة/تعليم)" },
                    { key: "r3", label: "مبيعات بالنسبة الصفرية" },
                    { key: "r4", label: "صادرات" },
                    { key: "r5", label: "مبيعات معفاة" },
                  ].map((field) => (
                    <div key={field.key}>
                      <div className="text-[11px] text-slate-500 dark:text-white/45 mb-1">
                        {field.label}
                      </div>
                      <input
                        type="number"
                        value={sales[field.key]}
                        onChange={(event) =>
                          updateSales({ [field.key]: event.target.value })
                        }
                        className={`${ws.input} px-2.5 py-2 text-sm text-left`}
                        step="0.01"
                        min="0"
                        dir="ltr"
                        placeholder="0.00"
                      />
                      {field.key === "r1" && moneyValue(sales.r1) > 0 ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1" dir="ltr">
                          الخاضع {money(salesComputed.r1Base)} + ضريبة {money(salesComputed.r1Vat)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-white/35">
                  تُحفظ القيم لهذه الفترة على هذا الجهاز. خانات المشتريات
                  (7 و10) تتعبأ تلقائياً من فواتير الفترة.
                </div>
              </div>

              {/* نموذج الإقرار الضريبي */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="text-right text-[11px] text-slate-500 dark:text-white/45 border-b border-slate-200 dark:border-white/10">
                      <th className="px-3 py-2 font-bold w-20">رقم الخانة</th>
                      <th className="px-3 py-2 font-bold">البيان</th>
                      <th className="px-3 py-2 font-bold text-left w-44">
                        المبلغ الخاضع للضريبة
                      </th>
                      <th className="px-3 py-2 font-bold text-left w-36">
                        مبلغ الضريبة
                      </th>
                      <th className="px-3 py-2 font-bold text-left w-24">
                        تعديلات
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatReturnRows.map((row, index) => {
                      if (row.section) {
                        return (
                          <tr key={`s${index}`}>
                            <td
                              colSpan={5}
                              className="px-3 pt-5 pb-2 font-bold text-slate-900 dark:text-white"
                            >
                              {row.section}
                            </td>
                          </tr>
                        );
                      }
                      const dash = (value) =>
                        value === 0 && !row.isTotal ? (
                          <span className="text-slate-400 dark:text-white/30">—</span>
                        ) : (
                          money(value)
                        );
                      return (
                        <tr
                          key={row.no}
                          className={
                            row.isTotal
                              ? "border-t-2 border-b-4 border-double border-slate-300 dark:border-white/25 font-bold text-slate-900 dark:text-white"
                              : "border-t border-slate-100 dark:border-white/5 text-slate-800 dark:text-white/80"
                          }
                        >
                          <td className="px-3 py-2.5 font-mono" dir="ltr">
                            {row.no}
                          </td>
                          <td className="px-3 py-2.5">{row.label}</td>
                          <td
                            className={`px-3 py-2.5 text-left font-mono tabular-nums ${row.isNet && row.base < 0 ? "text-rose-700 dark:text-rose-300" : row.base > 0 && !row.isTotal ? "text-sky-700 dark:text-sky-300" : ""}`}
                            dir="ltr"
                          >
                            {dash(row.base)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-left font-mono tabular-nums ${row.isNet && row.vat < 0 ? "text-rose-700 dark:text-rose-300" : row.vat > 0 && !row.isTotal ? "text-sky-700 dark:text-sky-300" : ""}`}
                            dir="ltr"
                          >
                            {dash(row.vat)}
                          </td>
                          <td className="px-3 py-2.5 text-left font-mono tabular-nums" dir="ltr">
                            0.00
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {netVatDue < 0 ? (
                <div className="text-[11px] text-slate-500 dark:text-white/45">
                  القيمة السالبة في خانة 13 تعني ضريبة مدخلات قابلة
                  للاسترداد/الترحيل — المشتريات أعلى من المبيعات في الفترة.
                </div>
              ) : null}
            </>
          ) : null}

          {reportKey === "by-account" ? (
            byAccountReport.rows.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                لا توجد مشتريات في الفترة المحددة.
              </div>
            ) : (
              <ReportTable
                columns={[
                  { header: "الرقم", accessor: (row) => row.code, numeric: true },
                  { header: "الحساب", accessor: (row) => row.name },
                  { header: "البنود", accessor: (row) => row.count, numeric: true },
                  { header: "الصافي", accessor: (row) => money(row.net), numeric: true },
                  { header: "الضريبة", accessor: (row) => money(row.tax), numeric: true },
                  { header: "الإجمالي", accessor: (row) => money(row.total), numeric: true },
                ]}
                rows={byAccountReport.rows}
                footer={{
                  الحساب: "الإجمالي",
                  الصافي: money(byAccountReport.totals.net),
                  الضريبة: money(byAccountReport.totals.tax),
                  الإجمالي: money(byAccountReport.totals.total),
                }}
              />
            )
          ) : null}

          {reportKey === "by-supplier" ? (
            bySupplierReport.rows.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                لا توجد فواتير في الفترة المحددة.
              </div>
            ) : (
              <ReportTable
                columns={[
                  { header: "المورد", accessor: (row) => row.name },
                  { header: "الفواتير", accessor: (row) => row.count, numeric: true },
                  { header: "الإجمالي", accessor: (row) => money(row.total), numeric: true },
                  { header: "المدفوع", accessor: (row) => money(row.paid), numeric: true },
                  { header: "المتبقي", accessor: (row) => money(row.balance), numeric: true },
                ]}
                rows={bySupplierReport.rows}
                footer={{
                  المورد: "الإجمالي",
                  الإجمالي: money(bySupplierReport.totals.total),
                  المدفوع: money(bySupplierReport.totals.paid),
                  المتبقي: money(bySupplierReport.totals.balance),
                }}
              />
            )
          ) : null}

          {reportKey === "statement" ? (
            !supplierId ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                اختر مورداً من الفلاتر أعلاه لعرض كشف حسابه.
              </div>
            ) : statementReport.rows.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                لا توجد فواتير لهذا المورد في الفترة المحددة.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard
                    label="إجمالي الفواتير"
                    value={`${money(statementReport.totals.total)} SAR`}
                  />
                  <KpiCard
                    label="المدفوع"
                    value={`${money(statementReport.totals.paid)} SAR`}
                  />
                  <KpiCard
                    label="الرصيد المستحق"
                    value={`${money(statementReport.totals.balance)} SAR`}
                  />
                </div>
                <ReportTable
                  columns={[
                    { header: "التاريخ", accessor: (row) => row.invoice_date, numeric: true },
                    { header: "رقم الفاتورة", accessor: (row) => row.invoice_number, numeric: true },
                    { header: "الإجمالي", accessor: (row) => money(row.total_amount), numeric: true },
                    { header: "المدفوع", accessor: (row) => money(row.paid_amount), numeric: true },
                    { header: "المتبقي", accessor: (row) => money(row.balance_due), numeric: true },
                    { header: "البنك", accessor: (row) => row.paid_bank_name || "—" },
                  ]}
                  rows={statementReport.rows}
                  footer={{
                    "رقم الفاتورة": "الإجمالي",
                    الإجمالي: money(statementReport.totals.total),
                    المدفوع: money(statementReport.totals.paid),
                    المتبقي: money(statementReport.totals.balance),
                  }}
                />
              </>
            )
          ) : null}

          {reportKey === "aging" ? (
            agingReport.rows.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                لا توجد أرصدة غير مسددة — كل الفواتير مسددة. 👌
              </div>
            ) : (
              <ReportTable
                columns={[
                  { header: "المورد", accessor: (row) => row.name },
                  { header: "غير مستحق", accessor: (row) => money(row.current), numeric: true },
                  { header: "1-30", accessor: (row) => money(row.b30), numeric: true },
                  { header: "31-60", accessor: (row) => money(row.b60), numeric: true },
                  { header: "61-90", accessor: (row) => money(row.b90), numeric: true },
                  { header: "+90", accessor: (row) => money(row.b90plus), numeric: true },
                  { header: "الإجمالي", accessor: (row) => money(row.total), numeric: true },
                ]}
                rows={agingReport.rows}
                footer={{
                  المورد: "الإجمالي",
                  "غير مستحق": money(agingReport.totals.current),
                  "1-30": money(agingReport.totals.b30),
                  "31-60": money(agingReport.totals.b60),
                  "61-90": money(agingReport.totals.b90),
                  "+90": money(agingReport.totals.b90plus),
                  الإجمالي: money(agingReport.totals.total),
                }}
              />
            )
          ) : null}

          {reportKey === "by-bank" ? (
            byBankReport.rows.length === 0 ? (
              <div className="text-center text-sm text-slate-500 dark:text-white/50 py-8">
                لا توجد مدفوعات في الفترة المحددة.
              </div>
            ) : (
              <ReportTable
                columns={[
                  { header: "الحساب البنكي", accessor: (row) => row.name },
                  { header: "الفواتير", accessor: (row) => row.count, numeric: true },
                  { header: "المدفوع", accessor: (row) => money(row.paid), numeric: true },
                ]}
                rows={byBankReport.rows}
                footer={{
                  "الحساب البنكي": "الإجمالي",
                  المدفوع: money(byBankReport.total),
                }}
              />
            )
          ) : null}
        </div>
      </div>
    </>
  );
}
