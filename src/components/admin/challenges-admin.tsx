"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Calendar, Award, ToggleLeft } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Схема для валидации формы челленджа
const challengeSchema = z.object({
  title: z.string().min(3, { message: "Название должно содержать минимум 3 символа" }),
  description: z.string().min(10, { message: "Описание должно содержать минимум 10 символов" }),
  reward: z.coerce.number().positive({ message: "Награда должна быть положительным числом" }),
  type: z.string(),
  requirement: z.coerce.number().positive({ message: "Требование должно быть положительным числом" }),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean(),
  districtIds: z.string().optional(),
  parkIds: z.string().optional(),
  imageUrl: z.string().optional(),
});

type ChallengeFormData = z.infer<typeof challengeSchema>;

// Интерфейс для челленджа
interface Challenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: string;
  requirement: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  districtIds?: string;
  parkIds?: string;
  imageUrl?: string;
}

export default function ChallengesAdmin() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const { toast } = useToast();

  const form = useForm<ChallengeFormData>({
    resolver: zodResolver(challengeSchema),
    defaultValues: {
      title: "",
      description: "",
      reward: 10,
      type: "visit_parks",
      requirement: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      districtIds: "[]",
      parkIds: "[]",
      imageUrl: "",
    }
  });

  // Загрузка челленджей
  const loadChallenges = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/challenges");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке челленджей");
      }
      const data = await response.json();
      setChallenges(data.challenges || []);
    } catch (error) {
      console.error("Error loading challenges:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить челленджи",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadChallenges();
  }, []);

  // Сохранение челленджа
  const onSubmit = async (data: ChallengeFormData) => {
    setIsSubmitting(true);
    try {
      const endpoint = editingChallenge 
        ? `/api/admin/challenges/${editingChallenge.id}` 
        : "/api/admin/challenges";
      
      const method = editingChallenge ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Ошибка при сохранении челленджа");
      }

      toast({
        title: "Успешно",
        description: editingChallenge 
          ? "Челлендж успешно обновлен" 
          : "Челлендж успешно создан",
      });

      // Перезагрузка списка челленджей
      loadChallenges();
      
      // Сброс формы
      form.reset();
      setEditingChallenge(null);
    } catch (error) {
      console.error("Error saving challenge:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить челлендж",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Установка значений формы при редактировании
  const handleEditChallenge = (challenge: Challenge) => {
    setEditingChallenge(challenge);
    
    form.reset({
      title: challenge.title,
      description: challenge.description,
      reward: challenge.reward,
      type: challenge.type,
      requirement: challenge.requirement,
      startDate: new Date(challenge.startDate).toISOString().split('T')[0],
      endDate: new Date(challenge.endDate).toISOString().split('T')[0],
      isActive: Boolean(challenge.isActive),
      districtIds: challenge.districtIds || "[]",
      parkIds: challenge.parkIds || "[]",
      imageUrl: challenge.imageUrl || "",
    });
  };

  // Удаление челленджа
  const handleDeleteChallenge = async (challengeId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот челлендж?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/challenges/${challengeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении челленджа");
      }

      toast({
        title: "Успешно",
        description: "Челлендж успешно удален",
      });

      // Перезагрузка списка челленджей
      loadChallenges();
    } catch (error) {
      console.error("Error deleting challenge:", error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить челлендж",
        variant: "destructive",
      });
    }
  };

  // Получение типа челленджа для отображения
  const getChallengeTypeLabel = (type: string) => {
    switch (type) {
      case "visit_parks": return "Посещение парковок";
      case "daily_login": return "Ежедневный вход";
      case "invite_friends": return "Пригласить друзей";
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Управление челленджами</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingChallenge(null);
                form.reset({
                  title: "",
                  description: "",
                  reward: 10,
                  type: "visit_parks",
                  requirement: 1,
                  startDate: new Date().toISOString().split('T')[0],
                  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  isActive: true,
                  districtIds: "[]",
                  parkIds: "[]",
                  imageUrl: "",
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Создать челлендж
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingChallenge ? "Редактировать" : "Создать"} челлендж
              </DialogTitle>
              <DialogDescription>
                Заполните поля ниже, чтобы {editingChallenge ? "обновить" : "создать"} челлендж
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите название челленджа" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Введите описание челленджа" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reward"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Награда (токены)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип челленджа</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="visit_parks">Посещение парковок</SelectItem>
                            <SelectItem value="daily_login">Ежедневный вход</SelectItem>
                            <SelectItem value="invite_friends">Пригласить друзей</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="requirement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Требование (количество)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Количество посещений/дней/приглашений необходимых для выполнения
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата начала</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата окончания</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Активен</FormLabel>
                        <FormDescription>
                          Отображать этот челлендж пользователям
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="districtIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID районов (JSON array)</FormLabel>
                      <FormControl>
                        <Input placeholder='["district1", "district2"]' {...field} />
                      </FormControl>
                      <FormDescription>
                        JSON массив с ID районов для челленджа посещения
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="parkIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID парковок (JSON array)</FormLabel>
                      <FormControl>
                        <Input placeholder='["park1", "park2"]' {...field} />
                      </FormControl>
                      <FormDescription>
                        JSON массив с ID парковок для челленджа посещения
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL изображения</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите URL изображения" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" type="button">Отмена</Button>
                  </DialogClose>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {editingChallenge ? "Обновить" : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {challenges.length === 0 ? (
        <Card className="w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Челленджи отсутствуют</p>
            <p className="text-sm text-muted-foreground mt-1">Создайте первый челлендж нажав на кнопку выше</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {challenges.map(challenge => (
            <Card key={challenge.id} className={!challenge.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{challenge.title}</span>
                  {!challenge.isActive && (
                    <span className="bg-muted text-muted-foreground text-xs py-1 px-2 rounded-md">
                      Не активен
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{challenge.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div className="flex items-center">
                    <Award className="h-4 w-4 mr-1 text-amber-500" />
                    <span>{challenge.reward} токенов</span>
                  </div>
                  <div className="flex items-center">
                    <ToggleLeft className="h-4 w-4 mr-1 text-blue-500" />
                    <span>{getChallengeTypeLabel(challenge.type)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>
                      {new Date(challenge.startDate).toLocaleDateString()} - 
                      {new Date(challenge.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    Требование: {challenge.requirement}
                  </div>
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditChallenge(challenge)}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Редактировать
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>
                        {editingChallenge ? "Редактировать" : "Создать"} челлендж
                      </DialogTitle>
                      <DialogDescription>
                        Заполните поля ниже, чтобы {editingChallenge ? "обновить" : "создать"} челлендж
                      </DialogDescription>
                    </DialogHeader>
                    
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Форма с теми же полями, что и выше */}
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="destructive"
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleDeleteChallenge(challenge.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Удалить
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 