-- Move payouts from a per-account scalar to a dated ledger table.

CREATE TABLE "Payout" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payout_accountId_date_idx" ON "Payout"("accountId", "date");

ALTER TABLE "Payout" ADD CONSTRAINT "Payout_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing totals: seed one payout per account that had a non-zero payout,
-- dated at the account's creation day (best available date for legacy scalar totals).
INSERT INTO "Payout" ("accountId", "amount", "date", "note", "createdAt")
SELECT "id", "payout", "createdAt", 'Migrated from account total', CURRENT_TIMESTAMP
FROM "Account"
WHERE "payout" > 0;

ALTER TABLE "Account" DROP COLUMN "payout";
