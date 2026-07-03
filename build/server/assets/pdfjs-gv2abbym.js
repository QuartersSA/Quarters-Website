import * as pdfjs from 'pdfjs-dist';

function WorkerWrapper(options) {
            return new Worker(
              "/assets/pdf.worker.entry-BfshONyD.js",
              {
          
          name: options?.name
        }
            );
          }

let workerReady = false;
function ensureWorker() {
  if (workerReady) return;
  pdfjs.GlobalWorkerOptions.workerPort = new WorkerWrapper();
  workerReady = true;
}

// Full text + VISUAL LINES. Table extraction needs rows: text items
// sharing (roughly) one Y coordinate form a visual line, ordered by X.
// Returns { text, lines } or undefined when the file has no readable
// text (e.g. a scanned image) or fails to parse.
const extractPdfDetails = async file => {
  try {
    ensureWorker();
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data
    }).promise;
    let extractedText = "";
    const lines = [];
    const pageLines = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items.filter(item => "str" in item && String(item.str).trim().length > 0);
      extractedText += items.map(item => item.str).join(" ") + "\n";

      // Group by Y (3.5-unit tolerance covers sub/superscripts and
      // slight baseline jitter), top to bottom, then order each row's
      // runs by X.
      const rows = [];
      for (const item of items) {
        const y = item.transform?.[5] ?? 0;
        const x = item.transform?.[4] ?? 0;
        let row = rows.find(r => Math.abs(r.y - y) <= 3.5);
        if (!row) {
          row = {
            y,
            parts: []
          };
          rows.push(row);
        }
        row.parts.push({
          x,
          str: item.str
        });
      }
      rows.sort((a, b) => b.y - a.y);
      const current = [];
      for (const row of rows) {
        row.parts.sort((a, b) => a.x - b.x);
        // Join runs by their real horizontal gap: Arabic PDFs often
        // emit ONE GLYPH per run, and a blind " " join spells words
        // like "و ح د ة". Runs that touch get concatenated directly.
        let line = "";
        let prevEnd = null;
        for (const part of row.parts) {
          const gap = prevEnd === null ? 0 : part.x - prevEnd;
          if (line && gap > 1.5) line += " ";
          line += part.str;
          prevEnd = part.x + (part.width || 0);
        }
        // NFKC folds Arabic presentation forms (ﻮ→و); strip replacement
        // and private-use glyphs (fonts without a ToUnicode map).
        line = line.normalize("NFKC").replace(/[�-]/g, "").replace(/\s{2,}/g, " ").trim();
        if (line) {
          lines.push(line);
          current.push(line);
        }
      }
      pageLines.push(current);
    }
    const trimmed = extractedText.trim();
    if (trimmed.length === 0) return undefined;
    return {
      text: trimmed,
      lines,
      pageLines
    };
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return undefined;
  }
};

// Back-compat: plain text only.
const extractTextFromPDF = async file => {
  const details = await extractPdfDetails(file);
  return details?.text;
};

export { extractPdfDetails, extractTextFromPDF };
