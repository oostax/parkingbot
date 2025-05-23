# Московские перехватывающие парковки

Телеграм мини-приложение для отслеживания свободных мест на перехватывающих парковках Москвы.

## Функциональность

- Отображение перехватывающих парковок на карте Москвы
- Просмотр информации о свободных местах в реальном времени
- Просмотр прогноза загруженности парковок
- Добавление парковок в избранное
- Интеграция с Яндекс Картами для построения маршрутов
- Возможность использования как в Telegram, так и в браузере

## Технологии

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **Карты**: react-map-gl, mapbox-gl
- **Аутентификация**: Telegram Login, NextAuth.js
- **База данных**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Хостинг**: Vercel

## Установка и запуск

1. Клонировать репозиторий
2. Установить зависимости:
   ```bash
   npm install
   ```
3. Создать файл `.env.local` со следующими переменными:
   ```
   DATABASE_URL="postgresql://neondb_owner:npg_SPEJ0XC3qmNW@ep-withered-cloud-a24cpnbc-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"
   TELEGRAM_BOT_TOKEN="ваш_токен_бота"
   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="имя_вашего_бота"
   NEXTAUTH_SECRET="ваш_секрет"
   NEXTAUTH_URL="http://localhost:3000"
   ```
4. Сгенерировать Prisma клиент:
   ```bash
   npx prisma generate
   ```
5. Запустить приложение в режиме разработки:
   ```bash
   npm run dev
   ```

## Деплой

Приложение готово к деплою на Vercel. Для этого:

1. Создайте проект на Vercel
2. Подключите репозиторий
3. Добавьте переменные окружения
4. Запустите деплой

## Структура проекта

- `src/app` - страницы и API маршруты приложения
- `src/components` - React компоненты
- `src/lib` - утилиты и библиотеки
- `src/types` - TypeScript типы
- `prisma` - схема базы данных
- `public` - статические файлы

## Telegram Mini App

Для интеграции с Telegram:

1. Создайте бота через @BotFather
2. Настройте веб-приложение для бота
3. Добавьте URL вашего приложения в настройки бота
4. Установите токен бота в `.env.local`
