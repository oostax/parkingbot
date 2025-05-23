import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;

// URL вашего мини-приложения
const appUrl = 'https://mosparkingbot.ru/';

// Создаем обработчик запросов
export async function POST(req: NextRequest) {
  try {
    // Если нет токена, возвращаем ошибку
    if (!token) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not set' },
        { status: 500 }
      );
    }

    // Получаем данные из запроса
    const data = await req.json();
    console.log('Получен вебхук:', JSON.stringify(data));

    // Обрабатываем команду /start
    if (data?.message?.text === '/start') {
      const bot = new Telegraf(token);
      const userId = data.message.from.id;
      
      // Отправляем сообщение с кнопкой
      await bot.telegram.sendMessage(userId, 'Открыть приложение', {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Открыть', web_app: { url: appUrl } }]
          ]
        }
      });
      
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ошибка в обработчике вебхука:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// Создаем GET endpoint для настройки вебхука
export async function GET(req: NextRequest) {
  try {
    if (!token) {
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not set' },
        { status: 500 }
      );
    }

    const bot = new Telegraf(token);
    const webhookUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/webhook`
      : 'https://mosparkingbot.ru/api/webhook';

    await bot.telegram.setWebhook(webhookUrl);
    
    return NextResponse.json({
      ok: true,
      webhook_url: webhookUrl,
      info: 'Webhook установлен успешно'
    });
  } catch (error) {
    console.error('Ошибка при установке вебхука:', error);
    return NextResponse.json(
      { error: 'Failed to set webhook' },
      { status: 500 }
    );
  }
} 