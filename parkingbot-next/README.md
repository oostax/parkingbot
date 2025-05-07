# Парковки Москвы

Интерактивная веб-приложение для отслеживания свободных мест на перехватывающих парковках Москвы.

## Возможности

- Интерактивная карта с отображением всех перехватывающих парковок
- Информация о количестве свободных мест в реальном времени
- Прогноз загруженности парковок по часам
- Добавление парковок в избранное
- Маршрут до парковки через Яндекс Карты

## Технологии

- Next.js 15
- React 19
- shadcn/ui (компоненты на основе Tailwind CSS)
- Leaflet (интерактивные карты)
- PostgreSQL (Neon)
- Vercel (хостинг)

## Установка и запуск

### Предварительные требования

- Node.js 18+ и npm/yarn/pnpm
- PostgreSQL или доступ к облачной базе данных

### Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/parkingbot-next.git
cd parkingbot-next
```

2. Установите зависимости:
```bash
npm install
# или
yarn install
# или
pnpm install
```

3. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

4. Настройте переменные окружения в файле `.env`

5. Инициализируйте базу данных:
```bash
npm run setup-db
# или
yarn setup-db
# или
pnpm setup-db
```

### Запуск в режиме разработки

```bash
npm run dev
# или
yarn dev
# или
pnpm dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

### Сборка для продакшн

```bash
npm run build
# или
yarn build
# или
pnpm build
```

## Деплой на Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fparkingbot-next)

1. Создайте проект на Vercel
2. Настройте переменные окружения в Vercel
3. Нажмите кнопку Deploy

## Лицензия

[MIT](LICENSE)
