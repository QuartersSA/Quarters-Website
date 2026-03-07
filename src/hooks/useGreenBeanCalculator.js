import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/utils/apiAuth";
import {
  toNumberOrNullFromInput,
  withVat,
  withoutVat,
  clamp,
  round4,
  todayISO,
  computeGreenBeanMetrics,
} from "@/utils/greenBeanCalculations";

export function useGreenBeanCalculator({ ready, isAuthenticated, isAdmin }) {
  const queryClient = useQueryClient();

  const [calculatorModeInternal, setCalculatorModeInternal] =
    useState("pricing");
  const [newName, setNewName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const lastRegisterSelectedIdRef = useRef("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [roastInputMode, setRoastInputMode] = useState("excl");

  const getEmptyDraft = useCallback(() => {
    return {
      priceKgExclTax: "",
      bagSizeKg: "",
      receivedKg: "",
      roastCostExclTax: "7",
      roastCostInclTax: "8.05",
      extraCostPerKg: "0",
    };
  }, []);

  const [draft, setDraft] = useState(getEmptyDraft);

  const setCalculatorMode = useCallback(
    (mode) => {
      const next = mode === "register" ? "register" : "pricing";
      setCalculatorModeInternal(next);
      setError(null);
      setSuccess(null);

      if (next === "pricing") {
        // Pricing-only: clear everything and unlink from any bean.
        if (selectedId) {
          lastRegisterSelectedIdRef.current = String(selectedId);
        }
        setSelectedId("");
        setDraft(getEmptyDraft());
        return;
      }

      // Register mode: restore previous selection if we have one.
      const restore = lastRegisterSelectedIdRef.current;
      if (!selectedId && restore) {
        setSelectedId(String(restore));
      }
    },
    [getEmptyDraft, selectedId],
  );

  const calculatorMode = calculatorModeInternal;

  const beansQuery = useQuery({
    queryKey: ["accounting", "greenBeans"],
    enabled: !!ready && !!isAuthenticated && !!isAdmin,
    queryFn: async () => {
      const res = await adminFetch("/api/accounting/green-beans");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When fetching /api/accounting/green-beans, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
  });

  const beans = Array.isArray(beansQuery.data?.beans)
    ? beansQuery.data.beans
    : [];

  useEffect(() => {
    // Only auto-select a bean in "register" mode.
    if (calculatorMode !== "register") return;
    if (selectedId) return;
    if (beans.length === 0) return;
    setSelectedId(String(beans[0].id));
  }, [beans, selectedId, calculatorMode]);

  const selectedBean = useMemo(() => {
    const idNum = Number(selectedId);
    if (!Number.isFinite(idNum)) return null;
    return beans.find((b) => Number(b.id) === idNum) || null;
  }, [beans, selectedId]);

  const selectedUpdatedAtText = useMemo(() => {
    const raw = selectedBean?.updated_at;
    if (!raw) return "—";
    const text = String(raw).replace("T", " ").slice(0, 16);
    return text || "—";
  }, [selectedBean?.updated_at]);

  useEffect(() => {
    // Only load bean data into the form in "register" mode.
    if (calculatorMode !== "register") return;
    if (!selectedBean) return;

    const price = selectedBean.price_kg_excl_tax;
    const bag = selectedBean.bag_size_kg;
    const bagText = bag === null || bag === undefined ? "" : String(bag);

    const roastExclText =
      selectedBean.roast_cost_excl_tax === null ||
      selectedBean.roast_cost_excl_tax === undefined
        ? "7"
        : String(selectedBean.roast_cost_excl_tax);

    const roastInclText =
      selectedBean.roast_cost_incl_tax === null ||
      selectedBean.roast_cost_incl_tax === undefined
        ? "8.05"
        : String(selectedBean.roast_cost_incl_tax);

    setDraft({
      priceKgExclTax:
        price === null || price === undefined ? "" : String(price),
      bagSizeKg: bagText,
      receivedKg: "", // keep empty until user types it
      roastCostExclTax: roastExclText,
      roastCostInclTax: roastInclText,
      extraCostPerKg:
        selectedBean.extra_cost_per_kg === null ||
        selectedBean.extra_cost_per_kg === undefined
          ? "0"
          : String(selectedBean.extra_cost_per_kg),
    });

    setRoastInputMode((m) => (m === "incl" || m === "excl" ? m : "excl"));
    setError(null);
    setSuccess(null);
  }, [selectedBean, calculatorMode]);

  const createBeanMutation = useMutation({
    mutationFn: async ({ name }) => {
      const res = await adminFetch("/api/accounting/green-beans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When posting /api/accounting/green-beans, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeans"],
      });

      // After adding a bean, we want to continue in "register" mode and clear the form.
      setCalculatorModeInternal("register");
      setDraft(getEmptyDraft());

      const id = data?.bean?.id;
      if (id) {
        setSelectedId(String(id));
        lastRegisterSelectedIdRef.current = String(id);
      }

      setNewName("");
      setSuccess("تمت إضافة البن.");
      setError(null);
    },
    onError: (e) => {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "فشل إضافة البن");
    },
  });

  const updateBeanMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      const res = await adminFetch(`/api/accounting/green-beans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When putting /api/accounting/green-beans/${id}, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeans"],
      });
    },
  });

  const createSupplyMutation = useMutation({
    mutationFn: async ({ payload }) => {
      const res = await adminFetch("/api/accounting/green-bean-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            `When posting /api/accounting/green-bean-orders, the response was [${res.status}] ${res.statusText}`,
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["accounting", "greenBeanOrders"],
      });
    },
  });

  const handleRefresh = useCallback(() => {
    beansQuery.refetch();
  }, [beansQuery]);

  const onAdd = useCallback(() => {
    const name = String(newName || "").trim();
    if (!name) {
      setError("اكتب اسم البن أولاً");
      setSuccess(null);
      return;
    }
    createBeanMutation.mutate({ name });
  }, [newName, createBeanMutation]);

  const onSave = useCallback(async () => {
    if (calculatorMode !== "register") {
      return;
    }

    if (!selectedBean?.id) {
      setError("اختر البن أولاً");
      setSuccess(null);
      return;
    }

    const priceKgExclTax = toNumberOrNullFromInput(draft.priceKgExclTax);
    const bagSizeKg = toNumberOrNullFromInput(draft.bagSizeKg);

    const roastCostExclInput = toNumberOrNullFromInput(draft.roastCostExclTax);
    const roastCostInclInput = toNumberOrNullFromInput(draft.roastCostInclTax);

    const extraCostPerKg = toNumberOrNullFromInput(draft.extraCostPerKg);
    const receivedKgRaw = toNumberOrNullFromInput(draft.receivedKg);

    if (priceKgExclTax === null || bagSizeKg === null) {
      setError("تأكد من سعر الكيلو وحجم الخيشة");
      setSuccess(null);
      return;
    }

    let roastCostExclTax = null;
    let roastCostInclTax = null;

    if (roastInputMode === "incl") {
      const incl = roastCostInclInput === null ? 8.05 : roastCostInclInput;
      const exclComputed = withoutVat(incl);
      roastCostInclTax = incl;
      roastCostExclTax = Number.isFinite(exclComputed) ? exclComputed : 7;
    } else {
      const excl = roastCostExclInput === null ? 7 : roastCostExclInput;
      const inclComputed = withVat(excl);
      roastCostExclTax = excl;
      roastCostInclTax = Number.isFinite(inclComputed) ? inclComputed : 8.05;
    }

    let wastePercent = 0;
    if (receivedKgRaw !== null && bagSizeKg > 0) {
      const raw = (1 - receivedKgRaw / bagSizeKg) * 100;
      const clamped = clamp(raw, 0, 100);
      wastePercent = Number.isFinite(clamped) ? round4(clamped) : 0;
    } else {
      const existing = Number(selectedBean?.waste_percent);
      wastePercent = Number.isFinite(existing) ? existing : 0;
    }

    const patch = {
      priceKgExclTax,
      bagSizeKg,
      roastCostExclTax,
      roastCostInclTax,
      extraCostPerKg: extraCostPerKg === null ? 0 : extraCostPerKg,
      wastePercent,
    };

    try {
      setError(null);
      setSuccess(null);

      await updateBeanMutation.mutateAsync({ id: selectedBean.id, patch });

      if (receivedKgRaw !== null) {
        const receivedKg = receivedKgRaw;
        if (!Number.isFinite(receivedKg) || receivedKg <= 0) {
          setError("اكتب الواصل بعد الهدر بشكل صحيح");
          setSuccess(null);
          return;
        }

        const payloadItem = {
          beanId: Number(selectedBean.id),
          priceKgExclTax,
          bagSizeKg,
          roastCostInclTax: patch.roastCostInclTax,
          extraCostPerKg: patch.extraCostPerKg,
          receivedAfterWasteKg: receivedKg,
        };

        const payload = {
          orderDate: todayISO(),
          supplierName: null,
          note: `توريد من الحاسبة - ${selectedBean.name}`,
          items: [payloadItem],
        };

        const data = await createSupplyMutation.mutateAsync({ payload });
        const orderId = data?.order?.id ? String(data.order.id) : "";

        const msg = orderId
          ? `تم الحفظ + تم تسجيل توريد رقم ${orderId}.`
          : "تم الحفظ + تم تسجيل التوريد.";

        setSuccess(msg);
      } else {
        setSuccess("تم حفظ بيانات البن. (وضع التسجيل)");
      }
    } catch (e) {
      console.error(e);
      setSuccess(null);
      setError(e?.message || "فشل الحفظ");
    }
  }, [
    calculatorMode,
    draft,
    selectedBean,
    updateBeanMutation,
    createSupplyMutation,
    roastInputMode,
  ]);

  const onCopyFinalPrice = useCallback(async (finalPricePerKg) => {
    try {
      setError(null);
      setSuccess(null);
      const value = finalPricePerKg;
      const text = Number.isFinite(Number(value)) ? String(value) : "";
      if (!text) {
        setError("لا يوجد رقم لنسخه الآن");
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setSuccess("تم نسخ سعر الكيلو النهائي");
        return;
      }
      setError("النسخ غير مدعوم في هذا المتصفح");
    } catch (e) {
      console.error(e);
      setError("فشل النسخ");
    }
  }, []);

  const handleChangePriceKgExclTax = useCallback((e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, priceKgExclTax: value }));
  }, []);

  const handleChangeBagSizeKg = useCallback((e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, bagSizeKg: value }));
  }, []);

  const handleChangeRoastCostExclTax = useCallback((e) => {
    const value = e.target.value;
    setDraft((d) => {
      const n = toNumberOrNullFromInput(value);
      const incl = n === null ? "" : String(withVat(n));
      return { ...d, roastCostExclTax: value, roastCostInclTax: incl };
    });
  }, []);

  const handleChangeRoastCostInclTax = useCallback((e) => {
    const value = e.target.value;
    setDraft((d) => {
      const n = toNumberOrNullFromInput(value);
      const excl = n === null ? "" : String(withoutVat(n));
      return { ...d, roastCostInclTax: value, roastCostExclTax: excl };
    });
  }, []);

  const handleChangeReceivedKg = useCallback((e) => {
    const value = e.target.value;
    setDraft((d) => ({ ...d, receivedKg: value }));
  }, []);

  const handleChangeNewName = useCallback((e) => {
    setNewName(e.target.value);
  }, []);

  const beanOptions = useMemo(() => {
    const base = [{ value: "", label: "اختر البن" }];
    const options = beans.map((b) => ({
      value: String(b.id),
      label: b.name,
    }));
    return [...base, ...options];
  }, [beans]);

  const computed = useMemo(() => computeGreenBeanMetrics(draft), [draft]);

  return {
    calculatorMode,
    setCalculatorMode,
    newName,
    setNewName,
    selectedId,
    setSelectedId,
    error,
    setError,
    success,
    setSuccess,
    roastInputMode,
    setRoastInputMode,
    draft,
    setDraft,
    beansQuery,
    beans,
    selectedBean,
    selectedUpdatedAtText,
    createBeanMutation,
    updateBeanMutation,
    createSupplyMutation,
    handleRefresh,
    onAdd,
    onSave,
    onCopyFinalPrice,
    handleChangePriceKgExclTax,
    handleChangeBagSizeKg,
    handleChangeRoastCostExclTax,
    handleChangeRoastCostInclTax,
    handleChangeReceivedKg,
    handleChangeNewName,
    beanOptions,
    computed,
  };
}
