"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Truck,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import PurchaseInvoiceModal from "@/components/Accounting/PurchaseInvoiceModal";
import ContactModal from "@/components/Accounting/ContactModal";
import {
  PURCHASE_INVOICE_TOKEN_KEY,
  purchaseInvoiceFetch,
} from "@/utils/apiAuth";

// Field entry for رفع فاتورة مشتريات: a landing screen first (the
// editor opens only when the user asks for a new invoice), plus —
// for employees holding can_manage_suppliers — a supplier manager
// (add/edit contacts) reusing the SAME modal the accounting section
// uses, minus the admin-only beneficiaries panel.
export default function PurchaseInvoiceEntryPage() {
  const [session, setSession] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  // Landing first — the invoice editor opens on demand only.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // invoice_number | true

  // Supplier manager (إضافة / تعديل مورد)
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [savingContact, setSavingContact] = useState(false);
  const [supplierNotice, setSupplierNotice] = useState(null);

  const goToLogin = useCallback(() => {
    window.location.href = "/employee/purchase-invoice/login";
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem("purchaseInvoiceSession");
      localStorage.removeItem(PURCHASE_INVOICE_TOKEN_KEY);
    } catch {
      // ignore
    }
    goToLogin();
  }, [goToLogin]);

  const loadContacts = useCallback(async () => {
    const response = await purchaseInvoiceFetch("/api/accounting/contacts");
    if (response.status === 401 || response.status === 403) {
      logout();
      return null;
    }
    const data = await response.json().catch(() => ({}));
    const list = Array.isArray(data?.contacts) ? data.contacts : [];
    setContacts(list);
    return list;
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem(PURCHASE_INVOICE_TOKEN_KEY);
    if (!token) {
      goToLogin();
      return undefined;
    }
    try {
      setSession(JSON.parse(localStorage.getItem("purchaseInvoiceSession")));
    } catch {
      // ignore
    }

    const load = async () => {
      try {
        const [contactsList, accountsRes] = await Promise.all([
          loadContacts(),
          purchaseInvoiceFetch("/api/accounting/accounts"),
        ]);
        if (cancelled || contactsList === null) return;
        const accountsData = await accountsRes.json().catch(() => ({}));
        if (cancelled) return;
        setAccounts(
          Array.isArray(accountsData?.accounts) ? accountsData.accounts : [],
        );
        setLoading(false);
      } catch (error) {
        console.error("purchase invoice entry load failed", error);
        if (!cancelled) {
          setLoadError("فشل تحميل البيانات — تأكد من الاتصال ثم حدّث الصفحة.");
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [goToLogin, loadContacts]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      const response = await purchaseInvoiceFetch(
        "/api/accounting/purchase-invoices",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data?.error || "فشل حفظ الفاتورة");
        return;
      }
      setLastSaved(data?.invoice?.invoice_number || true);
      setEditorOpen(false);
      // A fresh key remounts the editor completely empty next time.
      setEditorKey((key) => key + 1);
    } catch (error) {
      console.error("purchase invoice submit failed", error);
      alert("فشل حفظ الفاتورة — تأكد من الاتصال ثم حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContactSubmit = async (payload) => {
    setSavingContact(true);
    try {
      const isEditing = !!payload.id;
      const response = await purchaseInvoiceFetch(
        isEditing
          ? `/api/accounting/contacts/${payload.id}`
          : "/api/accounting/contacts",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (response.status === 401 || response.status === 403) {
        logout();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data?.error || "فشل حفظ المورد");
        return;
      }
      await loadContacts();
      setContactModalOpen(false);
      setEditingContact(null);
      setSupplierNotice(
        isEditing ? "تم تحديث المورد بنجاح" : "تمت إضافة المورد بنجاح",
      );
    } catch (error) {
      console.error("supplier save failed", error);
      alert("فشل حفظ المورد — تأكد من الاتصال ثم حاول مرة أخرى.");
    } finally {
      setSavingContact(false);
    }
  };

  const canManageSuppliers = !!session?.canManageSuppliers;

  const filteredContacts = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    const list = contacts.filter((contact) => contact.is_active !== false);
    if (!q) return list;
    return list.filter(
      (contact) =>
        String(contact.name || "").toLowerCase().includes(q) ||
        String(contact.vat_number || "").includes(q),
    );
  }, [contacts, supplierSearch]);

  return (
    <div
      className={`dark min-h-[100svh] flex items-center justify-center px-4 py-8 ${ws.appBg}`}
      dir="rtl"
    >
      <div className="w-full max-w-md text-center">
        <img
          src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
          alt="Quarters Coffee Bar"
          className="h-20 w-auto mx-auto mb-6"
        />

        {!suppliersOpen ? (
          <div className={`${ws.glass} ${ws.card} p-8 space-y-5`}>
            <div className={`${ws.iconBox} w-16 h-16 mx-auto text-emerald-200`}>
              <ReceiptText className="w-8 h-8" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${ws.title}`}>
                رفع فاتورة مشتريات
              </h1>
              {session?.username ? (
                <p className={`${ws.muted} mt-1`}>مرحباً {session.username}</p>
              ) : null}
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 text-white/60 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تحميل البيانات…
              </div>
            ) : loadError ? (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-3 text-red-200 text-sm">
                {loadError}
              </div>
            ) : (
              <>
                {lastSaved ? (
                  <div className="bg-emerald-500/10 border border-emerald-400/25 rounded-2xl p-3 text-emerald-200 text-sm flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    تم حفظ الفاتورة
                    {typeof lastSaved === "string"
                      ? ` رقم ${lastSaved}`
                      : ""}{" "}
                    بنجاح
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className={`${ws.btnPrimary} w-full justify-center py-3`}
                >
                  <Plus className="w-4 h-4" />
                  فاتورة مشتريات جديدة
                </button>
                {canManageSuppliers ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierNotice(null);
                      setSupplierSearch("");
                      setSuppliersOpen(true);
                    }}
                    className={`${ws.btnNeutral} w-full justify-center py-3`}
                  >
                    <Truck className="w-4 h-4" />
                    إضافة / تعديل مورد
                  </button>
                ) : null}
              </>
            )}

            <button
              type="button"
              onClick={logout}
              className={`${ws.btnNeutral} w-full justify-center py-2.5`}
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </button>
          </div>
        ) : (
          <div className={`${ws.glass} ${ws.card} p-6 space-y-4 text-right`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`${ws.iconBox} w-10 h-10 text-emerald-200`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white">الموردون</div>
                  <div className="text-[11px] text-white/50">
                    أضف مورداً جديداً أو عدّل بيانات مورد قائم
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuppliersOpen(false)}
                className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                رجوع
              </button>
            </div>

            {supplierNotice ? (
              <div className="bg-emerald-500/10 border border-emerald-400/25 rounded-2xl p-2.5 text-emerald-200 text-xs flex items-center justify-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                {supplierNotice}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setContactModalOpen(true);
              }}
              className={`${ws.btnPrimary} w-full justify-center py-2.5`}
            >
              <Plus className="w-4 h-4" />
              مورد جديد
            </button>

            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
              <input
                type="search"
                value={supplierSearch}
                onChange={(event) => setSupplierSearch(event.target.value)}
                placeholder="ابحث بالاسم أو الرقم الضريبي…"
                className={`${ws.input} w-full pr-9 pl-3 py-2 text-sm`}
              />
            </div>

            <div className="max-h-[45svh] overflow-y-auto space-y-2">
              {filteredContacts.length === 0 ? (
                <div className="text-xs text-white/45 py-6 text-center">
                  {contacts.length === 0
                    ? "لا يوجد موردون بعد — أضف أول مورد."
                    : "لا نتائج مطابقة للبحث."}
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`${ws.glassSoft} ${ws.card} px-3 py-2 flex items-center justify-between gap-2`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {contact.name}
                      </div>
                      {contact.vat_number ? (
                        <div
                          className="text-[11px] text-white/45 font-mono truncate"
                          dir="ltr"
                        >
                          {contact.vat_number}
                        </div>
                      ) : (
                        <div className="text-[11px] text-white/35">
                          بدون رقم ضريبي
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContact(contact);
                        setContactModalOpen(true);
                      }}
                      className={`${ws.iconButton} w-8 h-8 shrink-0`}
                      title="تعديل المورد"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {!loading && !loadError ? (
        <PurchaseInvoiceModal
          key={editorKey}
          open={editorOpen}
          invoice={null}
          contacts={contacts}
          accounts={accounts}
          isSubmitting={submitting}
          onClose={() => setEditorOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}

      <ContactModal
        open={contactModalOpen}
        contact={editingContact}
        accounts={accounts}
        isSubmitting={savingContact}
        showBeneficiaries={false}
        onClose={() => {
          setContactModalOpen(false);
          setEditingContact(null);
        }}
        onSubmit={handleContactSubmit}
      />
    </div>
  );
}
