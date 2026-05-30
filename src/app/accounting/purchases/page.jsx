"use client";

import React, { useState } from "react";
import {
  ShoppingCart,
  FileText,
  Users,
  Layers,
  Building,
  Percent,
  Construction,
  Contact,
  HandCoins,
  Plus,
  Search,
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
import PurchasesItemsPanel from "@/components/Accounting/PurchasesItemsPanel";
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

/**
 * Purchases section — scaffold.
 *
 * Five top-level tabs, each a placeholder right now. Content lands
 * in follow-up commits as we flesh out each area:
 *
 *   - فواتير المشتريات     — purchase invoices ledger
 *   - الموردين والمستفيدين  — two-pane (suppliers + beneficiaries)
 *   - فئات وأصناف          — purchase-side categories + items
 *   - الحسابات البنكية      — bank accounts master list
 *   - الضريبة              — VAT settings + reports
 */

const VENDOR_SUBTABS = [
  {
    key: "contacts",
    label: "جهات الاتصال",
    Icon: Contact,
    description:
      "قائمة جهات الاتصال التجارية — موردين، مكاتب، شركاء، إلخ.",
  },
  {
    key: "beneficiaries",
    label: "المستفيدون",
    Icon: HandCoins,
    description:
      "قائمة المستفيدين الذين تُحوَّل لهم المدفوعات من حسابات البنك.",
  },
];

const CATALOG_SUBTABS = [
  {
    key: "categories",
    label: "التصنيفات",
    Icon: Layers,
    description: "تصنيفات المشتريات المرتبطة بالأصناف.",
  },
  {
    key: "items",
    label: "أصناف",
    Icon: ShoppingCart,
    description: "كامل أصناف المخزون بصيغة موحّدة لقسم المشتريات.",
  },
];

const TABS = [
  {
    key: "invoices",
    label: "فواتير المشتريات",
    Icon: FileText,
    description: "إدخال ومتابعة فواتير المشتريات لكل مورد.",
  },
  {
    key: "vendors",
    label: "الموردين والمستفيدين",
    Icon: Users,
    description: "إدارة جهات الاتصال والمستفيدين في قائمتين منفصلتين.",
    subTabs: VENDOR_SUBTABS,
  },
  {
    key: "catalog",
    label: "التصنيفات والأصناف",
    Icon: Layers,
    description: "تصنيفات وأصناف المشتريات المرتبطة بالفواتير.",
    subTabs: CATALOG_SUBTABS,
  },
  {
    key: "banks",
    label: "الحسابات البنكية",
    Icon: Building,
    description: "حسابات البنك المستخدمة في عمليات الدفع.",
  },
  {
    key: "tax",
    label: "الضريبة",
    Icon: Percent,
    description: "إعدادات ضريبة القيمة المضافة + تقارير الضريبة.",
  },
];

function PurchasesMobileHeader() {
  return (
    <div
      className={`lg:hidden sticky top-0 z-30 ${ws.topBar} px-4 py-3 flex items-center gap-3`}
    >
      <div className="w-9 h-9 rounded-2xl bg-slate-200 dark:bg-white/10 border border-slate-200 dark:border-white/10 flex items-center justify-center">
        <ShoppingCart className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />
      </div>
      <div>
        <div className="font-bold text-slate-900 dark:text-white tracking-tight">
          المشتريات
        </div>
        <div className="text-xs text-slate-500 dark:text-white/50">
          فواتير، موردين، أصناف، بنوك، وضريبة
        </div>
      </div>
    </div>
  );
}

function PurchasesDesktopHeader() {
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
          فواتير المشتريات، الموردين والمستفيدين، فئات وأصناف،
          الحسابات البنكية، والضريبة.
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
      {/* Toolbar */}
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

function ComingSoonCard({ tab }) {
  const Icon = tab?.Icon || Construction;
  return (
    <div className={`${ws.glass} ${ws.card} p-10 text-center`}>
      <div
        className={`${ws.iconBox} w-14 h-14 mx-auto mb-4 text-emerald-700 dark:text-emerald-200`}
      >
        <Icon className="w-7 h-7" />
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight mb-1">
        {tab?.label}
      </div>
      <div className="text-sm text-slate-600 dark:text-white/60 max-w-md mx-auto leading-relaxed">
        {tab?.description}
      </div>
      <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-200 text-xs font-semibold">
        <Construction className="w-3.5 h-3.5" />
        قيد التطوير
      </div>
    </div>
  );
}

export default function PurchasesPage() {
  const { ready, employeeId, user } = useWorkspaceUser();
  const isAdmin = user?.role === "Admin";

  const [activeTab, setActiveTab] = useState(TABS[0].key);
  // Per top-level tab, remember which sub-tab the operator last
  // picked. Keyed by parent tab.key so switching away and back
  // returns to the same inner view.
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const init = {};
    for (const t of TABS) {
      if (Array.isArray(t.subTabs) && t.subTabs.length > 0) {
        init[t.key] = t.subTabs[0].key;
      }
    }
    return init;
  });

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
    const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
    const subTabs = Array.isArray(tab.subTabs) ? tab.subTabs : null;
    const subKey = subTabs ? activeSubTab[tab.key] : null;
    const activeSub = subTabs
      ? subTabs.find((s) => s.key === subKey) || subTabs[0]
      : null;

    body = (
      <>
        {/* Tabs row — horizontally scrollable on mobile so the
            5-tab set never gets squeezed. */}
        <div className={`${ws.glass} ${ws.card} p-2 overflow-x-auto`}>
          <div className="flex items-center gap-1 min-w-max">
            {TABS.map((t) => {
              const isActive = t.key === activeTab;
              const Icon = t.Icon;
              const cls = `${ws.segBtn} ${
                isActive ? ws.segActive : ws.segInactive
              } flex items-center gap-2 whitespace-nowrap`;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={cls}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-tabs row — only renders when the active top tab has
            nested sections (e.g. الموردين والمستفيدين). Same segWrap
            styling but smaller, scoped to this tab's children. */}
        {subTabs ? (
          <div className={`${ws.glassSoft} ${ws.card} p-2 overflow-x-auto`}>
            <div className="flex items-center gap-1 min-w-max">
              {subTabs.map((s) => {
                const isActive = s.key === activeSub.key;
                const Icon = s.Icon;
                const cls = `${ws.segBtn} ${
                  isActive ? ws.segActive : ws.segInactive
                } flex items-center gap-2 whitespace-nowrap text-sm`;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() =>
                      setActiveSubTab((prev) => ({
                        ...prev,
                        [tab.key]: s.key,
                      }))
                    }
                    className={cls}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeTab === "vendors" && activeSub?.key === "contacts" ? (
          <ContactsPanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : activeTab === "vendors" &&
          activeSub?.key === "beneficiaries" ? (
          <BeneficiariesPanel employeeId={employeeId} isAdmin={isAdmin} />
        ) : activeTab === "catalog" && activeSub?.key === "items" ? (
          <PurchasesItemsPanel />
        ) : (
          <ComingSoonCard tab={activeSub || tab} />
        )}
      </>
    );
  }

  return (
    <div className="min-h-[100svh] pb-24 lg:pb-0" dir="rtl">
      <AccountingSidebar active="purchases" />
      <PurchasesMobileHeader />
      <main className="mr-0 lg:mr-72 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto w-full space-y-5">
          <PurchasesDesktopHeader />
          {body}
        </div>
      </main>
    </div>
  );
}
