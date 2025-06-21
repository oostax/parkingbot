// This module ensures environment variables are loaded
import { config } from 'dotenv';
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from multiple .env files
config({ path: '.env.development' });
config({ path: '.env.local' });
config({ path: '.env' });

// Определение схемы переменных окружения
const envSchema = z.object({
  // URL для подключения к базе данных
  DATABASE_URL: z.string().url(),
  
  // Секретный ключ для NextAuth
  NEXTAUTH_SECRET: z.string(),
  
  // URL для NextAuth
  NEXTAUTH_URL: z.string().url(),
  
  // Токен для Telegram бота
  TELEGRAM_BOT_TOKEN: z.string(),
  
  // Имя пользователя Telegram бота
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string(),
});

// Функция для получения абсолютного пути к файлу базы данных
function getAbsoluteDatabasePath() {
  // Определяем путь к файлу базы данных в зависимости от платформы
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  
  // Формируем URL в зависимости от платформы
  if (process.platform === 'win32') {
    // Для Windows используем формат с буквой диска и обратными слешами
    return `file:${dbPath.replace(/\\/g, '/')}`;
  } else {
    // Для Unix используем абсолютный путь
    return `file:${dbPath}`;
  }
}

// Функция для получения переменных окружения с проверкой
function getEnvVariables() {
  // Пытаемся получить переменные из .env файла
  try {
    const parsed = envSchema.safeParse(process.env);
    
    if (parsed.success) {
      return parsed.data;
    } else {
      // Если переменные не прошли валидацию, используем значения по умолчанию
      console.warn("⚠️ Переменные окружения не прошли валидацию, используем значения по умолчанию");
      
      const defaultEnv = {
        DATABASE_URL: getAbsoluteDatabasePath(),
        NEXTAUTH_SECRET: "parkingbot_secure_secret_key_for_authentication_12345",
        NEXTAUTH_URL: process.platform === 'win32' ? "http://localhost:3000" : "https://mosparkingbot.ru",
        TELEGRAM_BOT_TOKEN: "7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A",
        NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "mosmetroparkingbot",
      };
      
      return defaultEnv;
    }
  } catch (error) {
    // В случае ошибки используем значения по умолчанию
    console.error("❌ Ошибка при получении переменных окружения:", error);
    
    const defaultEnv = {
      DATABASE_URL: getAbsoluteDatabasePath(),
      NEXTAUTH_SECRET: "parkingbot_secure_secret_key_for_authentication_12345",
      NEXTAUTH_URL: process.platform === 'win32' ? "http://localhost:3000" : "https://mosparkingbot.ru",
      TELEGRAM_BOT_TOKEN: "7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A",
      NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: "mosmetroparkingbot",
    };
    
    return defaultEnv;
  }
}

// Экспортируем переменные окружения
export const env = getEnvVariables();

// Экспортируем путь к базе данных для использования в других модулях
export const DATABASE_PATH = getAbsoluteDatabasePath();

// Set DATABASE_URL both as a module export and as a global environment variable
if (typeof process !== 'undefined' && process.env) {
  // Set the environment variable if it's not already set
  if (!process.env.DATABASE_URL) {
    console.log('Setting DATABASE_URL environment variable with default value');
    process.env.DATABASE_URL = DATABASE_PATH;
  } else {
    console.log('DATABASE_URL environment variable already set');
  }

  // Log the DATABASE_URL value
  console.log(`Current DATABASE_URL: ${process.env.DATABASE_URL}`);
}

// Set the variable in global scope for Prisma
if (typeof global !== 'undefined') {
  (global as any).DATABASE_URL = process.env.DATABASE_URL || DATABASE_PATH;
}

export default {
  DATABASE_URL: process.env.DATABASE_URL || DATABASE_PATH
}; 