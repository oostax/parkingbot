// Проверка, что код выполняется на сервере
const isServer = typeof window === 'undefined';

// Import prisma only on server-side
const prisma = isServer ? require('./prisma').default : null;

// Функция для выполнения SQL-запроса с возвратом результатов
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!isServer) {
    console.warn('Database queries can only be executed on the server');
    return [];
  }
  
  try {
    // Ensure prisma is available
    if (!prisma) {
      throw new Error('Prisma client is not available on the client side');
    }
    
    // Use type assertion to help TypeScript understand that prisma is available
    return await (prisma as any).$queryRawUnsafe(sql, ...params) as T[];
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Функция для выполнения SQL-запроса без возврата данных
export async function execute(sql: string, params: any[] = []): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } catch (error) {
    console.error('Error executing statement:', error);
    throw error;
  }
}

// Функция для обновления почасовых данных парковки
export async function updateHourlyParkingData(
  parkingId: string, 
  hour: number, 
  freeSpaces: number, 
  totalSpaces: number
): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  const today = new Date().toISOString().split('T')[0]; // Формат YYYY-MM-DD
  
  try {
    await prisma.hourly_parking_data.upsert({
      where: {
        parking_id_hour: {
          parking_id: parkingId,
          hour: hour
        }
      },
      update: {
        free_spaces: freeSpaces,
        total_spaces: totalSpaces,
        date_updated: new Date(today)
      },
      create: {
        parking_id: parkingId,
        hour: hour,
        free_spaces: freeSpaces,
        total_spaces: totalSpaces,
        date_updated: new Date(today)
      }
    });
    
    console.log(`Обновлены данные парковки ${parkingId} для часа ${hour}: ${freeSpaces}/${totalSpaces}`);
  } catch (error) {
    console.error(`Ошибка обновления данных парковки ${parkingId}:`, error);
    throw error;
  }
}

// Функция для записи состояния парковки
export async function recordParkingState(
  parkingId: string, 
  freeSpaces: number, 
  totalSpaces: number
): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  const timestamp = new Date();
  
  try {
    // Записываем в parking_stats
    await prisma.parking_stats.create({
      data: {
        parking_id: parkingId,
        timestamp: timestamp,
        free_spaces: freeSpaces,
        total_spaces: totalSpaces
      }
    });
    
    // Обновляем hourly_parking_data для текущего часа
    const currentHour = new Date().getHours();
    await updateHourlyParkingData(parkingId, currentHour, freeSpaces, totalSpaces);
    
  } catch (error) {
    console.error(`Ошибка записи состояния парковки ${parkingId}:`, error);
    throw error;
  }
}

// Функция для очистки устаревших данных
export async function cleanupOldData(): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    // Удаляем записи старше 7 дней
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - 7);
    
    await prisma.parking_stats.deleteMany({
      where: {
        timestamp: {
          lt: retentionDate
        }
      }
    });
    
    console.log('Очистка устаревших данных выполнена');
  } catch (error) {
    console.error('Ошибка при очистке устаревших данных:', error);
  }
}

// Проверка подключения к базе данных
export async function checkConnection(): Promise<boolean> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return false;
  }
  
  try {
    // Проверяем, настроена ли переменная среды
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set!');
      return false;
    }

    // Проверяем, доступен ли prisma
    if (!prisma) {
      console.error('Prisma client is not available');
      return false;
    }
    
    // Простой запрос для проверки соединения
    await prisma.$queryRaw`SELECT 1 as result`;
    console.log('Database connection successful');
    return true;
  } catch (error) {
    // Используем обработчик для вывода подробной информации
    const { handlePrismaError } = await import('./db-fallback');
    handlePrismaError(error);
    return false;
  }
}

// Инициализация базы данных
export async function initializeDatabase(): Promise<void> {
  if (!isServer) {
    console.warn('Database operations can only be executed on the server');
    return;
  }
  
  try {
    console.log('Инициализация базы данных...');
    
    // Проверяем соединение
    const isConnected = await checkConnection();
    if (isConnected) {
      console.log('База данных успешно инициализирована');
    } else {
      throw new Error('Не удалось подключиться к базе данных');
    }
  } catch (error) {
    console.error('Ошибка при инициализации базы данных:', error);
    throw error;
  }
} 