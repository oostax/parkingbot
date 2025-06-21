#!/bin/bash

# Скрипт для автоматического деплоя приложения на сервер
# Должен запускаться на сервере после git pull

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода сообщений с отметкой времени
log() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warn() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Функция для установки необходимых зависимостей
install_dependencies() {
  log "Проверка и установка необходимых зависимостей..."
  
  # Определение дистрибутива Linux
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
  else
    OS=$(uname -s)
  fi
  
  log "Определен дистрибутив: $OS"
  
  # Проверка и установка curl
  if ! command -v curl &> /dev/null; then
    log "Установка curl..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
      apt update && apt install -y curl
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
      yum install -y curl
    else
      error "Неизвестный дистрибутив. Установите curl вручную."
      exit 1
    fi
  fi
  
  # Проверка и установка Node.js и npm
  if ! command -v node &> /dev/null; then
    log "Node.js не найден. Установка Node.js и npm..."
    
    # Установка Node.js 18.x LTS
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
      curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
      apt install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "fedora" ]; then
      curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
      yum install -y nodejs
    else
      error "Неизвестный дистрибутив. Установите Node.js вручную."
      exit 1
    fi
    
    log "Node.js и npm установлены."
  fi
  
  # Проверка и установка PM2
  if ! command -v pm2 &> /dev/null; then
    log "PM2 не найден. Установка PM2..."
    npm install -g pm2
    log "PM2 установлен."
  fi
  
  log "Все необходимые зависимости установлены."
}

# Проверка и установка зависимостей
install_dependencies

# Проверка наличия необходимых команд после установки
log "Проверка наличия необходимых команд..."
if ! command -v node &> /dev/null; then
  error "Node.js не установлен. Установите его вручную."
  exit 1
fi

if ! command -v npm &> /dev/null; then
  error "npm не установлен. Установите его вручную."
  exit 1
fi

if ! command -v pm2 &> /dev/null; then
  error "PM2 не установлен. Установите его вручную: npm install -g pm2"
  exit 1
fi

# Определение директории проекта
PROJECT_DIR=$(pwd)
log "Директория проекта: $PROJECT_DIR"

# Установка пользователя веб-сервера
# Обычно это www-data для nginx/apache на Ubuntu/Debian
WEB_USER="www-data"
log "Пользователь веб-сервера: $WEB_USER"

# Установка зависимостей
log "Установка зависимостей проекта..."
npm install
if [ $? -ne 0 ]; then
  error "Ошибка при установке зависимостей"
  exit 1
fi
log "Зависимости проекта успешно установлены"

# Создание директории для базы данных, если она не существует
log "Проверка наличия директории для базы данных..."
mkdir -p "$PROJECT_DIR/prisma"
if [ $? -ne 0 ]; then
  error "Не удалось создать директорию для базы данных"
  exit 1
fi
log "Директория для базы данных готова"

# Резервное копирование базы данных если она существует
DB_FILE="$PROJECT_DIR/prisma/dev.db"
if [ -f "$DB_FILE" ]; then
  log "Создание резервной копии базы данных..."
  BACKUP_DIR="$PROJECT_DIR/backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/dev.db.$(date '+%Y%m%d_%H%M%S').bak"
  cp "$DB_FILE" "$BACKUP_FILE"
  if [ $? -eq 0 ]; then
    log "Резервная копия создана: $BACKUP_FILE"
  else
    warn "Не удалось создать резервную копию базы данных"
  fi
fi

# Настройка базы данных
log "Настройка базы данных..."
node scripts/setup-database.js
if [ $? -ne 0 ]; then
  error "Ошибка при настройке базы данных"
  exit 1
fi
log "База данных успешно настроена"

# Установка правильных прав доступа для базы данных
log "Установка прав доступа к файлу базы данных..."
if [ -f "$DB_FILE" ]; then
  chmod 666 "$DB_FILE"
  chmod 777 "$PROJECT_DIR/prisma"
  log "Права доступа к файлу базы данных установлены: 666"
  
  # Проверка владельца файла
  DB_OWNER=$(stat -c '%U' "$DB_FILE")
  log "Текущий владелец файла базы данных: $DB_OWNER"
  
  # Изменение владельца файла на пользователя, от имени которого запущен веб-сервер
  if [ -n "$WEB_USER" ]; then
    chown $WEB_USER:$WEB_USER "$DB_FILE" 2>/dev/null
    if [ $? -eq 0 ]; then
      log "Владелец файла базы данных изменен на $WEB_USER"
    else
      warn "Не удалось изменить владельца файла базы данных. Возможно, требуются права root."
    fi
  else
    warn "Переменная WEB_USER не установлена. Владелец файла не изменен."
fi

  # Проверка доступа к файлу
  if [ -r "$DB_FILE" ] && [ -w "$DB_FILE" ]; then
    log "Файл базы данных доступен для чтения и записи"
  else
    error "Файл базы данных недоступен для чтения и записи"
    ls -la "$DB_FILE"
  fi
else
  error "Файл базы данных не найден: $DB_FILE"
  exit 1
fi

# Сборка проекта
log "Сборка проекта..."
npm run build
if [ $? -ne 0 ]; then
  error "Ошибка при сборке проекта"
  exit 1
fi
log "Проект успешно собран"

# Проверка наличия файла экземпляра PM2
PM2_CONFIG="ecosystem.config.js"
if [ ! -f "$PM2_CONFIG" ]; then
  log "Создание конфигурации PM2..."
  cat > "$PM2_CONFIG" << EOF
module.exports = {
  apps: [
    {
      name: 'parkingbot',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'parkingbot-data-collector',
      script: 'scripts/data-collector.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF
  log "Конфигурация PM2 создана"
fi

# Перезапуск приложения с помощью PM2
log "Перезапуск приложения..."
pm2 reload "$PM2_CONFIG" || pm2 start "$PM2_CONFIG"
if [ $? -ne 0 ]; then
  error "Ошибка при перезапуске приложения"
  exit 1
fi
log "Приложение успешно перезапущено"

# Проверка запуска скрипта сбора данных
log "Проверка запуска скрипта сбора данных..."
if pm2 show parkingbot-data-collector > /dev/null 2>&1; then
  log "Скрипт сбора данных успешно запущен"
else
  error "Скрипт сбора данных не запущен. Проверьте логи PM2"
fi

# Сохранение конфигурации PM2
log "Сохранение конфигурации PM2..."
pm2 save
if [ $? -ne 0 ]; then
  warn "Не удалось сохранить конфигурацию PM2"
fi

# Проверка статуса приложения
log "Проверка статуса приложения..."
pm2 status
log "Деплой успешно завершен!" 