"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, LogOut, Star, ArrowLeft, Coins, Award, Trophy, Users } from "lucide-react";
import UserProfile from "@/components/user-profile";
import FortuneWheel from "@/components/fortune-wheel";
import Leaderboard from "@/components/leaderboard";
import Challenges from "@/components/challenges";
import { UserProfile as UserProfileType } from "@/types/gamification";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");
  const [userTokens, setUserTokens] = useState(10); // Начальное значение соответствует профилю
  const { toast } = useToast();

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

  // Загрузка баланса пользователя
  useEffect(() => {
    if (session) {
      fetch("/api/gamification/profile")
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error fetching profile: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.profile && data.profile.tokenBalance !== undefined) {
            setUserTokens(data.profile.tokenBalance);
          }
        })
        .catch(err => {
          console.error("Error loading user balance:", err);
        });
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

  // Обработчик выигрыша в колесе удачи
  const handleWheelWin = (prize: any) => {
    if (prize.type === 'tokens') {
      setUserTokens(prev => prev + Number(prize.value));
      toast({
        title: "Поздравляем!",
        description: `Вы выиграли ${prize.value} баллов!`,
        variant: "default",
      });
    } else {
      toast({
        title: "Поздравляем!",
        description: `Вы выиграли: ${prize.name}`,
        variant: "default",
      });
    }
  };

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
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="container py-0 flex-1 flex flex-col mt-[60px] md:mt-[72px] px-4 pb-4">
        <Tabs defaultValue="profile" className="mt-4" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="profile" className="flex flex-col items-center py-2">
              <User className="h-4 w-4 mb-1" />
              <span className="text-xs">Профиль</span>
            </TabsTrigger>
            <TabsTrigger value="challenges" className="flex flex-col items-center py-2">
              <Trophy className="h-4 w-4 mb-1" />
              <span className="text-xs">Челленджи</span>
            </TabsTrigger>
            <TabsTrigger value="wheel" className="flex flex-col items-center py-2">
              <Coins className="h-4 w-4 mb-1" />
              <span className="text-xs">Колесо</span>
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex flex-col items-center py-2">
              <Users className="h-4 w-4 mb-1" />
              <span className="text-xs">Рейтинг</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="pt-4">
            <UserProfile />
          </TabsContent>

          <TabsContent value="challenges" className="pt-4">
            <Challenges userId={session.user?.id} />
          </TabsContent>

          <TabsContent value="wheel" className="pt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Колесо удачи</h2>
                <div className="flex items-center">
                  <Coins className="h-5 w-5 text-amber-500 mr-1" />
                  <span className="font-medium">{userTokens}</span>
                </div>
              </div>
              <FortuneWheel 
                tokenCost={30} 
                onWin={handleWheelWin} 
                userTokens={userTokens} 
              />
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="pt-4">
            <Leaderboard currentUserId={session.user?.id} />
          </TabsContent>
        </Tabs>

        {activeTab === "profile" && (
          <div className="mt-4">
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
        )}
      </div>
    </main>
  );
} 