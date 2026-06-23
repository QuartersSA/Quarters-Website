import { LOCALE } from "./dateUtils";

export function processItemHistoryChartData(rows) {
  const branchKeyById = new Map();
  const branchLabelByKey = new Map();
  const branchIdsInData = [];

  for (const r of rows) {
    const bid = r.branch_id ?? 0;
    if (!branchKeyById.has(bid)) {
      const key = `b_${bid}`;
      branchKeyById.set(bid, key);
      branchLabelByKey.set(key, r.branch_name || `فرع ${bid}`);
      branchIdsInData.push(bid);
    }
  }

  const byTs = new Map();
  for (const r of rows) {
    const dt = new Date(r.created_at);
    const day = dt.toLocaleDateString(LOCALE, {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      timeZone: "Asia/Riyadh",
    });
    const time = dt.toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Riyadh",
    });

    const tsKey = dt.toISOString();
    const shortLabel = `${day} ${time}`;
    const fullLabel = dt.toLocaleString(LOCALE, {
      timeZone: "Asia/Riyadh",
    });

    const existing = byTs.get(tsKey) || {
      ts: dt.getTime(),
      tsKey,
      shortLabel,
      fullLabel,
    };

    const bid = r.branch_id ?? 0;
    const key = branchKeyById.get(bid) || `b_${bid}`;
    existing[key] = Number(r.quantity) || 0;

    byTs.set(tsKey, existing);
  }

  const chartData = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);

  const palette = [
    "#38bdf8",
    "#34d399",
    "#a78bfa",
    "#fbbf24",
    "#fb7185",
    "#60a5fa",
    "#22c55e",
    "#f97316",
  ];

  const branchSeries = branchIdsInData
    .slice()
    .sort((a, b) => a - b)
    .map((bid, idx) => {
      const key = branchKeyById.get(bid);
      return {
        dataKey: key,
        name: branchLabelByKey.get(key) || `فرع ${bid}`,
        color: palette[idx % palette.length],
      };
    });

  return { chartData, branchSeries };
}

export function processVarianceChartData(varianceRows) {
  const data = [];
  for (const r of varianceRows) {
    const dt = new Date(r.created_at);
    const day = dt.toLocaleDateString(LOCALE, {
      year: "2-digit",
      month: "short",
      day: "2-digit",
      timeZone: "Asia/Riyadh",
    });
    const time = dt.toLocaleTimeString(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Riyadh",
    });

    data.push({
      ts: dt.getTime(),
      label: `${day} ${time}`,
      fullLabel: dt.toLocaleString(LOCALE, { timeZone: "Asia/Riyadh" }),
      expected: Number(r.expected_quantity) || 0,
      actual: Number(r.actual_quantity) || 0,
      delta: Number(r.delta_quantity) || 0,
      openingOpenedAt: r.opening_opened_at,
    });
  }
  data.sort((a, b) => a.ts - b.ts);
  return data;
}

export function checkVarianceHasOpening(varianceChartData) {
  if (varianceChartData.length === 0) {
    return false;
  }
  for (const row of varianceChartData) {
    if (row.openingOpenedAt) {
      return true;
    }
  }
  return false;
}

/**
 * Processes item analysis data (inventory, receipts, openings, transfers)
 * into a unified timeline for a multi-bar chart.
 *
 * Each data point has: label, fullLabel, ts, inventory, receipt, opening, transferIn, transferOut
 * Events are grouped by their full timestamp (date + time) so each distinct
 * moment appears as its own bar group in the chart.
 */
export function processItemAnalysisChartData(analysisData) {
  if (!analysisData) return [];

  const {
    inventory = [],
    receipts = [],
    openings = [],
    transfers_in = [],
    transfers_out = [],
  } = analysisData;

  // Collect all events into one array with a unified shape
  const events = [];

  for (const r of inventory) {
    events.push({
      date: new Date(r.event_date),
      inventory: Number(r.quantity) || 0,
    });
  }

  for (const r of receipts) {
    events.push({
      date: new Date(r.event_date),
      receipt: Number(r.quantity) || 0,
    });
  }

  for (const r of openings) {
    events.push({
      date: new Date(r.event_date),
      opening: Number(r.quantity) || 0,
    });
  }

  for (const r of transfers_in) {
    events.push({
      date: new Date(r.event_date),
      transferIn: Number(r.quantity) || 0,
    });
  }

  for (const r of transfers_out) {
    events.push({
      date: new Date(r.event_date),
      transferOut: Number(r.quantity) || 0,
    });
  }

  if (events.length === 0) return [];

  // Sort by date
  events.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group events by full timestamp (date + hour + minute) so each distinct
  // moment gets its own column in the chart
  const byTimestamp = new Map();

  for (const ev of events) {
    // Round to the minute so events within the same minute merge
    const dt = ev.date;
    const tsKey = dt.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM

    if (!byTimestamp.has(tsKey)) {
      const day = dt.toLocaleDateString(LOCALE, {
        year: "2-digit",
        month: "short",
        day: "2-digit",
        timeZone: "Asia/Riyadh",
      });
      const time = dt.toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Riyadh",
      });
      const label = `${day} ${time}`;
      const fullLabel = dt.toLocaleString(LOCALE, {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Riyadh",
      });

      byTimestamp.set(tsKey, {
        ts: dt.getTime(),
        tsKey,
        label,
        fullLabel,
        inventory: null,
        receipt: null,
        opening: null,
        transferIn: null,
        transferOut: null,
      });
    }

    const point = byTimestamp.get(tsKey);

    // For inventory/opening: take the latest value (overwrite)
    if (ev.inventory != null) {
      point.inventory = (point.inventory || 0) + ev.inventory;
    }
    if (ev.opening != null) {
      point.opening = (point.opening || 0) + ev.opening;
    }
    // For receipts and transfers: sum them up
    if (ev.receipt != null) {
      point.receipt = (point.receipt || 0) + ev.receipt;
    }
    if (ev.transferIn != null) {
      point.transferIn = (point.transferIn || 0) + ev.transferIn;
    }
    if (ev.transferOut != null) {
      point.transferOut = (point.transferOut || 0) + ev.transferOut;
    }
  }

  const data = Array.from(byTimestamp.values()).sort((a, b) => a.ts - b.ts);
  return data;
}
