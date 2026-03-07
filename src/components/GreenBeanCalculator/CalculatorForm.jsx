import { FieldRow } from "./FieldRow";
import { ws } from "@/components/Workspace/ui";
import { formatMoney } from "@/utils/greenBeanCalculations";

export function CalculatorForm({
  calculatorMode,
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
  const isRegister = calculatorMode === "register";

  if (isRegister && !selectedBean) {
    return <div className="mt-4 text-white/60">اختر البن من الأعلى.</div>;
  }

  const roastExclBtnClass =
    roastInputMode === "excl"
      ? `${ws.btnPrimary} px-3 py-2 text-sm`
      : `${ws.btnNeutral} px-3 py-2 text-sm`;

  const roastInclBtnClass =
    roastInputMode === "incl"
      ? `${ws.btnPrimary} px-3 py-2 text-sm`
      : `${ws.btnNeutral} px-3 py-2 text-sm`;

  const headerTitle = isRegister ? "البن:" : "تسعير فقط:";

  const headerValue = isRegister ? selectedBean?.name : "غير مرتبط باسم بن";

  const headerUpdatedAt = isRegister ? (
    <div className="text-xs text-white/40">
      آخر تحديث: {selectedUpdatedAtText}
    </div>
  ) : (
    <div className="text-xs text-white/40">
      لن يتم حفظ أي شيء عند هذا الوضع.
    </div>
  );

  return (
    <div className="mt-4">
      <div className="rounded-3xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.03] flex items-center justify-between gap-2 flex-wrap">
          <div className="text-white/80">
            {headerTitle}{" "}
            <span className="font-bold text-white">{headerValue}</span>
          </div>
          {headerUpdatedAt}
        </div>

        <div className="px-4">
          <FieldRow label="سعر الكيلو الخام" hint="Excl. tax">
            <input
              className={`${ws.input} px-4 py-2.5`}
              type="number"
              step="0.01"
              inputMode="decimal"
              value={draft.priceKgExclTax}
              onChange={handleChangePriceKgExclTax}
              placeholder="مثال: 35"
            />
          </FieldRow>

          <FieldRow label="حجم الخيشة" hint="بالكيلو">
            <input
              className={`${ws.input} px-4 py-2.5`}
              type="number"
              step="0.001"
              inputMode="decimal"
              value={draft.bagSizeKg}
              onChange={handleChangeBagSizeKg}
              placeholder="مثال: 60"
            />
          </FieldRow>

          <FieldRow
            label="تكلفة الخيشة"
            hint="غير شامل الضريبة (محسوبة تلقائيًا)"
          >
            <div
              className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-bold`}
            >
              {formatMoney(computed.bagCostExcl)}
            </div>
          </FieldRow>

          <FieldRow label="تكلفة الخيشة" hint="شامل الضريبة (محسوبة تلقائيًا)">
            <div
              className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-bold`}
            >
              {formatMoney(computed.bagCostIncl)}
            </div>
          </FieldRow>

          {!isRegister ? (
            <>
              <FieldRow
                label="تكلفة التحميص"
                hint="اختر الإدخال: غير شامل الضريبة أو شامل الضريبة"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRoastInputMode("excl")}
                      className={roastExclBtnClass}
                    >
                      غير شامل
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoastInputMode("incl")}
                      className={roastInclBtnClass}
                    >
                      شامل
                    </button>
                    <div className="text-xs text-white/40 self-center">
                      (الضريبة 15%)
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-white/50 mb-1">
                        غير شامل الضريبة
                      </div>
                      <input
                        className={`${ws.input} px-4 py-2.5`}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        list="roastExclOptions"
                        value={draft.roastCostExclTax}
                        onChange={handleChangeRoastCostExclTax}
                        disabled={roastInputMode !== "excl"}
                      />
                      <datalist id="roastExclOptions">
                        <option value="7" />
                        <option value="6" />
                        <option value="5" />
                      </datalist>
                    </div>

                    <div>
                      <div className="text-xs text-white/50 mb-1">
                        شامل الضريبة
                      </div>
                      <input
                        className={`${ws.input} px-4 py-2.5`}
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        list="roastInclOptions"
                        value={draft.roastCostInclTax}
                        onChange={handleChangeRoastCostInclTax}
                        disabled={roastInputMode !== "incl"}
                      />
                      <datalist id="roastInclOptions">
                        <option value="8.05" />
                        <option value="6.90" />
                        <option value="5.75" />
                      </datalist>
                    </div>
                  </div>
                </div>
              </FieldRow>

              <FieldRow
                label="تكلفة الاجماليه للتحميص"
                hint="حجم الخيشة × تكلفة التحميص للكيلو شامل الضريبة (محسوبة تلقائيًا)"
              >
                <div
                  className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-bold`}
                >
                  {formatMoney(computed.roastTotalIncl)}
                </div>
              </FieldRow>

              <FieldRow label="الواصل بعد الهدر" hint="مدخل (بالكيلو)">
                <input
                  className={`${ws.input} px-4 py-2.5`}
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={draft.receivedKg}
                  onChange={handleChangeReceivedKg}
                  placeholder="مثال: 50"
                />
              </FieldRow>

              <FieldRow
                label="نسبة الهدر"
                hint="% (محسوبة تلقائيًا من الكمية الواصلة)"
              >
                <div
                  className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-bold`}
                >
                  {formatMoney(computed.wastePercentDerived)}
                </div>
              </FieldRow>

              <FieldRow label="الإجمالي" hint="شامل الضريبة">
                <div
                  className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-extrabold`}
                >
                  {formatMoney(computed.totalIncl)}
                </div>
              </FieldRow>

              <FieldRow
                label="سعر الكيلو النهائي"
                hint="(الإجمالي / الواصل بعد الهدر)"
              >
                <div
                  className={`${ws.glass} ${ws.card} px-4 py-3 text-white font-extrabold`}
                >
                  {formatMoney(computed.finalPricePerKg)}
                </div>
              </FieldRow>
            </>
          ) : null}

          <div className="py-4" />
        </div>
      </div>

      {savingBlock}
    </div>
  );
}
