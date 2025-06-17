// Скрипт для полного исправления настроек базы данных на сервере
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Начинаем исправление настроек базы данных...');

// Пути к файлам
const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma');
const envPath = path.resolve(process.cwd(), '.env.production');
const backupPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma.backup');

try {
  // Создаем резервную копию схемы Prisma
  if (fs.existsSync(schemaPath)) {
    console.log('Создаем резервную копию схемы Prisma...');
    fs.copyFileSync(schemaPath, backupPath);
  }

  // Создаем или обновляем файл .env.production
  console.log('Обновляем файл .env.production...');
  const envContent = `DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_SECRET="parkingbot_secure_secret_key_for_authentication_12345"
NEXTAUTH_URL="https://mosparkingbot.ru"
`;
  fs.writeFileSync(envPath, envContent, 'utf8');

  // Обновляем схему Prisma
  console.log('Обновляем схему Prisma...');
  const schemaContent = `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id         String     @id 
  username   String?
  firstName  String?
  lastName   String?
  favorites  Favorite[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  email      String?    @unique
  image      String?
  telegramId String?
  
  // Связи с моделями геймификации
  userProfile    UserProfile?
  achievements   Achievement[]
  transactions   TokenTransaction[]
  districts      UserDistrict[]
}

model Favorite {
  id          String   @id @default(cuid())
  userId      String
  parkingId   String
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])

  @@unique([userId, parkingId])
}

model ParkingStats {
  id          String   @id @default(cuid())
  parkingId   String
  timestamp   DateTime @default(now())
  freeSpaces  Int
  totalSpaces Int
}

model DailyStats {
  id              String   @id @default(cuid())
  parkingId       String
  hour            Int
  avgFreeSpaces   Float
  avg_occupancy   Float
  sampleCount     Int
  lastUpdated     DateTime

  @@unique([parkingId, hour])
}

// Модели для системы геймификации

model UserProfile {
  id                   String   @id @default(cuid())
  userId               String   @unique
  tokenBalance         Int      @default(0)
  status               String   @default("Regular") // Regular, Silver, Gold, Platinum
  carModel             String?
  district             String?
  lastLoginAt          DateTime @default(now())
  totalParksVisited    Int      @default(0)
  uniqueParksVisited   Int      @default(0)
  consecutiveLoginDays Int      @default(1)
  totalTokensEarned    Int      @default(0)
  totalTokensSpent     Int      @default(0)
  referralsCount       Int      @default(0)
  challengesCompleted  Int      @default(0)
  user                 User     @relation(fields: [userId], references: [id])
}

// Модель для хранения посещенных районов (вместо массива в UserProfile)
model UserDistrict {
  id        String @id @default(cuid())
  userId    String
  district  String
  user      User   @relation(fields: [userId], references: [id])
  
  @@unique([userId, district])
}

model Achievement {
  id           String    @id @default(cuid())
  userId       String
  achievementId String
  earned       Boolean   @default(false)
  earnedAt     DateTime?
  user         User      @relation(fields: [userId], references: [id])

  @@unique([userId, achievementId])
}

model TokenTransaction {
  id          String   @id @default(cuid())
  userId      String
  amount      Int
  type        String   // DAILY_LOGIN, ACHIEVEMENT, WHEEL_SPIN, etc.
  description String
  createdAt   DateTime @default(now())
  user        User     @relation(fields: [userId], references: [id])
}

model Challenge {
  id          String   @id @default(cuid())
  title       String
  description String
  reward      Int
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(true)
  type        String   // DAILY, WEEKLY, ONE_TIME
  requirement Int      // Требуемое количество для выполнения
  completions ChallengeCompletion[]
}

// Модель для хранения выполненных челленджей (вместо массива в Challenge)
model ChallengeCompletion {
  id          String   @id @default(cuid())
  challengeId String
  userId      String
  completedAt DateTime @default(now())
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  
  @@unique([challengeId, userId])
}`;

  fs.writeFileSync(schemaPath, schemaContent, 'utf8');
  console.log('Схема Prisma успешно обновлена.');

  // Генерируем клиент Prisma
  console.log('Генерация клиента Prisma...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Перезапускаем приложение
  console.log('Перезапуск приложения...');
  execSync('pm2 restart nextjs-app --update-env', { stdio: 'inherit' });

  console.log('Исправление настроек базы данных завершено успешно!');
} catch (error) {
  console.error('Произошла ошибка при исправлении настроек базы данных:', error);
  
  // Восстанавливаем схему из резервной копии, если она существует
  if (fs.existsSync(backupPath)) {
    console.log('Восстанавливаем схему Prisma из резервной копии...');
    fs.copyFileSync(backupPath, schemaPath);
  }
  
  process.exit(1);
} 