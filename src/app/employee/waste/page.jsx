"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Trash2,
  CheckCircle,
  LogOut,
  Edit2,
  AlertCircle,
  Search,
  Zap,
  Save,
  TrendingUp,
  Filter,
  ArrowLeft,
  Layers,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import {
  EMPLOYEE_WASTE_TOKEN_KEY,
  getEmployeeWasteToken,
  employeeWasteFetch,
} from "@/utils/apiAuth";
import { formatDateForInput } from "@/utils/dateUtils";

// Build a deterministic localStorage key for the auto-saved draft.
// MUST use ISO YYYY-MM-DD (not toLocaleDateString) — browser locale otherwise
// produces Hijri strings on Arabic systems, which:
//   - changes the key day-to-day inconsistently
//   - collides with admin-side date handling (Gregorian-only policy)
function wasteDraftKey(employeeId) {
  return `waste_${employeeId}_${formatDateForInput(new Date())}`;
}

const WASTE_LOGIN_PATH = "/employee/waste/login";

export default function WastePage() {
  const [employee, setEmployee] = useState(null);
  const [language, setLanguage] = useState("ar");
  // itemId -> stored quantity (the typed number, as-is)
  const [availableItems, setAvailableItems] = useState({});
  // itemId -> chosen waste reason (stable key) + note (free text)
  const [reasonByItem, setReasonByItem] = useState({});
  const [noteByItem, setNoteByItem] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState("");
  // active-item draft reason + note (committed on "تم")
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reasonError, setReasonError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoSaved, setAutoSaved] = useState(false);
  const [showRemainingOnly, setShowRemainingOnly] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  useEffect(() => {
    const employeeData = localStorage.getItem("employeeWasteSession");
    const token = getEmployeeWasteToken();

    if (!employeeData || !token) {
      window.location.href = WASTE_LOGIN_PATH;
      return;
    }

    let emp;
    try {
      emp = JSON.parse(employeeData);
    } catch {
      window.location.href = WASTE_LOGIN_PATH;
      return;
    }
    setEmployee(emp);

    // Load auto-saved draft — but prompt first instead of silently
    // hydrating. Two employees sharing the same device/account were
    // getting each other's half-typed counts merged in with no signal.
    // We parse first so we know if the saved blob actually has entries
    // (an empty `{}` from a previous successful submit shouldn't ask).
    const savedRaw = localStorage.getItem(wasteDraftKey(emp.id));
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        const entryCount =
          parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0;
        if (entryCount === 0) {
          localStorage.removeItem(wasteDraftKey(emp.id));
        } else {
          const ok = window.confirm(
            `وجدنا مسودة هدر محفوظة (${entryCount} صنف). هل تريد استكمالها؟\nاضغط "إلغاء" لبدء تسجيل هدر جديد فارغ.`,
          );
          if (ok) {
            setAvailableItems(parsed);
            setAutoSaved(true);
            setTimeout(() => setAutoSaved(false), 3000);
          } else {
            localStorage.removeItem(wasteDraftKey(emp.id));
          }
        }
      } catch {
        // Corrupt draft — drop it so we don't trip on it next time.
        localStorage.removeItem(wasteDraftKey(emp.id));
      }
    }

    // Get language from localStorage
    const savedLanguage = localStorage.getItem("employeeLanguage") || "ar";
    setLanguage(savedLanguage);
  }, []);

  // Auto-save to localStorage
  useEffect(() => {
    if (employee && Object.keys(availableItems).length > 0) {
      localStorage.setItem(
        wasteDraftKey(employee.id),
        JSON.stringify(availableItems),
      );
    }
  }, [availableItems, employee]);

  // Scroll selected item into view (helps on mobile)
  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const card = document.getElementById(`waste-item-${selectedItem}`);
    if (!card) {
      return;
    }

    // small delay so DOM is fully updated
    const timeoutId = window.setTimeout(() => {
      try {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // ignore
      }
    }, 50);

    return () => window.clearTimeout(timeoutId);
  }, [selectedItem]);

  const { data: items } = useQuery({
    queryKey: ["waste-items"],
    queryFn: async () => {
      const response = await employeeWasteFetch("/api/waste/items");
      if (!response.ok) {
        throw new Error("Failed to fetch waste items");
      }
      return response.json();
    },
    enabled: !!employee,
  });

  const submitWasteMutation = useMutation({
    mutationFn: async (data) => {
      const response = await employeeWasteFetch("/api/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit waste");
      }
      return response.json();
    },
    onSuccess: () => {
      setError(null);
      setShowSuccess(true);
      // Clear auto-save
      if (employee) {
        localStorage.removeItem(wasteDraftKey(employee.id));
      }
      setTimeout(() => {
        setAvailableItems({});
        setShowSuccess(false);
      }, 3000);
    },
    onError: (error) => {
      setError(
        error.message ||
          (language === "ar"
            ? "حدث خطأ أثناء إرسال الهدر"
            : "Error submitting waste"),
      );
    },
  });

  const t = {
    ar: {
      title: "تسجيل الهدر",
      employee: "الموظف",
      logout: "خروج",
      search: "ابحث عن صنف...",
      progress: "التقدم",
      of: "من",
      items: "صنف",
      quickButtons: "أرقام سريعة",
      enterQuantity: "أدخل الكمية",
      confirm: "تأكيد",
      done: "تم",
      next: "التالي",
      showRemainingOnly: "اعرض المتبقي فقط",
      showAll: "إظهار الكل",
      submit: "إرسال الهدر",
      submitting: "جاري الإرسال...",
      edit: "تعديل",
      successTitle: "تم إرسال الهدر بنجاح ✅",
      successMessage: "شكراً لك، تم حفظ بيانات الهدر بنجاح",
      error: "خطأ",
      unit: "وحدة",
      autoSaved: "تم الحفظ التلقائي",
      completed: "مكتمل",
      pending: "متبقي",
      wasteReason: "سبب الهدر",
      reasonExpiry: "تاريخ صلاحية",
      reasonCustomerReturn: "إرجاع من العميل",
      reasonOrderError: "خطأ في الطلب",
      reasonNotSellable: "غير صالح للبيع",
      selectReason: "اختر سبب الهدر",
      invoiceLabel: "سجّل رقم الفاتورة",
      enterInvoice: "أدخل رقم الفاتورة",
    },
    en: {
      title: "Waste Logging",
      employee: "Employee",
      logout: "Logout",
      search: "Search for item...",
      progress: "Progress",
      of: "of",
      items: "items",
      quickButtons: "Quick Numbers",
      enterQuantity: "Enter quantity",
      confirm: "Confirm",
      done: "Done",
      next: "Next",
      showRemainingOnly: "Show remaining only",
      showAll: "Show all",
      submit: "Submit Waste",
      submitting: "Submitting...",
      edit: "Edit",
      successTitle: "Waste Submitted Successfully ✅",
      successMessage: "Thank you, waste data has been saved",
      error: "Error",
      unit: "unit",
      autoSaved: "Auto-saved",
      completed: "Completed",
      pending: "Pending",
      wasteReason: "Waste reason",
      reasonExpiry: "Expiry",
      reasonCustomerReturn: "Customer return",
      reasonOrderError: "Order error",
      reasonNotSellable: "Not sellable",
      selectReason: "Select a waste reason",
      invoiceLabel: "Record invoice number",
      enterInvoice: "Enter the invoice number",
    },
  };

  const text = t[language];

  // Stable reason keys -> localized labels. The key is what gets POSTed.
  const REASON_OPTIONS = [
    { key: "expiry", label: text.reasonExpiry },
    { key: "customer_return", label: text.reasonCustomerReturn },
    { key: "order_error", label: text.reasonOrderError },
    { key: "not_sellable", label: text.reasonNotSellable },
  ];
  const reasonLabel = (key) =>
    REASON_OPTIONS.find((o) => o.key === key)?.label || "";

  // ADD: normalize legacy unit label ("مفرد") to the new label ("كرتون مفرد")
  const normalizeUnitLabel = (unit) => {
    if (!unit) {
      return unit;
    }
    if (unit === "مفرد") {
      return "كرتون مفرد";
    }
    return unit;
  };

  // Translate the Arabic unit names to English when the page
  // language is "en". Falls back to the original label for any
  // unit the table doesn't cover (custom items, future units).
  const UNIT_AR_TO_EN = {
    حبة: "piece",
    كيلو: "kg",
    كرتون: "carton",
    شدة: "bundle",
    كيس: "bag",
    رول: "roll",
    "كرتون مفرد": "single carton",
  };
  const translateUnitLabel = (unit) => {
    if (!unit) return unit;
    if (language !== "en") return unit;
    return UNIT_AR_TO_EN[unit] || unit;
  };

  // The waste-items endpoint already returns only active items in the
  // eligible categories (مخبوزات/حلويات), so there's no extra per-branch
  // filtering to do here.
  const activeItems = Array.isArray(items) ? items : [];

  // No separate categories endpoint for waste: derive the chip list from
  // the distinct category_name values present in the returned items.
  const categoryOptions = useMemo(() => {
    const base = [
      {
        value: "",
        label: language === "ar" ? "كل الفئات" : "All categories",
      },
    ];

    const seen = new Map();
    for (const item of activeItems) {
      const id = item.category_id;
      if (id == null || seen.has(String(id))) continue;
      const label =
        language === "ar"
          ? item.category_name
          : item.category_name_en || item.category_name || String(id);
      seen.set(String(id), {
        value: String(id),
        label: label || String(id),
      });
    }

    return [...base, ...Array.from(seen.values())];
  }, [activeItems, language]);

  const remainingCount = useMemo(() => {
    return activeItems.filter((it) => availableItems[it.id] === undefined)
      .length;
  }, [activeItems, availableItems]);

  const filteredItems = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    let list = activeItems;

    if (selectedCategoryId) {
      const selectedId = parseInt(selectedCategoryId);
      if (!Number.isNaN(selectedId)) {
        list = list.filter((item) => item.category_id === selectedId);
      }
    }

    if (searchLower) {
      list = list.filter((item) => {
        const name = language === "ar" ? item.name : item.name_en || item.name;
        const nameMatch = String(name || "")
          .toLowerCase()
          .includes(searchLower);

        const categoryText =
          language === "ar"
            ? item.category_name
            : item.category_name_en || item.category_name;

        const categoryTextOther =
          language === "ar" ? item.category_name_en : item.category_name;

        const categoryMatch = String(categoryText || "")
          .toLowerCase()
          .includes(searchLower);

        const categoryMatchOther = String(categoryTextOther || "")
          .toLowerCase()
          .includes(searchLower);

        return nameMatch || categoryMatch || categoryMatchOther;
      });
    }

    if (showRemainingOnly) {
      list = list.filter((item) => availableItems[item.id] === undefined);
    }

    return list;
  }, [
    activeItems,
    availableItems,
    language,
    searchQuery,
    selectedCategoryId,
    showRemainingOnly,
  ]);

  const completedCount = Object.keys(availableItems).length;
  const totalCount = activeItems.length;
  const progressPercentage =
    totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;

  const submitDisabled =
    submitWasteMutation.isPending ||
    Object.keys(availableItems).length === 0;

  const submitLabel = submitWasteMutation.isPending
    ? text.submitting
    : text.submit;

  const findNextPendingItemId = (fromItemId) => {
    const list = filteredItems.length > 0 ? filteredItems : activeItems;
    if (!list.length) {
      return null;
    }

    const startIndex = Math.max(
      0,
      list.findIndex((it) => it.id === fromItemId),
    );

    // scan forward
    for (let i = startIndex + 1; i < list.length; i++) {
      const it = list[i];
      if (availableItems[it.id] === undefined) {
        return it.id;
      }
    }

    // wrap around
    for (let i = 0; i < startIndex; i++) {
      const it = list[i];
      if (availableItems[it.id] === undefined) {
        return it.id;
      }
    }

    return null;
  };

  const goToNextPending = (fromItemId) => {
    const nextId = findNextPendingItemId(fromItemId);
    setReason("");
    setNote("");
    setReasonError(null);
    if (!nextId) {
      setSelectedItem(null);
      setQuantity("");
      return;
    }
    setSelectedItem(nextId);
    setQuantity("");
  };

  const setItemValue = (itemId, displayValue, reasonKey, noteText) => {
    // The employee logs waste in the item's default unit (a plain text
    // label from item.unit). The number they type IS the stored
    // quantity — no conversion-factor multiplication.
    const n = Number(displayValue);
    const qty = Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
    setAvailableItems((prev) => ({
      ...prev,
      [itemId]: qty,
    }));
    setReasonByItem((prev) => ({
      ...prev,
      [itemId]: reasonKey || "",
    }));
    setNoteByItem((prev) => ({
      ...prev,
      [itemId]: reasonKey === "customer_return" ? noteText || "" : "",
    }));
  };

  const handleQuickSet = (itemId, value) => {
    // Quick-set confirms immediately, so it must also pass reason validation.
    if (!reason) {
      setReasonError(text.selectReason);
      return;
    }
    const trimmedNote = note.trim();
    if (reason === "customer_return" && trimmedNote === "") {
      setReasonError(text.enterInvoice);
      return;
    }
    setItemValue(itemId, value, reason, trimmedNote);
    goToNextPending(itemId);
  };

  // "تم" confirm — requires a reason; customer_return also needs the invoice.
  const handleConfirmAndNext = () => {
    if (!selectedItem || quantity === "") {
      return;
    }

    if (!reason) {
      setReasonError(text.selectReason);
      return;
    }
    const trimmedNote = note.trim();
    if (reason === "customer_return" && trimmedNote === "") {
      setReasonError(text.enterInvoice);
      return;
    }

    const currentId = selectedItem;
    setItemValue(currentId, parseFloat(quantity), reason, trimmedNote);
    goToNextPending(currentId);
  };

  const handleEditItem = (itemId) => {
    setSelectedItem(itemId);
    setQuantity(String(availableItems[itemId]));
    setReason(reasonByItem[itemId] || "");
    setNote(noteByItem[itemId] || "");
    setReasonError(null);
    const newAvailableItems = { ...availableItems };
    delete newAvailableItems[itemId];
    setAvailableItems(newAvailableItems);
  };

  const handleSubmitWaste = async () => {
    if (!employee) return;

    setError(null);

    const payloadItems = Object.entries(availableItems)
      .map(([itemId, qty]) => {
        const n = Number(qty);
        const reasonKey = reasonByItem[itemId] || "";
        return {
          itemId: Number(itemId),
          quantity: Number.isFinite(n) ? n : 0,
          reason: reasonKey,
          note: reasonKey === "customer_return" ? noteByItem[itemId] || "" : "",
        };
      })
      .filter((row) => row.quantity > 0);

    if (payloadItems.length === 0) {
      return;
    }

    submitWasteMutation.mutate({
      branchId: employee.branchId,
      items: payloadItems,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("employeeWasteSession");
    localStorage.removeItem(EMPLOYEE_WASTE_TOKEN_KEY);
    window.location.href = WASTE_LOGIN_PATH;
  };

  const toggleShowRemaining = () => {
    setShowRemainingOnly((prev) => !prev);
    setSelectedItem(null);
    setQuantity("");
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const filterChipLabel = showRemainingOnly
    ? text.showAll
    : text.showRemainingOnly;

  const categorySelectDir = language === "ar" ? "rtl" : "ltr";
  const categoryButtonPadding = language === "ar" ? "pr-12" : "pl-12";

  if (!employee) {
    return null;
  }

  if (showSuccess) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-[#0a1a18] via-[#0a1f2b] to-[#08101f] flex items-center justify-center px-4"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full mb-6 shadow-2xl">
            <CheckCircle className="w-16 h-16 text-slate-700 dark:text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {text.successTitle}
          </h1>
          <p className="text-gray-300 text-lg">{text.successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#0a1120] via-[#0e1930] to-[#121f3a] text-gray-100"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="bg-[#0b1220]/80 backdrop-blur border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo */}
              <img
                src="https://ucarecdn.com/9abc4da3-5a32-444e-8a26-4e20862dae6a/-/format/auto/"
                alt="Quarters"
                className="h-10 sm:h-12 w-auto bg-white rounded-lg p-1.5 shadow"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-6 h-6" />
                  {text.title}
                </h1>
                <p className="text-gray-300 text-sm mt-1">
                  {text.employee}: {employee.username}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors border border-white/10"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">{text.logout}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
        {/* Auto-save notification */}
        {autoSaved && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 rounded-lg flex items-center gap-2 shadow">
            <Save className="w-5 h-5" />
            <span className="font-semibold">{text.autoSaved}</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-6 bg-white/5 rounded-xl shadow-lg p-5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-teal-700 dark:text-teal-300" />
              <span className="font-bold text-white text-lg">
                {text.progress}
              </span>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {completedCount}
                <span className="text-xl text-gray-400">
                  {" "}
                  {text.of} {totalCount}
                </span>
              </div>
              <div className="text-sm text-gray-400">{text.items}</div>
            </div>
          </div>

          <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
            <div
              className="absolute top-0 h-full bg-gradient-to-r from-teal-500 via-sky-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                right: language === "ar" ? 0 : "auto",
                left: language === "ar" ? "auto" : 0,
              }}
            />
          </div>

          <div className="flex justify-between mt-2 text-sm">
            <span className="text-emerald-300 font-semibold">
              {completedCount} {text.completed}
            </span>
            <span className="text-amber-300 font-semibold">
              {totalCount - completedCount} {text.pending}
            </span>
          </div>
        </div>

        {/* Search + quick filter */}
        <div className="mb-4 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/40 ${language === "ar" ? "right-4" : "left-4"}`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={text.search}
              className={`${ws.input} ${language === "ar" ? "pr-12 pl-10" : "pl-12 pr-10"} py-4 text-lg shadow`}
            />

            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className={`absolute top-1/2 -translate-y-1/2 ${language === "ar" ? "left-3" : "right-3"} p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10`}
                title="Clear"
              >
                <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              </button>
            )}

            <div
              className={`absolute top-1/2 -translate-y-1/2 ${language === "ar" ? "left-12" : "right-12"} text-xs text-gray-400 bg-white/5 border border-white/10 rounded-md px-2 py-1`}
            >
              {filteredItems.length}
            </div>
          </div>

          <div className="min-w-[180px]">
            <div className="relative">
              <Layers
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/40 ${language === "ar" ? "right-4" : "left-4"}`}
              />

              <GlassSelect
                value={selectedCategoryId}
                onChange={(v) => {
                  setSelectedCategoryId(v);
                  setSelectedItem(null);
                  setQuantity("");
                }}
                options={categoryOptions}
                dir={categorySelectDir}
                buttonClassName={`${categoryButtonPadding} py-4 text-lg shadow`}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={toggleShowRemaining}
            className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl border transition-colors ${
              showRemainingOnly
                ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-100"
                : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
            }`}
          >
            <Filter className="w-5 h-5" />
            <span className="font-semibold">{filterChipLabel}</span>
            <span className="text-xs bg-black/30 px-2 py-1 rounded-md border border-white/10">
              {remainingCount}
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-xl flex items-start gap-3 shadow">
            <AlertCircle className="w-6 h-6 text-red-700 dark:text-red-300 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-100 mb-1">{text.error}</h3>
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="space-y-4 mb-6">
          {filteredItems.map((item) => {
            const hasValue = availableItems[item.id] !== undefined;
            const cardId = `waste-item-${item.id}`;
            const normalizedUnit = translateUnitLabel(
              normalizeUnitLabel(item.unit),
            );
            // The unit is a plain read-only label (item.unit). The
            // employee can't change it; it's shown next to the number
            // they type and on the completed badge.
            const unitText = normalizedUnit || text.unit;

            const categoryLabel =
              language === "ar"
                ? item.category_name
                : item.category_name_en || item.category_name;

            const cardClassName =
              selectedItem === item.id
                ? "border-teal-400/50 bg-white/10 shadow-xl"
                : hasValue
                  ? "border-emerald-400/50 bg-emerald-500/10"
                  : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 cursor-pointer";

            const onCardClick = () => {
              if (hasValue) {
                handleEditItem(item.id);
                return;
              }
              setSelectedItem(item.id);
            };

            const completedUnitLabel = unitText;
            const completedDisplayQty = availableItems[item.id];
            const completedReasonLabel = reasonLabel(reasonByItem[item.id]);

            return (
              <div
                key={item.id}
                id={cardId}
                className={`rounded-xl p-5 transition-colors duration-200 border ${cardClassName}`}
                onClick={onCardClick}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-white text-xl">
                        {language === "ar"
                          ? item.name
                          : item.name_en || item.name}
                      </h3>

                      {categoryLabel ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-sky-200 border border-white/10 rounded-full text-sm font-bold">
                          <Layers className="w-4 h-4" />
                          <span>{categoryLabel}</span>
                        </span>
                      ) : null}

                      {normalizedUnit ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 text-teal-200 border border-white/10 rounded-full text-sm font-bold">
                          <span>{normalizedUnit}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {hasValue && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-[#0b1220] border border-white/10 rounded-lg px-4 py-2">
                        <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
                        <span className="font-bold text-emerald-200 text-2xl">
                          {completedDisplayQty}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {completedUnitLabel}
                        </span>
                      </div>
                      {completedReasonLabel ? (
                        <span className="inline-flex items-center px-3 py-1 bg-amber-500/15 text-amber-100 border border-amber-400/30 rounded-full text-xs font-bold">
                          {completedReasonLabel}
                        </span>
                      ) : null}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditItem(item.id);
                        }}
                        className="flex items-center gap-1 px-4 py-2 text-sm bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors border border-white/10"
                      >
                        <Edit2 className="w-4 h-4" />
                        <span>{text.edit}</span>
                      </button>
                    </div>
                  )}
                </div>

                {selectedItem === item.id && !hasValue && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    {/* Quick Buttons */}
                    <div className="mb-4">
                      <label className="block text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        {text.quickButtons}
                      </label>
                      <div className="grid grid-cols-6 gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSet(item.id, 0);
                          }}
                          className="px-4 py-3 bg-red-500/20 text-red-100 border border-red-400/30 rounded-lg font-bold hover:bg-red-500/30 transition-colors text-lg"
                        >
                          0
                        </button>
                        {[1, 2, 3, 4, 5].map((num) => (
                          <button
                            key={num}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickSet(item.id, num);
                            }}
                            className="px-4 py-3 bg-white/10 text-white border border-white/10 rounded-lg font-bold hover:bg-white/15 transition-colors text-lg"
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual Input */}
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-200 mb-2">
                          {text.enterQuantity}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") {
                                return;
                              }
                              e.preventDefault();
                              handleConfirmAndNext();
                            }}
                            placeholder="0"
                            className={`${ws.input} px-4 py-4 text-2xl text-center font-bold shadow`}
                            autoFocus
                          />
                          <div
                            className={`absolute ${language === "ar" ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 px-3 py-1 bg-white/10 border border-white/10 text-gray-100 rounded-lg text-sm font-bold`}
                          >
                            {unitText}
                          </div>
                        </div>
                      </div>

                      {/* Unit is a read-only label (item.unit) — the
                          employee neither picks nor changes it. It's
                          shown as the input suffix ({unitText}) above. */}

                      {/* Single button: "تم" saves and jumps to next */}
                      <div className="flex flex-col gap-2 self-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmAndNext();
                          }}
                          disabled={quantity === "" || parseFloat(quantity) < 0}
                          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 transition-colors shadow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {text.done}
                        </button>
                      </div>
                    </div>

                    {/* Waste reason selector — operator must pick one. */}
                    <div className="mt-4">
                      <label className="block text-sm font-bold text-gray-200 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                        {text.wasteReason}
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {REASON_OPTIONS.map((opt) => {
                          const isActive = reason === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReason(opt.key);
                                setReasonError(null);
                                if (opt.key !== "customer_return") {
                                  setNote("");
                                }
                              }}
                              className={`px-4 py-3 rounded-lg font-bold text-sm sm:text-base transition-colors border ${
                                isActive
                                  ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40"
                                  : "bg-white/10 text-white border-white/10 hover:bg-white/15"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Invoice number — only for customer_return. */}
                    {reason === "customer_return" && (
                      <div className="mt-4">
                        <label className="block text-sm font-bold text-gray-200 mb-2">
                          {text.invoiceLabel}
                        </label>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => {
                            setNote(e.target.value);
                            setReasonError(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={text.invoiceLabel}
                          className={`${ws.input} px-4 py-3 text-lg shadow`}
                        />
                      </div>
                    )}

                    {reasonError && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-400/30 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-700 dark:text-red-300 flex-shrink-0" />
                        <span className="text-red-200 text-sm font-semibold">
                          {reasonError}
                        </span>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-400">
                      {text.done} = {text.next}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-[#0b1220]/90 backdrop-blur border-t border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleSubmitWaste}
              disabled={submitDisabled}
              className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-white py-4 rounded-xl font-bold text-lg hover:from-emerald-600 hover:via-teal-600 hover:to-sky-600 transition-colors shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitWasteMutation.isPending ? (
                <>
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  {submitLabel}
                </>
              ) : (
                <>
                  <CheckCircle className="w-6 h-6" />
                  {submitLabel}
                </>
              )}
            </button>
            <div className="mt-2 text-center text-xs text-gray-400">
              {completedCount} {text.completed} • {totalCount - completedCount}{" "}
              {text.pending}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
