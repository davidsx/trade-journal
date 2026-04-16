-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "accessToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contractName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "fees" REAL NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "orderId" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "contractId" INTEGER NOT NULL,
    "contractName" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "entryFillId" TEXT NOT NULL,
    "exitFillId" TEXT NOT NULL,
    "entryPrice" REAL NOT NULL,
    "exitPrice" REAL NOT NULL,
    "entryTime" DATETIME NOT NULL,
    "exitTime" DATETIME NOT NULL,
    "holdingMins" REAL NOT NULL,
    "grossPnl" REAL NOT NULL,
    "fees" REAL NOT NULL,
    "netPnl" REAL NOT NULL,
    "rMultiple" REAL,
    "qualityScore" INTEGER,
    "entryScore" INTEGER,
    "exitScore" INTEGER,
    "riskScore" INTEGER,
    "scoreNotes" TEXT,
    "capitalBefore" REAL NOT NULL,
    "capitalAfter" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" INTEGER NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fillsAdded" INTEGER NOT NULL,
    "tradesBuilt" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_accountId_key" ON "AuthToken"("accountId");

-- CreateIndex
CREATE INDEX "Fill_accountId_timestamp_idx" ON "Fill"("accountId", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_accountId_entryTime_idx" ON "Trade"("accountId", "entryTime");
