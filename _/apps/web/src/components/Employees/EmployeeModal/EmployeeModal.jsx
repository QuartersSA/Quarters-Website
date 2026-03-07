import { ws } from "@/components/Workspace/ui";
import { EmployeeModalHeader } from "./EmployeeModalHeader";
import { EmployeeFormFields } from "./EmployeeFormFields";

export function EmployeeModal({
  isOpen,
  isEditing,
  formData,
  setFormData,
  branches,
  onSubmit,
  onClose,
  onToggleBranch,
  isSubmitting,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`${ws.glass} ${ws.card} w-full max-w-2xl max-h-[90svh] overflow-hidden`}
      >
        <EmployeeModalHeader isEditing={isEditing} onClose={onClose} />

        <form
          onSubmit={onSubmit}
          className="p-6 space-y-6 overflow-y-auto max-h-[calc(90svh-84px)]"
        >
          <EmployeeFormFields
            formData={formData}
            setFormData={setFormData}
            isEditing={isEditing}
            branches={branches}
            onToggleBranch={onToggleBranch}
          />

          {/* Actions */}
          <div className={`flex gap-3 pt-4 border-t ${ws.divider}`}>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${ws.btnPrimary} flex-1 px-6 py-3 justify-center disabled:opacity-50`}
            >
              {isEditing ? "تحديث الموظف" : "إضافة الموظف"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${ws.btnNeutral} px-6 py-3 justify-center`}
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
