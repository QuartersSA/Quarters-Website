"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Plus,
  ReceiptText,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import PurchaseInvoiceModal from "@/components/Accounting/PurchaseInvoiceModal";
import {
  PURCHASE_INVOICE_TOKEN_KEY,
  purchaseInvoiceFetch,
} from "@/utils/apiAuth";

// Field entry for رفع فاتورة مشتريات: the SAME editor admins use in
// المحاسبة → المشتريات (attachment + smart scan + line items + شجرة
// الحسابات), and nothing else — no ledger, no reports.
export default function PurchaseInvoiceEntryPage() {
  const [session, setSession] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorKey, setEditorKey] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // invoice_number | true

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
        const [contactsRes, accountsRes] = await Promise.all([
          purchaseInvoiceFetch("/api/accounting/contacts"),
          purchaseInvoiceFetch("/api/accounting/accounts"),
        ]);
        if (contactsRes.status === 401 || contactsRes.status === 403) {
          logout();
          return;
        }
        const contactsData = await contactsRes.json().catch(() => ({}));
        const accountsData = await accountsRes.json().catch(() => ({}));
        if (cancelled) return;
        setContacts(
          Array.isArray(contactsData?.contacts) ? contactsData.contacts : [],
        );
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
  }, [goToLogin, logout]);

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

  return (
    <div
      className={`dark min-h-[100svh] flex items-center justify-center px-4 ${ws.appBg}`}
      dir="rtl"
    >
      <div className="w-full max-w-md text-center">
        <img
          src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
          alt="Quarters Coffee Bar"
          className="h-20 w-auto mx-auto mb-6"
        />

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
                  {typeof lastSaved === "string" ? ` رقم ${lastSaved}` : ""}{" "}
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
    </div>
  );
}
