import { Save, Copy } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import { CalculatorForm } from "./CalculatorForm";

export function CalculatorCard({
  calculatorMode,
  setCalculatorMode,
  onSave,
  onCopyFinalPrice,
  saveDisabled,
  selectedBean,
  selectedUpdatedAtText,
  draft,
  handleChangePriceKgExclTax,
  handleChangeBagSizeKg,
  roastInputMode,
  setRoastInputMode,
  handleChangeRoastCostExclTax,
  handleChangeRoastCostInclTax,
  handleChangeReceivedKg,
  computed,
  savingBlock,
}) {
  const cardShell = `${ws.glassSoft} ${ws.card} p-5`;

  const pricingBtnClass =
    calculatorMode === "pricing"
      ? `${ws.btnPrimary} px-3 py-2 text-sm`
      : `${ws.btnNeutral} px-3 py-2 text-sm`;

  const registerBtnClass =
    calculatorMode === "register"
      ? `${ws.btnPrimary} px-3 py-2 text-sm`
      : `${ws.btnNeutral} px-3 py-2 text-sm`;

  return (
    <div className={cardShell}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-slate-900 dark:text-white font-bold tracking-tight">
            جدول الحاسبة
          </div>
          <div className="text-xs text-slate-500 dark:text-white/50 mt-1">
            اختر وضع الاستخدام ثم أدخل القيم.
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCalculatorMode("pricing")}
            className={pricingBtnClass}
          >
            تسعير فقط
          </button>
          <button
            type="button"
            onClick={() => setCalculatorMode("register")}
            className={registerBtnClass}
          >
            تسجيل البن
          </button>

          {calculatorMode === "register" ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saveDisabled}
              className={`${ws.btnPrimary} px-4 py-2`}
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCopyFinalPrice(computed.finalPricePerKg)}
              className={`${ws.btnNeutral} px-4 py-2`}
            >
              <Copy className="w-4 h-4" />
              نسخ السعر
            </button>
          )}
        </div>
      </div>

      {calculatorMode === "pricing" ? (
        <div className="mt-3 text-xs text-slate-500 dark:text-white/45">
          وضع تسعير فقط: عند اختيار هذا الوضع يتم تصفير الحقول ولا يتم ربط
          التسعير بأي اسم، ولا يتم حفظ أي بيانات.
        </div>
      ) : (
        <div className="mt-3 text-xs text-slate-500 dark:text-white/45">
          وضع التسجيل: يتم حفظ سعر الكيلو وحجم الخيشة فقط. لتسعير كامل مع
          التحميص والهدر استخدم وضع "تسعير فقط".
        </div>
      )}

      <CalculatorForm
        calculatorMode={calculatorMode}
        selectedBean={selectedBean}
        selectedUpdatedAtText={selectedUpdatedAtText}
        draft={draft}
        handleChangePriceKgExclTax={handleChangePriceKgExclTax}
        handleChangeBagSizeKg={handleChangeBagSizeKg}
        roastInputMode={roastInputMode}
        setRoastInputMode={setRoastInputMode}
        handleChangeRoastCostExclTax={handleChangeRoastCostExclTax}
        handleChangeRoastCostInclTax={handleChangeRoastCostInclTax}
        handleChangeReceivedKg={handleChangeReceivedKg}
        computed={computed}
        savingBlock={savingBlock}
      />
    </div>
  );
}
