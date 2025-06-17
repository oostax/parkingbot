"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaderboardEntry } from "@/types/gamification";
import { Trophy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getStatusColor(status: string) {
  switch (status) {
    case "Silver": return "bg-gray-200 text-gray-700";
    case "Gold": return "bg-amber-200 text-amber-700";
    case "Platinum": return "bg-indigo-200 text-indigo-700";
    default: return "bg-blue-100 text-blue-700";
  }
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Trophy className="h-5 w-5 text-amber-700" />;
  return <span className="font-bold">{rank}</span>;
}

interface LeaderboardProps {
  currentUserId?: string;
}

export default function Leaderboard({ currentUserId }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/gamification/leaderboard')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Error fetching leaderboard: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.leaderboard) {
          // Если передан currentUserId, обновляем флаг isCurrentUser для соответствующей записи
          const updatedLeaderboard = data.leaderboard.map((entry: LeaderboardEntry) => ({
            ...entry,
            isCurrentUser: currentUserId ? entry.id === currentUserId : entry.isCurrentUser,
          }));
          setLeaderboard(updatedLeaderboard);
        }
      })
      .catch(err => {
        console.error("Error loading leaderboard:", err);
        toast({
          title: "Ошибка загрузки таблицы лидеров",
          description: "Не удалось загрузить таблицу лидеров",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, [toast, currentUserId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Загрузка таблицы лидеров...</p>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Нет данных для отображения</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Таблица лидеров</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div 
                key={entry.id} 
                className={`flex items-center p-3 rounded-lg ${entry.isCurrentUser ? 'bg-primary/10' : ''}`}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div className="flex items-center flex-1 ml-2">
                  <Avatar className="h-8 w-8 mr-2">
                    {entry.avatarUrl ? (
                      <AvatarImage src={entry.avatarUrl} alt={entry.displayName} />
                    ) : null}
                    <AvatarFallback>{entry.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-medium">{entry.displayName}</span>
                      {entry.status && (
                        <Badge className={`ml-2 ${getStatusColor(entry.status)}`}>{entry.status}</Badge>
                      )}
                      {entry.isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">(Вы)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="font-bold">{entry.score}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 