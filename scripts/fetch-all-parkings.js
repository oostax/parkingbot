const fs = require('fs');
const path = require('path');
const https = require('https');

// Функция для выполнения HTTP запроса с промисом
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Функция для задержки выполнения
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Основная функция для сбора данных о парковках
async function fetchAllParkings() {
  console.log('Начинаем сбор данных о парковках...');
  
  // Создаем массив для хранения данных о парковках
  const allParkings = [];
  
  // Диапазон ID парковок для проверки
  // Можно настроить эти параметры в зависимости от того, какие ID вам нужны
  const startId = 20000;
  const endId = 50000; // Предполагаемый максимальный ID
  const batchSize = 10; // Количество запросов в одной пачке
  const delayBetweenBatches = 1000; // Задержка между пачками запросов в мс
  
  // Счетчики для статистики
  let successCount = 0;
  let failCount = 0;
  
  // Обрабатываем ID партиями для снижения нагрузки на API
  for (let i = startId; i <= endId; i += batchSize) {
    const batchPromises = [];
    
    // Создаем пачку запросов
    for (let j = i; j < i + batchSize && j <= endId; j++) {
      const promise = httpGet(`https://lk.parking.mos.ru/api/3.0/parkings/${j}`)
        .then(data => {
          if (data && data.parking) {
            console.log(`Успешно получены данные для парковки ID: ${j}`);
            successCount++;
            return data.parking;
          }
          return null;
        })
        .catch(err => {
          console.log(`Ошибка при получении данных для парковки ID: ${j}`);
          failCount++;
          return null;
        });
      
      batchPromises.push(promise);
    }
    
    // Ожидаем выполнения всех запросов в пачке
    const results = await Promise.all(batchPromises);
    
    // Добавляем успешные результаты в общий массив
    results.forEach(result => {
      if (result) {
        allParkings.push(result);
      }
    });
    
    // Выводим текущую статистику
    console.log(`Обработано ${i + batchSize - 1} ID. Найдено парковок: ${allParkings.length}. Успешно: ${successCount}. Ошибок: ${failCount}`);
    
    // Делаем паузу между пачками запросов
    await delay(delayBetweenBatches);
  }
  
  // Сохраняем результаты в файл
  const outputPath = path.join(__dirname, '..', 'public', 'data', 'all_parking_data.json');
  fs.writeFileSync(outputPath, JSON.stringify({ parkings: allParkings }, null, 2));
  
  console.log(`Сбор данных завершен. Всего найдено ${allParkings.length} парковок.`);
  console.log(`Данные сохранены в файл: ${outputPath}`);
}

// Запускаем функцию сбора данных
fetchAllParkings().catch(err => {
  console.error('Произошла ошибка при выполнении скрипта:', err);
}); 