import type { ImportedTrade } from "@/lib/csv/parser";

/** JSON-safe payload for API import (Dates as ISO strings). */
export type ImportedTradeWire = Omit<ImportedTrade, "entryTime" | "exitTime" | "createdAt"> & {
  entryTime: string;
  exitTime: string;
  createdAt: string;
};

export function importedTradeToWire(t: ImportedTrade): ImportedTradeWire {
  return {
    ...t,
    entryTime: t.entryTime.toISOString(),
    exitTime: t.exitTime.toISOString(),
    createdAt: t.createdAt.toISOString(),
  };
}

export function wireToImportedTrade(w: ImportedTradeWire): ImportedTrade {
  return {
    ...w,
    entryTime: new Date(w.entryTime),
    exitTime: new Date(w.exitTime),
    createdAt: new Date(w.createdAt),
  };
}
