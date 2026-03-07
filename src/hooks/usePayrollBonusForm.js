import { useState, useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";

export function usePayrollBonusForm(month) {
  const emptyBonusForm = useMemo(
    () => ({
      employeeIds: [],
      amount_mode: "fixed",
      amount: "",
      amount_percent: "",
    }),
    [],
  );

  const [bonusFormData, setBonusFormData] = useState(emptyBonusForm);
  const [editingBonus, setEditingBonus] = useState(null);
  const [showBonusModal, setShowBonusModal] = useState(false);

  useEffect(() => {
    setEditingBonus(null);
    setBonusFormData(emptyBonusForm);
    setShowBonusModal(false);
  }, [emptyBonusForm, month]);

  const handleOpenBonusModal = useCallback(
    (bonus = null) => {
      if (!month) {
        toast.error("اختر الشهر أولاً");
        return;
      }

      if (bonus) {
        const inferredMode =
          bonus.amount_mode === "percent" ||
          bonus.amount_mode === "Percent" ||
          (bonus.amount_percent !== null && bonus.amount_percent !== undefined)
            ? "percent"
            : "fixed";

        setEditingBonus(bonus);
        setBonusFormData({
          employeeIds: bonus.employee_id ? [String(bonus.employee_id)] : [],
          amount_mode: inferredMode,
          amount:
            inferredMode === "fixed"
              ? bonus.amount === null || bonus.amount === undefined
                ? ""
                : String(bonus.amount)
              : "",
          amount_percent:
            inferredMode === "percent"
              ? bonus.amount_percent === null ||
                bonus.amount_percent === undefined
                ? ""
                : String(bonus.amount_percent)
              : "",
        });
      } else {
        setEditingBonus(null);
        setBonusFormData(emptyBonusForm);
      }

      setShowBonusModal(true);
    },
    [emptyBonusForm, month],
  );

  const handleCloseBonusModal = useCallback(() => {
    setShowBonusModal(false);
    setEditingBonus(null);
    setBonusFormData(emptyBonusForm);
  }, [emptyBonusForm]);

  const handleSubmitBonus = useCallback(
    (e, createMutation, updateMutation) => {
      e.preventDefault();

      if (!month) {
        toast.error("اختر الشهر أولاً");
        return;
      }

      const employeeIdsRaw = Array.isArray(bonusFormData.employeeIds)
        ? bonusFormData.employeeIds
        : [];
      const employeeIdsValue = employeeIdsRaw
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (employeeIdsValue.length === 0) {
        toast.error("اختر الموظف / الموظفين");
        return;
      }

      const amountMode = bonusFormData.amount_mode || "fixed";

      let payloadBase = {
        month: String(month),
        bonus_date: `${String(month)}-01`,
        amount_mode: amountMode,
      };

      if (amountMode === "percent") {
        const percentRaw = String(bonusFormData.amount_percent ?? "").trim();
        const percentValue = percentRaw === "" ? null : Number(percentRaw);
        if (
          percentValue === null ||
          !Number.isFinite(percentValue) ||
          percentValue < 0
        ) {
          toast.error("النسبة غير صحيحة");
          return;
        }
        payloadBase = { ...payloadBase, amount_percent: percentValue };
      } else {
        const amountRaw = String(bonusFormData.amount ?? "").trim();
        const amountValue = amountRaw === "" ? null : Number(amountRaw);
        if (
          amountValue === null ||
          !Number.isFinite(amountValue) ||
          amountValue < 0
        ) {
          toast.error("المبلغ غير صحيح");
          return;
        }
        payloadBase = { ...payloadBase, amount: amountValue };
      }

      if (editingBonus) {
        const employeeIdValue = employeeIdsValue[0] || null;
        if (!employeeIdValue) {
          toast.error("اختر الموظف");
          return;
        }

        updateMutation.mutate(
          {
            id: editingBonus.id,
            data: {
              ...payloadBase,
              employee_id: employeeIdValue,
            },
          },
          {
            onSuccess: () => {
              handleCloseBonusModal();
            },
          },
        );
      } else {
        createMutation.mutate(
          {
            ...payloadBase,
            employee_ids: employeeIdsValue,
          },
          {
            onSuccess: () => {
              handleCloseBonusModal();
            },
          },
        );
      }
    },
    [bonusFormData, editingBonus, handleCloseBonusModal, month],
  );

  const handleDeleteBonus = useCallback((id, deleteMutation) => {
    if (!id) return;
    const ok = confirm("هل أنت متأكد من حذف هذا البونص؟");
    if (!ok) return;
    deleteMutation.mutate(id);
  }, []);

  return {
    bonusFormData,
    setBonusFormData,
    editingBonus,
    showBonusModal,
    handleOpenBonusModal,
    handleCloseBonusModal,
    handleSubmitBonus,
    handleDeleteBonus,
  };
}
