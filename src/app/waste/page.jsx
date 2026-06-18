"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Trash2,
  CheckCircle,
  LogOut,
  AlertCircle,
  Send,
  Layers,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import {
  EMPLOYEE_WASTE_TOKEN_KEY,
  employeeWasteFetch,
} from "@/utils/apiAuth";

const WASTE_LOGIN_PATH = "/waste/login";

export default function WastePage() {
  const [employee, setEmployee] = useState(null);
  const [language, setLanguage] = useState("ar");
  // itemId -> typed quantity string
  const [quantities, setQuantities] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const employeeData = localStorage.getItem("employeeWasteSession");
    const token = localStorage.getItem(EMPLOYEE_WASTE_TOKEN_KEY);

    if (!employeeData || !token) {
      window.location.href = WASTE_LOGIN_PATH;
      return;
    }

    try {
      setEmployee(JSON.parse(employeeData));
    } catch {
      window.location.href = WASTE_LOGIN_PATH;
      return;
    }

    const savedLanguage = localStorage.getItem("employeeLanguage") || "ar";
    setLanguage(savedLanguage);
  }, []);

  const { data: items = [], isLoading } = useQuery({
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
      setQuantities({});
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    },
    onError: (err) => {
      setError(
        err.message ||
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
      submit: "إرسال",
      submitting: "جاري الإرسال...",
      successTitle: "تم إرسال الهدر بنجاح ✅",
      successMessage: "شكراً لك، تم حفظ بيانات الهدر بنجاح",
      error: "خطأ",
      empty: "أدخل كمية واحدة على الأقل قبل الإرسال",
      noItems: "لا توجد أصناف متاحة لتسجيل الهدر",
      quantity: "الكمية",
    },
    en: {
      title: "Waste Logging",
      employee: "Employee",
      logout: "Logout",
      submit: "Submit",
      submitting: "Submitting...",
      successTitle: "Waste Submitted Successfully ✅",
      successMessage: "Thank you, waste data has been saved",
      error: "Error",
      empty: "Enter at least one quantity before submitting",
      noItems: "No items available for waste logging",
      quantity: "Quantity",
    },
  };

  const text = t[language];

  // Group eligible items by category for display.
  const groupedItems = useMemo(() => {
    const groups = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const key = item.category_id ?? "__none__";
      const label =
        language === "ar"
          ? item.category_name
          : item.category_name_en || item.category_name;
      if (!groups.has(key)) {
        groups.set(key, { label: label || "", items: [] });
      }
      groups.get(key).items.push(item);
    }
    return Array.from(groups.values());
  }, [items, language]);

  const setQty = (itemId, value) => {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = () => {
    if (!employee) return;

    setError(null);

    const payloadItems = Object.entries(quantities)
      .map(([itemId, value]) => {
        const n = Number(value);
        return { itemId: Number(itemId), quantity: Number.isFinite(n) ? n : 0 };
      })
      .filter((row) => row.quantity > 0);

    if (payloadItems.length === 0) {
      setError(text.empty);
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

  const filledCount = Object.values(quantities).filter(
    (v) => Number(v) > 0,
  ).length;

  const submitDisabled = submitWasteMutation.isPending || filledCount === 0;
  const submitLabel = submitWasteMutation.isPending
    ? text.submitting
    : text.submit;

  if (!employee) {
    return null;
  }

  if (showSuccess) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-[#1f1208] via-[#2b1a0a] to-[#1f1408] flex items-center justify-center px-4"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full mb-6 shadow-2xl">
            <CheckCircle className="w-16 h-16 text-white" />
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
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-xl flex items-start gap-3 shadow">
            <AlertCircle className="w-6 h-6 text-red-300 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-100 mb-1">{text.error}</h3>
              <p className="text-red-200">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && (!items || items.length === 0) ? (
          <div className="p-8 text-center bg-white/5 border border-white/10 rounded-xl text-gray-300">
            {text.noItems}
          </div>
        ) : null}

        {/* Items grouped by category */}
        {groupedItems.map((group, gi) => (
          <div key={gi} className="mb-6">
            {group.label ? (
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-5 h-5 text-amber-300" />
                <h2 className="text-lg font-bold text-white">{group.label}</h2>
              </div>
            ) : null}

            <div className="space-y-3">
              {group.items.map((item) => {
                const name =
                  language === "ar" ? item.name : item.name_en || item.name;
                const value = quantities[item.id] ?? "";
                const hasValue = Number(value) > 0;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border transition-colors duration-200 ${
                      hasValue
                        ? "border-amber-400/50 bg-amber-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="font-bold text-white text-lg flex-1 min-w-0">
                        {name}
                      </h3>

                      <div className="relative w-40 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => setQty(item.id, e.target.value)}
                          placeholder="0"
                          className={`${ws.input} px-4 py-3 text-xl text-center font-bold shadow`}
                        />
                        <div
                          className={`absolute ${language === "ar" ? "left-2" : "right-2"} top-1/2 -translate-y-1/2 px-2 py-1 bg-white/10 border border-white/10 text-gray-100 rounded-lg text-xs font-bold pointer-events-none`}
                        >
                          {item.unit}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky Submit Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="bg-[#0b1220]/90 backdrop-blur border-t border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white py-4 rounded-xl font-bold text-lg hover:from-amber-600 hover:via-orange-600 hover:to-red-600 transition-colors shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {submitWasteMutation.isPending ? (
                <>
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  {submitLabel}
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  {submitLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
