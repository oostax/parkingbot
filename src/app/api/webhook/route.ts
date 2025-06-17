import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

// Получаем токен бота из переменных окружения
const token = process.env.TELEGRAM_BOT_TOKEN;

// Фиксированный URL мини-приложения
const appUrl = 'https://mosparkingbot.ru/';

// Постоянный URL для webhook
const webhookUrl = 'https://mosparkingbot.ru/api/webhook';

// Создаем обработчик запросов
export async function POST(req: NextRequest) {
  try {
    console.log('Получен POST-запрос на webhook');
    
    // Если нет токена, возвращаем ошибку
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN не установлен');
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not set' },
        { status: 500 }
      );
    }

    // Получаем данные из запроса
    let data;
    try {
      data = await req.json();
      console.log('Получен вебхук:', JSON.stringify(data));
    } catch (error: any) {
      console.error('Ошибка при разборе JSON:', error);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Обрабатываем команду /start
    if (data?.message?.text === '/start') {
      console.log('Обрабатываем команду /start от пользователя:', data.message.from.id);
      
      try {
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
        
        console.log('Сообщение отправлено успешно');
        return NextResponse.json({ ok: true, message: 'Message sent successfully' });
      } catch (sendError: any) {
        console.error('Ошибка при отправке сообщения:', sendError);
        return NextResponse.json(
          { error: 'Failed to send message', details: sendError.message || String(sendError) },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('Общая ошибка в обработчике вебхука:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error.message || String(error) },
      { status: 500 }
    );
  }
}

// Создаем GET endpoint для настройки вебхука
export async function GET(req: NextRequest) {
  try {
    console.log('Получен GET-запрос для настройки вебхука');
    
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN не установлен');
      return NextResponse.json(
        { error: 'TELEGRAM_BOT_TOKEN is not set' },
        { status: 500 }
      );
    }

    const bot = new Telegraf(token);
    
    try {
      // Удаляем любой предыдущий вебхук
      await bot.telegram.deleteWebhook();
      console.log('Предыдущий вебхук удален');
      
      // Устанавливаем новый вебхук с фиксированным URL
      await bot.telegram.setWebhook(webhookUrl);
      console.log('Установлен новый вебхук:', webhookUrl);
      
      // Проверяем информацию о вебхуке для подтверждения
      const webhookInfo = await bot.telegram.getWebhookInfo();
      console.log('Информация о вебхуке:', JSON.stringify(webhookInfo));
      
      // Проверяем, что URL правильный
      if (webhookInfo.url !== webhookUrl) {
        console.warn(`Несоответствие URL вебхука: настроен ${webhookInfo.url}, ожидался ${webhookUrl}`);
      }
      
      return NextResponse.json({
        ok: true,
        webhook_url: webhookUrl,
        webhook_info: webhookInfo,
        info: 'Webhook установлен успешно'
      });
    } catch (webhookError: any) {
      console.error('Ошибка при настройке вебхука:', webhookError);
      return NextResponse.json(
        { error: 'Failed to set webhook', details: webhookError.message || String(webhookError) },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Общая ошибка при настройке вебхука:', error);
    return NextResponse.json(
      { error: 'Failed to configure webhook', details: error.message || String(error) },
      { status: 500 }
    );
  }
} 