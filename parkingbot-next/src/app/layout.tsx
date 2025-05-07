import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { auth } from "@/lib/auth-helpers";
import { Button } from "@/components/ui/button";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Парковки Москвы - Мониторинг свободных мест",
  description: "Интерактивная карта перехватывающих парковок Москвы с информацией о свободных местах и уведомлениями",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  
  return (
    <html lang="ru">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          {/* Header */}
          <header className="border-b">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-xl font-bold">Парковки Москвы</span>
              </Link>
              <nav className="flex gap-4 md:gap-6">
                <Link 
                  href="/" 
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Главная
                </Link>
                {session?.user ? (
                  <>
                    <Link 
                      href="/favorites" 
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Избранное
                    </Link>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/api/auth/signout">Выйти</Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="outline" size="sm">
                    <Link href="/api/auth/signin">Войти</Link>
                  </Button>
                )}
              </nav>
            </div>
          </header>
          
          {/* Main content */}
          <div className="flex-1">
            {children}
          </div>
          
          {/* Footer */}
          <footer className="border-t py-6 md:py-8">
            <div className="container flex flex-col items-center justify-center gap-4 px-4 md:px-6 md:flex-row md:justify-between">
              <div className="flex flex-col items-center gap-2 md:items-start">
                <Link href="/" className="text-lg font-bold">
                  Парковки Москвы
                </Link>
                <p className="text-sm text-muted-foreground">
                  Мониторинг свободных мест на перехватывающих парковках
                </p>
              </div>
              <div className="flex flex-col items-center gap-2 md:items-end">
                <p className="text-sm text-muted-foreground">
                  &copy; {new Date().getFullYear()} Парковки Москвы
                </p>
                <p className="text-xs text-muted-foreground">
                  Информация предоставлена порталом парковочного пространства Москвы
                </p>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
