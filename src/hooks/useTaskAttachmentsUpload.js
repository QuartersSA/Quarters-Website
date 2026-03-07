import { useCallback, useMemo, useRef, useState } from "react";
import useUpload from "@/utils/useUpload";

function bytesToMb(bytes) {
  if (!bytes || typeof bytes !== "number") return null;
  return bytes / (1024 * 1024);
}

export function useTaskAttachmentsUpload({ maxCount = 10, maxMb = 60 } = {}) {
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [upload, { loading }] = useUpload();

  const uploading = !!loading;

  const canAddMore = attachments.length < maxCount;

  const inputAccept = "*/*";

  const onPickFiles = useCallback(() => {
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, []);

  const removeAt = useCallback((idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
    setError(null);
  }, []);

  const setInitialAttachments = useCallback(
    (list) => {
      const safe = Array.isArray(list) ? list : [];
      const normalized = safe
        .map((a) => {
          if (!a) return null;
          const url = String(a.url || "").trim();
          if (!url) return null;
          const mimeType = a.mimeType ? String(a.mimeType) : null;
          const name = a.name ? String(a.name) : null;
          const sizeBytes =
            a.sizeBytes === null || a.sizeBytes === undefined
              ? null
              : Number(a.sizeBytes);

          return {
            url,
            mimeType: mimeType || null,
            name: name || null,
            sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
          };
        })
        .filter(Boolean)
        .slice(0, maxCount);

      setAttachments(normalized);
      setError(null);
    },
    [maxCount],
  );

  const onFilesSelected = useCallback(
    async (e) => {
      try {
        setError(null);

        const fileList = e?.target?.files;
        const picked = fileList ? Array.from(fileList) : [];
        if (picked.length === 0) return;

        if (!canAddMore) {
          setError(`وصلت الحد الأقصى للمرفقات (${maxCount})`);
          return;
        }

        const available = maxCount - attachments.length;
        const files = picked.slice(0, available);

        for (const file of files) {
          if (!file) continue;

          if (typeof file.size === "number") {
            const sizeMb = bytesToMb(file.size);
            if (sizeMb !== null && sizeMb > maxMb) {
              setError(
                `حجم الملف ${sizeMb.toFixed(1)}MB — الحد الأقصى ${maxMb}MB`,
              );
              return;
            }
          }

          const result = await upload({ file });
          if (result?.error) {
            const msg = String(result.error || "");
            const msgLower = msg.toLowerCase();

            const isMaxBytesExceeded =
              msgLower.includes("file too large") ||
              msgLower.includes("max") ||
              msgLower.includes("413");

            const isFunctionPayloadLimit =
              msgLower.includes("function_payload_too_large") ||
              msgLower.includes("request entity too large");

            const friendly = isFunctionPayloadLimit
              ? "فشل رفع الملف لأن المنصة رفضت حجم البيانات في أحد الطلبات. جرّب مرة ثانية — وإذا استمرت المشكلة قلّي."
              : isMaxBytesExceeded
                ? `حجم الملف كبير جدًا. الحد الأقصى ${maxMb}MB.`
                : msg || "فشل رفع الملف";

            setError(friendly);
            return;
          }

          setAttachments((prev) => {
            // de-dupe by url
            const url = result.url || null;
            if (!url) return prev;
            if (prev.some((a) => a.url === url)) return prev;

            const next = [
              ...prev,
              {
                url,
                mimeType: result.mimeType || file.type || null,
                name: file.name || null,
                sizeBytes: typeof file.size === "number" ? file.size : null,
              },
            ];

            return next.slice(0, maxCount);
          });
        }

        if (picked.length > available) {
          setError(
            `تم اختيار ${picked.length} ملف، وتم أخذ أول ${available} فقط.`,
          );
        }
      } catch (err) {
        console.error(err);
        setError("فشل رفع الملفات");
      }
    },
    [attachments.length, canAddMore, maxCount, maxMb, upload],
  );

  const summaryText = useMemo(() => {
    if (attachments.length === 0) return "لا يوجد مرفقات.";
    return `عدد المرفقات: ${attachments.length} / ${maxCount}`;
  }, [attachments.length, maxCount]);

  return {
    attachments,
    setAttachments: setInitialAttachments,
    error,
    uploading,
    canAddMore,
    fileInputRef,
    inputAccept,
    onPickFiles,
    onFilesSelected,
    removeAt,
    clearAll,
    summaryText,
    maxCount,
    maxMb,
  };
}
