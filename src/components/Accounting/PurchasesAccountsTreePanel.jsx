"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  FileText,
  Landmark,
  ListTree,
  Lock,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import {
  useAccountingAccounts,
  useCreateAccountingAccount,
  useDeleteAccountingAccount,
  useUpdateAccountingAccount,
} from "@/hooks/useAccountingAccounts";

const TYPE_META = {
  asset: {
    label: "أصول",
    pill: "bg-sky-100 dark:bg-sky-400/10 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-400/25",
  },
  liability: {
    label: "التزامات",
    pill: "bg-rose-100 dark:bg-rose-400/10 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-400/25",
  },
  equity: {
    label: "حقوق ملكية",
    pill: "bg-violet-100 dark:bg-violet-400/10 text-violet-700 dark:text-violet-200 border-violet-200 dark:border-violet-400/25",
  },
  revenue: {
    label: "إيرادات",
    pill: "bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25",
  },
  expense: {
    label: "مصروفات",
    pill: "bg-amber-100 dark:bg-amber-400/10 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-400/25",
  },
};

function typeMeta(type) {
  return TYPE_META[type] || TYPE_META.expense;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// Suggest the next child code from the loaded sibling list (mirrors
// the server's nextChildCode — server stays the source of truth).
function suggestChildCode(accounts, parent) {
  if (!parent) return "";
  const prefix = String(parent.code);
  let maxSeq = 0;
  for (const account of accounts) {
    if (account.parent_id !== parent.id) continue;
    const code = String(account.code || "");
    if (!code.startsWith(prefix)) continue;
    const suffix = Number(code.slice(prefix.length));
    if (Number.isInteger(suffix) && suffix > maxSeq) maxSeq = suffix;
  }
  return `${prefix}${String(maxSeq + 1).padStart(2, "0")}`;
}

function AccountModal({
  open,
  account,
  parentAccount,
  accounts,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!account;
  const [parentId, setParentId] = useState("");
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [code, setCode] = useState("");
  const [isPostable, setIsPostable] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setParentId(
      account?.parent_id
        ? String(account.parent_id)
        : parentAccount
          ? String(parentAccount.id)
          : "",
    );
    setName(account?.name || "");
    setNameEn(account?.name_en || "");
    setCode(account?.code || "");
    setIsPostable(account ? account.is_postable !== false : true);
    setNotes(account?.notes || "");
  }, [open, account, parentAccount]);

  const parentOptions = useMemo(() => {
    const active = accounts.filter((a) => a.is_active !== false);
    const sorted = [...active].sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "en", { numeric: true }),
    );
    return sorted.map((a) => ({
      value: String(a.id),
      label: `${a.code} — ${a.name}`,
    }));
  }, [accounts]);

  const selectedParent = useMemo(
    () => accounts.find((a) => String(a.id) === parentId) || null,
    [accounts, parentId],
  );

  const suggested = useMemo(
    () => (isEditing ? "" : suggestChildCode(accounts, selectedParent)),
    [accounts, selectedParent, isEditing],
  );

  const canSubmit = !isSubmitting && !!name.trim() && (isEditing || !!parentId);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      name_en: nameEn.trim() || null,
      code: code.trim() || undefined,
      is_postable: isPostable,
      notes: notes.trim() || null,
    };
    if (isEditing) {
      payload.id = account.id;
    } else {
      payload.parent_id = Number(parentId);
    }
    onSubmit(payload);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${ws.glass} ${ws.card} w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92svh] overflow-y-auto`}
      >
        <div
          className={`px-5 py-4 border-b ${ws.divider} flex items-center justify-between gap-3`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}
            >
              <ListTree className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white tracking-tight">
                {isEditing ? "تعديل حساب" : "إضافة حساب للشجرة"}
              </div>
              <div className="text-xs text-slate-500 dark:text-white/50 mt-0.5">
                {isEditing
                  ? `الحساب ${account.code}`
                  : "يرث الحساب نوعه من الحساب الأب تلقائياً."}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${ws.iconButton} w-9 h-9`}
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!isEditing ? (
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                الحساب الأب <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <GlassSelect
                value={parentId}
                onChange={setParentId}
                options={parentOptions}
                placeholder="اختر الحساب الأب"
                buttonClassName="text-sm py-2.5 px-3"
              />
              {selectedParent ? (
                <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                  النوع: {typeMeta(selectedParent.account_type).label}
                </div>
              ) : null}
            </div>
          ) : (
            <div className={`${ws.glassSoft} ${ws.card} px-3 py-2 text-xs text-slate-600 dark:text-white/55`}>
              نوع الحساب: {typeMeta(account.account_type).label} — لا يمكن نقل
              الحساب لفرع آخر.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                اسم الحساب بالعربي <span className="text-rose-700 dark:text-rose-300">*</span>
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="مثال: مشتريات مواد تغليف"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
                اسم الحساب بالإنجليزي
              </div>
              <input
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="Packaging Purchases"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              رقم الحساب
            </div>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className={`${ws.input} px-3 py-2.5 font-mono`}
              placeholder={suggested ? `تلقائي: ${suggested}` : "أرقام فقط"}
              dir="ltr"
            />
            <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
              اتركه فارغاً لتوليد الرقم التالي تحت الحساب الأب تلقائياً.
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75">
            <input
              type="checkbox"
              checked={isPostable}
              onChange={(event) => setIsPostable(event.target.checked)}
              className="accent-emerald-500 mt-0.5"
            />
            <span>
              حساب قابل للترحيل
              <span className="block text-xs text-slate-500 dark:text-white/45 mt-0.5">
                تُصنَّف عليه الفواتير والعمليات. ألغِ التفعيل ليكون حساباً
                تجميعياً ينظّم الشجرة فقط.
              </span>
            </span>
          </label>

          <div>
            <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
              ملاحظات
            </div>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className={`${ws.input} px-3 py-2.5 min-h-[70px] resize-none`}
              placeholder="اختياري"
            />
          </div>

          <div className={`flex items-center gap-2 pt-3 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${ws.btnPrimary} px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default function PurchasesAccountsTreePanel({ employeeId, isAdmin }) {
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [expandedSeeded, setExpandedSeeded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addParent, setAddParent] = useState(null);
  const [editing, setEditing] = useState(null);

  const accountsQuery = useAccountingAccounts({
    employeeId,
    isAdmin,
    includeInactive,
  });
  const accounts = useMemo(
    () => (Array.isArray(accountsQuery.data) ? accountsQuery.data : []),
    [accountsQuery.data],
  );

  const createMut = useCreateAccountingAccount();
  const updateMut = useUpdateAccountingAccount();
  const deleteMut = useDeleteAccountingAccount();

  const childrenByParent = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const key = account.parent_id == null ? "root" : String(account.parent_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(account);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        String(a.code).localeCompare(String(b.code), "en", { numeric: true }),
      );
    }
    return map;
  }, [accounts]);

  // First load: expand the roots + their direct children so the tree
  // reads as a tree instead of five collapsed rows.
  useEffect(() => {
    if (expandedSeeded || accounts.length === 0) return;
    const initial = new Set();
    for (const account of accounts) {
      if (account.parent_id == null) initial.add(account.id);
    }
    setExpanded(initial);
    setExpandedSeeded(true);
  }, [accounts, expandedSeeded]);

  // Search: keep nodes whose code/name matches + all their ancestors,
  // force-expanded so matches are always visible.
  const searchState = useMemo(() => {
    const term = normalize(q);
    if (!term) return null;
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const visible = new Set();
    for (const account of accounts) {
      const hay = [account.code, account.name, account.name_en]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(term)) continue;
      let cursor = account;
      while (cursor) {
        if (visible.has(cursor.id)) break;
        visible.add(cursor.id);
        cursor = cursor.parent_id ? byId.get(cursor.parent_id) : null;
      }
    }
    return { visible };
  }, [accounts, q]);

  const typeCounts = useMemo(() => {
    const counts = {};
    for (const account of accounts) {
      if (account.is_active === false) continue;
      counts[account.account_type] = (counts[account.account_type] || 0) + 1;
    }
    return counts;
  }, [accounts]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (payload) => {
    if (editing) {
      updateMut.mutate(payload, { onSuccess: () => setEditing(null) });
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          setShowAdd(false);
          setAddParent(null);
        },
      });
    }
  };

  const handleDelete = (account) => {
    const ok = window.confirm(
      `إيقاف الحساب "${account.code} — ${account.name}"؟`,
    );
    if (!ok) return;
    deleteMut.mutate({ id: account.id });
  };

  const renderNode = (account, depth) => {
    if (searchState && !searchState.visible.has(account.id)) return null;
    const children = childrenByParent.get(String(account.id)) || [];
    const hasChildren = children.length > 0;
    const isOpen = searchState ? true : expanded.has(account.id);
    const meta = typeMeta(account.account_type);
    const inactive = account.is_active === false;

    return (
      <React.Fragment key={account.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2.5 border-t border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors ${inactive ? "opacity-50" : ""}`}
          style={{ paddingRight: `${12 + depth * 22}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(account.id)}
              className={`${ws.iconButton} w-7 h-7 shrink-0`}
              aria-label={isOpen ? "طي" : "توسيع"}
            >
              {isOpen ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-7 h-7 shrink-0" />
          )}

          <span
            className="font-mono text-xs text-slate-500 dark:text-white/50 shrink-0 min-w-[3.5rem]"
            dir="ltr"
          >
            {account.code}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`truncate ${
                  account.is_postable === false
                    ? "font-bold text-slate-900 dark:text-white"
                    : "font-medium text-slate-800 dark:text-white/85"
                } text-sm`}
              >
                {account.name}
              </span>
              {account.name_en ? (
                <span
                  className="hidden md:inline text-[11px] text-slate-400 dark:text-white/35 truncate"
                  dir="ltr"
                >
                  {account.name_en}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {depth === 0 ? (
              <span className={`${ws.pill} ${meta.pill} hidden sm:inline-flex`}>
                {meta.label}
              </span>
            ) : null}
            {account.is_postable === false ? (
              <span
                className={`${ws.pill} bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-white/55 border-slate-200 dark:border-white/10 hidden sm:inline-flex`}
              >
                تجميعي
              </span>
            ) : null}
            {account.is_system ? (
              <span
                className={`${ws.pill} bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/45 border-slate-200 dark:border-white/10 inline-flex items-center gap-1`}
                title="حساب نظام أساسي"
              >
                <Lock className="w-3 h-3" />
                <span className="hidden sm:inline">نظام</span>
              </span>
            ) : null}
            {account.invoice_count > 0 ? (
              <span
                className={`${ws.pill} bg-sky-100 dark:bg-sky-400/10 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-400/25 inline-flex items-center gap-1`}
                title="فواتير مشتريات مصنّفة على الحساب"
              >
                <FileText className="w-3 h-3" />
                {account.invoice_count}
              </span>
            ) : null}
            {account.source_bank_account_id ? (
              <span
                className={`${ws.pill} bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25 inline-flex items-center gap-1`}
                title="مرتبط بحساب بنكي"
              >
                <Landmark className="w-3 h-3" />
                <span className="hidden sm:inline">بنك</span>
              </span>
            ) : null}
            {inactive ? (
              <span
                className={`${ws.pill} bg-rose-100 dark:bg-rose-400/10 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-400/25`}
              >
                موقوف
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!inactive ? (
              <button
                type="button"
                onClick={() => {
                  setAddParent(account);
                  setShowAdd(true);
                }}
                className={`${ws.iconButton} w-8 h-8`}
                title="إضافة حساب فرعي"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            ) : null}
            {!account.is_system && !inactive ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(account)}
                  className={`${ws.iconButton} w-8 h-8`}
                  title="تعديل"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!account.source_bank_account_id ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(account)}
                    className={`${ws.iconButton} w-8 h-8 hover:bg-red-50 dark:hover:bg-red-500/15 hover:border-red-200 dark:hover:border-red-500/30 hover:text-red-700 dark:hover:text-red-200`}
                    title="إيقاف الحساب"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {hasChildren && isOpen
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </React.Fragment>
    );
  };

  const roots = childrenByParent.get("root") || [];

  if (accountsQuery.isLoading) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-slate-600 dark:text-white/60 text-sm`}>
        جاري تحميل شجرة الحسابات…
      </div>
    );
  }
  if (accountsQuery.error) {
    return (
      <div className={`${ws.glass} ${ws.card} p-6 text-red-700 dark:text-red-300 text-sm`}>
        فشل تحميل شجرة الحسابات. حاول مرة أخرى.
      </div>
    );
  }

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
              placeholder="ابحث برقم الحساب أو الاسم"
              className={`${ws.input} px-3 py-2 pr-9`}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-700 dark:text-white/75 shrink-0">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
              className="accent-emerald-500"
            />
            عرض الموقوفة
          </label>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => {
              setAddParent(null);
              setShowAdd(true);
            }}
            className={`${ws.btnPrimary} px-4 py-2`}
          >
            <Plus className="w-4 h-4" />
            إضافة حساب
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <div key={type} className={`${ws.glass} ${ws.card} p-3`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`${ws.pill} ${meta.pill}`}>{meta.label}</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {typeCounts[type] || 0}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className={`${ws.glass} ${ws.card} overflow-hidden`}>
        <div
          className={`px-4 py-3 border-b ${ws.divider} flex items-center justify-between gap-3`}
        >
          <div>
            <div className="text-slate-900 dark:text-white font-bold">
              شجرة الحسابات
            </div>
            <div className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              فواتير المشتريات تُصنَّف على حسابات المصروفات، والحسابات
              البنكية تُربط تلقائياً تحت «1102 البنوك».
            </div>
          </div>
          <div className={`${ws.iconBox} w-10 h-10 text-emerald-700 dark:text-emerald-200`}>
            <ListTree className="w-5 h-5" />
          </div>
        </div>

        {roots.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-600 dark:text-white/60">
            لا توجد حسابات — أعد تحميل الصفحة لبذر الشجرة الأساسية.
          </div>
        ) : searchState && searchState.visible.size === 0 ? (
          <div className="p-10 text-center">
            <div className={`${ws.iconBox} w-14 h-14 mx-auto mb-3`}>
              <Search className="w-6 h-6 text-slate-500 dark:text-white/50" />
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-white/75">
              لا توجد حسابات تطابق البحث
            </div>
          </div>
        ) : (
          <div>{roots.map((root) => renderNode(root, 0))}</div>
        )}
      </div>

      <AccountModal
        open={showAdd || !!editing}
        account={editing}
        parentAccount={addParent}
        accounts={accounts}
        isSubmitting={createMut.isPending || updateMut.isPending}
        onClose={() => {
          setShowAdd(false);
          setAddParent(null);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
