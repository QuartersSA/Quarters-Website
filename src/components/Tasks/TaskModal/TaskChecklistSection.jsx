import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Plus,
  Trash2,
  Square,
  CheckSquare2,
  Loader2,
  User2,
  CalendarDays,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassPopover from "@/components/Workspace/GlassPopover";
import GlassDatePicker from "@/components/Workspace/GlassDatePicker";

/* ─── Helpers ─── */
function parseDateStr(raw) {
  if (!raw) return null;
  const str =
    typeof raw === "string" && raw.includes("T") ? raw.split("T")[0] : raw;
  return String(str);
}

function formatShortDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function isDateOverdue(dateStr) {
  if (!dateStr) return false;
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  } catch {
    return false;
  }
}

/* ─── Inline assignee picker (compact) ─── */
function ChecklistAssigneePicker({ value, users, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);

  const selectedUser = useMemo(() => {
    if (!value) return null;
    return (users || []).find((u) => String(u.id) === String(value)) || null;
  }, [value, users]);

  const label = selectedUser?.name || null;

  const btnClass = label
    ? "bg-sky-400/10 border border-sky-400/20 text-sky-200"
    : "bg-white/[0.04] border border-white/10 text-white/40 hover:text-white/60";

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        className={`flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] transition-colors ${btnClass}`}
        title={label ? `المكلف: ${label}` : "اختر شخص"}
      >
        <User2 className="w-3 h-3" />
        {label ? <span className="max-w-[60px] truncate">{label}</span> : null}
      </button>

      <GlassPopover
        open={open}
        anchorRef={btnRef}
        onClose={() => setOpen(false)}
        style={{ width: 200 }}
      >
        <div className="max-h-[200px] overflow-auto">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className={`w-full text-right px-3 py-2.5 text-sm transition-colors ${
              !value
                ? "bg-white/10 text-white"
                : "text-white/60 hover:bg-white/[0.06]"
            }`}
          >
            بدون مكلف
          </button>
          {(users || []).map((u) => {
            const active = String(u.id) === String(value);
            const rowClass = active
              ? "bg-white/10 text-white"
              : "text-white/80 hover:bg-white/[0.06]";
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onChange(u.id);
                  setOpen(false);
                }}
                className={`w-full text-right px-3 py-2.5 text-sm transition-colors ${rowClass}`}
              >
                {u.name}
              </button>
            );
          })}
        </div>
      </GlassPopover>
    </div>
  );
}

/* ─── Checklist item row ─── */
function ChecklistItemRow({
  item,
  isToggling,
  safeUsers,
  onToggle,
  onUpdateField,
  onDelete,
}) {
  const completed = item.is_completed;
  const dateOnly = parseDateStr(item.due_date);
  const dueDateDisplay = formatShortDate(dateOnly);
  const overdue = !completed && isDateOverdue(dateOnly);

  const titleClass = completed ? "line-through text-white/40" : "text-white/85";

  const spinnerIcon = <Loader2 className="w-4 h-4 text-white/40" />;
  const completedIcon = <CheckSquare2 className="w-4 h-4 text-emerald-300" />;
  const uncheckedIcon = <Square className="w-4 h-4 text-white/35" />;

  let checkIcon = uncheckedIcon;
  if (isToggling) checkIcon = spinnerIcon;
  else if (completed) checkIcon = completedIcon;

  return (
    <div className="group rounded-xl py-2 px-2 hover:bg-white/[0.04] transition-colors">
      {/* Top row: checkbox + title + delete */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggle(item.id, !completed)}
          disabled={isToggling}
          className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
        >
          {checkIcon}
        </button>

        <span className={`flex-1 text-sm ${titleClass}`}>{item.title}</span>

        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center text-white/30 hover:text-red-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom row: assignee + due date pills */}
      <div className="flex items-center gap-2 mt-1.5 mr-7">
        <ChecklistAssigneePicker
          value={item.assignee_employee_id}
          users={safeUsers}
          onChange={(newId) =>
            onUpdateField(item.id, "assignee_employee_id", newId)
          }
        />

        <GlassDatePicker
          value={dateOnly || ""}
          onChange={(v) => onUpdateField(item.id, "due_date", v || null)}
          placeholder=""
          allowClear={true}
          buttonClassName="!w-auto !min-w-0 !px-1.5 !py-0.5 !rounded-lg !text-[11px]"
        />
      </div>
    </div>
  );
}

/* ─── Main Section ─── */
export function TaskChecklistSection({ taskId, viewerEmployeeId, users }) {
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemAssignee, setNewItemAssignee] = useState(null);
  const [newItemDueDate, setNewItemDueDate] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [showAddFields, setShowAddFields] = useState(false);

  const safeUsers = Array.isArray(users) ? users : [];

  const checklistQuery = useQuery({
    queryKey: ["workspaceTaskChecklist", taskId, viewerEmployeeId],
    enabled: !!taskId && !!viewerEmployeeId,
    queryFn: async () => {
      const res = await fetch(
        `/api/workspace/tasks/${taskId}/checklist?employeeId=${viewerEmployeeId}`,
      );
      if (!res.ok) throw new Error("فشل تحميل القائمة");
      return res.json();
    },
  });

  const items = checklistQuery.data?.items || [];
  const completedCount = items.filter((i) => i.is_completed).length;
  const totalCount = items.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const invalidateChecklist = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["workspaceTaskChecklist", taskId],
    });
    queryClient.invalidateQueries({ queryKey: ["workspaceTasks"] });
  }, [queryClient, taskId]);

  const addMutation = useMutation({
    mutationFn: async ({ title, assignee_employee_id, due_date }) => {
      const res = await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          title,
          assignee_employee_id: assignee_employee_id || null,
          due_date: due_date || null,
        }),
      });
      if (!res.ok) throw new Error("فشل إضافة العنصر");
      return res.json();
    },
    onSuccess: () => {
      invalidateChecklist();
      setNewItemTitle("");
      setNewItemAssignee(null);
      setNewItemDueDate("");
      setShowAddFields(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }) => {
      const res = await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          itemId,
          is_completed: isCompleted,
        }),
      });
      if (!res.ok) throw new Error("فشل تعديل العنصر");
      return res.json();
    },
    onMutate: ({ itemId }) => setTogglingId(itemId),
    onSuccess: invalidateChecklist,
    onSettled: () => setTogglingId(null),
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ itemId, field, fieldValue }) => {
      const res = await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: viewerEmployeeId,
          itemId,
          [field]: fieldValue,
        }),
      });
      if (!res.ok) throw new Error("فشل تعديل العنصر");
      return res.json();
    },
    onSuccess: invalidateChecklist,
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId) => {
      const res = await fetch(`/api/workspace/tasks/${taskId}/checklist`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: viewerEmployeeId, itemId }),
      });
      if (!res.ok) throw new Error("فشل حذف العنصر");
      return res.json();
    },
    onSuccess: invalidateChecklist,
  });

  const handleAdd = () => {
    const title = newItemTitle.trim();
    if (!title) return;
    addMutation.mutate({
      title,
      assignee_employee_id: newItemAssignee,
      due_date: newItemDueDate || null,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleToggle = useCallback((itemId, isCompleted) => {
    toggleMutation.mutate({ itemId, isCompleted });
  }, []);

  const handleUpdateField = useCallback((itemId, field, fieldValue) => {
    updateFieldMutation.mutate({ itemId, field, fieldValue });
  }, []);

  const handleDelete = useCallback((itemId) => {
    deleteMutation.mutate(itemId);
  }, []);

  const sectionClass = `${ws.glassSoft} ${ws.card} p-4 mt-4`;
  const hasNewTitle = newItemTitle.trim().length > 0;
  const addDisabled = !hasNewTitle || addMutation.isPending;

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-emerald-200" />
          <span className="font-bold text-white text-sm tracking-tight">
            قائمة المهام الفرعية
          </span>
        </div>
        {totalCount > 0 ? (
          <span className="text-xs text-white/55">
            {completedCount}/{totalCount}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      {totalCount > 0 ? (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400/60 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Items */}
      {checklistQuery.isLoading ? (
        <div className="text-white/50 text-xs py-2">جاري التحميل…</div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              isToggling={togglingId === item.id}
              safeUsers={safeUsers}
              onToggle={handleToggle}
              onUpdateField={handleUpdateField}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add new item */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAddFields(true)}
            className={`flex-1 ${ws.input} px-3 py-2 text-sm`}
            placeholder="أضف عنصر جديد…"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={addDisabled}
            className={`${ws.btnPrimary} px-2.5 py-2 disabled:opacity-40`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Assignee + Due date for new item */}
        {showAddFields && hasNewTitle ? (
          <div className="flex items-center gap-3 mr-1">
            <div className="flex items-center gap-1.5">
              <User2 className="w-3.5 h-3.5 text-white/40" />
              <select
                value={newItemAssignee || ""}
                onChange={(e) =>
                  setNewItemAssignee(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className={`${ws.input} px-2 py-1.5 text-xs !rounded-lg !w-auto min-w-[100px]`}
              >
                <option value="">بدون مكلف</option>
                {safeUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-white/40" />
              <input
                type="date"
                value={newItemDueDate}
                onChange={(e) => setNewItemDueDate(e.target.value)}
                className={`${ws.input} px-2 py-1.5 text-xs !rounded-lg !w-auto`}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {addMutation.error ? (
        <div className="text-xs text-red-300 mt-1">
          {addMutation.error.message}
        </div>
      ) : null}
    </div>
  );
}
