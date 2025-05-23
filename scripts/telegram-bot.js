const { Telegraf, Markup } = require('telegraf');
const dotenv = require('dotenv');

// Загружаем переменные окружения из .env.local
dotenv.config({ path: '.env.local' });

// Инициализация бота с токеном из переменных окружения
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Получаем имя бота из переменных окружения
const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'mosmetroparkingbot';

// URL вашего мини-приложения
const appUrl = 'https://parkingbot.vercel.app';

// Обработчик команды /start
bot.start((ctx) => {
  try {
    console.log('Получена команда /start от пользователя:', ctx.from.username || ctx.from.id);
    
    // Отправка сообщения с инлайн-кнопкой для открытия мини-приложения
    ctx.reply('Открыть приложение', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Открыть', web_app: { url: appUrl } }]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработчик для простых текстовых сообщений
bot.on('text', (ctx) => {
  ctx.reply('Для открытия приложения используйте команду /start');
});

// Запуск бота
bot.launch()
  .then(() => {
    console.log(`Бот @${botUsername} запущен успешно!`);
    console.log(`Мини-приложение доступно по URL: ${appUrl}`);
    console.log('Ожидание команд...');
  })
  .catch((err) => {
    console.error('Ошибка при запуске бота:', err);
    process.exit(1);
  });

// Включаем graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM')); 