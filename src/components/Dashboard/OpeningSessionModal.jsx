import { X, Search } from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

export function OpeningSessionModal({
  openingModalOpen,
  setOpeningModalOpen,
  openingBranchId,
  setOpeningBranchId,
  openingOpenedAt,
  setOpeningOpenedAt,
  openingNote,
  setOpeningNote,
  openingSearch,
  setOpeningSearch,
  openingQtyByItem,
  setOpeningQtyByItem,
  openingError,
  openingSuccess,
  filteredOpeningItems,
  submitOpening,
  createOpeningMutation,
  branches,
}) {
  if (!openingModalOpen) {
    return null;
  }

  const close = () => setOpeningModalOpen(false);

  const branchOptions = [
    { value: "", label: "اختر الفرع" },
    ...(branches || []).map((b) => ({ value: String(b.id), label: b.name })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      <div
        className={`relative w-full max-w-3xl ${ws.glass} ${ws.card} overflow-hidden`}
      >
        <div
          className={`p-5 border-b ${ws.divider} flex items-center justify-between gap-4`}
        >
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg tracking-tight truncate">
              تسجيل مخزون افتتاحي
            </h3>
            <p className="text-white/55 text-sm">
              هذه الخطوة تعيد "المفترض" كنقطة بداية للفترة
            </p>
          </div>
          <button
            type="button"
            className={ws.iconButton}
            onClick={close}
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <GlassSelect
              value={openingBranchId}
              onChange={setOpeningBranchId}
              options={branchOptions}
              buttonClassName="px-3 py-2.5"
            />

            <div className="w-full">
              <label className="block text-xs text-white/55 mb-1">
                تاريخ الافتتاحي
              </label>
              <GlassDatePicker
                value={openingOpenedAt}
                onChange={setOpeningOpenedAt}
                placeholder="اختر التاريخ"
                buttonClassName="px-3 py-2.5"
                showTime
              />
            </div>

            <div className="w-full">
              <label className="block text-xs text-white/55 mb-1">
                ملاحظة (اختياري)
              </label>
              <input
                type="text"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                className={`${ws.input} px-3 py-2.5`}
                placeholder="مثال: افتتاح فترة يناير"
              />
            </div>
          </div>

          <div className="mb-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={openingSearch}
                onChange={(e) => setOpeningSearch(e.target.value)}
                className={`${ws.input} pr-10 pl-3 py-2.5`}
                placeholder="ابحث عن صنف..."
              />
            </div>
          </div>

          <div
            className={`max-h-[46vh] overflow-auto rounded-3xl border ${ws.divider} bg-white/[0.02]`}
          >
            <table className="w-full">
              <thead>
                <tr className="bg-white/[0.04]">
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70">
                    الصنف
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70">
                    الوحدة
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-semibold text-white/70">
                    الكمية الافتتاحية
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOpeningItems.map((it) => (
                  <tr key={it.id} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white font-medium">
                      {it.name}
                    </td>
                    <td className="px-4 py-3 text-white/65 text-sm">
                      {it.unit || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={openingQtyByItem[it.id] ?? 0}
                        onChange={(e) => {
                          const v = e.target.value;
                          setOpeningQtyByItem((prev) => ({
                            ...prev,
                            [it.id]: v,
                          }));
                        }}
                        className={`${ws.input} px-3 py-2.5`}
                      />
                    </td>
                  </tr>
                ))}

                {filteredOpeningItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-10 text-center text-white/55"
                    >
                      لا توجد نتائج
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {openingSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl text-emerald-200 font-semibold">
              {openingSuccess}
            </div>
          )}

          {openingError && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-400/30 rounded-2xl text-red-200">
              {openingError}
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={close}
              className={`${ws.btnNeutral} px-4 py-3`}
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={submitOpening}
              disabled={createOpeningMutation.isPending}
              className={`${ws.btnPrimary} px-6 py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {createOpeningMutation.isPending
                ? "جاري الحفظ..."
                : "حفظ المخزون الافتتاحي"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
