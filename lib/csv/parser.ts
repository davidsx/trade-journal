export interface CsvRow {
  symbol: string;
  _tickSize: number;
  buyFillId: string;
  sellFillId: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  boughtTimestamp: Date;
  soldTimestamp: Date;
  holdingMins: number;
}

/**
 * Parse Tradovate "Performance" CSV export.
 * Handles PnL formats: $(73.00)  $185.00  "$1,650.00"
 */
export function parsePnl(raw: string): number {
  // Strip quotes, $, commas, spaces
  const cleaned = raw.replace(/["$,\s]/g, "");
  // $(73.00) → negative
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    return -parseFloat(cleaned.slice(1, -1));
  }
  return parseFloat(cleaned);
}

/** Parse "MM/DD/YYYY HH:mm:ss" → Date (treated as local) */
function parseTimestamp(s: string): Date {
  // "04/09/2026 14:02:44"
  const [datePart, timePart] = s.trim().split(" ");
  const [month, day, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}`);
}

/** Parse "1h 43min 43sec" / "26min 35sec" / "57sec" → minutes (float) */
function parseDuration(s: string): number {
  let mins = 0;
  const h = s.match(/(\d+)h/);
  const m = s.match(/(\d+)min/);
  const sec = s.match(/(\d+)sec/);
  if (h) mins += parseInt(h[1]) * 60;
  if (m) mins += parseInt(m[1]);
  if (sec) mins += parseInt(sec[1]) / 60;
  return mins;
}

/**
 * Parse raw CSV text into CsvRow[].
 * Handles quoted fields (e.g. "$1,650.00").
 */
export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV has no data rows");

  // Simple CSV parser that handles quoted fields
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let inQuote = false;
    let cur = "";
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitLine(line);
    const get = (name: string) => cols[headers.indexOf(name)] ?? "";

    const boughtTimestamp = parseTimestamp(get("boughtTimestamp"));
    const soldTimestamp = parseTimestamp(get("soldTimestamp"));
    const duration = get("duration");

    rows.push({
      symbol: get("symbol").trim(),
      _tickSize: parseFloat(get("_tickSize")) || 0.25,
      buyFillId: get("buyFillId").trim(),
      sellFillId: get("sellFillId").trim(),
      qty: parseInt(get("qty")),
      buyPrice: parseFloat(get("buyPrice")),
      sellPrice: parseFloat(get("sellPrice")),
      pnl: parsePnl(get("pnl")),
      boughtTimestamp,
      soldTimestamp,
      holdingMins: parseDuration(duration),
    });
  }

  if (rows.length === 0) throw new Error("No valid rows found in CSV");
  return rows;
}

export interface ImportedTrade {
  id: string;
  accountId: number;
  contractId: number;
  contractName: string;
  direction: "Long" | "Short";
  qty: number;
  entryFillId: string;
  exitFillId: string;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  holdingMins: number;
  grossPnl: number;
  fees: number;
  netPnl: number;
  rMultiple: null;
  qualityScore: null;
  entryScore: null;
  exitScore: null;
  riskScore: null;
  scoreNotes: null;
  capitalBefore: number;
  capitalAfter: number;
  createdAt: Date;
}

export function csvRowsToTrades(rows: CsvRow[], accountId = 1): ImportedTrade[] {
  // Sort chronologically by entry time before computing running capital
  const withMeta = rows.map((row) => {
    const isLong = row.boughtTimestamp <= row.soldTimestamp;
    const direction: "Long" | "Short" = isLong ? "Long" : "Short";
    const entryTime = isLong ? row.boughtTimestamp : row.soldTimestamp;
    const exitTime = isLong ? row.soldTimestamp : row.boughtTimestamp;
    const entryPrice = isLong ? row.buyPrice : row.sellPrice;
    const exitPrice = isLong ? row.sellPrice : row.buyPrice;
    const entryFillId = isLong ? row.buyFillId : row.sellFillId;
    const exitFillId = isLong ? row.sellFillId : row.buyFillId;

    return {
      direction,
      entryTime,
      exitTime,
      entryPrice,
      exitPrice,
      entryFillId,
      exitFillId,
      grossPnl: row.pnl,
      netPnl: row.pnl,
      qty: row.qty,
      contractName: row.symbol,
      holdingMins: row.holdingMins,
    };
  });

  // Sort by entryTime
  withMeta.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());

  // Compute running capital
  let capital = 50_000;
  const now = new Date();

  return withMeta.map((t) => {
    const capitalBefore = capital;
    capital += t.netPnl;
    return {
      // Stable ID from fill IDs so re-import is idempotent
      id: `csv-${t.entryFillId}-${t.exitFillId}`,
      accountId,
      contractId: 0,
      contractName: t.contractName,
      direction: t.direction,
      qty: t.qty,
      entryFillId: t.entryFillId,
      exitFillId: t.exitFillId,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      holdingMins: t.holdingMins,
      grossPnl: t.grossPnl,
      fees: 0,
      netPnl: t.netPnl,
      rMultiple: null,
      qualityScore: null,
      entryScore: null,
      exitScore: null,
      riskScore: null,
      scoreNotes: null,
      capitalBefore,
      capitalAfter: capital,
      createdAt: now,
    };
  });
}
