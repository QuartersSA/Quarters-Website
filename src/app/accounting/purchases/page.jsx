"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  BarChart3,
  Building,
  Contact,
  FileText,
  HandCoins,
  LayoutDashboard,
  ListTree,
  Plus,
  Search,
  ShoppingCart,
  Users,
} from "lucide-react";
import AccountingSidebar from "@/components/Accounting/Sidebar";
import useWorkspaceUser from "@/hooks/useWorkspaceUser";
import { ws } from "@/components/Workspace/ui";
import ContactModal from "@/components/Accounting/ContactModal";
import ContactsList from "@/components/Accounting/ContactsList";
import ContactsExportMenu from "@/components/Accounting/ContactsExportMenu";
import BeneficiaryModal from "@/components/Accounting/BeneficiaryModal";
import BeneficiariesList from "@/components/Accounting/BeneficiariesList";
import BeneficiariesExportMenu from "@/components/Accounting/BeneficiariesExportMenu";
import PurchasesOverviewPanel from "@/components/Accounting/PurchasesOverviewPanel";
import PurchasesAccountsTreePanel from "@/components/Accounting/PurchasesAccountsTreePanel";
import PurchasesBankAccountsPanel from "@/components/Accounting/PurchasesBankAccountsPanel";
import PurchasesInvoicesPanel from "@/components/Accounting/PurchasesInvoicesPanel";
import PurchasesReportsPanel from "@/components/Accounting/PurchasesReportsPanel";
import {
  useAccountingContacts,
  useCreateAccountingContact,
  useUpdateAccountingContact,
  useDeleteAccountingContact,
} from "@/hooks/useAccountingContacts";
import {
  useAccountingBeneficiaries,
  useCreateAccountingBeneficiary,
  useUpdateAccountingBeneficiary,
  useDeleteAccountingBeneficiary,
} from "@/hooks/useAccountingBeneficiaries";
import { useAccountingAccounts } from "@/hooks/useAccountingAccounts";

/**
 * Purchases section.
 *
 * Built on شجرة الحسابات (chart of accounts): purchase invoices
 * classify against expense accounts, bank accounts auto-link as asset
 * accounts under «1102 البنوك», and the VAT report reads the invoices'
 * tax amounts (backed by tree accounts 1104 / 2102).
 *
 *   - نظرة عامة            — KPIs, alerts, recent invoices, top accounts
 *   - فواتير المشتريات     — ledger + quick payment + export
 *   - الموردين والمستفيدين  — two-pane (suppliers + beneficiaries)
 *   - شجرة الحسابات         — hierarchical chart of accounts
 *   - الحسابات البنكية      — bank accounts master list
 *   - الضريبة              — VAT report aggregated from invoices
 *
 * The active tab (and vendor sub-tab) live in the URL query string so
 * refresh / back / deep links land on the same view.
 */

const VENDOR_SUBTABS = [
  {
    key: "contacts",
    label: "جهات الاتصال",
    Icon: Contact,
    description: "قائمة جهات الاتصال التجارية — موردين، مكاتب، شركاء، إلخ.",
  },
  {
    key: "beneficiaries",
    label: "المستفيدون",
    Icon: HandCoins,
    description: "قائمة المستفيدين الذين تُحوَّل لهم المدفوعات من حسابات البنك.",
  },
];

const TABS = [
  {
    key: "overview",
    label: "نظرة عامة",
    shortLabel: "عامة",
    Icon: LayoutDashboard,
    description: "ملخص سريع: التزامات، متأخرات، أحدث الفواتير، وأعلى الحسابات.",
  },
  {
    key: "invoices",
    label: "فواتير المشتريات",
    shortLabel: "فواتير",
    Icon: FileText,
    description: "إدخال ومتابعة فواتير المشتريات وتسجيل الدفعات.",
  },
  {
    key: "vendors",
    label: "الموردين والمستفيدين",
    shortLabel: "موردين",
    Icon: Users,
    description: "إدارة جهات الاتصال والمستفيدين في قائمتين منفصلتين.",
    subTabs: VENDOR_SUBTABS,
  },
  {
    key: "accounts",
    label: "شجرة الحسابات",
    shortLabel: "شجرة",
    Icon: ListTree,
    description: "شجرة الحسابات المحاسبية — أساس تصنيف الفواتير والبنوك والضريبة.",
  },
  {
    key: "banks",
    label: "الحسابات البنكية",
    shortLabel: "بنوك",
    Icon: Building,
    description: "حسابات البنك المستخدمة في عمليات الدفع.",
  },
  {
    key: "reports",
    label: "التقارير",
    shortLabel: "تقارير",
    Icon: BarChart3,
    description:
      "مركز التقارير: الضريبة، المشتريات حسب الحساب والمورد، كشوف الحسابات، أعمار الديون، والمدفوعات حسب البنك.",
  },
];

const TAB_KEYS = new Set(TABS.map((tab) => tab.key));
const VENDOR_KEYS = new Set(VENDOR_SUBTABS.map((sub) => sub.key));

function PurchasesMobileHeader({ activeTab }) {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <ShoppingCart className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">
          المشتريات
        </div>
        <div className="text-xs text-slate-500 dark:text-white/50 truncate">
          {activeTab?.label || ""}
        </div>
      </div>
    </div>
  );
}

function PurchasesDesktopHeader({ activeTab }) {
  return (
    <div className="hidden lg:flex items-center gap-4">
      <div className={ws.iconBox}>
        <ShoppingCart className="w-6 h-6 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
          المشتريات
        </h1>
        <p className="text-slate-500 dark:text-white/50 text-sm mt-0.5">
          {activeTab?.description ||
            "فواتير المشتريات، الموردين والمستفيدين، شجرة الحسابات، الحسابات البنكية، والضريبة."}
        </p>
      </div>
    </div>
  );
}

function ContactsPanel({ employeeId, isAdmin }) {
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const contactsQuery = useAccountingContacts({
    employeeId,
    isAdmin,
    q: q || null,
    includeInactive,
  });
  const contacts = contactsQuery.data || [];
  // شجرة الحسابات — feeds the supplier's default-account picker.
  const accountsQuery = useAccountingAccounts({ employeeId, isAdmin });
  const accounts = accountsQuery.data || [];

  const createMut = useCreateAccountingContact();
  const updateMut = useUpdateAccountingContact();
  const deleteMut = useDeleteAccountingContact();

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

  const handleDelete = (contact) => {
    const ok = window.confirm(
      `إيقاف "${contact.name}"؟ يمكنك تفعيلها لاحقاً من قائمة الموقوفين.`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: contact.id, force: false });
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم المنشأة أو الرقم الضريبي"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="accent-emerald-500"
            />
            عرض الموقوفين
          </label>
          <div className="flex-1" />
          <ContactsExportMenu contacts={contacts} />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            إضافة جهة اتصال
          </button>
        </div>
      </div>

      <ContactsList
        contacts={contacts}
        isLoading={contactsQuery.isLoading}
        onEdit={(c) => setEditing(c)}
        onDelete={handleDelete}
        onAdd={() => setShowAdd(true)}
      />

      <ContactModal
        open={showAdd || !!editing}
        contact={editing}
        accounts={accounts}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}

function BeneficiariesPanel({ employeeId, isAdmin }) {
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  // Beneficiaries pull contacts to render the link dropdown inside
  // the modal AND to render the contact name on each list row.
  const contactsQuery = useAccountingContacts({ employeeId, isAdmin });
  const contacts = contactsQuery.data || [];

  const benQuery = useAccountingBeneficiaries({
    employeeId,
    isAdmin,
    q: q || null,
    includeInactive,
  });
  const beneficiaries = benQuery.data || [];

  const createMut = useCreateAccountingBeneficiary();
  const updateMut = useUpdateAccountingBeneficiary();
  const deleteMut = useDeleteAccountingBeneficiary();

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

  const handleDelete = (ben) => {
    const ok = window.confirm(
      `إيقاف "${ben.name}"؟ يمكنك تفعيله لاحقاً من قائمة الموقوفين.`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: ben.id, force: false });
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث بالاسم أو الآيبان أو البنك"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="accent-emerald-500"
            />
            عرض الموقوفين
          </label>
          <div className="flex-1" />
          <BeneficiariesExportMenu beneficiaries={beneficiaries} />
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            إضافة مستفيد
          </button>
        </div>
      </div>

      <BeneficiariesList
        beneficiaries={beneficiaries}
        isLoading={benQuery.isLoading}
        onEdit={(b) => setEditing(b)}
        onDelete={handleDelete}
        onAdd={() => setShowAdd(true)}
      />

      <BeneficiaryModal
        open={showAdd || !!editing}
        beneficiary={editing}
        contacts={contacts}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}

export default function PurchasesPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [searchParams, setSearchParams] = useSearchParams();

  const rawTabParam = searchParams.get("tab") || "overview";
  // Legacy deep links: the old الضريبة tab lives inside التقارير now.
  const rawTab = rawTabParam === "tax" ? "reports" : rawTabParam;
  const activeTabKey = TAB_KEYS.has(rawTab) ? rawTab : "overview";
  const rawSub = searchParams.get("sub") || "contacts";
  const vendorSubKey = VENDOR_KEYS.has(rawSub) ? rawSub : "contacts";

  // "invoices:add" style intents let the overview's quick actions land
  // on a tab with its create modal already open.
  const intent = searchParams.get("intent") || "";

  const setTab = useCallback(
    (tabKey, extras = {}) => {
      const next = new URLSearchParams();
      next.set("tab", tabKey);
      if (tabKey === "vendors") {
        next.set("sub", extras.sub || vendorSubKey);
      }
      if (extras.intent) next.set("intent", extras.intent);
      setSearchParams(next, { replace: false });
    },
    [setSearchParams, vendorSubKey],
  );

  const clearIntent = useCallback(() => {
    if (!intent) return;
    const next = new URLSearchParams(searchParams);
    next.delete("intent");
    setSearchParams(next, { replace: true });
  }, [intent, searchParams, setSearchParams]);

  const activeTab = TABS.find((tab) => tab.key === activeTabKey) || TABS[0];
  const activeVendorSub =
    VENDOR_SUBTABS.find((sub) => sub.key === vendorSubKey) || VENDOR_SUBTABS[0];

  // Restore scroll to the top when switching tabs — long tables
  // otherwise leave the next tab starting mid-page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeTabKey]);

  let body = null;
  if (!ready) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60`}>
        جاري التحميل…
      </div>
    );
  } else if (!employeeId) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        الرجاء تسجيل الدخول.
      </div>
    );
  } else if (!isAdmin) {
    body = (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-700 dark:text-white/70`}>
        هذا القسم متاح فقط لمستخدمي المحاسبة.
      </div>
    );
  } else {
    body = (
      <>
        {/* Tab rail — icons + labels, horizontally scrollable on
            mobile. Short labels keep the rail compact under 420px. */}
        <div className={`${ws.glass} ${ws.card} p-2 overflow-x-auto`}>
          <div className="flex items-center gap-1 min-w-max">
            {TABS.map((tab) => {
              const isActive = tab.key === activeTabKey;
              const Icon = tab.Icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTab(tab.key)}
                  className={`${ws.segBtn} ${
                    isActive ? ws.segActive : ws.segInactive
                  } flex items-center gap-2 whitespace-nowrap`}
                  title={tab.description}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeTabKey === "vendors" ? (
          <div className={`${ws.glassSoft} ${ws.card} p-2 overflow-x-auto`}>
            <div className="flex items-center gap-1 min-w-max">
              {VENDOR_SUBTABS.map((sub) => {
                const isActive = sub.key === activeVendorSub.key;
                const Icon = sub.Icon;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setTab("vendors", { sub: sub.key })}
                    className={`${ws.segBtn} ${
                      isActive ? ws.segActive : ws.segInactive
                    } flex items-center gap-2 whitespace-nowrap text-sm`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTabKey === "overview" ? (
          <PurchasesOverviewPanel
            employeeId={employeeId}
            isAdmin={isAdmin}
            onNavigate={setTab}
          />
        ) : activeTabKey === "invoices" ? (
          <PurchasesInvoicesPanel
            employeeId={employeeId}
            isAdmin={isAdmin}
            autoOpenAdd={intent === "add"}
            onIntentConsumed={clearIntent}
          />
        ) : activeTabKey === "vendors" && activeVendorSub.key === "contacts" ? (
          <ContactsPanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : activeTabKey === "vendors" ? (
          <BeneficiariesPanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : activeTabKey === "accounts" ? (
          <PurchasesAccountsTreePanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : activeTabKey === "banks" ? (
          <PurchasesBankAccountsPanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : (
          <PurchasesReportsPanel employeeId={employeeId} isAdmin={isAdmin} />
        )}
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="purchases" />
      <PurchasesMobileHeader activeTab={activeTab} />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <PurchasesDesktopHeader activeTab={activeTab} />
          {body}
        </div>
      </main>
    </div>
  );
}
