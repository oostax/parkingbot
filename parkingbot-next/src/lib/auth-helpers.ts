import NextAuth from "next-auth";
import { authConfig } from "./auth";

// Создаем экземпляр NextAuth
const instance = NextAuth(authConfig);

// Экспортируем auth функцию
export const auth = instance.auth; 