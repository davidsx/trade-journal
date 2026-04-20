-- CreateTable
CREATE TABLE "AccountSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "initialBalance" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "maxLossLimit" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSettings_pkey" PRIMARY KEY ("id")
);
