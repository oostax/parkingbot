"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, Loader2, Users } from "lucide-react";
import ChallengesAdmin from "@/components/admin/challenges-admin";
import AchievementsAdmin from "@/components/admin/achievements-admin";
import PromoCodesAdmin from "@/components/admin/promocodes-admin";
import AdminsManagement from "@/components/admin/admins-management";

export default function AdminPage() {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userInfo, setUserInfo] = useState<{ id: string; username?: string; }|null>(null);

  // Проверка прав администратора при загрузке страницы
  useEffect(() => {
    // Получаем информацию из Telegram WebApp
    if (typeof window !== "undefined" && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      if (tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        setUserInfo({
          id: user.id.toString(),
          username: user.username,
        });
        
        // Проверяем права доступа через API
        fetch(`/api/admin/check-access?telegramId=${user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.isAdmin) {
              setIsAdmin(true);
            } else {
              toast({
                title: "Доступ запрещен",
                description: "У вас нет прав для доступа к панели администратора",
                variant: "destructive"
              });
            }
          })
          .catch(err => {
            console.error("Error checking admin access:", err);
            toast({
              title: "Ошибка проверки доступа",
              description: "Не удалось проверить права администратора",
              variant: "destructive"
            });
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        toast({
          title: "Ошибка авторизации",
          description: "Не удалось получить данные пользователя из Telegram",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    } else {
      toast({
        title: "Ошибка запуска",
        description: "Приложение должно быть открыто в Telegram",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Проверка доступа...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="max-w-md w-full">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-center">Доступ запрещен</CardTitle>
              <CardDescription className="text-center">
                У вас нет прав для доступа к панели администратора
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => window.history.back()}
              >
                Вернуться назад
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-full">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Панель администратора</h1>
      </div>

      <div className="mb-4">
        <p className="text-muted-foreground">
          Добро пожаловать, {userInfo?.username || `Telegram ID: ${userInfo?.id}`}
        </p>
      </div>

      <Tabs defaultValue="challenges" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8">
          <TabsTrigger value="challenges">Челленджи</TabsTrigger>
          <TabsTrigger value="achievements">Достижения</TabsTrigger>
          <TabsTrigger value="promocodes">Промокоды</TabsTrigger>
          <TabsTrigger value="admins">Администраторы</TabsTrigger>
        </TabsList>
        
        <TabsContent value="challenges">
          <ChallengesAdmin />
        </TabsContent>
        
        <TabsContent value="achievements">
          <AchievementsAdmin />
        </TabsContent>
        
        <TabsContent value="promocodes">
          <PromoCodesAdmin />
        </TabsContent>
        
        <TabsContent value="admins">
          <AdminsManagement currentUserId={userInfo?.id || ""} />
        </TabsContent>
      </Tabs>
    </div>
  );
} 