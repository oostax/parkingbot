"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Challenge } from "@/types/gamification";
import { Calendar, MapPin, Car, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Временные данные для демонстрации
const mockChallenges: Challenge[] = [
  {
    id: "1",
    title: "Исследователь района",
    description: "Посетите 5 разных парковок в Центральном районе",
    imageUrl: "/challenges/district-explorer.svg",
    tokenReward: 50,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "visit_parks",
    requirements: {
      count: 5,
      districtIds: ["central"]
    }
  },
  {
    id: "2",
    title: "Неделя активности",
    description: "Используйте приложение 7 дней подряд",
    imageUrl: "/challenges/weekly-streak.svg",
    tokenReward: 30,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "daily_login",
    requirements: {
      count: 7
    }
  },
  {
    id: "3",
    title: "Пригласите друзей",
    description: "Пригласите 3 друзей воспользоваться приложением",
    imageUrl: "/challenges/invite-friends.svg",
    tokenReward: 100,
    startDate: new Date("2023-06-01"),
    endDate: new Date("2023-06-30"),
    type: "invite_friends",
    requirements: {
      count: 3
    }
  }
];

interface ChallengeCardProps {
  challenge: Challenge;
  progress?: number;
  currentProgress?: number;
  onParticipate?: (challengeId: string) => void;
}

function ChallengeCard({ challenge, progress = 0, currentProgress = 0, onParticipate }: ChallengeCardProps) {
  const { toast } = useToast();
  const daysLeft = Math.ceil((challenge.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  const getChallengeIcon = () => {
    switch (challenge.type) {
      case "visit_parks": return <MapPin className="h-5 w-5 text-primary" />;
      case "daily_login": return <Calendar className="h-5 w-5 text-green-600" />;
      case "invite_friends": return <Car className="h-5 w-5 text-blue-600" />;
      default: return <Coins className="h-5 w-5 text-amber-600" />;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{challenge.title}</CardTitle>
            <CardDescription>{challenge.description}</CardDescription>
          </div>
          <div className="bg-primary/10 p-2 rounded-full">
            {getChallengeIcon()}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Прогресс</span>
          <span>{currentProgress} / {challenge.requirements.count}</span>
        </div>
        <Progress value={progress} className="h-2" />
        
        <div className="flex justify-between items-center mt-4">
          <div className="text-xs text-muted-foreground">
            {daysLeft > 0 ? `${daysLeft} дн. осталось` : "Завершается сегодня"}
          </div>
          <div className="flex items-center">
            <Coins className="h-4 w-4 text-amber-500 mr-1" />
            <span className="font-medium">{challenge.tokenReward}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full" 
          onClick={() => {
            if (onParticipate) {
              onParticipate(challenge.id);
            } else {
              toast({
                title: "Участие в челлендже",
                description: "Вы успешно присоединились к челленджу",
                variant: "default",
              });
            }
          }}
        >
          Участвовать
        </Button>
      </CardFooter>
    </Card>
  );
}

interface ChallengesProps {
  userId?: string;
}

export default function Challenges({ userId }: ChallengesProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userProgress, setUserProgress] = useState<{[challengeId: string]: {progress: number, currentProgress: number}}>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    // В реальном приложении здесь будет запрос к API
    setTimeout(() => {
      setChallenges(mockChallenges);
      // Имитация прогресса пользователя
      setUserProgress({
        "1": { progress: 40, currentProgress: 2 },
        "2": { progress: 71, currentProgress: 5 },
        "3": { progress: 0, currentProgress: 0 }
      });
      setIsLoading(false);
    }, 500);
  }, []);
  
  const handleParticipate = (challengeId: string) => {
    toast({
      title: "Участие в челлендже",
      description: "Вы успешно присоединились к челленджу",
      variant: "default",
    });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Еженедельные челленджи</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {challenges.map((challenge) => (
          <ChallengeCard 
            key={challenge.id} 
            challenge={challenge}
            progress={userProgress[challenge.id]?.progress || 0}
            currentProgress={userProgress[challenge.id]?.currentProgress || 0}
            onParticipate={handleParticipate}
          />
        ))}
      </div>
    </div>
  );
} 