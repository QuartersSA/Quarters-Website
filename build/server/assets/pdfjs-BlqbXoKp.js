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

// Returns the PDF's text layer as one string (pages separated by
// newlines) or undefined when the file has no readable text (e.g. a
// scanned image) or fails to parse.
const extractTextFromPDF = async file => {
  try {
    ensureWorker();
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data
    }).promise;
    let extractedText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => "str" in item ? item.str : "").join(" ");
      extractedText += pageText + "\n";
    }
    const trimmed = extractedText.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return undefined;
  }
};

export { extractTextFromPDF };
