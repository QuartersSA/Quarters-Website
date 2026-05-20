/**
 * Marketing / bloggers export helpers.
 *
 * Two flavors:
 *   1. exportInvitationImage(blogger, settings, baseURL) — single PNG
 *      of the invitation card, named by blogger.
 *   2. exportInvitationsZip(bloggers, settings, baseURL) — every active
 *      + pending blogger's card rendered, captured, packed into a ZIP.
 *      Each entry inside the zip is named `<blogger>.png`.
 *   3. exportBloggersData(bloggers) — Excel/CSV with name, handle,
 *      state, activation timestamp, activated-by employee name.
 *
 * Image rasterization uses `html-to-image` (already in deps). We mount a
 * hidden React root for each card off-screen, wait one tick so QR SVG +
 * fonts settle, then `toPng`. Doing it via ReactDOM.createRoot keeps the
 * markup identical to the on-screen card — no copy-pasted JSX drift.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import { BloggerInvitationCard } from "@/components/Marketing/BloggerInvitationCard";
import { exportToExcelHTML } from "@/utils/exportUtils";
import { formatDateTime } from "@/utils/dateUtils";

// PNG capture options.
//
// pixelRatio was 2 (printable), but bulk exports of 50+ bloggers
// would crash the tab with "Out of Memory" — each 2× capture is ~4MB
// in canvas RAM + base64 string + zip entry, and JSZip holds all of
// them in memory until generateAsync runs. 1.5× still prints
// acceptably for an invitation card while cutting peak memory by
// ~44%.
//
// IMPORTANT: do NOT pass `backgroundColor` here. html-to-image applies
// that option as an inline style on the captured node itself, which
// overrides the card's `background: <accent>` and wipes the olive
// fill. The white backdrop comes from a wrapping <div> we render in
// React instead (see captureBloggerCard below).
const PNG_OPTS = {
  pixelRatio: 1.5,
  cacheBust: true,
};

// dataURL "data:image/png;base64,XXX" → Uint8Array of the raw bytes.
// JSZip accepts Uint8Array directly and stores it without holding the
// long base64 string in memory, which matters for bulk exports.
function dataUrlToBytes(dataUrl) {
  const idx = String(dataUrl).indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : "";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeFileName(name) {
  return String(name || "blogger")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function welcomeURLFor(blogger, baseURL) {
  const base = baseURL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/welcome/${blogger?.slug || ""}`;
}

/**
 * Mounts the BloggerInvitationCard into a detached, off-screen DOM
 * node, captures it as PNG via html-to-image, then unmounts. Returns
 * the PNG data URL.
 */
async function captureBloggerCard(blogger, settings, baseURL) {
  if (typeof window === "undefined") {
    throw new Error("Image export must run in the browser");
  }

  // Off-screen host. Position fixed so layout never reflows the
  // visible page. We keep it in the document so getComputedStyle works
  // (important for html-to-image font/color resolution).
  //
  // 510px = 460 card + 24px padding each side + a couple of px slack
  // so the inline-block wrapper inside doesn't wrap.
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  host.style.width = "510px";
  host.style.pointerEvents = "none";
  host.setAttribute("dir", "rtl");
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    await new Promise((resolve) => {
      // Render the card inside a white-padded wrapper. We capture the
      // wrapper so the PNG has a clean white margin around the card's
      // rounded corners + drop shadow. The wrapper's background lives
      // on a normal React DOM node — NOT on the html-to-image
      // `backgroundColor` option — so the card's own olive fill is
      // preserved.
      root.render(
        React.createElement(
          "div",
          {
            style: {
              display: "inline-block",
              background: "#ffffff",
              padding: "24px",
            },
            dir: "rtl",
          },
          React.createElement(BloggerInvitationCard, {
            blogger,
            settings,
            welcomeURL: welcomeURLFor(blogger, baseURL),
          }),
        ),
      );
      // Two RAFs: ensures React commit + browser paint before capture,
      // otherwise QR SVG can render blank in the first frame.
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    // Tiny extra grace for webfonts (Cormorant + El Messiri). The
    // <link rel="stylesheet"> on the visible page already preloads
    // them; if they haven't finished loading we fall back to the
    // serif/sans stack which still renders correctly.
    try {
      if (document.fonts && document.fonts.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 300)),
        ]);
      }
    } catch {
      // ignore — fonts.ready not supported, html-to-image will use
      // computed styles as-is.
    }

    // Capture the wrapper (white frame), which contains the card. The
    // wrapper's own DOM background is what gives the PNG its white
    // margin — much safer than the html-to-image backgroundColor
    // option, which would replace the card's olive fill.
    const node = host.firstElementChild;
    if (!node) throw new Error("card did not mount");
    return await toPng(node, PNG_OPTS);
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Single invitation PNG download. Triggers an <a download> click.
 */
export async function exportInvitationImage(blogger, settings, baseURL) {
  const dataUrl = await captureBloggerCard(blogger, settings, baseURL);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${safeFileName(blogger.name)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Render every blogger's invitation, zip them into one archive, and
 * download. Progress callback fires per-blogger so the UI can show
 * `5 / 23 …`.
 *
 * Returns the number of cards captured.
 */
export async function exportInvitationsZip(
  bloggers,
  settings,
  baseURL,
  onProgress,
) {
  if (!Array.isArray(bloggers) || bloggers.length === 0) {
    throw new Error("no bloggers to export");
  }

  const zip = new JSZip();
  const seenNames = new Map();
  let captured = 0;

  for (const b of bloggers) {
    let dataUrl = null;
    try {
      dataUrl = await captureBloggerCard(b, settings, baseURL);
      // Convert straight to bytes and drop the dataURL so the long
      // base64 string isn't held alongside the binary copy in the zip.
      const bytes = dataUrlToBytes(dataUrl);
      dataUrl = null;

      // Disambiguate duplicate names (e.g. two بلوقرز with same display
      // name) by appending the slug suffix.
      const baseName = safeFileName(b.name);
      const collisions = seenNames.get(baseName) || 0;
      seenNames.set(baseName, collisions + 1);
      const fileName =
        collisions === 0
          ? `${baseName}.png`
          : `${baseName}-${b.slug || b.id}.png`;

      zip.file(fileName, bytes);
      captured += 1;
    } catch (err) {
      // Log but keep going so one bad row doesn't kill the whole batch.
      console.error("Failed to render card for blogger", b?.id, err);
    }
    if (typeof onProgress === "function") {
      onProgress(captured, bloggers.length);
    }
    // Yield to the browser between iterations. Without this the
    // sync-heavy capture loop never lets the GC run, and large
    // batches accumulate enough canvas / cloned-DOM garbage to OOM
    // the tab. setTimeout(0) is the smallest yield that actually
    // unblocks the event loop.
    await new Promise((r) => setTimeout(r, 0));
  }

  // STORE (no DEFLATE) keeps generateAsync from re-reading every PNG
  // into a working buffer to compress — PNGs are already compressed,
  // so the deflate step buys ~0 bytes anyway. Big win on peak memory
  // for bulk exports.
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "STORE",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `quarters-bloggers-invitations-${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return captured;
}

const STATE_AR = {
  active: "مفعّلة",
  pending: "بانتظار التفعيل",
};

/**
 * Bloggers data table (name, handle, state, activation info) → Excel.
 * Uses the existing exportToExcelHTML helper so the styling matches
 * other admin exports.
 */
export function exportBloggersData(bloggers) {
  const columns = [
    {
      header: "الاسم",
      accessor: (b) => b.name || "",
    },
    {
      header: "الحساب",
      accessor: (b) => (b.handle ? `@${b.handle}` : ""),
    },
    {
      header: "رقم الجوال",
      accessor: (b) => b.phone || "",
    },
    {
      header: "الكود",
      accessor: (b) => b.slug || "",
    },
    {
      header: "الحالة",
      accessor: (b) => STATE_AR[b.state] || b.state || "",
    },
    {
      header: "وقت التفعيل",
      accessor: (b) =>
        b.state === "active" && b.activated_at
          ? formatDateTime(b.activated_at)
          : "",
    },
    {
      header: "فُعِّلت بواسطة",
      accessor: (b) =>
        b.state === "active" ? b.activated_by_employee_name || "" : "",
    },
    {
      header: "تاريخ الإنشاء",
      accessor: (b) => (b.created_at ? formatDateTime(b.created_at) : ""),
    },
    {
      header: "ملاحظة",
      accessor: (b) => b.note || "",
    },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  exportToExcelHTML(
    bloggers || [],
    `quarters-bloggers-${stamp}`,
    columns,
    "بيانات البلوقرز",
  );
}
