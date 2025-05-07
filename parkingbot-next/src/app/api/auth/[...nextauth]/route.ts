import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth";

export const { handlers: { GET, POST }, auth } = NextAuth(authConfig); 