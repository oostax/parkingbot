import type { Metadata } from "next";
import "./globals.css";
import "@/styles/tabs-fix.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/providers/session-provider";
import UserDataPreloader from "@/components/user-data-preloader";
import Script from 'next/script';

export const metadata: Metadata = {
  title: "MosParking",
  description: "Отслеживание свободных мест на перехватывающих парковках Москвы",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      </head>
      <body className="font-sans">
        <SessionProvider>
          <UserDataPreloader />
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
