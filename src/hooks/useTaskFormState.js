import { useEffect, useState } from "react";
import { normalizeDate, safeArray } from "@/utils/taskUtils";

const SYSTEM_DELETED_TAG = "__system_deleted__";
const SYSTEM_CLOSED_TAG = "__closed_not_completed__";

export function useTaskFormState(initialTask) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Todo");
  const [priority, setPriority] = useState("Normal");
  const [dueDate, setDueDate] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [closeNotCompleted, setCloseNotCompleted] = useState(false);

  useEffect(() => {
    if (!initialTask) {
      setTitle("");
      setDescription("");
      setStatus("Todo");
      setPriority("Normal");
      setDueDate("");
      setSpaceId("");
      setTagsText("");
      setAssigneeIds([]);
      setCloseNotCompleted(false);
      return;
    }

    setTitle(initialTask.title || "");
    setDescription(initialTask.description || "");
    setStatus(initialTask.status || "Todo");
    setPriority(initialTask.priority || "Normal");
    setDueDate(normalizeDate(initialTask.due_date) || "");
    setSpaceId(initialTask.space_id ? String(initialTask.space_id) : "");

    const tagsArr = safeArray(initialTask.tags);
    const isClosed = tagsArr.includes(SYSTEM_CLOSED_TAG);
    setCloseNotCompleted(isClosed);

    const tags = tagsArr.filter(
      (t) =>
        String(t) !== SYSTEM_DELETED_TAG && String(t) !== SYSTEM_CLOSED_TAG,
    );
    setTagsText(tags.join(", "));

    const ids = safeArray(initialTask.assignees)
      .map((a) => a?.id)
      .filter(Boolean);
    setAssigneeIds(ids);
  }, [initialTask]);

  return {
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
  };
}
