"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, LogOut, Star, Clock, Settings } from "lucide-react";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Перенаправляем на главную страницу если пользователь не авторизован
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Получение количества избранных парковок
  useEffect(() => {
    if (session) {
      setIsLoading(true);
      fetch("/api/favorites/count")
        .then(res => res.json())
        .then(data => {
          setFavoriteCount(data.count || 0);
        })
        .catch(err => console.error("Error fetching favorites:", err))
        .finally(() => setIsLoading(false));
    }
  }, [session]);

  // Инициализация Telegram WebApp
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        const tg = window.Telegram.WebApp as any;
        tg.expand();
        tg.setHeaderColor('#FFFFFF');
        
        // Настройка safe area для корректного отображения
        if (tg.safeAreaInset) {
          document.documentElement.style.setProperty('--tg-safe-area-top', `${tg.safeAreaInset.top || 0}px`);
          document.documentElement.style.setProperty('--tg-safe-area-bottom', `${tg.safeAreaInset.bottom || 0}px`);
        }
      } catch (error) {
        console.error("Error initializing Telegram WebApp:", error);
      }
    }
  }, []);

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="p-2 md:p-4 pt-[calc(var(--tg-safe-area-top)+1.5rem)] md:pt-[calc(var(--tg-safe-area-top)+1rem)] bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="container flex justify-between items-center">
          <h1 className="text-base md:text-xl font-bold">Мой профиль</h1>
          <Button variant="outline" size="icon" onClick={() => router.push("/")}>
            <Clock className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container py-0 flex-1 flex flex-col mt-[60px] md:mt-[72px] px-4">
        <Card className="mt-4 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {session.user?.name?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
                {session.user?.image && (
                  <AvatarImage src={session.user.image} alt={session.user.name || ""} />
                )}
              </Avatar>
              <div>
                <CardTitle>{session.user?.name || "Пользователь"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {session.user?.email || "Telegram пользователь"}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-lg">
                <Star className="h-6 w-6 text-blue-500 mb-1" />
                <div className="text-xl font-semibold">{favoriteCount}</div>
                <div className="text-xs text-muted-foreground">Избранных парковок</div>
              </div>
              <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg">
                <User className="h-6 w-6 text-green-500 mb-1" />
                <div className="text-xl font-semibold">Активно</div>
                <div className="text-xs text-muted-foreground">Статус аккаунта</div>
              </div>
            </div>

            <Tabs defaultValue="account" className="mt-6">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="account">Аккаунт</TabsTrigger>
                <TabsTrigger value="settings">Настройки</TabsTrigger>
              </TabsList>
              <TabsContent value="account" className="pt-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="font-medium text-sm">ID:</div>
                    <div className="col-span-2 text-sm">{session.user?.id || "Н/Д"}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="font-medium text-sm">Имя:</div>
                    <div className="col-span-2 text-sm">{session.user?.name || "Не указано"}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="font-medium text-sm">Email:</div>
                    <div className="col-span-2 text-sm">{session.user?.email || "Не указан"}</div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="settings" className="pt-4">
                <div className="space-y-4">
                  <Button 
                    variant="outline" 
                    className="w-full flex justify-between items-center" 
                    onClick={() => router.push("/")}
                  >
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>На главную</span>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full flex justify-between items-center" 
                    onClick={() => router.push("/favorites")}
                  >
                    <div className="flex items-center">
                      <Star className="h-4 w-4 mr-2" />
                      <span>Избранное</span>
                    </div>
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="w-full flex justify-between items-center" 
                    onClick={() => signOut({ callbackUrl: "/" })}
                  >
                    <div className="flex items-center">
                      <LogOut className="h-4 w-4 mr-2" />
                      <span>Выйти из аккаунта</span>
                    </div>
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
} 