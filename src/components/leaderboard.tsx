"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaderboardEntry, UserStatus } from "@/types/gamification";
import { Trophy, Medal } from "lucide-react";

// Временные данные для демонстрации
const mockLeaderboard: LeaderboardEntry[] = [
  { position: 1, userId: "1", displayName: "***123", avatarUrl: "", score: 1250, status: "Platinum" },
  { position: 2, userId: "2", displayName: "***456", avatarUrl: "", score: 980, status: "Gold" },
  { position: 3, userId: "3", displayName: "***789", avatarUrl: "", score: 820, status: "Gold" },
  { position: 4, userId: "4", displayName: "***234", avatarUrl: "", score: 750, status: "Silver" },
  { position: 5, userId: "5", displayName: "***567", avatarUrl: "", score: 680, status: "Silver" },
  { position: 6, userId: "6", displayName: "***890", avatarUrl: "", score: 620, status: "Silver" },
  { position: 7, userId: "7", displayName: "***321", avatarUrl: "", score: 580, status: "Regular" },
  { position: 8, userId: "8", displayName: "***654", avatarUrl: "", score: 520, status: "Regular" },
  { position: 9, userId: "9", displayName: "***987", avatarUrl: "", score: 480, status: "Regular" },
  { position: 10, userId: "10", displayName: "***432", avatarUrl: "", score: 450, status: "Regular" },
];

interface LeaderboardProps {
  currentUserId?: string;
}

export default function Leaderboard({ currentUserId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [period, setPeriod] = useState<"week" | "month" | "alltime">("week");
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // В реальном приложении здесь будет запрос к API
    setTimeout(() => {
      setLeaderboard(mockLeaderboard);
      setIsLoading(false);
    }, 500);
  }, [period]);
  
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "Silver": return "bg-gray-200 text-gray-700";
      case "Gold": return "bg-amber-200 text-amber-700";
      case "Platinum": return "bg-indigo-200 text-indigo-700";
      default: return "bg-blue-100 text-blue-700";
    }
  };
  
  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1: return "bg-amber-100 text-amber-700 border-amber-300";
      case 2: return "bg-gray-100 text-gray-700 border-gray-300";
      case 3: return "bg-orange-100 text-orange-700 border-orange-300";
      default: return "bg-muted text-muted-foreground";
    }
  };
  
  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1: return <Trophy className="h-4 w-4 text-amber-500" />;
      case 2: return <Medal className="h-4 w-4 text-gray-500" />;
      case 3: return <Medal className="h-4 w-4 text-orange-500" />;
      default: return position;
    }
  };
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Таблица лидеров</CardTitle>
          <CardDescription>Загрузка данных...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Таблица лидеров</CardTitle>
        <CardDescription>
          Пользователи с наибольшим количеством баллов
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="week" className="w-full" onValueChange={(value) => setPeriod(value as any)}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="week">Неделя</TabsTrigger>
            <TabsTrigger value="month">Месяц</TabsTrigger>
            <TabsTrigger value="alltime">Все время</TabsTrigger>
          </TabsList>
          
          <TabsContent value="week" className="space-y-0 mt-0">
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div 
                  key={entry.userId} 
                  className={`flex items-center p-3 rounded-lg border ${
                    entry.userId === currentUserId ? "border-primary bg-primary/5" : "border-transparent"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center border ${getPositionStyle(entry.position)}`}>
                    {getPositionIcon(entry.position)}
                  </div>
                  
                  <div className="ml-3 flex-1">
                    <div className="flex items-center">
                      <span className="font-medium">{entry.displayName}</span>
                      <Badge className={`ml-2 ${getStatusColor(entry.status)}`}>{entry.status}</Badge>
                      {entry.userId === currentUserId && (
                        <span className="ml-2 text-xs text-primary">(Вы)</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="font-bold">
                    {entry.score}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="month" className="mt-0">
            <div className="text-center py-8 text-muted-foreground">
              Данные за месяц будут доступны скоро
            </div>
          </TabsContent>
          
          <TabsContent value="alltime" className="mt-0">
            <div className="text-center py-8 text-muted-foreground">
              Данные за все время будут доступны скоро
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 