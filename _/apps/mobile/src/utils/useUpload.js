import * as React from "react";

function useUpload() {
  const [loading, setLoading] = React.useState(false);

  const MAX_UPLOAD_BYTES = 90 * 1024 * 1024; // 90MB

  const upload = React.useCallback(async (input) => {
    try {
      setLoading(true);
      let response;

      const readErrorMessage = async (res) => {
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

      const uploadChunkedBlob = async (blob, meta) => {
        // Keep chunks VERY small because Anything Functions can reject bigger payloads
        // with FUNCTION_PAYLOAD_TOO_LARGE (varies by environment).
        const CHUNK_SIZE = 128 * 1024; // 128KB (safer across environments)
        const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);

        const initRes = await fetch("/api/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: meta?.fileName || "file",
            mimeType: meta?.mimeType || null,
            sizeBytes: blob.size,
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
          throw new Error("Upload init failed");
        }

        try {
          for (let i = 0; i < totalChunks; i += 1) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(blob.size, start + CHUNK_SIZE);
            const slice = blob.slice(start, end);
            const arrayBuffer = await slice.arrayBuffer();

            const chunkRes = await fetch(
              `/api/uploads/${uploadId}/chunk?index=${i}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
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
          }

          const completeRes = await fetch(`/api/uploads/${uploadId}/complete`, {
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
            mimeType: completeData?.mimeType || meta?.mimeType || null,
          };
        } catch (e) {
          try {
            await fetch(`/api/uploads/${uploadId}`, { method: "DELETE" });
          } catch {
            // ignore
          }
          throw e;
        }
      };

      if ("reactNativeAsset" in input && input.reactNativeAsset) {
        const asset = input.reactNativeAsset;

        const size =
          typeof asset?.fileSize === "number" ? asset.fileSize : null;
        if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
          throw new Error(`Upload failed: File too large. Max 90MB`);
        }

        const blobRes = await fetch(asset.uri);
        const blob = await blobRes.blob();

        if (typeof blob?.size === "number" && blob.size > MAX_UPLOAD_BYTES) {
          throw new Error(`Upload failed: File too large. Max 90MB`);
        }

        const shouldChunk =
          typeof blob?.size === "number" && blob.size > 4.5 * 1024 * 1024;
        if (shouldChunk) {
          const chunked = await uploadChunkedBlob(blob, {
            fileName: asset?.fileName || "file",
            mimeType: asset?.mimeType || blob?.type || null,
          });
          return { url: chunked.url, mimeType: chunked.mimeType || null };
        }

        // Fast path for small files.
        // IMPORTANT: /_create/api/upload expects multipart/form-data with a `file` field.
        const name = asset?.fileName || "file";
        const type =
          asset?.mimeType || blob?.type || "application/octet-stream";

        const form = new FormData();
        // RN fetch expects { uri, name, type }
        form.append("file", { uri: asset.uri, name, type });

        response = await fetch("/_create/api/upload/", {
          method: "POST",
          body: form,
        });

        if (!response.ok) {
          if (response.status === 413) {
            const chunked = await uploadChunkedBlob(blob, {
              fileName: name,
              mimeType: type,
            });
            return { url: chunked.url, mimeType: chunked.mimeType || null };
          }

          const msg = await readErrorMessage(response);
          const msgLower = String(msg || "").toLowerCase();
          if (msgLower.includes("no image provided")) {
            const chunked = await uploadChunkedBlob(blob, {
              fileName: name,
              mimeType: type,
            });
            return { url: chunked.url, mimeType: chunked.mimeType || null };
          }
        }
      } else if ("url" in input) {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: input.url }),
        });
      } else if ("base64" in input) {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ base64: input.base64 }),
        });
      } else {
        response = await fetch("/_create/api/upload/", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: input.buffer,
        });
      }

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error("Upload failed: File too large.");
        }

        const msg = await readErrorMessage(response);
        throw new Error(msg || "Upload failed");
      }

      const data = await response.json().catch(() => ({}));
      return { url: data.url, mimeType: data.mimeType || null };
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : null;
      const msgLower = msg ? msg.toLowerCase() : "";
      if (msgLower.includes("failed to fetch")) {
        return {
          error:
            "Could not reach the upload service. Please check your internet and try again.",
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
