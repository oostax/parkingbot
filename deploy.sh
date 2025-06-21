#!/bin/bash

# Deployment script for Ubuntu server

# Exit on any error
set -e

echo "Starting deployment process..."

# Update packages
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js if not installed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js and npm..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 if not installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    sudo npm install -g pm2
fi

# Install Nginx if not installed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    sudo apt-get install -y nginx
fi

# Install SQLite3 if not installed
if ! command -v sqlite3 &> /dev/null; then
    echo "Installing SQLite3..."
    sudo apt-get install -y sqlite3
fi

# Build the Next.js application
echo "Building the application..."
npm ci
npm run build

# Initialize database tables
echo "Initializing database..."
npm run init-db

# Setup Nginx configuration
echo "Setting up Nginx configuration..."
sudo tee /etc/nginx/sites-available/mosparkingbot.ru > /dev/null << EOF
server {
    listen 80;
    server_name mosparkingbot.ru www.mosparkingbot.ru;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site configuration
if [ ! -f /etc/nginx/sites-enabled/mosparkingbot.ru ]; then
    sudo ln -s /etc/nginx/sites-available/mosparkingbot.ru /etc/nginx/sites-enabled/
fi

# Setup PM2 configuration for both Next.js and Telegram bot
echo "Setting up PM2 configuration..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'nextjs-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://mosparkingbot.ru',
        DATABASE_URL: 'file:./prisma/dev.db'
      },
      max_memory_restart: '500M',
    },
    {
      name: 'telegram-bot',
      script: 'npm',
      args: 'run bot',
      env: {
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: '7043413169:AAFLuLBvDqxCWh2dS-jndfiD5s-OHRs6s1A',
        NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: 'mosmetroparkingbot',
        DATABASE_URL: 'file:./prisma/dev.db'
      },
      max_memory_restart: '300M',
    },
    {
      name: 'stats-daemon',
      script: 'node',
      args: 'scripts/data-collector.js',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'file:./prisma/dev.db'
      },
      max_memory_restart: '300M',
      restart_delay: 10000, // 10 seconds delay between restarts
      max_restarts: 10, // Max number of consecutive restarts
    }
  ]
};
EOF

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Restart Nginx
echo "Restarting Nginx..."
sudo systemctl restart nginx

# Start application using PM2
echo "Starting application using PM2..."
pm2 start ecosystem.config.js
pm2 save

# Setup PM2 to start on boot
echo "Setting up PM2 to start on boot..."
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo "Deployment completed successfully!"
echo "Now you can access your application at https://mosparkingbot.ru"
echo "Note: To enable HTTPS, install Certbot and run: sudo certbot --nginx -d mosparkingbot.ru -d www.mosparkingbot.ru" 