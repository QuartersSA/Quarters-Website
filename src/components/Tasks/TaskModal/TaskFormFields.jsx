import { CalendarDays, Circle, Flag, Tags, User2, Users2 } from "lucide-react";
import { FormRowLabel } from "../FormRowLabel";
import { MultiUserPicker } from "../MultiUserPicker";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";
import { parseTags, normalizeDate } from "@/utils/taskUtils";

export function TaskFormFields({
  title,
  setTitle,
  description,
  setDescription,
  status,
  setStatus,
  priority,
  setPriority,
  dueDate,
  setDueDate,
  spaceId,
  setSpaceId,
  tagsText,
  setTagsText,
  assigneeIds,
  setAssigneeIds,
  closeNotCompleted,
  setCloseNotCompleted,
  showAssignees,
  users,
  spaces,
  requireDueDate = false,
  requireSpace = false,
  // NEW: show creator (cached on task)
  createdByName = null,
  createdAt = null,
  children,
  rightChildren,
}) {
  const inputClass = `${ws.input} px-4 py-3`;
  const selectClass = `mt-2 ${ws.select} px-4 py-3`;
  const sideCardClass = `${ws.glassSoft} ${ws.card} p-4`;

  const tagsPreview = parseTags(tagsText);

  const createdAtText = createdAt ? normalizeDate(createdAt) : null;
  const showCreatedMeta = !!createdByName || !!createdAtText;

  const statusOptions = [
    { value: "Todo", label: "للإنجاز" },
    { value: "In Progress", label: "قيد التنفيذ" },
    { value: "Done", label: "مكتملة" },
  ];

  const priorityOptions = [
    { value: "Low", label: "منخفضة" },
    { value: "Normal", label: "عادية" },
    { value: "High", label: "عالية" },
    { value: "Urgent", label: "عاجلة" },
  ];

  const dueLabel = requireDueDate ? "تاريخ الاستحقاق *" : "تاريخ الاستحقاق";
  const spaceLabel = requireSpace ? "المساحة *" : "المساحة";

  const spaceOptions = [
    { value: "", label: requireSpace ? "اختر مساحة" : "بدون مساحة" },
    ...spaces.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const isCloseNotCompleted = !!closeNotCompleted;

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    // If user changes status manually, treat it as a normal status change (not "closed")
    setCloseNotCompleted(false);
  };

  const handleCloseNotCompletedChange = (e) => {
    const checked = !!e.target.checked;
    setCloseNotCompleted(checked);
    if (checked) {
      setStatus("Done");
    }
  };

  const showCloseRow = status !== "Todo" || true;

  return (
    <>
      <div className="lg:col-span-3 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">
            عنوان المهمة
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="مثال: متابعة توريد البن"
          />
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-700 dark:text-white/70 mb-2">الوصف</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} min-h-[140px] resize-y`}
            placeholder="تفاصيل إضافية…"
          />
        </div>

        {children}

        {showAssignees ? (
          <div>
            <FormRowLabel
              icon={<Users2 className="w-4 h-4" />}
              label="المكلفون"
            />
            <div className="mt-2">
              <MultiUserPicker
                users={users}
                selectedIds={assigneeIds}
                onChange={setAssigneeIds}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className={sideCardClass}>
          {showCreatedMeta ? (
            <div className="mb-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 px-3 py-3">
              <div className="text-xs text-slate-600 dark:text-white/55">معلومات</div>
              {createdByName ? (
                <div className="mt-1 text-sm text-slate-800 dark:text-white/85">
                  <span className="text-slate-600 dark:text-white/55">أنشأها: </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {createdByName}
                  </span>
                </div>
              ) : null}
              {createdAtText ? (
                <div className="mt-1 text-sm text-slate-800 dark:text-white/85">
                  <span className="text-slate-600 dark:text-white/55">تاريخ الإنشاء: </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {createdAtText}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <FormRowLabel
                icon={<Circle className="w-4 h-4" />}
                label="الحالة"
              />
              <GlassSelect
                value={status}
                onChange={handleStatusChange}
                options={statusOptions}
                className="mt-2"
                buttonClassName="px-4 py-3"
              />
            </div>

            <div>
              <FormRowLabel
                icon={<Flag className="w-4 h-4" />}
                label="الأولوية"
              />
              <GlassSelect
                value={priority}
                onChange={setPriority}
                options={priorityOptions}
                className="mt-2"
                buttonClassName="px-4 py-3"
              />

              {showCloseRow ? (
                <label className="mt-3 flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isCloseNotCompleted}
                    onChange={handleCloseNotCompletedChange}
                    className="mt-1 h-4 w-4 accent-white"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      إغلاق المهمة لعدم إتمامها
                    </div>
                    <div className="text-xs text-slate-600 dark:text-white/60">
                      عند التفعيل سيتم إغلاق المهمة وتتحول إلى "منتهية" بدون
                      اعتبارها مكتملة.
                    </div>
                  </div>
                </label>
              ) : null}
            </div>

            <div>
              <FormRowLabel
                icon={<CalendarDays className="w-4 h-4" />}
                label={dueLabel}
              />
              <div className="mt-2">
                <GlassDatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder={requireDueDate ? "اختر التاريخ" : "بدون تاريخ"}
                  buttonClassName="px-4 py-3"
                />
              </div>
              {requireDueDate && !dueDate ? (
                <div className="mt-2 text-xs text-red-700 dark:text-red-300">
                  تاريخ الاستحقاق مطلوب
                </div>
              ) : null}
            </div>

            <div>
              <FormRowLabel
                icon={<Tags className="w-4 h-4" />}
                label="الوسوم (افصل بفاصلة)"
              />
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className={selectClass}
                placeholder="مثال: صيانة, توريد, عاجل"
              />
              {tagsPreview.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagsPreview.map((t) => (
                    <span key={t} className={ws.chip}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <FormRowLabel
                icon={<User2 className="w-4 h-4" />}
                label={spaceLabel}
              />
              <GlassSelect
                value={spaceId}
                onChange={setSpaceId}
                options={spaceOptions}
                className="mt-2"
                buttonClassName="px-4 py-3"
              />
              {requireSpace && !spaceId ? (
                <div className="mt-2 text-xs text-red-700 dark:text-red-300">المساحة مطلوبة</div>
              ) : null}
            </div>
          </div>
        </div>

        {rightChildren}

        <div className="h-6 lg:hidden" />
      </div>
    </>
  );
}
