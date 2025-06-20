# ParkingBot


## Структура проекта

```
parkingbot/
├── prisma/              # Схема базы данных и миграции
├── public/              # Статические файлы
│   └── data/            # Данные о парковках
├── scripts/             # Скрипты для обслуживания проекта
│   ├── data-collector.js      # Сбор данных о парковках
│   ├── initialize-tables.js   # Инициализация таблиц
│   └── ...
├── src/
│   ├── app/             # Маршруты Next.js App Router
│   ├── components/      # React компоненты
│   ├── hooks/           # Пользовательские React хуки
│   ├── lib/             # Вспомогательные функции
│   ├── pages/           # Страницы Next.js
│   ├── styles/          # Стили
│   └── types/           # TypeScript типы
└── ecosystem.config.js  # Конфигурация PM2
```

## Основные функции

1. **Мониторинг парковок**: Отображение доступных парковочных мест в Москве
2. **Telegram-бот**: Получение информации о парковках через бот
3. **Статистика**: Сбор и анализ данных о загруженности парковок
4. **Прогнозирование**: Предсказание доступности парковок на основе исторических данных

## Установка и запуск

### Требования

- Node.js 18+
- NPM или Yarn

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/parkingbot.git
cd parkingbot

# Установка зависимостей
npm install

# Настройка окружения
cp .env.example .env.local
```

### Настройка базы данных

```bash
# Генерация Prisma клиента
npx prisma generate

# Инициализация таблиц базы данных
npm run init-tables
```

### Запуск для разработки

```bash
# Запуск Next.js в режиме разработки
npm run dev
```

### Запуск в продакшн

```bash
# Сборка проекта
npm run build

# Запуск с PM2
pm2 start ecosystem.config.js
```

## Скрипты

- `npm run dev` - Запуск Next.js в режиме разработки
- `npm run build` - Сборка проекта
- `npm run start` - Запуск собранного проекта
- `npm run bot` - Запуск Telegram-бота
- `npm run data-collector` - Запуск сбора данных о парковках
- `npm run init-tables` - Инициализация таблиц базы данных
- `npm run optimize-db` - Оптимизация базы данных

## База данных

Проект использует SQLite с ORM Prisma. База данных хранится в файле `prisma/dev.db`.

Основные таблицы:
- `favorites` - Избранные парковки пользователей
- `parking_stats` - Статистика парковок
- `hourly_parking_data` - Почасовая статистика парковок
- `User` - Информация о пользователях
