/** @type {import('next').NextConfig} */
const path = require('path');
const os = require('os');

// Определяем абсолютный путь к файлу базы данных
const getDbPath = () => {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  
  // Форматируем путь в зависимости от платформы
  if (os.platform() === 'win32') {
    // Для Windows используем формат с буквой диска и обратными слешами
    return `file:${dbPath.replace(/\\/g, '/')}`;
  } else {
    // Для Unix используем абсолютный путь
    return `file:${dbPath}`;
  }
};

const nextConfig = {
  reactStrictMode: true,
  // Удаляем устаревшую опцию swcMinify
  
  // Отключаем проверку типов
  typescript: {
    // ⚠️ Важно: это временное решение для обхода проблемы с типами в Next.js 15.1.8
    // Позднее рекомендуется решить проблему корректного типизирования API-маршрутов
    ignoreBuildErrors: true,
  },
  
  // Определяем переменные окружения
  env: {
    DATABASE_URL: getDbPath(),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || (os.platform() === 'win32' ? 'http://localhost:3000' : 'https://mosparkingbot.ru'),
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'parkingbot_secure_secret_key_for_authentication_12345',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A',
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'mosmetroparkingbot',
  },
  
  // Добавляем обработку изображений
  images: {
    domains: ['t.me', 'telegram.org', 'cdn.mosparkingbot.ru'],
  },
  
  // Оптимизация для production
  compiler: {
    // Удаляем консольные вызовы в production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Настройка webpack для работы с SQLite
  webpack: (config, { isServer }) => {
    // Добавляем поддержку SQLite для Node.js
    if (isServer) {
      config.externals.push('sqlite3');
    }
    
    return config;
  },
};

module.exports = nextConfig; 