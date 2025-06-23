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
import { Loader2, Plus, Pencil, Trash2, Medal, Award, BarChart } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Схема для валидации формы достижения
const achievementSchema = z.object({
  id: z.string().min(2, { message: "ID должен содержать минимум 2 символа" }),
  name: z.string().min(3, { message: "Название должно содержать минимум 3 символа" }),
  description: z.string().min(10, { message: "Описание должно содержать минимум 10 символов" }),
  category: z.string(),
  reward: z.coerce.number().int().positive({ message: "Награда должна быть положительным числом" }),
  thresholds: z.string().min(1, { message: "Необходимо указать пороговые значения" }),
  iconUrl: z.string().optional(),
});

type AchievementFormData = z.infer<typeof achievementSchema>;

// Интерфейс для достижения
interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  reward: number;
  thresholds: number[];
  iconUrl?: string;
  earnedCount?: number;
}

export default function AchievementsAdmin() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const { toast } = useToast();

  const form = useForm<AchievementFormData>({
    resolver: zodResolver(achievementSchema),
    defaultValues: {
      id: "",
      name: "",
      description: "",
      category: "visits",
      reward: 10,
      thresholds: "1,5,10",
      iconUrl: "",
    }
  });

  // Загрузка достижений
  const loadAchievements = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/achievements");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке достижений");
      }
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (error) {
      console.error("Error loading achievements:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить достижения",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAchievements();
  }, []);

  // Сохранение достижения
  const onSubmit = async (data: AchievementFormData) => {
    setIsSubmitting(true);
    
    // Преобразуем строку порогов в массив чисел
    const thresholds = data.thresholds
      .split(',')
      .map(t => parseInt(t.trim()))
      .filter(t => !isNaN(t) && t > 0)
      .sort((a, b) => a - b);
    
    if (thresholds.length === 0) {
      toast({
        title: "Ошибка валидации",
        description: "Пороговые значения должны содержать как минимум одно число",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }
    
    try {
      const endpoint = editingAchievement 
        ? `/api/admin/achievements/${data.id}` 
        : "/api/admin/achievements";
      
      const method = editingAchievement ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          thresholds,
        }),
      });

      if (!response.ok) {
        throw new Error("Ошибка при сохранении достижения");
      }

      toast({
        title: "Успешно",
        description: editingAchievement 
          ? "Достижение успешно обновлено" 
          : "Достижение успешно создано",
      });

      // Перезагрузка списка достижений
      loadAchievements();
      
      // Сброс формы
      form.reset();
      setEditingAchievement(null);
    } catch (error) {
      console.error("Error saving achievement:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить достижение",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Установка значений формы при редактировании
  const handleEditAchievement = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    
    form.reset({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      reward: achievement.reward,
      thresholds: achievement.thresholds.join(','),
      iconUrl: achievement.iconUrl || "",
    });
  };

  // Удаление достижения
  const handleDeleteAchievement = async (achievementId: string) => {
    if (!confirm("Вы уверены, что хотите удалить это достижение?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/achievements/${achievementId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении достижения");
      }

      toast({
        title: "Успешно",
        description: "Достижение успешно удалено",
      });

      // Перезагрузка списка достижений
      loadAchievements();
    } catch (error) {
      console.error("Error deleting achievement:", error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить достижение",
        variant: "destructive",
      });
    }
  };

  // Получение категории достижения для отображения
  const getAchievementCategoryLabel = (category: string) => {
    switch (category) {
      case "visits": return "Посещения";
      case "loyalty": return "Лояльность";
      case "social": return "Социальная активность";
      case "special": return "Особые достижения";
      default: return category;
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
        <h2 className="text-xl font-semibold">Управление достижениями</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingAchievement(null);
                form.reset({
                  id: "",
                  name: "",
                  description: "",
                  category: "visits",
                  reward: 10,
                  thresholds: "1,5,10",
                  iconUrl: "",
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Создать достижение
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingAchievement ? "Редактировать" : "Создать"} достижение
              </DialogTitle>
              <DialogDescription>
                Заполните поля ниже, чтобы {editingAchievement ? "обновить" : "создать"} достижение
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID достижения</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="unique_id" 
                            {...field} 
                            disabled={!!editingAchievement}
                          />
                        </FormControl>
                        <FormDescription>
                          Уникальный идентификатор (например, "first_visit")
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Категория</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите категорию" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="visits">Посещения</SelectItem>
                            <SelectItem value="loyalty">Лояльность</SelectItem>
                            <SelectItem value="social">Социальная активность</SelectItem>
                            <SelectItem value="special">Особые достижения</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите название достижения" {...field} />
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
                        <Textarea 
                          placeholder="Введите описание достижения" 
                          {...field} 
                          className="min-h-[80px]"
                        />
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
                    name="thresholds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Пороговые значения</FormLabel>
                        <FormControl>
                          <Input placeholder="1,5,10" {...field} />
                        </FormControl>
                        <FormDescription>
                          Через запятую, например: 1,5,10
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="iconUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL иконки (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/icon.svg" {...field} />
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
                    {editingAchievement ? "Обновить" : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {achievements.length === 0 ? (
        <Card className="w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Достижения отсутствуют</p>
            <p className="text-sm text-muted-foreground mt-1">Создайте первое достижение нажав на кнопку выше</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map(achievement => (
            <Card key={achievement.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-1 mr-2 bg-primary/10 rounded-full">
                      <Medal className="h-5 w-5 text-primary" />
                    </div>
                    <span>{achievement.name}</span>
                  </div>
                  <span className="bg-muted text-muted-foreground text-xs py-1 px-2 rounded-md">
                    {getAchievementCategoryLabel(achievement.category)}
                  </span>
                </CardTitle>
                <CardDescription className="line-clamp-2">{achievement.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Награда:</span>
                    <div className="flex items-center">
                      <Award className="h-4 w-4 mr-1 text-amber-500" />
                      <span>{achievement.reward} токенов</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Пороги:</span>
                    <div className="flex items-center">
                      <BarChart className="h-4 w-4 mr-1 text-blue-500" />
                      <span>{achievement.thresholds.join(', ')}</span>
                    </div>
                  </div>
                  
                  {achievement.earnedCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Кол-во получивших:</span>
                      <span>{achievement.earnedCount}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              
              <CardFooter className="flex justify-between gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditAchievement(achievement)}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Редактировать
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>Редактировать достижение</DialogTitle>
                      <DialogDescription>
                        Измените данные достижения
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
                  onClick={() => handleDeleteAchievement(achievement.id)}
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