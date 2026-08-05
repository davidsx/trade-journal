-- Add three-state lifecycle status, replacing the breached boolean.
CREATE TYPE "AccountStatus" AS ENUM ('Running', 'Passed', 'Breached');

ALTER TABLE "Account" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'Running';

-- Backfill: breached rows become Breached; everything else stays Running.
UPDATE "Account" SET "status" = 'Breached' WHERE "breached" = true;

ALTER TABLE "Account" DROP COLUMN "breached";
