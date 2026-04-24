-- Starting capital: single field on "Account" only. Remove legacy "AccountSettings".

ALTER TABLE "Account" ADD COLUMN "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 50000;
ALTER TABLE "Account" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Canonical value for all accounts (50,000)
UPDATE "Account" SET "initialBalance" = 50000;

DROP TABLE IF EXISTS "AccountSettings";
