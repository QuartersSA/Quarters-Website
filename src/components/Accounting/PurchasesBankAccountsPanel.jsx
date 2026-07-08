"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BookOpen,
  Building2,
  CreditCard,
  FileUp,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { ws } from "@/components/Workspace/uiPurchases";
import BankAccountModal, {
  ACCOUNT_TYPE_OPTIONS,
} from "@/components/Accounting/BankAccountModal";
import {
  useAccountingBankAccounts,
  useCreateAccountingBankAccount,
  useDeleteAccountingBankAccount,
  useUpdateAccountingBankAccount,
} from "@/hooks/useAccountingBankAccounts";

function accountTypeLabel(value) {
  return ACCOUNT_TYPE_OPTIONS.find((option) => option.value === value)?.label || "بنك";
}

function accountTypeIcon(value) {
  if (value === "credit_card") return CreditCard;
  if (value === "petty_cash") return Wallet;
  return Building2;
}

function formatMoney(value, currency = "SAR") {
  const number = Number(value || 0);
  const safe = Number.isFinite(number) ? number : 0;
  return `${safe.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function buildUpdatePayload(account, overrides = {}) {
  return {
    id: account.id,
    name: account.name,
    account_type: account.account_type || "bank",
    currency: account.currency || "SAR",
    bank_name: account.bank_name || null,
    iban: account.iban || null,
    account_number: account.account_number || null,
    book_balance: moneyValue(account.book_balance),
    statement_balance: moneyValue(account.statement_balance),
    notes: account.notes || null,
    ...overrides,
  };
}

function StatementBalanceModal({ account, isSubmitting, onClose, onSubmit }) {
  const [statementBalance, setStatementBalance] = useState(
    account ? String(moneyValue(account.statement_balance).toFixed(2)) : "0.00",
  );

  useEffect(() => {
    if (!account) return;
    setStatementBalance(String(moneyValue(account.statement_balance).toFixed(2)));
  }, [account]);

  if (!account) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`${ws.glass} ${ws.card} w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-5`}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              استيراد كشف حساب
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
              حدّث رصيد كشف الحساب لـ {account.name}.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            ×
          </button>
        </div>

        <div>
          <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
            رصيد كشف الحساب
          </div>
          <input
            type="number"
            value={statementBalance}
            onChange={(event) => setStatementBalance(event.target.value)}
            className={`${ws.input} px-3 py-2.5 text-right`}
            step="0.01"
            dir="ltr"
          />
          <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
            أدخل هنا الرصيد الموجود في كشف البنك أو البطاقة، ثم يقارنه النظام مع رصيد الدفتر.
          </div>
        </div>

        <div className={`flex items-center gap-2 pt-4 mt-4 border-t ${ws.divider}`}>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() =>
              onSubmit(
                buildUpdatePayload(account, {
                  statement_balance:
                    statementBalance === "" ? 0 : Number(statementBalance),
                }),
              )
            }
            className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50`}
          >
            <FileUp className="w-4 h-4" />
            حفظ الرصيد
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.btnNeutral} px-4 py-2`}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchasesBankAccountsPanel({ employeeId, isAdmin }) {
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [statementAccount, setStatementAccount] = useState(null);

  const accountsQuery = useAccountingBankAccounts({
    employeeId,
    isAdmin,
    q,
    includeInactive,
  });
  const accounts = accountsQuery.data || [];

  const createMut = useCreateAccountingBankAccount();
  const updateMut = useUpdateAccountingBankAccount();
  const deleteMut = useDeleteAccountingBankAccount();

  const totals = useMemo(() => {
    return accounts.reduce(
      (acc, account) => {
        acc.book += moneyValue(account.book_balance);
        acc.statement += moneyValue(account.statement_balance);
        acc.diff += moneyValue(account.difference);
        return acc;
      },
      { book: 0, statement: 0, diff: 0 },
    );
  }, [accounts]);

  const handleSubmit = (payload) => {
    if (editing) {
      updateMut.mutate(payload, {
        onSuccess: () => setEditing(null),
      });
    } else {
      createMut.mutate(payload, {
        onSuccess: () => setShowAdd(false),
      });
    }
  };

  const handleStatementSubmit = (payload) => {
    updateMut.mutate(payload, {
      onSuccess: () => setStatementAccount(null),
    });
  };

  const handleDelete = (account) => {
    const ok = window.confirm(
      `إيقاف حساب "${account.name}"؟ يمكنك عرضه لاحقاً من خيار عرض الموقوفين.`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: account.id, force: false });
  };

  return (
    <>
      <div className={`${ws.glass} ${ws.card} p-4`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث باسم الحساب، البنك، الآيبان"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="accent-[#0e7a5f]"
            />
            عرض الموقوفين
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => accountsQuery.refetch()}
            className={`${ws.btnNeutral} px-4 py-2`}
          >
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            أضف حساب بنك
          </button>
        </div>
      </div>

      <div className={`${ws.glassSoft} ${ws.card} p-4`}>
        <div className="flex items-start gap-3">
          <div className={`${ws.iconBox} w-10 h-10 shrink-0 text-sky-700 dark:text-sky-200`}>
            <Info className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-900 dark:text-white">
              توضيح سريع للحسابات البنكية
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs leading-6 text-slate-600 dark:text-white/60">
              <div>
                <span className="font-semibold text-slate-800 dark:text-white/85">
                  مصروفات نثرية:
                </span>{" "}
                صندوق أو كاش صغير للمصاريف البسيطة اليومية.
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-white/85">
                  رصيد الدفتر:
                </span>{" "}
                الرصيد المسجل داخل النظام من العمليات والمدفوعات.
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-white/85">
                  رصيد كشف الحساب:
                </span>{" "}
                الرصيد الظاهر في كشف البنك أو البطاقة عند المطابقة.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-white/50">
                إجمالي رصيد الدفتر
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1" dir="ltr">
                {formatMoney(totals.book, "SAR")}
              </div>
            </div>
            <div className={`${ws.iconBox} w-10 h-10 text-sky-700 dark:text-sky-200`}>
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-white/50">
                إجمالي كشف الحساب
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1" dir="ltr">
                {formatMoney(totals.statement, "SAR")}
              </div>
            </div>
            <div className={`${ws.iconBox} w-10 h-10 text-[#0e7a5f] dark:text-emerald-200`}>
              <Banknote className="w-5 h-5" />
            </div>
          </div>
        </div>
        <div className={`${ws.glass} ${ws.card} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-500 dark:text-white/50">
                إجمالي الفرق
              </div>
              <div
                className={`text-xl font-bold mt-1 ${
                  Math.abs(totals.diff) > 0.009
                    ? "text-amber-700 dark:text-amber-200"
                    : "text-slate-900 dark:text-white"
                }`}
                dir="ltr"
              >
                {formatMoney(totals.diff, "SAR")}
              </div>
            </div>
            <div className={`${ws.iconBox} w-10 h-10 text-amber-700 dark:text-amber-200`}>
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {accountsQuery.isLoading ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
          جاري تحميل الحسابات البنكية…
        </div>
      ) : accountsQuery.error ? (
        <div className={`${ws.glass} ${ws.card} p-6 text-red-700 dark:text-red-300 text-sm`}>
          فشل تحميل الحسابات البنكية. حاول مرة أخرى.
        </div>
      ) : accounts.length === 0 ? (
        <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
          <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
            <Building2 className="w-6 h-6 text-slate-500 dark:text-white/50" />
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-white">
            لا توجد حسابات بنكية بعد
          </div>
          <div className="text-sm text-slate-600 dark:text-white/60 mt-1 mb-4">
            أضف حساب بنك أو بطاقة ائتمان أو صندوق مصروفات نثرية للبدء.
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            أضف حساب بنك
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const Icon = accountTypeIcon(account.account_type);
            const isActive = account.is_active !== false;
            const diff = moneyValue(account.difference);
            return (
              <div
                key={account.id}
                className={`${ws.glass} ${ws.card} p-4 sm:p-5 max-w-5xl mx-auto`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 md:order-2">
                    <div className={`${ws.iconBox} w-11 h-11 shrink-0 text-slate-700 dark:text-white/80`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {account.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-white/45 mt-1">
                        {accountTypeLabel(account.account_type)} · {account.currency || "SAR"}
                        {account.bank_name ? ` · ${account.bank_name}` : ""}
                      </div>
                      {account.iban || account.account_number ? (
                        <div className="text-xs text-slate-500 dark:text-white/45 mt-1" dir="ltr">
                          {account.iban || account.account_number}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 md:order-1">
                    <button
                      type="button"
                      onClick={() => setStatementAccount(account)}
                      className={`${ws.btnNeutral} px-3 py-2 text-xs`}
                    >
                      <FileUp className="w-4 h-4" />
                      استيراد كشف حساب
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(account)}
                      className={`${ws.iconButton} w-9 h-9`}
                      title="تعديل"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className={`${ws.iconButton} w-9 h-9 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                      title="إيقاف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className={`${ws.iconButton} w-9 h-9 cursor-default`} title="خيارات إضافية لاحقاً">
                      <MoreVertical className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-8 gap-y-2 max-w-lg">
                  <div className="text-sm text-slate-700 dark:text-white/70 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    رصيد الدفتر
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white text-left" dir="ltr">
                    {formatMoney(account.book_balance, account.currency || "SAR")}
                  </div>

                  <div className="text-sm text-slate-700 dark:text-white/70 flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    رصيد كشف الحساب
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white text-left" dir="ltr">
                    {formatMoney(account.statement_balance, account.currency || "SAR")}
                  </div>

                  <div className={`border-t ${ws.divider} sm:col-span-2 my-1`} />

                  <div className="text-sm text-slate-700 dark:text-white/70 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    الفرق
                  </div>
                  <div
                    className={`text-sm font-bold text-left ${
                      Math.abs(diff) > 0.009
                        ? "text-amber-700 dark:text-amber-200"
                        : "text-slate-900 dark:text-white"
                    }`}
                    dir="ltr"
                  >
                    {formatMoney(diff, account.currency || "SAR")}
                  </div>
                </div>

                {!isActive ? (
                  <div className="mt-4">
                    <span className={`${ws.pill} bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10`}>
                      موقوف
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <BankAccountModal
        open={showAdd || !!editing}
        account={editing}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <StatementBalanceModal
        account={statementAccount}
        isSubmitting={updateMut.isPending}
        onClose={() => setStatementAccount(null)}
        onSubmit={handleStatementSubmit}
      />
    </>
  );
}
