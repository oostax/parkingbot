import CredentialsProvider from "next-auth/providers/credentials";
import { nanoid } from "nanoid";
import { getDb, executeRun } from "@/lib/db";
import { env } from "@/lib/env";

// Определяем типы для пользовательских данных
interface TelegramCredentials {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: string;
  hash?: string;
}

interface UserData {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  telegramId?: string;
  username?: string;
}

// Настройка провайдера аутентификации через Telegram
export const authOptions = {
  providers: [
    CredentialsProvider({
      id: "telegram-login",
      name: "Telegram Login",
      credentials: {
        id: { label: "ID", type: "text" },
        first_name: { label: "First Name", type: "text" },
        last_name: { label: "Last Name", type: "text" },
        username: { label: "Username", type: "text" },
        photo_url: { label: "Photo URL", type: "text" },
        auth_date: { label: "Auth Date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        try {
          const telegramData = credentials as unknown as TelegramCredentials;
          console.log("Попытка авторизации через Telegram:", telegramData.username);
          
          // Проверка данных Telegram
          const { id, first_name, last_name, username, photo_url } = telegramData;
          
          if (!id) {
            console.error("Отсутствует ID пользователя Telegram");
            return null;
          }
          
          // Получение или создание пользователя
          const db = getDb();
          
          // Проверяем существование пользователя
          const userCheckSql = `SELECT * FROM User WHERE telegramId = ?`;
          
          return new Promise((resolve, reject) => {
            db.get(userCheckSql, [id], async (err, user: any) => {
              if (err) {
                console.error("Ошибка при поиске пользователя:", err);
                reject(err);
                return;
              }
              
              try {
                if (user) {
                  // Пользователь существует, обновляем информацию
                  console.log("Пользователь найден, обновляем данные:", user.id);
                  
                  const updateUserSql = `
                    UPDATE User 
                    SET username = ?, firstName = ?, lastName = ?, image = ?, updatedAt = CURRENT_TIMESTAMP 
                    WHERE id = ?
                  `;
                  
                  await executeRun(updateUserSql, [
                    username || null,
                    first_name || null,
                    last_name || null,
                    photo_url || null,
                    user.id
                  ]);
                  
                  // Обновляем профиль пользователя
                  const updateProfileSql = `
                    UPDATE UserProfile 
                    SET lastLoginAt = CURRENT_TIMESTAMP 
                    WHERE userId = ?
                  `;
                  
                  await executeRun(updateProfileSql, [user.id]);
                  
                  // Возвращаем данные пользователя
                  const userData: UserData = {
                    id: user.id,
                    name: first_name + (last_name ? ` ${last_name}` : ""),
                    email: user.email,
                    image: photo_url,
                    telegramId: id,
                    username: username,
                  };
                  
                  resolve(userData);
                } else {
                  // Создаем нового пользователя
                  console.log("Создание нового пользователя для Telegram ID:", id);
                  
                  const userId = nanoid();
                  const createUserSql = `
                    INSERT INTO User (id, username, firstName, lastName, image, telegramId) 
                    VALUES (?, ?, ?, ?, ?, ?)
                  `;
                  
                  await executeRun(createUserSql, [
                    userId,
                    username || null,
                    first_name || null,
                    last_name || null,
                    photo_url || null,
                    id
                  ]);
                  
                  // Создаем профиль пользователя
                  const createProfileSql = `
                    INSERT INTO UserProfile (id, userId) 
                    VALUES (?, ?)
                  `;
                  
                  await executeRun(createProfileSql, [nanoid(), userId]);
                  
                  // Возвращаем данные нового пользователя
                  const userData: UserData = {
                    id: userId,
                    name: first_name + (last_name ? ` ${last_name}` : ""),
                    image: photo_url,
                    telegramId: id,
                    username: username,
                  };
                  
                  resolve(userData);
                }
              } catch (error) {
                console.error("Ошибка при обработке пользователя:", error);
                reject(error);
              }
            });
          });
        } catch (error) {
          console.error("Ошибка авторизации через Telegram:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: any; user: any }) {
      // Добавляем данные пользователя в токен
      if (user) {
        token.telegramId = user.telegramId;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Добавляем данные пользователя в сессию
      if (token && session.user) {
        session.user.id = token.sub;
        session.user.telegramId = token.telegramId;
        session.user.username = token.username;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== "production",
}; 