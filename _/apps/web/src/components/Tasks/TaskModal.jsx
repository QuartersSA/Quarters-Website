import { useCallback, useEffect, useRef, useState } from "react";
import { useTaskFormState } from "@/hooks/useTaskFormState";
import { useTaskHistory } from "@/hooks/useTaskHistory";
import { useTaskUpdates } from "@/hooks/useTaskUpdates";
import { useTaskAttachments } from "@/hooks/useTaskAttachments";
import { useTaskAttachmentsUpload } from "@/hooks/useTaskAttachmentsUpload";
import { TaskModalHeader } from "./TaskModal/TaskModalHeader";
import { TaskModalFooter } from "./TaskModal/TaskModalFooter";
import { TaskFormFields } from "./TaskModal/TaskFormFields";
import { TaskImageAttachment } from "./TaskModal/TaskImageAttachment";
import { TaskUpdatesSection } from "./TaskModal/TaskUpdatesSection";
import { TaskHistorySection } from "./TaskModal/TaskHistorySection";
import { SubtasksSection } from "./TaskModal/SubtasksSection";
import { ws } from "@/components/Workspace/ui";
import { GitBranch } from "lucide-react";

// ADD helper loader pieces to keep react-query hooks out of TaskModal itself
function TaskHistoryLoader({
  taskId,
  viewerEmployeeId,
  spaceNameById,
  userNameById,
}) {
  const historyQuery = useTaskHistory(taskId, viewerEmployeeId, true);
  const events = historyQuery.data?.events || [];

  return (
    <TaskHistorySection
      events={events}
      isLoading={historyQuery.isLoading}
      error={historyQuery.error}
      viewerEmployeeId={viewerEmployeeId}
      spaceNameById={spaceNameById}
      userNameById={userNameById}
    />
  );
}

function TaskUpdatesLoader({
  mode,
  taskId,
  viewerEmployeeId,
  // NEW: controlled draft update state (saved via main submit)
  draftBody,
  setDraftBody,
  draftAttachments,
  draftAttachmentsError,
  uploadingDraftAttachments,
  draftFileInputRef,
  onPickDraftFiles,
  onDraftFilesSelected,
  removeDraftAt,
  clearDraftAll,
  draftSummaryText,
  draftMaxCount,
  draftMaxMb,
}) {
  const {
    updates,
    isLoading: updatesLoading,
    error: updatesError,
  } = useTaskUpdates(taskId, viewerEmployeeId, true);

  return (
    <TaskUpdatesSection
      mode={mode}
      taskId={taskId}
      viewerEmployeeId={viewerEmployeeId}
      updates={updates}
      isLoading={updatesLoading}
      error={updatesError}
      draftBody={draftBody}
      setDraftBody={setDraftBody}
      attachments={draftAttachments}
      attachmentsError={draftAttachmentsError}
      uploadingAttachments={uploadingDraftAttachments}
      fileInputRef={draftFileInputRef}
      onPickFiles={onPickDraftFiles}
      onFilesSelected={onDraftFilesSelected}
      removeAt={removeDraftAt}
      clearAll={clearDraftAll}
      summaryText={draftSummaryText}
      maxCount={draftMaxCount}
      maxMb={draftMaxMb}
    />
  );
}

function TaskAttachmentsLoader({ taskId, viewerEmployeeId, onLoaded }) {
  const q = useTaskAttachments(taskId, viewerEmployeeId, true);

  useEffect(() => {
    const list = q.data?.attachments;
    if (Array.isArray(list)) {
      onLoaded(list);
    }
  }, [q.data, onLoaded]);

  return null;
}

export function TaskModal({
  mode,
  users,
  spaces,
  initialTask,
  onClose,
  onSubmit,
  onDelete,
  submitting,
  submitError,
  showAssignees = true,
  viewerEmployeeId,
  allTasks,
  onOpenSubtask,
  onGoToParent,
}) {
  const safeUsersList = Array.isArray(users) ? users : [];
  const safeSpacesList = Array.isArray(spaces) ? spaces : [];

  const formState = useTaskFormState(initialTask);

  const createdByName = initialTask?.created_by_name || null;
  const createdAt = initialTask?.created_at || null;

  // Detect if this is a subtask
  const isSubtask = !!initialTask?.parent_task_id;
  const parentTaskId = initialTask?.parent_task_id || null;
  const safeAllTasks = Array.isArray(allTasks) ? allTasks : [];
  const parentTask = parentTaskId
    ? safeAllTasks.find((t) => t.id === parentTaskId)
    : null;
  const parentTaskTitle = parentTask?.title || null;

  const {
    attachments,
    setAttachments,
    error: attachmentsError,
    uploading: uploadingAttachments,
    fileInputRef,
    onPickFiles,
    onFilesSelected,
    removeAt,
    clearAll,
    summaryText,
    maxCount,
    maxMb,
  } = useTaskAttachmentsUpload({ maxCount: 10, maxMb: 60 });

  const loadedAttachmentsForTaskIdRef = useRef(null);

  // Seed attachments from initialTask immediately (legacy fields), then loader will replace from DB if needed
  useEffect(() => {
    loadedAttachmentsForTaskIdRef.current = null;

    if (initialTask?.image_url) {
      setAttachments([
        {
          url: initialTask.image_url,
          mimeType: initialTask.image_mime_type || null,
          name: initialTask.image_name || null,
          sizeBytes: null,
        },
      ]);
    } else {
      clearAll();
    }
  }, [
    initialTask?.id,
    initialTask?.image_url,
    initialTask?.image_mime_type,
    initialTask?.image_name,
    setAttachments,
    clearAll,
  ]);

  const taskId = initialTask?.id;
  const canLoadExtras = mode === "edit" && !!taskId && !!viewerEmployeeId;

  const handleLoadedAttachments = useCallback(
    (list) => {
      if (!taskId) return;
      if (loadedAttachmentsForTaskIdRef.current === taskId) return;

      setAttachments(list);
      loadedAttachmentsForTaskIdRef.current = taskId;
    },
    [setAttachments, taskId],
  );

  const isCreate = mode !== "edit";
  const requireDueDate = isCreate;
  const requireSpace = isCreate;

  const titleOk = formState.title.trim().length > 0;
  const dueOk = !requireDueDate || !!formState.dueDate;
  const spaceOk = !requireSpace || !!formState.spaceId;

  const canSubmit = titleOk && dueOk && spaceOk;

  // NEW: draft update (note) saved with the same "تحديث المهمة" button
  const [draftUpdateBody, setDraftUpdateBody] = useState("");

  const {
    attachments: draftUpdateAttachments,
    error: draftUpdateAttachmentsError,
    uploading: uploadingDraftUpdateAttachments,
    fileInputRef: draftUpdateFileInputRef,
    onPickFiles: onPickDraftUpdateFiles,
    onFilesSelected: onDraftUpdateFilesSelected,
    removeAt: removeDraftUpdateAttachmentAt,
    clearAll: clearDraftUpdateAttachments,
    summaryText: draftUpdateAttachmentsSummary,
    maxCount: draftUpdateMaxCount,
    maxMb: draftUpdateMaxMb,
  } = useTaskAttachmentsUpload({ maxCount: 10, maxMb: 60 });

  // Reset draft update when switching tasks / opening the modal
  useEffect(() => {
    setDraftUpdateBody("");
    clearDraftUpdateAttachments();
  }, [initialTask?.id, mode, clearDraftUpdateAttachments]);

  let validationMessage = null;
  if (!titleOk) {
    validationMessage = "عنوان المهمة مطلوب";
  } else if (isCreate && !dueOk && !spaceOk) {
    validationMessage = "تاريخ الاستحقاق والمساحة مطلوبة";
  } else if (isCreate && !dueOk) {
    validationMessage = "تاريخ الاستحقاق مطلوب";
  } else if (isCreate && !spaceOk) {
    validationMessage = "المساحة مطلوبة";
  }

  // NEW: disable saving while files are uploading (task attachments OR update attachments)
  const isUploadingAnyAttachments =
    uploadingAttachments ||
    (mode === "edit" ? uploadingDraftUpdateAttachments : false);

  const canSubmitNow = canSubmit && !isUploadingAnyAttachments;

  let finalValidationMessage = validationMessage;
  if (!finalValidationMessage && isUploadingAnyAttachments) {
    finalValidationMessage = "جاري رفع الملفات… انتظر شوي";
  }

  const submit = () => {
    if (!canSubmitNow) {
      return;
    }

    const payload = {
      title: formState.title.trim(),
      description: formState.description,
      status: formState.status,
      priority: formState.priority,
      dueDate: formState.dueDate || null,
      spaceId: formState.spaceId ? Number(formState.spaceId) : null,
      tags: formState.tagsText,
      attachments: attachments.map((a) => ({
        url: a.url,
        mimeType: a.mimeType || null,
        name: a.name || null,
        sizeBytes: a.sizeBytes || null,
      })),
      closeNotCompleted: !!formState.closeNotCompleted,
      ...(showAssignees ? { assigneeEmployeeIds: formState.assigneeIds } : {}),
    };

    // If user wrote a draft update or attached files in "ملاحظات وتحديثات", include it.
    // It will be saved together when pressing the main button.
    if (mode === "edit") {
      const bodyText = String(draftUpdateBody || "").trim();
      const atts = Array.isArray(draftUpdateAttachments)
        ? draftUpdateAttachments
        : [];

      const updateAttachmentsPayload = atts
        .map((a) => ({
          url: a?.url,
          mimeType: a?.mimeType || null,
          name: a?.name || null,
          sizeBytes: a?.sizeBytes || null,
        }))
        .filter((a) => !!a.url);

      const hasDraftUpdate =
        bodyText.length > 0 || updateAttachmentsPayload.length > 0;

      if (hasDraftUpdate) {
        payload.taskUpdate = {
          body: bodyText,
          attachments: updateAttachmentsPayload,
        };
      }
    }

    onSubmit(payload);
  };

  const spaceNameById = (id) => {
    if (!id) return "بدون مساحة";
    const match = safeSpacesList.find((s) => String(s.id) === String(id));
    return match?.name ? String(match.name) : `#${id}`;
  };

  const userNameById = (id) => {
    if (!id) return "—";
    const match = safeUsersList.find((u) => String(u.id) === String(id));
    return match?.name ? String(match.name) : `#${id}`;
  };

  const overlayClass =
    "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-stretch sm:items-center justify-center p-0 sm:p-4";

  const shellClass = `w-full sm:max-w-2xl ${ws.glass} ${ws.card} overflow-hidden flex flex-col h-[100svh] sm:h-auto sm:max-h-[calc(100svh-2rem)]`;

  // Prevent any accidental horizontal overflow (often shows up as a bottom bar on mobile)
  const bodyClass =
    "flex-1 overflow-y-auto overflow-x-hidden overscroll-contain";

  return (
    <div className={overlayClass}>
      <div className={shellClass} dir="rtl">
        <TaskModalHeader
          mode={mode}
          onClose={onClose}
          isSubtask={isSubtask}
          parentTaskTitle={parentTaskTitle}
          onGoToParent={onGoToParent}
        />

        <div className={bodyClass}>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
            <TaskFormFields
              {...formState}
              createdByName={createdByName}
              createdAt={createdAt}
              requireDueDate={requireDueDate}
              requireSpace={requireSpace}
              showAssignees={showAssignees}
              users={safeUsersList}
              spaces={safeSpacesList}
              rightChildren={
                canLoadExtras ? (
                  <TaskHistoryLoader
                    taskId={taskId}
                    viewerEmployeeId={viewerEmployeeId}
                    spaceNameById={spaceNameById}
                    userNameById={userNameById}
                  />
                ) : null
              }
            >
              {canLoadExtras ? (
                <TaskAttachmentsLoader
                  taskId={taskId}
                  viewerEmployeeId={viewerEmployeeId}
                  onLoaded={handleLoadedAttachments}
                />
              ) : null}

              <TaskImageAttachment
                attachments={attachments}
                error={attachmentsError}
                uploading={uploadingAttachments}
                fileInputRef={fileInputRef}
                onPickFiles={onPickFiles}
                onFilesSelected={onFilesSelected}
                removeAt={removeAt}
                clearAll={clearAll}
                summaryText={summaryText}
                maxCount={maxCount}
                maxMb={maxMb}
              />

              {canLoadExtras ? (
                <SubtasksSection
                  taskId={taskId}
                  viewerEmployeeId={viewerEmployeeId}
                  users={safeUsersList}
                  allTasks={allTasks}
                  onOpenSubtask={onOpenSubtask}
                />
              ) : null}

              {canLoadExtras ? (
                <TaskUpdatesLoader
                  mode={mode}
                  taskId={taskId}
                  viewerEmployeeId={viewerEmployeeId}
                  draftBody={draftUpdateBody}
                  setDraftBody={setDraftUpdateBody}
                  draftAttachments={draftUpdateAttachments}
                  draftAttachmentsError={draftUpdateAttachmentsError}
                  uploadingDraftAttachments={uploadingDraftUpdateAttachments}
                  draftFileInputRef={draftUpdateFileInputRef}
                  onPickDraftFiles={onPickDraftUpdateFiles}
                  onDraftFilesSelected={onDraftUpdateFilesSelected}
                  removeDraftAt={removeDraftUpdateAttachmentAt}
                  clearDraftAll={clearDraftUpdateAttachments}
                  draftSummaryText={draftUpdateAttachmentsSummary}
                  draftMaxCount={draftUpdateMaxCount}
                  draftMaxMb={draftUpdateMaxMb}
                />
              ) : (
                <TaskUpdatesSection
                  mode={mode}
                  taskId={taskId}
                  viewerEmployeeId={viewerEmployeeId}
                  updates={[]}
                  isLoading={false}
                  error={null}
                  draftBody={draftUpdateBody}
                  setDraftBody={setDraftUpdateBody}
                  attachments={draftUpdateAttachments}
                  attachmentsError={draftUpdateAttachmentsError}
                  uploadingAttachments={uploadingDraftUpdateAttachments}
                  fileInputRef={draftUpdateFileInputRef}
                  onPickFiles={onPickDraftUpdateFiles}
                  onFilesSelected={onDraftUpdateFilesSelected}
                  removeAt={removeDraftUpdateAttachmentAt}
                  clearAll={clearDraftUpdateAttachments}
                  summaryText={draftUpdateAttachmentsSummary}
                  maxCount={draftUpdateMaxCount}
                  maxMb={draftUpdateMaxMb}
                />
              )}
            </TaskFormFields>
          </div>
        </div>

        <TaskModalFooter
          mode={mode}
          initialTask={initialTask}
          canSubmit={canSubmitNow}
          submitting={submitting}
          submitError={submitError}
          validationMessage={finalValidationMessage}
          onSubmit={submit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
