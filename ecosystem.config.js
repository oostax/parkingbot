module.exports = {
  apps: [
    {
      name: 'nextjs-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        NEXTAUTH_URL: 'https://mosparkingbot.ru',
        DATABASE_URL: 'postgresql://neondb_owner:npg_SPEJ0XC3qmNW@ep-withered-cloud-a24cpnbc-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
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
        DATABASE_URL: 'postgresql://neondb_owner:npg_SPEJ0XC3qmNW@ep-withered-cloud-a24cpnbc-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
      },
      max_memory_restart: '300M',
    },
    {
      name: 'stats-daemon',
      script: 'node',
      args: 'scripts/start-bot-daemon.js',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://neondb_owner:npg_SPEJ0XC3qmNW@ep-withered-cloud-a24cpnbc-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
      },
      max_memory_restart: '300M',
    }
  ]
}; 