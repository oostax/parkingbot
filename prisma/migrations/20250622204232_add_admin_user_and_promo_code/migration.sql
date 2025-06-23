/*
  Warnings:

  - You are about to alter the column `earned` on the `Achievement` table. The data in that column could be lost. The data in that column will be cast from `Boolean` to `Int`.
  - You are about to alter the column `isActive` on the `Challenge` table. The data in that column could be lost. The data in that column will be cast from `Boolean` to `Int`.

*/
-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'tokens',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TEXT,
    "usageLimit" INTEGER DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "PromoCodeRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoCodeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP',
    CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT NOT NULL,
    "username" TEXT,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "addedById" TEXT,
    "createdAt" TEXT NOT NULL DEFAULT 'CURRENT_TIMESTAMP'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earned" INTEGER DEFAULT 0,
    "earnedAt" TEXT,
    CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_Achievement" ("achievementId", "earned", "earnedAt", "id", "userId") SELECT "achievementId", "earned", "earnedAt", "id", "userId" FROM "Achievement";
DROP TABLE "Achievement";
ALTER TABLE "new_Achievement" RENAME TO "Achievement";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_Achievement_2" ON "Achievement"("userId", "achievementId");
Pragma writable_schema=0;
CREATE TABLE "new_Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reward" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "isActive" INTEGER DEFAULT 1,
    "type" TEXT NOT NULL,
    "requirement" INTEGER NOT NULL,
    "districtIds" TEXT,
    "imageUrl" TEXT,
    "parkIds" TEXT
);
INSERT INTO "new_Challenge" ("description", "endDate", "id", "isActive", "requirement", "reward", "startDate", "title", "type") SELECT "description", "endDate", "id", "isActive", "requirement", "reward", "startDate", "title", "type" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
CREATE TABLE "new_ChallengeCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TEXT DEFAULT 'CURRENT_TIMESTAMP',
    CONSTRAINT "ChallengeCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_ChallengeCompletion" ("challengeId", "completedAt", "id", "userId") SELECT "challengeId", "completedAt", "id", "userId" FROM "ChallengeCompletion";
DROP TABLE "ChallengeCompletion";
ALTER TABLE "new_ChallengeCompletion" RENAME TO "ChallengeCompletion";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_ChallengeCompletion_2" ON "ChallengeCompletion"("challengeId", "userId");
Pragma writable_schema=0;
CREATE TABLE "new_TokenTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TEXT DEFAULT 'CURRENT_TIMESTAMP',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "image" TEXT,
    "telegramId" TEXT
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "image", "lastName", "telegramId", "updatedAt", "username") SELECT "createdAt", "email", "firstName", "id", "image", "lastName", "telegramId", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_User_2" ON "User"("email");
Pragma writable_schema=0;
CREATE TABLE "new_UserDistrict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    CONSTRAINT "UserDistrict_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_UserDistrict" ("district", "id", "userId") SELECT "district", "id", "userId" FROM "UserDistrict";
DROP TABLE "UserDistrict";
ALTER TABLE "new_UserDistrict" RENAME TO "UserDistrict";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_UserDistrict_2" ON "UserDistrict"("userId", "district");
Pragma writable_schema=0;
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "districtsVisited" TEXT DEFAULT '[]',
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
INSERT INTO "new_UserProfile" ("carModel", "challengesCompleted", "consecutiveLoginDays", "district", "id", "lastLoginAt", "referralsCount", "status", "tokenBalance", "totalParksVisited", "totalTokensEarned", "totalTokensSpent", "uniqueParksVisited", "userId") SELECT "carModel", "challengesCompleted", "consecutiveLoginDays", "district", "id", "lastLoginAt", "referralsCount", "status", "tokenBalance", "totalParksVisited", "totalTokensEarned", "totalTokensSpent", "uniqueParksVisited", "userId" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_UserProfile_2" ON "UserProfile"("userId");
Pragma writable_schema=0;
CREATE TABLE "new_favorites" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" TEXT NOT NULL,
    "parking_id" TEXT NOT NULL,
    "timestamp" TEXT DEFAULT 'CURRENT_TIMESTAMP'
);
INSERT INTO "new_favorites" ("id", "parking_id", "timestamp", "user_id") SELECT "id", "parking_id", "timestamp", "user_id" FROM "favorites";
DROP TABLE "favorites";
ALTER TABLE "new_favorites" RENAME TO "favorites";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_favorites_1" ON "favorites"("user_id", "parking_id");
Pragma writable_schema=0;
CREATE TABLE "new_hourly_parking_data" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parking_id" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "free_spaces" INTEGER NOT NULL,
    "total_spaces" INTEGER NOT NULL,
    "date_updated" TEXT NOT NULL
);
INSERT INTO "new_hourly_parking_data" ("date_updated", "free_spaces", "hour", "id", "parking_id", "total_spaces") SELECT "date_updated", "free_spaces", "hour", "id", "parking_id", "total_spaces" FROM "hourly_parking_data";
DROP TABLE "hourly_parking_data";
ALTER TABLE "new_hourly_parking_data" RENAME TO "hourly_parking_data";
Pragma writable_schema=1;
CREATE UNIQUE INDEX "sqlite_autoindex_hourly_parking_data_1" ON "hourly_parking_data"("parking_id", "hour");
Pragma writable_schema=0;
CREATE TABLE "new_parking_stats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "parking_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "free_spaces" INTEGER NOT NULL,
    "total_spaces" INTEGER NOT NULL
);
INSERT INTO "new_parking_stats" ("free_spaces", "id", "parking_id", "timestamp", "total_spaces") SELECT "free_spaces", "id", "parking_id", "timestamp", "total_spaces" FROM "parking_stats";
DROP TABLE "parking_stats";
ALTER TABLE "new_parking_stats" RENAME TO "parking_stats";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_telegramId_key" ON "AdminUser"("telegramId");
