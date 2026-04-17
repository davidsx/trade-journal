-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contractName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contractName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "entryFillId" TEXT NOT NULL,
    "exitFillId" TEXT NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION NOT NULL,
    "entryTime" TIMESTAMP(3) NOT NULL,
    "exitTime" TIMESTAMP(3) NOT NULL,
    "holdingMins" DOUBLE PRECISION NOT NULL,
    "grossPnl" DOUBLE PRECISION NOT NULL,
    "fees" DOUBLE PRECISION NOT NULL,
    "netPnl" DOUBLE PRECISION NOT NULL,
    "rMultiple" DOUBLE PRECISION,
    "qualityScore" INTEGER,
    "entryScore" INTEGER,
    "exitScore" INTEGER,
    "riskScore" INTEGER,
    "scoreNotes" TEXT,
    "capitalBefore" DOUBLE PRECISION NOT NULL,
    "capitalAfter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fill_accountId_timestamp_idx" ON "Fill"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_accountId_entryTime_idx" ON "Trade"("accountId", "entryTime");
