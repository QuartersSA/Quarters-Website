import { useCallback, useRef, useState } from "react";
import useUpload from "@/utils/useUpload";

export function useTaskImageUpload() {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageMimeType, setImageMimeType] = useState(null);
  const [imageName, setImageName] = useState(null);
  const [imageError, setImageError] = useState(null);
  const fileInputRef = useRef(null);
  const [upload, { loading: uploadingImage }] = useUpload();

  const MAX_MB = 90;

  const onPickImage = useCallback(() => {
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, []);

  const onFileSelected = useCallback(
    async (e) => {
      try {
        setImageError(null);
        const file = e?.target?.files?.[0];
        if (!file) return;

        if (typeof file.size === "number") {
          const sizeMb = file.size / (1024 * 1024);
          if (sizeMb > MAX_MB) {
            setImageError(
              `حجم الملف ${sizeMb.toFixed(1)}MB — الحد الأقصى ${MAX_MB}MB`,
            );
            return;
          }
        }

        // NOTE: allow ANY file type now (pdf/excel/images/etc)
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
            ? "فشل رفع الملف لأن المنصة رفضت حجم البيانات في أحد الطلبات. جرّب مرة ثانية — وإذا استمرت المشكلة قلّي وراح نقلل حجم الأجزاء أكثر."
            : isMaxBytesExceeded
              ? `حجم الملف كبير جدًا. الحد الأقصى ${MAX_MB}MB.`
              : msg || "فشل رفع الملف";

          setImageError(friendly);
          return;
        }

        setImageUrl(result.url || null);
        setImageMimeType(result.mimeType || file.type || null);
        setImageName(file.name || null);
      } catch (err) {
        console.error(err);
        setImageError("فشل رفع الملف");
      }
    },
    [upload],
  );

  const removeImage = useCallback(() => {
    setImageUrl(null);
    setImageMimeType(null);
    setImageName(null);
    setImageError(null);
  }, []);

  const setImage = useCallback((url, mimeType, name) => {
    setImageUrl(url);
    setImageMimeType(mimeType);
    setImageName(name || null);
    setImageError(null);
  }, []);

  return {
    imageUrl,
    imageMimeType,
    imageName,
    imageError,
    uploadingImage,
    fileInputRef,
    onPickImage,
    onFileSelected,
    removeImage,
    setImage,
  };
}
