-- CreateTable
CREATE TABLE "Device" (
    "deviceId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "productName" TEXT,
    "category" TEXT,
    "firstSeenUtc" DATETIME,
    "lastSeenUtc" DATETIME,
    "lastOnlineUtc" DATETIME,
    "lastStatus" JSONB
);

-- CreateTable
CREATE TABLE "RawEnergy" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "tsUtc" DATETIME NOT NULL,
    "addEleKwh" DECIMAL NOT NULL
);

-- CreateTable
CREATE TABLE "RawHealth" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "tsUtc" DATETIME NOT NULL,
    "powerW" INTEGER,
    "voltageV" DECIMAL,
    "currentA" DECIMAL,
    "pfEst" DECIMAL,
    "online" BOOLEAN
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "tsUtc" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB
);

-- CreateTable
CREATE TABLE "DailyKwh" (
    "deviceId" TEXT NOT NULL,
    "dayIst" DATETIME NOT NULL,
    "kwh" DECIMAL NOT NULL,

    PRIMARY KEY ("deviceId", "dayIst")
);

-- CreateTable
CREATE TABLE "Rollup1m" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "windowUtc" DATETIME NOT NULL,
    "avgPowerW" INTEGER,
    "minPowerW" INTEGER,
    "maxPowerW" INTEGER,
    "lastAddEle" DECIMAL,
    "kwh" DECIMAL
);

-- CreateTable
CREATE TABLE "Rollup15m" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "windowUtc" DATETIME NOT NULL,
    "avgPowerW" INTEGER,
    "minPowerW" INTEGER,
    "maxPowerW" INTEGER,
    "kwh" DECIMAL
);

-- CreateTable
CREATE TABLE "Rollup1h" (
    "id" BIGINT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "windowUtc" DATETIME NOT NULL,
    "avgPowerW" INTEGER,
    "minPowerW" INTEGER,
    "maxPowerW" INTEGER,
    "kwh" DECIMAL
);

-- CreateIndex
CREATE INDEX "RawEnergy_deviceId_tsUtc_idx" ON "RawEnergy"("deviceId", "tsUtc");

-- CreateIndex
CREATE INDEX "RawHealth_deviceId_tsUtc_idx" ON "RawHealth"("deviceId", "tsUtc");

-- CreateIndex
CREATE INDEX "Event_deviceId_tsUtc_idx" ON "Event"("deviceId", "tsUtc");

-- CreateIndex
CREATE INDEX "Rollup1m_deviceId_windowUtc_idx" ON "Rollup1m"("deviceId", "windowUtc");

-- CreateIndex
CREATE INDEX "Rollup15m_deviceId_windowUtc_idx" ON "Rollup15m"("deviceId", "windowUtc");

-- CreateIndex
CREATE INDEX "Rollup1h_deviceId_windowUtc_idx" ON "Rollup1h"("deviceId", "windowUtc");
