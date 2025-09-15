#!/bin/bash

# 🚀 Быстрый деплой MosParking
# Использование: ./scripts/quick-deploy.sh [environment]
# environment: dev, staging, production

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Проверка аргументов
ENVIRONMENT=${1:-production}

if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|production)$ ]]; then
    error "Неверное окружение. Используйте: dev, staging, production"
    exit 1
fi

log "🚀 Начинаем деплой MosParking в окружении: $ENVIRONMENT"

# Проверка зависимостей
check_dependencies() {
    log "🔍 Проверка зависимостей..."
    
    if ! command -v node &> /dev/null; then
        error "Node.js не установлен"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        error "npm не установлен"
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        warning "PM2 не установлен. Устанавливаем..."
        npm install -g pm2
    fi
    
    success "Все зависимости найдены"
}

# Установка зависимостей
install_dependencies() {
    log "📦 Установка зависимостей..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        npm ci --only=production
    else
        npm install
    fi
    
    success "Зависимости установлены"
}

# Настройка базы данных
setup_database() {
    log "🗄️ Настройка базы данных..."
    
    # Применение миграций
    npx prisma migrate deploy
    
    # Генерация Prisma клиента
    npx prisma generate
    
    # Инициализация данных для dev окружения
    if [ "$ENVIRONMENT" = "dev" ]; then
        log "🔧 Инициализация данных для разработки..."
        npm run setup-db
    fi
    
    success "База данных настроена"
}

# Сборка приложения
build_app() {
    log "🏗️ Сборка приложения..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        npm run build
    else
        npm run build
    fi
    
    success "Приложение собрано"
}

# Настройка PM2
setup_pm2() {
    log "⚙️ Настройка PM2..."
    
    # Остановка существующего процесса
    pm2 delete mosparking 2>/dev/null || true
    
    # Запуск приложения
    if [ "$ENVIRONMENT" = "production" ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start ecosystem.config.js --env development
    fi
    
    # Сохранение конфигурации
    pm2 save
    
    success "PM2 настроен"
}

# Проверка здоровья приложения
health_check() {
    log "🏥 Проверка здоровья приложения..."
    
    # Ожидание запуска
    sleep 5
    
    # Проверка статуса PM2
    if pm2 list | grep -q "mosparking.*online"; then
        success "Приложение запущено"
    else
        error "Приложение не запустилось"
        pm2 logs mosparking --lines 20
        exit 1
    fi
    
    # Проверка порта (если доступен)
    if command -v curl &> /dev/null; then
        if curl -f http://localhost:3000/api/parkings > /dev/null 2>&1; then
            success "API доступен"
        else
            warning "API недоступен (возможно, не настроен Nginx)"
        fi
    fi
}

# Очистка
cleanup() {
    log "🧹 Очистка временных файлов..."
    
    # Очистка кэша npm
    npm cache clean --force
    
    # Очистка кэша Next.js
    rm -rf .next/cache
    
    success "Очистка завершена"
}

# Основная функция
main() {
    log "🎯 Начинаем процесс деплоя..."
    
    check_dependencies
    install_dependencies
    setup_database
    build_app
    setup_pm2
    health_check
    cleanup
    
    success "🎉 Деплой завершен успешно!"
    
    log "📊 Статус приложения:"
    pm2 status
    
    log "📝 Полезные команды:"
    echo "  Просмотр логов: pm2 logs mosparking"
    echo "  Мониторинг: pm2 monit"
    echo "  Перезапуск: pm2 restart mosparking"
    echo "  Остановка: pm2 stop mosparking"
}

# Обработка ошибок
trap 'error "Деплой прерван из-за ошибки"; exit 1' ERR

# Запуск
main "$@"
