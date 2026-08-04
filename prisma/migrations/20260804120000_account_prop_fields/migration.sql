-- Prop-firm metadata on "Account".

CREATE TYPE "Stage" AS ENUM ('Eval', 'Funded');

ALTER TABLE "Account" ADD COLUMN "propfirmName" TEXT;
ALTER TABLE "Account" ADD COLUMN "description" TEXT;
ALTER TABLE "Account" ADD COLUMN "breached" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "numberOfAccounts" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Account" ADD COLUMN "stage" "Stage" NOT NULL DEFAULT 'Eval';
