"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Challenge } from "@/types/gamification";
import { Calendar, MapPin, Car, Coins, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChallengeCardProps {
  challenge: Challenge;
  onParticipate?: (challengeId: string) => void;
}

function ChallengeCard({ challenge, onParticipate }: ChallengeCardProps) {
  const { toast } = useToast();
  const daysLeft = Math.ceil((new Date(challenge.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
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
          <span>{Math.round((challenge.progress || 0) * challenge.requirements.count! / 100)} / {challenge.requirements.count}</span>
        </div>
        <Progress value={challenge.progress || 0} className="h-2" />
        
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
      <CardFooter>
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
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  useEffect(() => {
    setIsLoading(true);
    fetch('/api/gamification/challenges')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Error fetching challenges: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.challenges) {
          setChallenges(data.challenges);
        }
      })
      .catch(err => {
        console.error("Error loading challenges:", err);
        toast({
          title: "Ошибка загрузки челленджей",
          description: "Не удалось загрузить еженедельные челленджи",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoading(false));
  }, [toast]);
  
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
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Загрузка челленджей...</p>
        </div>
      </div>
    );
  }
  
  if (challenges.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Нет активных челленджей на данный момент</p>
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
            onParticipate={handleParticipate}
          />
        ))}
      </div>
    </div>
  );
} 