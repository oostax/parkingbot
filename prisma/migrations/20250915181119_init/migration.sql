/*
  Warnings:

  - You are about to drop the `AdminUser` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromoCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PromoCodeRedemption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `districtsVisited` on the `UserProfile` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "AdminUser_telegramId_key";

-- DropIndex
DROP INDEX "PromoCode_code_key";

-- DropIndex
DROP INDEX "idx_user_created_at";

-- DropIndex
DROP INDEX "idx_user_username";

-- DropIndex
DROP INDEX "idx_user_telegram_id";

-- DropIndex
DROP INDEX "idx_favorites_parking_id";

-- DropIndex
DROP INDEX "idx_favorites_user_id";

-- DropIndex
DROP INDEX "idx_hourly_parking_data_date";

-- DropIndex
DROP INDEX "idx_hourly_parking_data_hour";

-- DropIndex
DROP INDEX "idx_hourly_parking_data_parking_id";

-- DropIndex
DROP INDEX "idx_parking_stats_parking_timestamp";

-- DropIndex
DROP INDEX "idx_parking_stats_timestamp";

-- DropIndex
DROP INDEX "idx_parking_stats_parking_id";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AdminUser";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PromoCode";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PromoCodeRedemption";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Challenge" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "reward" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isActive" INTEGER DEFAULT 1,
    "type" TEXT NOT NULL,
    "requirement" INTEGER NOT NULL,
    "parkIds" TEXT,
    "districtIds" TEXT
);
INSERT INTO "new_Challenge" ("description", "districtIds", "endDate", "id", "imageUrl", "isActive", "parkIds", "requirement", "reward", "startDate", "title", "type") SELECT "description", "districtIds", "endDate", "id", "imageUrl", "isActive", "parkIds", "requirement", "reward", "startDate", "title", "type" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
CREATE TABLE "new_TokenTransaction" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TEXT DEFAULT 'CURRENT_TIMESTAMP',
    CONSTRAINT "TokenTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_TokenTransaction" ("amount", "createdAt", "description", "id", "type", "userId") SELECT "amount", "createdAt", "description", "id", "type", "userId" FROM "TokenTransaction";
DROP TABLE "TokenTransaction";
ALTER TABLE "new_TokenTransaction" RENAME TO "TokenTransaction";
CREATE TABLE "new_UserProfile" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT,
    "tokenBalance" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'Regular',
    "carModel" TEXT,
    "district" TEXT,
    "lastLoginAt" TEXT DEFAULT 'CURRENT_TIMESTAMP',
    "totalParksVisited" INTEGER DEFAULT 0,
    "uniqueParksVisited" INTEGER DEFAULT 0,
    "consecutiveLoginDays" INTEGER DEFAULT 1,
    "totalTokensEarned" INTEGER DEFAULT 0,
    "totalTokensSpent" INTEGER DEFAULT 0,
    "referralsCount" INTEGER DEFAULT 0,
    "challengesCompleted" INTEGER DEFAULT 0,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_UserProfile" ("carModel", "challengesCompleted", "consecutiveLoginDays", "district", "id", "lastLoginAt", "referralsCount", "status", "tokenBalance", "totalParksVisited", "totalTokensEarned", "totalTokensSpent", "uniqueParksVisited", "userId") SELECT "carModel", "challengesCompleted", "consecutiveLoginDays", "district", "id", "lastLoginAt", "referralsCount", "status", "tokenBalance", "totalParksVisited", "totalTokensEarned", "totalTokensSpent", "uniqueParksVisited", "userId" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_UserProfile_2" ON "UserProfile"("userId");
Pragma writable_schema=0;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
