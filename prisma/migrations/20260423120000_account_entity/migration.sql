-- Create "Account" and seed #1; link Trade, Fill, and AccountSettings.

CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Account" ("id", "name", "createdAt")
VALUES (1, 'Default', CURRENT_TIMESTAMP);

-- Keep SERIAL aligned after explicit id insert
SELECT setval(pg_get_serial_sequence('"Account"', 'id'), (SELECT MAX("id") FROM "Account"));

-- Legacy AccountSettings: PK was "id" (default 1). Re-key to "accountId" -> Account.
INSERT INTO "AccountSettings" ("id", "initialBalance", "updatedAt")
SELECT 1, 50000, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AccountSettings" WHERE "id" = 1);

ALTER TABLE "AccountSettings" ADD COLUMN "accountId" INTEGER;
UPDATE "AccountSettings" SET "accountId" = "id" WHERE "accountId" IS NULL;
ALTER TABLE "AccountSettings" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "AccountSettings" DROP CONSTRAINT "AccountSettings_pkey";
ALTER TABLE "AccountSettings" DROP COLUMN "id";
ALTER TABLE "AccountSettings" ADD CONSTRAINT "AccountSettings_pkey" PRIMARY KEY ("accountId");
ALTER TABLE "AccountSettings" ADD CONSTRAINT "AccountSettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AccountSettings" ("accountId", "initialBalance", "updatedAt")
SELECT 1, 50000, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AccountSettings" WHERE "accountId" = 1);

-- Single-account app: everything belongs to account #1
UPDATE "Trade" SET "accountId" = 1;
UPDATE "Fill" SET "accountId" = 1;

ALTER TABLE "Trade" ADD CONSTRAINT "Trade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Fill" ADD CONSTRAINT "Fill_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
