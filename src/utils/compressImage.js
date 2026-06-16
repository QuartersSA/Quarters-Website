// Client-side image downscale + re-encode before upload.
//
// Phone cameras produce 3–12MB JPEGs at 4000px+. Our chunked
// uploader pushes those in 128KB slices over sequential HTTP
// round-trips, so a single receipt photo can take 30–60s. Receipts
// and deduction attachments only need to be legible, not
// full-resolution — downscaling the longest edge to ~1600px and
// re-encoding as JPEG q≈0.72 typically cuts an 8MB photo to
// ~250–450KB (a 20–40× reduction), which collapses the upload to a
// 2–4 chunk round-trip.
//
// Non-image files, tiny images, and anything the browser can't
// decode pass through UNTOUCHED — the caller still gets a valid
// File back, so this is always safe to wrap an upload with.

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.72;
// Below this, compressing is pointless overhead — ship as-is.
const SKIP_BELOW_BYTES = 400 * 1024; // 400KB

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } else {
      // Very old browsers: fall back to dataURL → Blob.
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const [meta, b64] = dataUrl.split(",");
        const mime = (meta.match(/:(.*?);/) || [])[1] || type;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        resolve(new Blob([bytes], { type: mime }));
      } catch {
        resolve(null);
      }
    }
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

/**
 * Returns a (possibly) smaller File. Always resolves to a usable
 * File — never throws to the caller; on any failure it returns the
 * original input untouched.
 *
 * @param {File} file
 * @param {{maxEdge?: number, quality?: number}} [opts]
 */
export async function compressImage(file, opts = {}) {
  try {
    if (typeof window === "undefined" || !file) return file;
    const type = file.type || "";
    // Only raster photos benefit. Skip SVG (vector — rasterizing
    // would degrade it) and any non-image.
    if (!type.startsWith("image/") || type === "image/svg+xml") {
      return file;
    }
    // GIF may be animated; canvas re-encode would flatten to one
    // frame. Leave it alone.
    if (type === "image/gif") return file;

    if (typeof file.size === "number" && file.size > 0 && file.size < SKIP_BELOW_BYTES) {
      return file;
    }

    const maxEdge = opts.maxEdge || DEFAULT_MAX_EDGE;
    const quality = opts.quality || DEFAULT_QUALITY;

    const img = await loadImage(file);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return file;

    const longest = Math.max(w, h);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Always re-encode to JPEG — PNG photos balloon, and we don't
    // need alpha on a receipt/attachment. Keeps the pipeline simple.
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob || !blob.size) return file;

    // If compression somehow produced a bigger file (already-tiny
    // or already-optimized source), keep the original.
    if (typeof file.size === "number" && blob.size >= file.size) {
      return file;
    }

    const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    // Any failure → original file, upload still works.
    return file;
  }
}

export default compressImage;
