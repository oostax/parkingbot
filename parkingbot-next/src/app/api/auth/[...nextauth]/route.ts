import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

// Экспортируем только обработчики GET и POST
export const { handlers: { GET, POST } } = NextAuth(authConfig); 