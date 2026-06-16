import * as React from "react";
import { authedFetch } from "@/utils/apiAuth";
import { compressImage } from "@/utils/compressImage";

function useUpload() {
  const [loading, setLoading] = React.useState(false);

  const MAX_UPLOAD_BYTES = 90 * 1024 * 1024; // 90MB

  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);

      const readErrorMessage = async (res) => {
        // Prefer JSON { error } but fall back to plain text.
        // IMPORTANT: clone() the response because body streams can only be read once.
        try {
          const maybeJson = await res.clone().json();
          if (maybeJson?.error) {
            return String(maybeJson.error);
          }
        } catch {
          // ignore
        }

        try {
          const t = await res.clone().text();
          if (t) {
            return t;
          }
        } catch {
          // ignore
        }

        return `Upload failed (${res.status} ${res.statusText})`;
      };

      const isNetworkLikeError = (err) => {
        const msg = err instanceof Error ? err.message : String(err || "");
        const lower = msg.toLowerCase();
        // Browsers differ (Chrome: "Failed to fetch", Safari/iOS: "Load failed")
        return (
          lower.includes("failed to fetch") ||
          lower.includes("load failed") ||
          lower.includes("networkerror") ||
          lower.includes("network error") ||
          lower.includes("the network connection")
        );
      };

      const uploadChunked = async (file) => {
        // Keep chunks VERY small because Anything Functions can reject bigger payloads
        // with FUNCTION_PAYLOAD_TOO_LARGE (varies by environment).
        const CHUNK_SIZE = 128 * 1024; // 128KB (safer across environments)
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        const initRes = await authedFetch("/api/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || null,
            sizeBytes: file.size,
            totalChunks,
          }),
        });
        if (!initRes.ok) {
          const msg = await readErrorMessage(initRes);
          throw new Error(
            msg ||
              `When POSTing /api/uploads/init, the response was [${initRes.status}] ${initRes.statusText}`,
          );
        }
        const initData = await initRes.json().catch(() => ({}));
        const uploadId = initData?.uploadId;
        if (!uploadId) {
          throw new Error("فشل بدء رفع الملف");
        }

        try {
          // Upload chunks with bounded concurrency instead of one
          // strictly-sequential round-trip at a time. Each chunk is
          // tiny (128KB) but the per-request latency dominates over
          // a phone connection, so firing several in parallel cuts
          // wall-clock roughly N-fold. Cap kept modest so we don't
          // overwhelm the function/DB or trip rate limits.
          const CONCURRENCY = 6;
          const uploadOneChunk = async (i) => {
            const start = i * CHUNK_SIZE;
            const end = Math.min(file.size, start + CHUNK_SIZE);
            const slice = file.slice(start, end);
            const arrayBuffer = await slice.arrayBuffer();

            const chunkRes = await authedFetch(
              `/api/uploads/${uploadId}/chunk?index=${i}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/octet-stream",
                },
                body: arrayBuffer,
              },
            );

            if (!chunkRes.ok) {
              const msg = await readErrorMessage(chunkRes);
              throw new Error(
                msg ||
                  `When POSTing a chunk, the response was [${chunkRes.status}] ${chunkRes.statusText}`,
              );
            }
          };

          for (let base = 0; base < totalChunks; base += CONCURRENCY) {
            const batch = [];
            for (
              let i = base;
              i < Math.min(base + CONCURRENCY, totalChunks);
              i += 1
            ) {
              batch.push(uploadOneChunk(i));
            }
            // If any chunk in the batch fails, the whole upload aborts
            // (the catch below cleans up the session).
            await Promise.all(batch);
          }

          const completeRes = await authedFetch(`/api/uploads/${uploadId}/complete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totalChunks }),
          });
          if (!completeRes.ok) {
            const msg = await readErrorMessage(completeRes);
            throw new Error(
              msg ||
                `When POSTing /api/uploads/${uploadId}/complete, the response was [${completeRes.status}] ${completeRes.statusText}`,
            );
          }
          const completeData = await completeRes.json().catch(() => ({}));
          return {
            url: completeData?.url,
            mimeType: completeData?.mimeType || file.type || null,
          };
        } catch (e) {
          // best-effort cleanup
          try {
            await authedFetch(`/api/uploads/${uploadId}`, { method: "DELETE" });
          } catch {
            // ignore
          }
          throw e;
        }
      };

      if ("file" in input && input.file) {
        // Downscale + re-encode photos before chunking. A receipt
        // shot at 8MB becomes ~300KB, turning a 60-chunk sequential
        // upload into a 2–3 chunk one. No-op for non-images, tiny
        // images, or anything the browser can't decode. `unoptimized`
        // lets a caller opt out (e.g. originals that must stay exact).
        const file = input.unoptimized
          ? input.file
          : await compressImage(input.file);

        if (typeof file?.size === "number" && file.size > MAX_UPLOAD_BYTES) {
          throw new Error(
            `Upload failed: File too large. الحد الأقصى ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB`,
          );
        }

        // Always use chunked upload through our own /api/uploads/* endpoints.
        const chunked = await uploadChunked(file);
        return { url: chunked.url, mimeType: chunked.mimeType || null };
      } else if ("url" in input) {
        // Fetch the remote URL and convert to a File, then chunked upload.
        const remoteRes = await fetch(input.url);
        if (!remoteRes.ok) {
          throw new Error(`تعذر تحميل الرابط (${remoteRes.status})`);
        }
        const blob = await remoteRes.blob();
        const fileName =
          (input.url.split("/").pop() || "file").split("?")[0] || "file";
        const file = new File([blob], fileName, {
          type: blob.type || "application/octet-stream",
        });
        const chunked = await uploadChunked(file);
        return { url: chunked.url, mimeType: chunked.mimeType || null };
      } else if ("base64" in input) {
        // Decode base64 (with optional data: prefix) into a File, then upload.
        const raw = String(input.base64 || "");
        let mime = "application/octet-stream";
        let b64Body = raw;
        const m = raw.match(/^data:([^;]+);base64,(.*)$/);
        if (m) {
          mime = m[1];
          b64Body = m[2];
        }
        const binary = atob(b64Body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "upload.bin", { type: mime });
        const chunked = await uploadChunked(file);
        return { url: chunked.url, mimeType: chunked.mimeType || null };
      } else {
        // Raw buffer
        const buf = input.buffer;
        const file = new File([buf], "upload.bin", {
          type: "application/octet-stream",
        });
        const chunked = await uploadChunked(file);
        return { url: chunked.url, mimeType: chunked.mimeType || null };
      }
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : null;
      const msgLower = msg ? msg.toLowerCase() : "";
      if (
        msgLower.includes("failed to fetch") ||
        msgLower.includes("load failed")
      ) {
        return {
          error:
            "فشل الاتصال بخدمة رفع الملفات. تأكد من الإنترنت ثم جرّب مرة ثانية.",
        };
      }

      if (uploadError instanceof Error) {
        return { error: uploadError.message };
      }
      if (typeof uploadError === "string") {
        return { error: uploadError };
      }
      return { error: "Upload failed" };
    } finally {
      setLoading(false);
    }
  }, []);

  return [upload, { loading }];
}

export { useUpload };
export default useUpload;
