"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  ScanLine,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ws } from "@/components/Workspace/ui";
import GlassSelect from "@/components/Workspace/GlassSelect";
import useUpload from "@/utils/useUpload";

export const PURCHASE_INVOICE_STATUS_OPTIONS = [
  { value: "new", label: "جديد" },
  { value: "pending_payment", label: "بانتظار الدفع" },
  { value: "partial_paid", label: "مدفوع جزئي" },
  { value: "paid", label: "مدفوع" },
  { value: "overdue", label: "متأخر" },
];

const WORKFLOW_OPTIONS = [
  { value: "new", label: "جديد" },
  { value: "pending_payment", label: "بانتظار الدفع" },
];

const CURRENCY_OPTIONS = [
  { value: "SAR", label: "ريال سعودي - SAR" },
  { value: "USD", label: "دولار أمريكي - USD" },
  { value: "EUR", label: "يورو - EUR" },
  { value: "AED", label: "درهم إماراتي - AED" },
  { value: "KWD", label: "دينار كويتي - KWD" },
  { value: "BHD", label: "دينار بحريني - BHD" },
  { value: "QAR", label: "ريال قطري - QAR" },
  { value: "OMR", label: "ريال عماني - OMR" },
];

function todayRiyadh() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// ---------- PDF auto-fill ----------
// Extracts invoice fields from the attached PDF's text layer.
// Heuristic (regex) based — works for digital invoices in Arabic or
// English; scanned-image PDFs have no text layer and are skipped.

// Arabic-Indic digits + separators → Latin so one money regex works.
function normalizeDigits(text) {
  return String(text || "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/٫/g, ".") // arabic decimal separator
    .replace(/٬/g, ","); // arabic thousands separator
}

const MONEY_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d{2,})/;

function parseMoneyToken(token) {
  const number = Number(String(token).replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Money value near a keyword. RTL PDFs often extract the VALUE before
// its LABEL ("630.00 :المبلغ المستحق"), so after failing the forward
// window we also look just before the keyword and take the money token
// closest to it.
function moneyAfterKeyword(text, keywords, windowAfter = 60, windowBefore = 30) {
  for (const keyword of keywords) {
    const re = new RegExp(keyword, "gi");
    let match;
    while ((match = re.exec(text)) !== null) {
      const start = match.index + match[0].length;
      const after = text.slice(start, start + windowAfter);
      const forward = after.match(MONEY_RE);
      if (forward) {
        const value = parseMoneyToken(forward[1]);
        if (value !== null) return value;
      }
      const before = text.slice(
        Math.max(0, match.index - windowBefore),
        match.index,
      );
      const backwardAll = [...before.matchAll(new RegExp(MONEY_RE.source, "g"))];
      if (backwardAll.length > 0) {
        const value = parseMoneyToken(backwardAll[backwardAll.length - 1][1]);
        if (value !== null) return value;
      }
    }
  }
  return null;
}

function detectInvoiceNumber(text) {
  const patterns = [
    /(?:رقم\s*الفاتورة|الفاتورة\s*رقم|فاتورة\s*(?:ضريبية\s*)?(?:رقم|#)|المرجع)\s*[:#]?\s*([A-Za-z0-9\-\/_.]{2,30})/gi,
    /invoice\s*(?:no|number|num|#)?\.?\s*[:#]?\s*([A-Za-z0-9\-\/_.]{2,30})/gi,
    /\b(INV[-\/]?[A-Za-z0-9][A-Za-z0-9\-]{2,24})\b/g,
  ];
  // Every occurrence is a candidate — the first "invoice" mention is
  // often the "TAX INVOICE" title, so single-match scanning misses the
  // real number further down.
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      const token = match[1].replace(/[.:،,]+$/, "");
      // "Invoice Date" style false positives
      if (/^(date|no|number|تاريخ)$/i.test(token)) continue;
      if (!/\d/.test(token)) continue;
      return token;
    }
  }
  return null;
}

function detectTotal(text) {
  // Priority: explicit grand-total phrasing first, plain "total" last.
  const value =
    moneyAfterKeyword(text, [
      "المبلغ\\s*المستحق",
      "الإجمالي\\s*المستحق",
      "الاجمالي\\s*المستحق",
      "قحتسملا\\s*غلبملا",
      "عومجملا",
      "المجموع\\s*الكلي",
      "الإجمالي\\s*(?:شامل|مع)\\s*الضريبة",
      "الاجمالي\\s*(?:شامل|مع)\\s*الضريبة",
      "grand\\s*total",
      "total\\s*(?:due|amount)",
      "amount\\s*due",
      "المجموع",
      "الإجمالي",
      "الاجمالي",
      "total",
    ]) ?? null;
  if (value !== null) return value;
  // Fallback: biggest FORMATTED money figure (decimal point or
  // thousands separator required). Plain integers are too risky —
  // postal codes, street numbers, and VAT ids all look like amounts
  // (e.g. a zip code 34436 outranking the real 630.00 total).
  let max = null;
  const re = new RegExp(MONEY_RE.source, "g");
  let match;
  while ((match = re.exec(text)) !== null) {
    if (!match[1].includes(".") && !match[1].includes(",")) continue;
    const parsed = parseMoneyToken(match[1]);
    if (parsed === null || parsed > 10000000) continue;
    if (max === null || parsed > max) max = parsed;
  }
  return max;
}

function detectTax(text) {
  return moneyAfterKeyword(text, [
    "إجمالي\\s*الضريبة",
    "اجمالي\\s*الضريبة",
    "ضريبة\\s*القيمة\\s*المضافة\\s*(?:\\(?\\s*15\\s*%?\\s*\\)?)?",
    "قيمة\\s*الضريبة",
    "vat\\s*(?:\\(?\\s*15\\s*%?\\s*\\)?)?\\s*(?:amount)?",
    "tax\\s*amount",
  ]);
}

const DATE_TOKEN_RE = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;

function normalizeDateToken(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[\/\-.]/).map(Number);
  if (parts.length !== 3) return null;
  let [day, month, year] = parts;
  // yyyy/mm/dd came in first position
  if (parts[0] > 1900) {
    [year, month, day] = parts;
  }
  if (year < 100) year += 2000;
  if (!day || !month || !year || month > 12 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Spaces between Arabic characters removed — letter-spaced extraction
// ("خ ي ر ا ت") compacts back into searchable words. NFKC first so
// presentation-form glyphs (U+FB50…U+FEFF) fold into the base range.
function compactArabic(text) {
  return String(text)
    .normalize("NFKC")
    .replace(/(?<=[؀-ۿ])\s+(?=[؀-ۿ])/g, "");
}

// Date next to a keyword: forward first, then just before it (RTL
// extraction usually puts the value BEFORE its label).
function dateNearKeyword(text, keywords) {
  for (const keyword of keywords) {
    const re = new RegExp(keyword, "gi");
    let match;
    while ((match = re.exec(text)) !== null) {
      const start = match.index + match[0].length;
      const after = text.slice(start, start + 40).match(DATE_TOKEN_RE);
      if (after) {
        const value = normalizeDateToken(after[1]);
        if (value) return value;
      }
      const before = text.slice(Math.max(0, match.index - 40), match.index);
      const backwardAll = [
        ...before.matchAll(new RegExp(DATE_TOKEN_RE.source, "g")),
      ];
      if (backwardAll.length > 0) {
        const value = normalizeDateToken(
          backwardAll[backwardAll.length - 1][1],
        );
        if (value) return value;
      }
    }
  }
  return null;
}

// Mirrored spellings included: تاريخ الإصدار arrives as رادصلإا خيرات
// in visual-order PDFs.
function detectInvoiceDate(text) {
  const compact = compactArabic(text);
  return dateNearKeyword(compact, [
    "تاريخ\\s*الفاتورة",
    "تاريخ\\s*الإصدار",
    "تاريخ\\s*الاصدار",
    "رادصلإا\\s*خيرات",
    "رادصالا\\s*خيرات",
    "ةروتافلا\\s*خيرات",
    "invoice\\s*date",
    "issue\\s*date",
    "التاريخ",
    "date",
  ]);
}

function detectDueDate(text) {
  const compact = compactArabic(text);
  return dateNearKeyword(compact, [
    "تاريخ\\s*الاستحقاق",
    "تاريخ\\s*الإستحقاق",
    "قاقحتسلاا\\s*خيرات",
    "قاقحتسالا\\s*خيرات",
    "due\\s*date",
    "payment\\s*due",
  ]);
}

function normalizeVat(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

// All VAT-registration candidates in the text: numbers following the
// VAT keywords, plus any bare Saudi-format number (15 digits starting
// and ending with 3). Invoices usually carry TWO VAT numbers (seller +
// buyer) — matching against the contacts list naturally picks the
// supplier's.
function extractVatNumbers(text) {
  const found = new Set();
  const keywordRe =
    /(?:الرقم\s*الضريبي|رقم\s*(?:التسجيل\s*)?الضريبي|السجل\s*الضريبي|vat\s*(?:reg(?:istration)?)?\s*(?:no|number|num|#)?|tax\s*(?:reg(?:istration)?)?\s*(?:no|number|num|#)|trn)\s*[.:#]?\s*([0-9][0-9\s\-]{5,25})/gi;
  for (const match of text.matchAll(keywordRe)) {
    const digits = normalizeVat(match[1]);
    if (digits.length >= 7) found.add(digits);
  }
  for (const match of text.matchAll(/\b3\d{13}3\b/g)) {
    found.add(match[0]);
  }
  return [...found];
}

// Contact resolution, most reliable first:
//   1. VAT number on the contact (الموردين والمستفيدين) appears in the
//      invoice — exact digit match.
//   2. Fallback: longest active contact whose name appears in the text.
function detectContact(text, contacts) {
  const vatNumbers = extractVatNumbers(text);
  if (vatNumbers.length > 0) {
    for (const contact of contacts) {
      if (contact.is_active === false) continue;
      const contactVat = normalizeVat(contact.vat_number);
      if (contactVat.length >= 7 && vatNumbers.includes(contactVat)) {
        return { contact, matchedBy: "vat" };
      }
    }
  }

  const lower = text.toLowerCase();
  let best = null;
  for (const contact of contacts) {
    if (contact.is_active === false) continue;
    const name = String(contact.name || "").trim();
    if (name.length >= 3 && lower.includes(name.toLowerCase())) {
      if (!best || name.length > String(best.name).length) best = contact;
    }
  }
  return best ? { contact: best, matchedBy: "name" } : null;
}

// ---------- line-item extraction ----------
// Detect product rows in the invoice table. A row qualifies when its
// numbers contain a triplet a + b ≈ c (net + VAT = line total) — the
// arithmetic survives any RTL column scrambling. Summary rows
// (المجموع/الإجمالي/total…) are excluded by keyword.
// Includes the MIRRORED spellings (يلامجلاا = الاجمالي backwards…) —
// visual-order Arabic PDFs emit summary labels reversed, and a summary
// row that slips through gets mistaken for a product row.
const SUMMARY_LINE_RE =
  /(المجموع|الإجمالي|الاجمالي|إجمالي|اجمالي|المبلغ\s*المستحق|المستحق|عومجملا|يلامجلإا|يلامجلاا|يلامجا|قحتسملا|غلبملا|sub\s*-?\s*total|grand\s*total|total\s*(?:due|amount|before)|amount\s*due|balance)/i;

// Some PDFs emit each Arabic glyph as its own run with real gaps, so
// summary labels arrive letter-spaced ("يل ا م ج لا ا") and slip past
// the keyword regex — test a compacted copy (all spaces between
// Arabic characters removed) too.
function isSummaryLine(line) {
  if (SUMMARY_LINE_RE.test(line)) return true;
  const compact = String(line).replace(
    /(?<=[؀-ۿ])\s+(?=[؀-ۿ])/g,
    "",
  );
  return SUMMARY_LINE_RE.test(compact);
}

// Wider than MONEY_RE on purpose: quantities are often single digits
// ("2") and unit prices can carry 3–4 decimals ("16.499"). Order of
// appearance is preserved — column order matters for qty/price.
const LINE_NUM_RE = /(\d{1,3}(?:,\d{3})+(?:\.\d{1,4})?|\d+\.\d{1,4}|\d{1,6})/g;

function lineNumbers(line) {
  // Kill barcodes/ids FIRST — a 12-digit barcode would otherwise
  // shatter into 6-digit chunks that pollute every numeric search.
  const scrubbed = String(line).replace(/\d{7,}/g, " ");
  const values = [];
  for (const match of scrubbed.matchAll(LINE_NUM_RE)) {
    const value = Number(String(match[1]).replace(/,/g, ""));
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function findLineTriplet(values) {
  let best = null;
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length; j += 1) {
      if (i === j) continue;
      const net = values[i];
      const tax = values[j];
      // net ≥ tax rules out (tax, net) swaps: VAT is at most 100%.
      if (net <= 0 || tax <= 0 || net < tax) continue;
      const total = net + tax;
      const hit = values.find(
        (candidate) => Math.abs(candidate - total) <= 0.03,
      );
      if (hit === undefined) continue;
      if (!best || hit > best.total) {
        best = { net: round2(net), tax: round2(tax), total: round2(hit) };
      }
    }
  }
  return best;
}

// Arabic runs extracted from visual-order PDFs come out mirrored
// ("ةدحو" for "وحدة"). Score both directions with cheap morphology
// (definite article must lead, taa marbuta must trail) and keep the
// likelier one — correctly-encoded PDFs score higher as-is and are
// left untouched.
// Small lexicon of words common on food/packaging invoices — a direct
// hit is the strongest direction signal available.
const AR_INVOICE_WORDS = new Set(
  "كيك وحدة قطعة صينية صينة علبة كرتون حبة شدة كوب أكواب اكواب حليب قهوة بن سكر شاي ماء مياه عصير شوكولاته شوكولاتة شكلاته كراميل فانيلا فانيليا توت فراولة مانجو ليمون جبن جبنة زبدة كريمة عسل تمر كعك خبز مخبوزات حلويات بسكويت دونات كرواسون معمول تراميسو تشيز لوز فستق بندق جوز كاجو مندي كوكيز مافن براونيز كوكونت بيري راز كرانشي لاتيه موكا كابتشينو اسبريسو سموذي ميلك شيك وافل بانكيك سينابون".split(
    " ",
  ),
);

function arabicDirectionScore(text) {
  let score = 0;
  for (const word of text.split(/\s+/)) {
    if (!/[؀-ۿ]/.test(word)) continue;
    if (AR_INVOICE_WORDS.has(word)) score += 3;
    if (/^ال./.test(word)) score += 2;
    if (/.[ةى]$/.test(word)) score += 2;
    if (/^[ةى]/.test(word)) score -= 3;
    if (/.ال$/.test(word)) score -= 2;
  }
  return score;
}

// Some PDFs emit each Arabic GLYPH as its own text run with real
// gaps, so geometry-based joining can't help — "وحدة" arrives as the
// tokens "ة د ح و". Two or more consecutive single-letter Arabic
// tokens are letters of one word: glue them (a lone letter like و
// "and" stays a word).
function mergeSingleLetterRuns(text) {
  const tokens = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length >= 2) out.push(buffer.join(""));
    else out.push(...buffer);
    buffer = [];
  };
  for (const token of tokens) {
    if (/^[؀-ۿ]$/.test(token)) {
      buffer.push(token);
    } else {
      flush();
      out.push(token);
    }
  }
  flush();
  return out.join(" ");
}

function fixArabicText(text) {
  return mergeSingleLetterRuns(text).replace(
    /[؀-ۿ][؀-ۿ\s]*[؀-ۿ]/g,
    (run) => {
      // The لا ligature decomposes (NFKC) to lam+alef in VISUAL order —
      // reversing it letter-by-letter would corrupt it to "ال". Treat
      // it as one unit across the flip.
      const LAM_ALEF_MARK = "";
      const reversed = [...run.split("لا").join(LAM_ALEF_MARK)]
        .reverse()
        .join("")
        .split(LAM_ALEF_MARK)
        .join("لا");
      return arabicDirectionScore(reversed) > arabicDirectionScore(run)
        ? reversed
        : run;
    },
  );
}

function cleanItemDescription(line) {
  const cleaned = line
    .replace(/\b\d{7,}\b/g, " ") // barcodes / ids
    .replace(new RegExp(MONEY_RE.source, "g"), " ")
    .replace(/\d+(?:\.\d+)?\s*%/g, " ")
    .replace(/[%#|]/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*\d+\s+/, "") // leading row index
    .trim();
  return fixArabicText(cleaned);
}

// Quantity × unit price. Division-based so it survives any column
// order (RTL extraction often reverses it): every value is tried as
// the quantity, the implied price = base ÷ qty must then appear in the
// row. Both bases are checked — net (unit prices quoted before tax)
// and gross (unit prices quoted tax-inclusive). Ranking: non-trivial
// pairs first (1 × amount is trivially true of the bare row index),
// then integer-ish quantities, then the tightest match.
function decimalsOf(value) {
  return (String(value).split(".")[1] || "").length;
}

function findQtyPrice(values, net, total) {
  const clean = values.filter((value) => value > 0 && value <= 1000000);
  let best = null;
  for (const [basis, base] of [
    ["net", net],
    ["gross", total],
  ]) {
    if (!base || base <= 0) continue;
    for (const q of clean) {
      if (q > 100000) continue;
      const impliedPrice = base / q;
      if (!Number.isFinite(impliedPrice) || impliedPrice <= 0) continue;
      for (const p of clean) {
        if (p === q && clean.filter((v) => v === q).length < 2) {
          // a single occurrence can't be both qty and price
          if (Math.abs(q * q - base) > 0.02) continue;
        }
        const diff = Math.abs(p - impliedPrice);
        if (diff > Math.max(0.02, impliedPrice * 0.003)) continue;
        const trivial = q === 1 || p === 1 ? 1 : 0;
        const qtyIsCountLike = decimalsOf(q) <= 1 ? 1 : 0;
        const candidate = {
          diff,
          trivial,
          qtyIsCountLike,
          basisIsNet: basis === "net" ? 1 : 0,
          quantity: q,
          unitPrice: p,
          basis,
        };
        if (
          !best ||
          candidate.trivial < best.trivial ||
          (candidate.trivial === best.trivial &&
            (candidate.qtyIsCountLike > best.qtyIsCountLike ||
              (candidate.qtyIsCountLike === best.qtyIsCountLike &&
                (candidate.basisIsNet > best.basisIsNet ||
                  (candidate.basisIsNet === best.basisIsNet &&
                    candidate.diff < best.diff)))))
        ) {
          best = candidate;
        }
      }
    }
  }
  return best;
}

function itemFromLine(line) {
  if (isSummaryLine(line)) return null;
  const values = lineNumbers(line);
  if (values.length < 3) return null;
  const triplet = findLineTriplet(values);
  if (!triplet) return null;
  const rate = triplet.net > 0 ? round2((triplet.tax / triplet.net) * 100) : 15;
  // Implausible VAT rate → probably a coincidence, not a product row.
  if (rate <= 0 || rate > 50) return null;
  const qtyPrice = findQtyPrice(values, triplet.net, triplet.total);
  return {
    description: cleanItemDescription(line),
    net: triplet.net,
    total: triplet.total,
    rate,
    quantity: qtyPrice?.quantity ?? null,
    unitPrice: qtyPrice?.unitPrice ?? null,
    priceIncludesTax: qtyPrice?.basis === "gross",
  };
}

// Table-header vocabulary — a line made only of these is column
// headers, not a product name.
const HEADER_WORD_RE =
  /^(vat|qty|unit|price|amount|total|discount|before|tax|products?|#|الوصف|المنتج|الكمية|السعر|الخصم|الضريبة)$/i;

// A "name line": mostly text, at most a couple of small numbers (the
// row index) — used to adopt product names printed above the numbers.
function isDescriptionLine(line) {
  if (isSummaryLine(line)) return false;
  const numbers = lineNumbers(line);
  if (numbers.length > 2) return false;
  if (numbers.some((value) => value >= 1000)) return false;
  const cleaned = cleanItemDescription(line);
  if (cleaned.length < 3) return false;
  const words = cleaned.split(/\s+/);
  if (words.every((word) => HEADER_WORD_RE.test(word))) return false;
  return true;
}

// Bilingual invoices print the product name twice — drop duplicated
// "-"-separated segments while keeping their order.
function dedupeDescription(description) {
  const segments = description
    .split(/\s+-\s+|^-\s+|\s+-$/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const segment of segments) {
    const key = segment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(segment);
  }
  let result = unique.join(" - ") || description.trim();
  // Same phrase repeated back-to-back (bilingual layouts print the
  // name twice) — collapse it, twice for triple repeats.
  for (let pass = 0; pass < 2; pass += 1) {
    result = result.replace(/(.{4,}?)\s*[-–]?\s*\1/gu, "$1");
  }
  return result.replace(/\s{2,}/g, " ").trim();
}

// Product rows span 1–4 visual lines in real PDFs (name / qty+discount
// / price+VAT / net+unit). Slide a growing window over the lines: the
// smallest window that yields a triplet is a candidate, and the window
// keeps growing (max 4) until the qty×price pair is found too.
function itemsFromRows(rows) {
  const normalized = rows.map((row) => normalizeDigits(row));
  const items = [];
  const consumed = new Set();
  let i = 0;
  while (i < normalized.length) {
    if (isSummaryLine(normalized[i])) {
      i += 1;
      continue;
    }
    let best = null;
    let merged = "";
    for (let k = 1; k <= 4 && i + k <= normalized.length; k += 1) {
      const next = normalized[i + k - 1];
      // never merge across a summary row
      if (k > 1 && isSummaryLine(next)) break;
      merged = merged ? `${merged} ${next}` : next;
      const item = itemFromLine(merged);
      if (!item) continue;
      if (!best) best = { item, k };
      if (item.quantity !== null) {
        best = { item, k };
        break;
      }
    }
    if (!best) {
      i += 1;
      continue;
    }
    // Adopt up to two preceding name lines as the description.
    const descParts = [];
    for (let back = i - 1; back >= 0 && back >= i - 2; back -= 1) {
      if (consumed.has(back)) break;
      if (!isDescriptionLine(normalized[back])) break;
      descParts.unshift(cleanItemDescription(normalized[back]));
      consumed.add(back);
    }
    const description = dedupeDescription(
      [...descParts, best.item.description]
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    );
    items.push({ ...best.item, description });
    for (let c = 0; c < best.k; c += 1) consumed.add(i + c);
    i += best.k;
  }
  return items;
}

function itemsSumMatches(items, grandTotal) {
  if (items.length === 0) return false;
  if (grandTotal === null || grandTotal === undefined) return items.length >= 2;
  const sum = round2(items.reduce((acc, item) => acc + item.total, 0));
  return Math.abs(sum - grandTotal) <= Math.max(1, grandTotal * 0.015);
}

// rowGroups: candidate line sets (per page first, then all pages
// merged — multi-page invoices often duplicate the items table on a
// copy page, which doubles the sum when pages are mixed together).
// grandTotal: detected invoice total (validates each candidate).
// Returns [{description, total, rate}] or null when no candidate
// reproduces the invoice total.
export function parseInvoiceLineItems(rowGroups, grandTotal) {
  const groups = (Array.isArray(rowGroups) ? rowGroups : [])
    .filter((rows) => Array.isArray(rows) && rows.length > 0);
  if (groups.length === 0) return null;

  for (const rows of groups) {
    const items = itemsFromRows(rows);
    if (itemsSumMatches(items, grandTotal)) {
      return items;
    }
  }
  return null;
}
// ---------- /line-item extraction ----------

export function parseInvoiceText(rawText, contacts = []) {
  // NFKC folds Arabic presentation forms so every keyword search
  // (dates, totals, VAT, summaries) sees plain letters.
  const text = normalizeDigits(String(rawText).normalize("NFKC")).replace(
    /\s+/g,
    " ",
  );
  const total = detectTotal(text);
  const tax = detectTax(text);
  const contactMatch = detectContact(text, contacts);
  return {
    invoiceNumber: detectInvoiceNumber(text),
    total,
    tax: tax !== null && total !== null && tax >= total ? null : tax,
    invoiceDate: detectInvoiceDate(text),
    dueDate: detectDueDate(text),
    contact: contactMatch?.contact || null,
    contactMatchedBy: contactMatch?.matchedBy || null,
  };
}
// ---------- /PDF auto-fill ----------

function moneyInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return (Math.round(number * 100) / 100).toFixed(2);
}

function moneyValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value, currency = "SAR") {
  return `${moneyValue(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function computedStatus({ workflowStatus, totalAmount, paidAmount, dueDate }) {
  const total = moneyValue(totalAmount);
  const paid = moneyValue(paidAmount);
  const balance = Math.max(total - paid, 0);
  if (total > 0 && paid >= total) return "paid";
  if (dueDate && dueDate < todayRiyadh() && balance > 0) return "overdue";
  if (paid > 0) return "partial_paid";
  if (workflowStatus === "new") return "new";
  return "pending_payment";
}

export function purchaseInvoiceStatusLabel(value) {
  return (
    PURCHASE_INVOICE_STATUS_OPTIONS.find((option) => option.value === value)
      ?.label || "جديد"
  );
}

export function purchaseInvoiceStatusClass(value) {
  if (value === "paid") {
    return "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-500/25";
  }
  if (value === "partial_paid") {
    return "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 border-indigo-200 dark:border-indigo-500/25";
  }
  if (value === "overdue") {
    return "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-500/25";
  }
  if (value === "pending_payment") {
    return "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-200 dark:border-amber-500/25";
  }
  return "bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-200 dark:border-sky-500/25";
}

// Postable expense accounts from شجرة الحسابات, grouped under their
// parent node so the dropdown mirrors the tree structure.
export function buildExpenseAccountOptions(accounts = []) {
  const active = accounts.filter(
    (account) =>
      account.account_type === "expense" &&
      account.is_postable !== false &&
      account.is_active !== false,
  );
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const groups = new Map();
  for (const account of active) {
    const parent = account.parent_id ? byId.get(account.parent_id) : null;
    const key = parent ? String(parent.id) : "orphan";
    if (!groups.has(key)) {
      groups.set(key, {
        code: parent ? String(parent.code) : "",
        label: parent ? `${parent.code} ${parent.name}` : "أخرى",
        children: [],
      });
    }
    groups.get(key).children.push(account);
  }
  const sortedGroups = [...groups.values()].sort((a, b) =>
    a.code.localeCompare(b.code, "en", { numeric: true }),
  );
  const options = [{ value: "", label: "غير مصنّفة" }];
  for (const group of sortedGroups) {
    group.children.sort((a, b) =>
      String(a.code).localeCompare(String(b.code), "en", { numeric: true }),
    );
    options.push({
      value: `group-${group.code || group.label}`,
      label: group.label,
      isGroupLabel: true,
    });
    for (const account of group.children) {
      options.push({
        value: String(account.id),
        label: `${account.code} — ${account.name}`,
      });
    }
  }
  return options;
}

// One editable line (بند) of the invoice: quantity × unit price is
// the base amount; the tax toggle decides whether that base is net or
// gross.
let lineKeyCounter = 0;
function newLine(overrides = {}) {
  lineKeyCounter += 1;
  return {
    key: `line-${lineKeyCounter}`,
    description: "",
    account_id: "",
    quantity: "1",
    unit_price: "",
    tax_rate: "15",
    amount_includes_tax: false,
    ...overrides,
  };
}

function lineAmount(line) {
  const quantity = moneyValue(line.quantity);
  const price = moneyValue(line.unit_price);
  if (quantity <= 0 || price <= 0) return 0;
  return round2(quantity * price);
}

function lineMath(line) {
  const amount = lineAmount(line);
  const rate = Math.min(Math.max(moneyValue(line.tax_rate), 0), 100);
  if (amount <= 0) return { amount: 0, subtotal: 0, tax: 0, total: 0 };
  if (line.amount_includes_tax) {
    const subtotal = amount / (1 + rate / 100);
    return {
      amount,
      subtotal: round2(subtotal),
      tax: round2(amount - subtotal),
      total: round2(amount),
    };
  }
  const tax = (amount * rate) / 100;
  return {
    amount,
    subtotal: round2(amount),
    tax: round2(tax),
    total: round2(amount + tax),
  };
}

function priceInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  // Unit prices keep up to 4 decimals (e.g. 16.499) without noise.
  return String(Math.round(number * 10000) / 10000);
}

function linesFromInvoice(invoice) {
  const stored = Array.isArray(invoice?.items) ? invoice.items : [];
  if (stored.length > 0) {
    return stored.map((item) => {
      const quantity = moneyValue(item.quantity);
      const price = moneyValue(item.unit_price);
      return newLine({
        description: item.description || "",
        account_id: item.account_id ? String(item.account_id) : "",
        quantity: quantity > 0 ? String(quantity) : "1",
        unit_price:
          price > 0 ? priceInput(price) : moneyInput(item.amount) || "",
        tax_rate: String(moneyValue(item.tax_rate)),
        amount_includes_tax: !!item.amount_includes_tax,
      });
    });
  }
  // Legacy header-only invoice → seed one line from its totals so the
  // numbers survive editing.
  const total = moneyValue(invoice?.total_amount);
  if (total > 0) {
    const tax = moneyValue(invoice?.tax_amount);
    const subtotal = Math.max(total - tax, 0);
    const rate = subtotal > 0 ? round2((tax / subtotal) * 100) : 15;
    return [
      newLine({
        description: "",
        account_id: invoice?.expense_account_id
          ? String(invoice.expense_account_id)
          : "",
        quantity: "1",
        unit_price: moneyInput(total),
        tax_rate: String(rate || 0),
        amount_includes_tax: true,
      }),
    ];
  }
  return [newLine()];
}

function SectionTitle({ children }) {
  return (
    <div className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
      {children}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <div className="text-xs text-slate-600 dark:text-white/55 mb-1">
      {children}
      {required ? <span className="text-rose-700 dark:text-rose-300"> *</span> : null}
    </div>
  );
}

export default function PurchaseInvoiceModal({
  open,
  invoice,
  contacts = [],
  accounts = [],
  contactStats = null,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const isEditing = !!invoice;
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [contactId, setContactId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayRiyadh());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [lines, setLines] = useState(() => [newLine()]);
  const [paidAmount, setPaidAmount] = useState("0.00");
  const [workflowStatus, setWorkflowStatus] = useState("new");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentMime, setAttachmentMime] = useState("");
  const [vatMatched, setVatMatched] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanSummary, setScanSummary] = useState(null); // {filled:[], warning?}
  const [mobilePane, setMobilePane] = useState("form"); // form | preview
  const fileInputRef = useRef(null);
  const [upload, { loading: uploading }] = useUpload();

  // Fields owned by the LAST scan (not touched by the user since).
  // Attaching a new invoice re-fills these with the new document's
  // values; anything the user typed manually stays protected. Manual
  // edits remove the field from this set.
  const autoFilledRef = useRef(new Set());

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(invoice?.invoice_number || "");
    setContactId(invoice?.contact_id ? String(invoice.contact_id) : "");
    setSupplierName(invoice?.supplier_name || "");
    setInvoiceDate(invoice?.invoice_date || todayRiyadh());
    setDueDate(invoice?.due_date || "");
    setCurrency(invoice?.currency || "SAR");
    setLines(linesFromInvoice(invoice));
    setPaidAmount(moneyInput(invoice?.paid_amount) || "0.00");
    setWorkflowStatus(invoice?.workflow_status || "new");
    setNotes(invoice?.notes || "");
    setAttachmentUrl(invoice?.attachment_url || "");
    setAttachmentName("");
    setAttachmentMime(
      invoice?.attachment_url && /\.pdf(\?|$)/i.test(invoice.attachment_url)
        ? "application/pdf"
        : "",
    );
    setVatMatched(false);
    setScanBusy(false);
    setScanSummary(null);
    setMobilePane("form");
    // Fresh editor: nothing is scan-owned yet. The default "today"
    // date on a NEW invoice is not user input, so scans may replace it.
    autoFilledRef.current = new Set(isEditing ? [] : ["date"]);
  }, [open, invoice, isEditing]);

  // Lock page scroll while the editor is open.
  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const contactOptions = useMemo(() => {
    const activeContacts = contacts
      .filter((contact) => contact.is_active !== false)
      .map((contact) => ({
        value: String(contact.id),
        label: contact.name,
      }));
    activeContacts.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    return [{ value: "", label: "بدون جهة اتصال / مورد يدوي" }, ...activeContacts];
  }, [contacts]);

  const accountOptions = useMemo(
    () => buildExpenseAccountOptions(accounts),
    [accounts],
  );

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let total = 0;
    for (const line of lines) {
      const math = lineMath(line);
      subtotal += math.subtotal;
      tax += math.tax;
      total += math.total;
    }
    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      total: round2(total),
    };
  }, [lines]);

  const contactTransactionCount = useMemo(() => {
    if (!contactId || !contactStats) return null;
    const count = contactStats[contactId];
    return Number.isFinite(count) ? count : null;
  }, [contactId, contactStats]);

  const status = computedStatus({
    workflowStatus,
    totalAmount: totals.total,
    paidAmount,
    dueDate,
  });
  const balance = Math.max(totals.total - moneyValue(paidAmount), 0);
  const canSubmit =
    !isSubmitting &&
    (!!supplierName.trim() || !!contactId) &&
    totals.total > 0 &&
    moneyValue(paidAmount) <= totals.total;

  const updateLine = (key, patch) => {
    autoFilledRef.current.delete("lines");
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };
  const removeLine = (key) => {
    autoFilledRef.current.delete("lines");
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.key !== key),
    );
  };
  const addLine = () => {
    autoFilledRef.current.delete("lines");
    setLines((prev) => [...prev, newLine()]);
  };

  const handleSubmit = (event) => {
    event?.preventDefault?.();
    if (!canSubmit) return;
    const items = lines
      .filter((line) => lineAmount(line) > 0)
      .map((line) => ({
        description: line.description.trim() || null,
        account_id: line.account_id || null,
        quantity: moneyValue(line.quantity),
        unit_price: moneyValue(line.unit_price),
        amount: lineAmount(line),
        tax_rate: moneyValue(line.tax_rate),
        amount_includes_tax: !!line.amount_includes_tax,
      }));
    const payload = {
      invoice_number: invoiceNumber.trim() || undefined,
      contact_id: contactId || null,
      supplier_name: supplierName.trim() || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      currency,
      items,
      subtotal_amount: totals.subtotal,
      tax_amount: totals.tax,
      total_amount: totals.total,
      paid_amount: moneyValue(paidAmount),
      workflow_status: workflowStatus,
      notes: notes.trim() || null,
      attachment_url: attachmentUrl || null,
    };
    if (isEditing) payload.id = invoice.id;
    onSubmit(payload);
  };

  const handleContactChange = (nextContactId) => {
    autoFilledRef.current.delete("contact");
    setContactId(nextContactId);
    setVatMatched(false);
    if (!nextContactId) return;
    const selected = contacts.find(
      (contact) => String(contact.id) === nextContactId,
    );
    if (selected?.name) {
      setSupplierName(selected.name);
    }
  };

  // Upload the picked file, then (for PDFs) read its text layer and
  // auto-fill whatever fields it can find. User-entered values are
  // never overwritten — only empty/default fields get filled.
  const handleFilePicked = async (fileArg) => {
    const file = fileArg;
    if (!file) return;
    setScanSummary(null);

    const result = await upload({ file });
    if (result?.error) {
      setScanSummary({ filled: [], warning: `فشل رفع الملف: ${result.error}` });
      return;
    }
    setAttachmentUrl(result.url || "");
    setAttachmentName(file.name || "");
    setAttachmentMime(file.type || "");

    const isPdf =
      file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setScanSummary({
        filled: [],
        warning: "تم إرفاق الملف. الفحص التلقائي يعمل مع ملفات PDF فقط.",
      });
      return;
    }

    setScanBusy(true);
    try {
      const { extractPdfDetails } = await import(
        "@/client-integrations/pdfjs"
      );
      const details = await extractPdfDetails(file);
      const text = details?.text;
      if (!text || text.trim().length < 10) {
        setScanSummary({
          filled: [],
          warning:
            "تم إرفاق الفاتورة لكن ما قدرت أقرأ نصها — غالباً صورة ممسوحة. عبّي الحقول يدوياً.",
        });
        return;
      }

      // Prefer the visually-ordered lines: raw stream order can put a
      // value far from its label, breaking keyword-window searches.
      const linesText = (details?.pageLines || [])
        .flat()
        .join("\n");
      const parsed = parseInvoiceText(linesText || text, contacts);
      const filled = [];
      // A field is fillable when it's still empty/default OR the last
      // scan owns it (replacing the attachment refreshes those values).
      const owned = autoFilledRef.current;
      const canFill = (field, isEmpty) => isEmpty || owned.has(field);

      if (parsed.invoiceNumber && canFill("number", !invoiceNumber.trim())) {
        setInvoiceNumber(parsed.invoiceNumber);
        owned.add("number");
        filled.push("رقم الفاتورة");
      }
      const contactLabel =
        parsed.contactMatchedBy === "vat"
          ? "جهة الاتصال (تطابق الرقم الضريبي)"
          : "جهة الاتصال (تطابق الاسم)";
      if (parsed.contact && canFill("contact", !contactId)) {
        setContactId(String(parsed.contact.id));
        setSupplierName(parsed.contact.name);
        setVatMatched(parsed.contactMatchedBy === "vat");
        owned.add("contact");
        filled.push(contactLabel);
      } else if (parsed.contact && !supplierName.trim()) {
        setSupplierName(parsed.contact.name);
        filled.push("اسم المورد");
      }

      // Line items: recover the product table when possible — each
      // row becomes its own بند (gross amount + its effective rate).
      // Otherwise seed ONE aggregate line from the detected totals.
      const hasAmounts = lines.some((line) => lineAmount(line) > 0);
      if (canFill("lines", !hasAmounts)) {
        // Per-page groups first (copy pages duplicate the table), then
        // everything merged as a last resort.
        const rowGroups = [
          ...(Array.isArray(details?.pageLines) ? details.pageLines : []),
          details?.lines,
        ];
        const tableItems = parseInvoiceLineItems(rowGroups, parsed.total);
        // Diagnostics for real-world invoices that fail extraction —
        // open DevTools console and share this output.
        console.info(
          "[invoice-scan] total:",
          parsed.total,
          "items:",
          JSON.stringify(tableItems),
          "lines:",
          JSON.stringify(details?.pageLines?.[0]?.slice(0, 40) || []),
        );
        if (tableItems) {
          setLines(
            tableItems.map((item) =>
              item.quantity !== null && item.unitPrice !== null
                ? // Quantity × unit price recovered from the row —
                  // entered exactly like the invoice quotes it (net or
                  // tax-inclusive unit prices both supported).
                  newLine({
                    description: item.description,
                    quantity: String(item.quantity),
                    unit_price: priceInput(item.unitPrice),
                    tax_rate: String(item.rate),
                    amount_includes_tax: !!item.priceIncludesTax,
                  })
                : newLine({
                    description: item.description,
                    quantity: "1",
                    unit_price: item.total.toFixed(2),
                    tax_rate: String(item.rate),
                    amount_includes_tax: true,
                  }),
            ),
          );
          owned.add("lines");
          filled.push(`بنود الفاتورة (${tableItems.length})`);
        } else if (parsed.total !== null) {
          const tax = parsed.tax ?? null;
          const subtotal = tax !== null ? parsed.total - tax : null;
          const rate =
            tax !== null && subtotal > 0
              ? round2((tax / subtotal) * 100)
              : 15;
          setLines([
            newLine({
              description: "",
              quantity: "1",
              unit_price: parsed.total.toFixed(2),
              tax_rate: String(rate),
              amount_includes_tax: true,
            }),
          ]);
          owned.add("lines");
          filled.push("مبلغ الفاتورة");
          if (tax !== null) filled.push("الضريبة");
        }
      }
      if (parsed.invoiceDate && canFill("date", false)) {
        setInvoiceDate(parsed.invoiceDate);
        owned.add("date");
        filled.push("تاريخ الفاتورة");
      }
      if (parsed.dueDate && canFill("dueDate", !dueDate)) {
        setDueDate(parsed.dueDate);
        owned.add("dueDate");
        filled.push("تاريخ الاستحقاق");
      }

      setScanSummary({
        filled,
        warning:
          filled.length === 0
            ? "قرأت الملف لكن ما تعرفت على الحقول — تأكد منها يدوياً."
            : !parsed.contact
              ? "ما لقيت مورداً مطابقاً (بالرقم الضريبي أو الاسم) في جهات الاتصال — اختر الجهة أو اكتب اسم المورد."
              : null,
      });
      setMobilePane("form");
    } catch (error) {
      console.error("invoice scan failed", error);
      setScanSummary({
        filled: [],
        warning: "تعذّر فحص الملف — تم إرفاقه فقط.",
      });
    } finally {
      setScanBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isPdfAttachment =
    /pdf/i.test(attachmentMime) || /\.pdf(\?|$)/i.test(attachmentUrl);
  const isImageAttachment = /^image\//i.test(attachmentMime);

  if (!open || typeof document === "undefined") return null;

  const previewPane = (
    <div className="h-full flex flex-col">
      {attachmentUrl ? (
        <>
          <div
            className={`px-4 py-2.5 border-b ${ws.divider} flex items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 min-w-0 text-xs text-slate-600 dark:text-white/60">
              <Paperclip className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate" dir="ltr">
                {attachmentName || "الفاتورة المرفقة"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className={`${ws.btnNeutral} px-2.5 py-1.5 text-[11px]`}
              >
                <ExternalLink className="w-3 h-3" />
                فتح
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || scanBusy}
                className={`${ws.btnNeutral} px-2.5 py-1.5 text-[11px] disabled:opacity-50`}
              >
                استبدال
              </button>
              <button
                type="button"
                onClick={() => {
                  setAttachmentUrl("");
                  setAttachmentName("");
                  setAttachmentMime("");
                  setScanSummary(null);
                }}
                className={`${ws.iconButton} w-7 h-7 hover:text-red-700 dark:hover:text-red-200`}
                title="إزالة المرفق"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-slate-200/70 dark:bg-black/40">
            {isPdfAttachment ? (
              <iframe
                src={attachmentUrl}
                title="معاينة الفاتورة"
                className="w-full h-full border-0"
              />
            ) : isImageAttachment ? (
              <div className="w-full h-full overflow-auto p-3">
                <img
                  src={attachmentUrl}
                  alt="الفاتورة المرفقة"
                  className="max-w-full h-auto rounded-xl mx-auto"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-slate-500 dark:text-white/50 p-6 text-center">
                لا يمكن معاينة هذا النوع — استخدم زر «فتح».
              </div>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || scanBusy}
          className="flex-1 m-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-emerald-400 dark:hover:border-emerald-400/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/[0.04] transition-colors flex flex-col items-center justify-center gap-3 p-8 text-center disabled:opacity-50"
        >
          {uploading || scanBusy ? (
            <Loader2 className="w-10 h-10 text-emerald-600 dark:text-emerald-300 animate-spin" />
          ) : (
            <ScanLine className="w-10 h-10 text-slate-400 dark:text-white/35" />
          )}
          <div className="text-sm font-bold text-slate-800 dark:text-white/85">
            {uploading
              ? "جاري الرفع…"
              : scanBusy
                ? "جاري فحص الفاتورة…"
                : "أرفق الفاتورة (PDF)"}
          </div>
          <div className="text-xs text-slate-500 dark:text-white/45 max-w-[260px] leading-relaxed">
            تُعرض هنا جنب النموذج، وتُفحص وتُعبّأ الحقول تلقائياً — رقم
            الفاتورة، المورد (بالرقم الضريبي)، المبلغ والضريبة والتاريخ.
          </div>
        </button>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex flex-col bg-slate-100 dark:bg-slate-950" dir="rtl">
      {/* Top bar */}
      <div
        className={`${ws.topBar} px-4 sm:px-6 py-3 flex items-center gap-3 border-b ${ws.divider} shrink-0`}
      >
        <div className={`${ws.iconBox} w-9 h-9 text-emerald-700 dark:text-emerald-200 shrink-0`}>
          <FileText className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {isEditing ? "تعديل فاتورة مشتريات" : "تسجيل فاتورة مشتريات"}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-white/45 truncate">
            الحالة تُحسب تلقائياً من المبلغ والمدفوع وتاريخ الاستحقاق.
          </div>
        </div>
        <span
          className={`hidden sm:inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold shrink-0 ${purchaseInvoiceStatusClass(status)}`}
        >
          {purchaseInvoiceStatusLabel(status)}
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`${ws.btnPrimary} px-4 py-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          حفظ الفاتورة
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`${ws.iconButton} w-9 h-9 shrink-0`}
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mobile pane switch */}
      <div className={`lg:hidden px-4 pt-3 shrink-0`}>
        <div className={`${ws.segWrap}`}>
          <button
            type="button"
            onClick={() => setMobilePane("form")}
            className={`${ws.segBtn} text-xs flex-1 ${mobilePane === "form" ? ws.segActive : ws.segInactive}`}
          >
            النموذج
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("preview")}
            className={`${ws.segBtn} text-xs flex-1 ${mobilePane === "preview" ? ws.segActive : ws.segInactive}`}
          >
            المرفق {attachmentUrl ? "•" : ""}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/*"
        onChange={(event) => handleFilePicked(event?.target?.files?.[0])}
        className="hidden"
      />

      {/* Body: form (right in RTL) + attachment preview (left) */}
      <div className="flex-1 min-h-0 flex">
        {/* Form column */}
        <div
          className={`flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 ${
            mobilePane === "preview" ? "hidden lg:block" : ""
          }`}
        >
          <form
            onSubmit={handleSubmit}
            className="max-w-2xl mx-auto space-y-4 pb-16"
          >
            {/* Scan feedback */}
            {scanSummary ? (
              <div className={`${ws.glassSoft} ${ws.card} p-3 space-y-1.5`}>
                {scanSummary.filled.length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap text-xs text-emerald-800 dark:text-emerald-200">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>تمت تعبئة:</span>
                    {scanSummary.filled.map((label) => (
                      <span
                        key={label}
                        className={`${ws.pill} bg-emerald-100 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-400/25`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
                {scanSummary.warning ? (
                  <div className="text-xs text-amber-700 dark:text-amber-200">
                    {scanSummary.warning}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* معلومات الفاتورة */}
            <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
              <SectionTitle>معلومات الفاتورة</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <FieldLabel>رقم الفاتورة</FieldLabel>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(event) => {
                      autoFilledRef.current.delete("number");
                      setInvoiceNumber(event.target.value);
                    }}
                    className={`${ws.input} px-3 py-2.5`}
                    placeholder="فارغ = رقم تلقائي"
                    dir="ltr"
                  />
                </div>
                <div>
                  <FieldLabel>العملة</FieldLabel>
                  <GlassSelect
                    value={currency}
                    onChange={setCurrency}
                    options={CURRENCY_OPTIONS}
                    placeholder="اختر العملة"
                    buttonClassName="text-sm py-2.5 px-3"
                  />
                </div>
                <div>
                  <FieldLabel required>المورد</FieldLabel>
                  <GlassSelect
                    value={contactId}
                    onChange={handleContactChange}
                    options={contactOptions}
                    placeholder="اختر المورد"
                    buttonClassName="text-sm py-2.5 px-3"
                  />
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {vatMatched ? (
                      <span
                        className={`${ws.pill} bg-fuchsia-100 dark:bg-fuchsia-400/10 text-fuchsia-700 dark:text-fuchsia-200 border-fuchsia-200 dark:border-fuchsia-400/25 inline-flex items-center gap-1`}
                      >
                        <BadgeCheck className="w-3 h-3" />
                        مطابق حسب الرقم الضريبي
                      </span>
                    ) : null}
                    {contactTransactionCount !== null ? (
                      <span className="text-[11px] text-sky-700 dark:text-sky-300">
                        {contactTransactionCount} معاملة سابقة
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <FieldLabel>اسم المورد (كما في الفاتورة)</FieldLabel>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(event) => {
                      autoFilledRef.current.delete("contact");
                      setSupplierName(event.target.value);
                    }}
                    className={`${ws.input} px-3 py-2.5`}
                    placeholder="مثال: مؤسسة عمق المذاق"
                  />
                </div>
                <div>
                  <FieldLabel>تاريخ الفاتورة</FieldLabel>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(event) => {
                      autoFilledRef.current.delete("date");
                      setInvoiceDate(event.target.value);
                    }}
                    className={`${ws.input} px-3 py-2.5`}
                  />
                </div>
                <div>
                  <FieldLabel>تاريخ الاستحقاق</FieldLabel>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => {
                      autoFilledRef.current.delete("dueDate");
                      setDueDate(event.target.value);
                    }}
                    className={`${ws.input} px-3 py-2.5`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>حالة الفاتورة الأساسية</FieldLabel>
                  <GlassSelect
                    value={workflowStatus}
                    onChange={setWorkflowStatus}
                    options={WORKFLOW_OPTIONS}
                    placeholder="اختر الحالة"
                    buttonClassName="text-sm py-2.5 px-3"
                  />
                  <div className="text-[11px] text-slate-500 dark:text-white/45 mt-1">
                    «مدفوع»، «مدفوع جزئياً»، و«متأخر» تُحسب تلقائياً من الأرقام
                    وتاريخ الاستحقاق.
                  </div>
                </div>
              </div>
            </div>

            {/* بنود الفاتورة */}
            <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <SectionTitle>بنود الفاتورة</SectionTitle>
                <button
                  type="button"
                  onClick={addLine}
                  className={`${ws.btnNeutral} px-3 py-1.5 text-xs`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة بند
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, index) => {
                  const math = lineMath(line);
                  return (
                    <div
                      key={line.key}
                      className={`${ws.glassSoft} ${ws.card} p-3 space-y-2.5`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-white/45">
                          بند {index + 1}
                        </div>
                        {lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className={`${ws.iconButton} w-7 h-7 hover:text-red-700 dark:hover:text-red-200`}
                            title="حذف البند"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel>الوصف</FieldLabel>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(event) =>
                              updateLine(line.key, {
                                description: event.target.value,
                              })
                            }
                            className={`${ws.input} px-3 py-2`}
                            placeholder="مثال: صينية كيك تراميسو"
                          />
                        </div>
                        <div>
                          <FieldLabel>الحساب — شجرة الحسابات</FieldLabel>
                          <GlassSelect
                            value={line.account_id}
                            onChange={(value) =>
                              updateLine(line.key, { account_id: value })
                            }
                            options={accountOptions}
                            placeholder="غير مصنّفة"
                            buttonClassName="text-sm py-2 px-3"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <FieldLabel required>الكمية</FieldLabel>
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  quantity: event.target.value,
                                })
                              }
                              className={`${ws.input} px-3 py-2 text-right`}
                              step="any"
                              min="0"
                              dir="ltr"
                              placeholder="1"
                            />
                          </div>
                          <div>
                            <FieldLabel required>سعر الوحدة</FieldLabel>
                            <input
                              type="number"
                              value={line.unit_price}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  unit_price: event.target.value,
                                })
                              }
                              className={`${ws.input} px-3 py-2 text-right`}
                              step="any"
                              min="0"
                              dir="ltr"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div>
                          <FieldLabel>معدل الضريبة %</FieldLabel>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={line.tax_rate}
                              onChange={(event) =>
                                updateLine(line.key, {
                                  tax_rate: event.target.value,
                                })
                              }
                              className={`${ws.input} px-3 py-2 text-right w-24`}
                              step="0.1"
                              min="0"
                              max="100"
                              dir="ltr"
                            />
                            <div className={`${ws.segWrap} flex-1`}>
                              <button
                                type="button"
                                onClick={() =>
                                  updateLine(line.key, {
                                    amount_includes_tax: false,
                                  })
                                }
                                className={`${ws.segBtn} text-[11px] flex-1 ${!line.amount_includes_tax ? ws.segActive : ws.segInactive}`}
                              >
                                خالي من الضريبة
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateLine(line.key, {
                                    amount_includes_tax: true,
                                  })
                                }
                                className={`${ws.segBtn} text-[11px] flex-1 ${line.amount_includes_tax ? ws.segActive : ws.segInactive}`}
                              >
                                شامل الضريبة
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {math.total > 0 ? (
                        <div className="text-[11px] text-slate-500 dark:text-white/45 flex items-center gap-3 flex-wrap pt-1">
                          <span>
                            المبلغ:{" "}
                            <span dir="ltr" className="font-bold">
                              {math.amount.toFixed(2)}
                            </span>
                          </span>
                          <span>
                            الصافي:{" "}
                            <span dir="ltr" className="font-bold">
                              {math.subtotal.toFixed(2)}
                            </span>
                          </span>
                          <span>
                            الضريبة:{" "}
                            <span dir="ltr" className="font-bold">
                              {math.tax.toFixed(2)}
                            </span>
                          </span>
                          <span className="text-slate-700 dark:text-white/70">
                            إجمالي البند:{" "}
                            <span dir="ltr" className="font-bold">
                              {math.total.toFixed(2)}
                            </span>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* الإجماليات والدفع */}
            <div className={`${ws.glass} ${ws.card} p-4 space-y-3`}>
              <SectionTitle>الإجماليات والدفع</SectionTitle>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-slate-600 dark:text-white/60">
                  <span>المجموع الفرعي (قبل الضريبة)</span>
                  <span dir="ltr">{formatMoney(totals.subtotal, currency)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 dark:text-white/60">
                  <span>إجمالي ضريبة القيمة المضافة</span>
                  <span dir="ltr">{formatMoney(totals.tax, currency)}</span>
                </div>
                <div
                  className={`flex items-center justify-between font-bold text-slate-900 dark:text-white pt-2 border-t ${ws.divider}`}
                >
                  <span>المجموع</span>
                  <span dir="ltr">{formatMoney(totals.total, currency)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <FieldLabel>المبلغ المدفوع</FieldLabel>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(event) => setPaidAmount(event.target.value)}
                    className={`${ws.input} px-3 py-2.5 text-right`}
                    step="0.01"
                    min="0"
                    dir="ltr"
                  />
                  {moneyValue(paidAmount) > totals.total ? (
                    <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                      المبلغ المدفوع لا يمكن أن يتجاوز مبلغ الفاتورة.
                    </div>
                  ) : null}
                </div>
                <div className={`${ws.glassSoft} ${ws.card} p-3 flex items-center justify-between gap-2`}>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-white/45">
                      الرصيد المتبقي
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white mt-0.5" dir="ltr">
                      {formatMoney(balance, currency)}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${purchaseInvoiceStatusClass(status)}`}
                  >
                    {purchaseInvoiceStatusLabel(status)}
                  </span>
                </div>
              </div>
            </div>

            {/* ملاحظات */}
            <div className={`${ws.glass} ${ws.card} p-4 space-y-2`}>
              <SectionTitle>ملاحظات</SectionTitle>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={`${ws.input} px-3 py-2.5 min-h-[80px] resize-none`}
                placeholder="اختياري"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!canSubmit}
                className={`${ws.btnPrimary} px-5 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Save className="w-4 h-4" />
                حفظ الفاتورة
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`${ws.btnNeutral} px-4 py-2.5`}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>

        {/* Attachment preview column */}
        <div
          className={`w-full lg:w-[44%] lg:max-w-[640px] border-r ${ws.divider} bg-white/60 dark:bg-white/[0.02] ${
            mobilePane === "form" ? "hidden lg:flex" : "flex"
          } flex-col min-h-0`}
        >
          {previewPane}
        </div>
      </div>
    </div>,
    document.body,
  );
}
