"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserProfile as UserProfileType, UserAchievement, TokenTransaction, UserStatus } from "@/types/gamification";
import { Coins, Trophy, Award, Calendar, Users, Car, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function UserProfile() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfileType | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAchievements, setIsLoadingAchievements] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  // Загрузка профиля пользователя
  useEffect(() => {
    if (session) {
      setIsLoading(true);
      fetch("/api/gamification/profile")
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error fetching profile: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          console.log("Fetched profile data:", data);
          if (data.profile) {
            setUserProfile(data.profile);
          } else {
            console.error("Profile data missing in API response");
          }
        })
        .catch(err => {
          console.error("Error loading user profile:", err);
          toast({
            title: "Ошибка загрузки профиля",
            description: "Не удалось загрузить данные профиля",
            variant: "destructive",
          });
        })
        .finally(() => setIsLoading(false));
    }
  }, [session, toast]);

  // Загрузка достижений пользователя
  useEffect(() => {
    if (session) {
      setIsLoadingAchievements(true);
      fetch("/api/gamification/achievements")
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error fetching achievements: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.achievements) {
            setAchievements(data.achievements);
          }
        })
        .catch(err => {
          console.error("Error loading achievements:", err);
        })
        .finally(() => setIsLoadingAchievements(false));
    }
  }, [session]);

  // Загрузка истории транзакций
  useEffect(() => {
    if (session && userProfile) {
      setIsLoadingTransactions(true);
      
      fetch("/api/gamification/transactions")
        .then(res => {
          if (!res.ok) {
            throw new Error(`Error fetching transactions: ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data.transactions) {
            setTransactions(data.transactions);
          }
        })
        .catch(err => {
          console.error("Error loading transactions:", err);
          toast({
            title: "Ошибка загрузки транзакций",
            description: "Не удалось загрузить историю транзакций",
            variant: "destructive",
          });
        })
        .finally(() => setIsLoadingTransactions(false));
    }
  }, [session, userProfile, toast]);

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "Silver": return "bg-gray-200 text-gray-700";
      case "Gold": return "bg-amber-200 text-amber-700";
      case "Platinum": return "bg-indigo-200 text-indigo-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };

  const statusRequirements = {
    Silver: 200,
    Gold: 500,
    Platinum: 1000
  };

  const getNextStatus = (currentStatus: UserStatus): { status: UserStatus, required: number } | null => {
    if (currentStatus === "Regular") return { status: "Silver", required: statusRequirements.Silver };
    if (currentStatus === "Silver") return { status: "Gold", required: statusRequirements.Gold };
    if (currentStatus === "Gold") return { status: "Platinum", required: statusRequirements.Platinum };
    return null;
  };

  const getStatusProgress = (currentStatus: UserStatus, tokenBalance: number): number => {
    const next = getNextStatus(currentStatus);
    if (!next) return 100;
    
    const currentRequired = statusRequirements[currentStatus as keyof typeof statusRequirements] || 0;
    const nextRequired = next.required;
    
    return Math.min(100, Math.max(0, ((tokenBalance - currentRequired) / (nextRequired - currentRequired)) * 100));
  };

  if (isLoading || !session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Если профиль не загружен, показываем заглушку
  if (!userProfile) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary">
                <AvatarFallback>{session.user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                {session.user?.image && <AvatarImage src={session.user.image} alt={session.user.name || ""} />}
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{session.user?.name || "Пользователь"}</CardTitle>
                  <Badge className="bg-blue-100 text-blue-700">Regular</Badge>
                </div>
                <CardDescription>@{session.user?.name?.toLowerCase().replace(/\s+/g, '') || "username"}</CardDescription>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Новый пользователь</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg">
                <Coins className="h-6 w-6 text-primary mb-1" />
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-center">Баллов</div>
              </div>
              <div className="flex flex-col items-center p-3 bg-amber-100 rounded-lg">
                <Trophy className="h-6 w-6 text-amber-600 mb-1" />
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-center">Челленджей</div>
              </div>
            </div>

            <div className="mt-2 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Прогресс до Silver</span>
                <span>0 / 200</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="outline" className="w-full" onClick={() => toast({ title: "Редактирование профиля", description: "Функция будет доступна в ближайшем обновлении" })}>
              Редактировать профиль
            </Button>
          </CardFooter>
        </Card>
        
        <div className="text-center py-8 text-muted-foreground">
          Данные профиля загружаются...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary">
              <AvatarImage src={userProfile.avatarUrl || session.user?.image || ""} alt={userProfile.displayName} />
              <AvatarFallback>{userProfile.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>{userProfile.displayName || session.user?.name || "Пользователь"}</CardTitle>
                <Badge className={getStatusColor(userProfile.status)}>{userProfile.status}</Badge>
              </div>
              <CardDescription>@{userProfile.username || session.user?.name?.toLowerCase().replace(/\s+/g, '') || "username"}</CardDescription>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>С нами с {new Date(userProfile.joinedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col items-center p-3 bg-primary/10 rounded-lg">
              <Coins className="h-6 w-6 text-primary mb-1" />
              <div className="text-2xl font-bold">{userProfile.tokenBalance}</div>
              <div className="text-xs text-center">Баллов</div>
            </div>
            <div className="flex flex-col items-center p-3 bg-amber-100 rounded-lg">
              <Trophy className="h-6 w-6 text-amber-600 mb-1" />
              <div className="text-2xl font-bold">{userProfile.stats.challengesCompleted}</div>
              <div className="text-xs text-center">Челленджей</div>
            </div>
          </div>

          {getNextStatus(userProfile.status) && (
            <div className="mt-2 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Прогресс до {getNextStatus(userProfile.status)?.status}</span>
                <span>{userProfile.tokenBalance} / {getNextStatus(userProfile.status)?.required}</span>
              </div>
              <Progress value={getStatusProgress(userProfile.status, userProfile.tokenBalance)} className="h-2" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            {userProfile.carModel && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>{userProfile.carModel}</span>
              </div>
            )}
            {userProfile.district && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{userProfile.district}</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="pt-0">
          <Button variant="outline" className="w-full" onClick={() => toast({ title: "Редактирование профиля", description: "Функция будет доступна в ближайшем обновлении" })}>
            Редактировать профиль
          </Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="achievements" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="achievements">Достижения</TabsTrigger>
          <TabsTrigger value="transactions">История</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-4 pt-4">
          {isLoadingAchievements ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : achievements.length > 0 ? (
            achievements.map((achievement) => (
              <Card key={achievement.id} className={`overflow-hidden ${!achievement.earned ? 'opacity-70' : ''}`}>
                <div className="flex items-center p-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${achievement.earned ? 'bg-primary/20' : 'bg-gray-200'}`}>
                    <Award className={`h-6 w-6 ${achievement.earned ? 'text-primary' : 'text-gray-400'}`} />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="font-medium">{achievement.name}</div>
                    <div className="text-sm text-muted-foreground">{achievement.description}</div>
                    {achievement.progress !== undefined && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Прогресс</span>
                          <span>{achievement.currentProgress} / {achievement.totalRequired}</span>
                        </div>
                        <Progress value={achievement.progress} className="h-1" />
                      </div>
                    )}
                  </div>
                  {achievement.earned && achievement.earnedAt && (
                    <div className="ml-2 text-xs text-muted-foreground">
                      {new Date(achievement.earnedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              У вас пока нет достижений
            </div>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 pt-4">
          {isLoadingTransactions ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : transactions.length > 0 ? (
            transactions.map((transaction) => (
              <Card key={transaction.id}>
                <div className="flex items-center p-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${transaction.amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Coins className={`h-5 w-5 ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="font-medium">{transaction.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`font-bold ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              История транзакций пуста
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="pt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Посещено парковок</span>
                  <span className="font-medium">{userProfile.stats.totalParksVisited}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Уникальных парковок</span>
                  <span className="font-medium">{userProfile.stats.uniqueParksVisited}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Дней подряд</span>
                  <span className="font-medium">{userProfile.stats.consecutiveLoginDays}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Всего заработано</span>
                  <span className="font-medium">{userProfile.stats.totalTokensEarned}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Всего потрачено</span>
                  <span className="font-medium">{userProfile.stats.totalTokensSpent}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Приглашено друзей</span>
                  <span className="font-medium">{userProfile.stats.referralsCount}</span>
                </div>
                <Separator />
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Посещено районов</span>
                  <span className="font-medium">{userProfile.stats.districtsVisited.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 