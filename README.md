# 🚗 MosParking - Система мониторинга парковок Москвы

Современное веб-приложение для отслеживания свободных мест на парковках Москвы с элементами геймификации и социальных функций.

## ✨ Основные возможности

- 🗺️ **Интерактивная карта** с отображением парковок в реальном времени
- 📱 **Telegram Mini App** для удобного доступа через мессенджер
- ⭐ **Система избранного** для быстрого доступа к любимым парковкам
- 🎮 **Геймификация** с токенами, достижениями и челленджами
- 🔍 **Умный поиск** с фильтрацией по типу и местоположению
- 📊 **Статистика и прогнозы** загруженности парковок
- 👥 **Многопользовательская система** с профилями и рейтингами

## 🏗️ Архитектура

### Технологический стек
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Shadcn UI, Radix UI
- **Карты**: React Leaflet, Mapbox GL
- **Backend**: Next.js API Routes
- **База данных**: SQLite + Prisma ORM
- **Кэширование**: Redis
- **Авторизация**: NextAuth.js с Telegram WebApp
- **Мониторинг**: Кастомная система логирования

### Структура проекта
```
parkingbot/
├── prisma/              # Схема БД и миграции
├── public/data/         # Данные о парковках
├── scripts/             # Скрипты обслуживания
├── src/
│   ├── app/             # Next.js App Router
│   ├── components/      # React компоненты
│   ├── lib/             # Утилиты и сервисы
│   └── types/           # TypeScript типы
└── docker-compose.yml   # Docker конфигурация
```

## 🚀 Быстрый старт

### Предварительные требования
- Node.js 18+
- Redis (для кэширования)
- Telegram Bot Token

### 1. Установка зависимостей
```bash
git clone <repository-url>
cd parkingbot
npm install
```

### 2. Настройка окружения
Создайте файл `.env.local`:
```env
# База данных
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-bot-token"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your-bot-username"

# Redis
REDIS_URL="redis://localhost:6379"

# Yandex Maps (опционально)
NEXT_PUBLIC_YANDEX_MAPS_API_KEY="your-yandex-key"
```

### 3. Запуск Redis
```bash
# С Docker
docker-compose up redis -d

# Или локально
redis-server
```

### 4. Инициализация базы данных
```bash
# Применение миграций
npx prisma migrate dev

# Генерация Prisma клиента
npx prisma generate
```

### 5. Запуск приложения
```bash
# Режим разработки
npm run dev

# Продакшн
npm run build
npm start
```

## 📊 Производительность

### Оптимизации
- ✅ **Redis кэширование** для API запросов
- ✅ **Индексы БД** для быстрых запросов
- ✅ **Оптимизированная загрузка** данных парковок
- ✅ **Rate limiting** для защиты от злоупотреблений
- ✅ **Валидация данных** с Zod
- ✅ **Система логирования** для мониторинга

### Мониторинг
```bash
# Просмотр логов
tail -f logs/app.log

# Статистика Redis
redis-cli info memory

# Статистика БД
npx prisma studio
```

## 🎮 Геймификация

### Система токенов
- Ежедневный бонус за вход
- Награды за достижения
- Колесо удачи
- Промокоды

### Достижения
- Первый вход
- Исследователь (5 парковок)
- Опытный водитель (10 парковок)
- Постоянный пользователь (3 дня подряд)

### Челленджи
- Еженедельные задания
- Сезонные события
- Групповые активности

## 🔧 API

### Основные эндпоинты
- `GET /api/parkings` - Список парковок
- `GET /api/parkings/[id]` - Детали парковки
- `GET /api/favorites` - Избранные парковки
- `POST /api/favorites` - Добавить в избранное
- `DELETE /api/favorites` - Удалить из избранного

### Геймификация
- `GET /api/gamification/profile` - Профиль пользователя
- `GET /api/gamification/achievements` - Достижения
- `POST /api/gamification/wheel` - Колесо удачи
- `GET /api/gamification/leaderboard` - Рейтинг

## 🛠️ Разработка

### Полезные команды
```bash
# Разработка
npm run dev

# Сборка
npm run build

# Линтинг
npm run lint

# Тесты
npm test

# Бот
npm run bot

# Сбор данных
npm run data-collector
```

### Структура БД
```sql
-- Основные таблицы
User (пользователи)
UserProfile (профили и геймификация)
favorites (избранные парковки)
parking_stats (статистика парковок)
hourly_parking_data (почасовые данные)

-- Геймификация
Achievement (достижения)
TokenTransaction (транзакции токенов)
Challenge (челленджи)
PromoCode (промокоды)
```

## 🚀 Деплой

### Docker
```bash
docker-compose up -d
```

### PM2
```bash
pm2 start ecosystem.config.js
```

### Vercel/Netlify
```bash
npm run build
# Деплой через веб-интерфейс
```

## 📈 Мониторинг

### Метрики
- Время отклика API
- Использование кэша
- Активность пользователей
- Ошибки и исключения

### Логирование
- Структурированные логи
- Уровни логирования
- Контекстная информация
- Производительность

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Внесите изменения
4. Добавьте тесты
5. Создайте Pull Request

## 📄 Лицензия

MIT License - см. файл LICENSE

## 🆘 Поддержка

- 📧 Email: support@mosparking.ru
- 💬 Telegram: @mosparking_support
- 🐛 Issues: GitHub Issues
