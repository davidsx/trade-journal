-- Per-account cost (purchase / eval fee) on "Account".

ALTER TABLE "Account" ADD COLUMN "cost" DOUBLE PRECISION NOT NULL DEFAULT 0;
