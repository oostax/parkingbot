# 🚀 Инструкция по деплою MosParking

Подробное руководство по развертыванию проекта на сервере.

## 📋 Предварительные требования

### Системные требования
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: Минимум 2GB, рекомендуется 4GB+
- **CPU**: 2+ ядра
- **Диск**: 20GB+ свободного места
- **Сеть**: Статический IP адрес

### Необходимое ПО
- Node.js 18+
- PM2 (Process Manager)
- Nginx (веб-сервер)
- Redis (кэширование)
- PostgreSQL (опционально, для продакшена)
- Git
- SSL сертификат (Let's Encrypt)

## 🛠️ Подготовка сервера

### 1. Обновление системы
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

### 2. Установка Node.js 18+
```bash
# Установка NodeSource репозитория
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Установка Node.js
sudo apt install -y nodejs

# Проверка версии
node --version
npm --version
```

### 3. Установка PM2
```bash
sudo npm install -g pm2
```

### 4. Установка Nginx
```bash
# Ubuntu/Debian
sudo apt install -y nginx

# CentOS/RHEL
sudo yum install -y nginx

# Запуск и автозапуск
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 5. Установка Redis
```bash
# Ubuntu/Debian
sudo apt install -y redis-server

# CentOS/RHEL
sudo yum install -y redis

# Запуск и автозапуск
sudo systemctl start redis
sudo systemctl enable redis

# Проверка
redis-cli ping
```

### 6. Установка PostgreSQL (опционально)
```bash
# Ubuntu/Debian
sudo apt install -y postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install -y postgresql-server postgresql-contrib

# Инициализация (только для CentOS)
sudo postgresql-setup initdb

# Запуск и автозапуск
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## 📁 Развертывание приложения

### 1. Создание пользователя для приложения
```bash
# Создание пользователя
sudo adduser --system --group --home /opt/mosparking mosparking

# Переключение на пользователя
sudo su - mosparking
```

### 2. Клонирование репозитория
```bash
# Переход в домашнюю директорию
cd /opt/mosparking

# Клонирование проекта
git clone <your-repository-url> app
cd app

# Установка зависимостей
npm install --production
```

### 3. Настройка переменных окружения
```bash
# Создание файла .env
nano .env
```

Содержимое `.env`:
```env
# База данных
DATABASE_URL="file:./prisma/prod.db"

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-super-secret-key-here"

# Telegram Bot
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME="your-bot-username"

# Redis
REDIS_URL="redis://localhost:6379"

# Yandex Maps (опционально)
NEXT_PUBLIC_YANDEX_MAPS_API_KEY="your-yandex-api-key"

# Webhook URL
WEBHOOK_URL="https://yourdomain.com/api/webhook"

# Режим продакшена
NODE_ENV="production"
```

### 4. Настройка базы данных
```bash
# Применение миграций
npx prisma migrate deploy

# Генерация Prisma клиента
npx prisma generate

# Инициализация данных (если нужно)
npm run setup-db
```

### 5. Сборка приложения
```bash
# Сборка для продакшена
npm run build
```

## ⚙️ Настройка PM2

### 1. Создание конфигурации PM2
```bash
# Создание файла конфигурации
nano ecosystem.config.js
```

Содержимое `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'mosparking',
    script: 'npm',
    args: 'start',
    cwd: '/opt/mosparking/app',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/opt/mosparking/logs/err.log',
    out_file: '/opt/mosparking/logs/out.log',
    log_file: '/opt/mosparking/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 2. Создание директорий для логов
```bash
mkdir -p /opt/mosparking/logs
chown -R mosparking:mosparking /opt/mosparking
```

### 3. Запуск приложения
```bash
# Запуск с PM2
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска
pm2 startup
```

## 🌐 Настройка Nginx

### 1. Создание конфигурации сайта
```bash
sudo nano /etc/nginx/sites-available/mosparking
```

Содержимое конфигурации:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Редирект на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Основное приложение
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Статические файлы
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, immutable";
    }

    # API эндпоинты
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhook для Telegram
    location /api/webhook {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Активация сайта
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/mosparking /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl reload nginx
```

## 🔒 Настройка SSL сертификата

### 1. Установка Certbot
```bash
# Ubuntu/Debian
sudo apt install -y certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install -y certbot python3-certbot-nginx
```

### 2. Получение SSL сертификата
```bash
# Получение сертификата
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автоматическое обновление
sudo crontab -e
# Добавить строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔄 Настройка автоматического деплоя

### 1. Создание скрипта деплоя
```bash
nano /opt/mosparking/deploy.sh
```

Содержимое скрипта:
```bash
#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Начинаем деплой MosParking...${NC}"

# Переход в директорию приложения
cd /opt/mosparking/app

# Получение последних изменений
echo -e "${YELLOW}📥 Получение изменений из репозитория...${NC}"
git pull origin main

# Установка зависимостей
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
npm install --production

# Применение миграций БД
echo -e "${YELLOW}🗄️ Применение миграций базы данных...${NC}"
npx prisma migrate deploy

# Генерация Prisma клиента
echo -e "${YELLOW}🔧 Генерация Prisma клиента...${NC}"
npx prisma generate

# Сборка приложения
echo -e "${YELLOW}🏗️ Сборка приложения...${NC}"
npm run build

# Перезапуск PM2
echo -e "${YELLOW}🔄 Перезапуск приложения...${NC}"
pm2 reload mosparking

# Проверка статуса
echo -e "${YELLOW}✅ Проверка статуса приложения...${NC}"
pm2 status

echo -e "${GREEN}🎉 Деплой завершен успешно!${NC}"
```

### 2. Настройка прав доступа
```bash
chmod +x /opt/mosparking/deploy.sh
chown mosparking:mosparking /opt/mosparking/deploy.sh
```

### 3. Настройка Webhook для автоматического деплоя
```bash
# Создание webhook скрипта
nano /opt/mosparking/webhook.sh
```

Содержимое webhook скрипта:
```bash
#!/bin/bash

# Проверка подписи GitHub webhook (опционально)
# if [ "$1" != "your-secret-token" ]; then
#     echo "Unauthorized"
#     exit 1
# fi

# Выполнение деплоя
sudo -u mosparking /opt/mosparking/deploy.sh
```

## 📊 Мониторинг и логи

### 1. Настройка логирования
```bash
# Создание директории для логов
sudo mkdir -p /var/log/mosparking
sudo chown mosparking:mosparking /var/log/mosparking

# Настройка ротации логов
sudo nano /etc/logrotate.d/mosparking
```

Содержимое logrotate:
```
/opt/mosparking/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 mosparking mosparking
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 2. Мониторинг с PM2
```bash
# Просмотр логов
pm2 logs mosparking

# Мониторинг в реальном времени
pm2 monit

# Статистика
pm2 show mosparking
```

### 3. Настройка мониторинга системы
```bash
# Установка htop для мониторинга
sudo apt install -y htop

# Установка iotop для мониторинга диска
sudo apt install -y iotop
```

## 🔧 Полезные команды

### Управление приложением
```bash
# Статус приложения
pm2 status

# Перезапуск
pm2 restart mosparking

# Остановка
pm2 stop mosparking

# Удаление из PM2
pm2 delete mosparking

# Просмотр логов
pm2 logs mosparking --lines 100

# Мониторинг
pm2 monit
```

### Управление Nginx
```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx

# Статус
sudo systemctl status nginx

# Просмотр логов
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Управление Redis
```bash
# Статус
sudo systemctl status redis

# Перезапуск
sudo systemctl restart redis

# Подключение к Redis
redis-cli

# Очистка кэша
redis-cli FLUSHALL
```

### Управление базой данных
```bash
# Подключение к Prisma Studio
npx prisma studio

# Сброс базы данных
npx prisma migrate reset

# Создание резервной копии
cp prisma/prod.db prisma/backup-$(date +%Y%m%d).db
```

## 🚨 Устранение неполадок

### Частые проблемы

#### 1. Приложение не запускается
```bash
# Проверка логов
pm2 logs mosparking

# Проверка портов
sudo netstat -tlnp | grep :3000

# Проверка переменных окружения
pm2 show mosparking
```

#### 2. Ошибки базы данных
```bash
# Проверка файла БД
ls -la prisma/prod.db

# Проверка прав доступа
ls -la prisma/

# Восстановление из резервной копии
cp prisma/backup-*.db prisma/prod.db
```

#### 3. Проблемы с Redis
```bash
# Проверка статуса
sudo systemctl status redis

# Проверка подключения
redis-cli ping

# Очистка кэша
redis-cli FLUSHALL
```

#### 4. Ошибки Nginx
```bash
# Проверка конфигурации
sudo nginx -t

# Просмотр логов
sudo tail -f /var/log/nginx/error.log

# Перезапуск
sudo systemctl restart nginx
```

## 📈 Оптимизация производительности

### 1. Настройка PM2
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'mosparking',
    script: 'npm',
    args: 'start',
    instances: 'max', // Использовать все CPU ядра
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

### 2. Настройка Nginx
```nginx
# Кэширование статических файлов
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Сжатие
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 3. Настройка Redis
```bash
# /etc/redis/redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 🔐 Безопасность

### 1. Настройка файрвола
```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000

# iptables (CentOS)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

### 2. Настройка SSH
```bash
# Отключение root логина
sudo nano /etc/ssh/sshd_config
# PermitRootLogin no

# Перезапуск SSH
sudo systemctl restart ssh
```

### 3. Регулярные обновления
```bash
# Автоматические обновления безопасности
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `pm2 logs mosparking`
2. Проверьте статус сервисов: `sudo systemctl status nginx redis`
3. Проверьте конфигурацию: `sudo nginx -t`
4. Обратитесь к документации проекта

---

**Удачного деплоя! 🚀**
