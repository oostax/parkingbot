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
import { Loader2, Plus, Pencil, Trash2, Timer, Tag, Coins, Gift, User } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Схема для валидации формы промокода
const promoCodeSchema = z.object({
  code: z.string().min(3, { message: "Код должен содержать минимум 3 символа" }),
  reward: z.coerce.number().positive({ message: "Награда должна быть положительным числом" }),
  type: z.string(),
  description: z.string().optional(),
  isActive: z.boolean(),
  expiresAt: z.string().optional(),
  usageLimit: z.coerce.number().int().nonnegative().optional(),
});

type PromoCodeFormData = z.infer<typeof promoCodeSchema>;

// Интерфейс для промокода
interface PromoCode {
  id: string;
  code: string;
  reward: number;
  type: string;
  description?: string;
  isActive: boolean;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  createdAt: string;
  createdBy?: string;
  redemptions?: { userId: string; redeemedAt: string }[];
}

export default function PromoCodesAdmin() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPromoCode, setEditingPromoCode] = useState<PromoCode | null>(null);
  const { toast } = useToast();

  const form = useForm<PromoCodeFormData>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues: {
      code: "",
      reward: 10,
      type: "tokens",
      description: "",
      isActive: true,
      expiresAt: "",
      usageLimit: 0,
    }
  });

  // Загрузка промокодов
  const loadPromoCodes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/promocodes");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке промокодов");
      }
      const data = await response.json();
      setPromoCodes(data.promoCodes || []);
    } catch (error) {
      console.error("Error loading promo codes:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить список промокодов",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPromoCodes();
  }, []);

  // Генерация случайного промокода
  const generateRandomCode = () => {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    form.setValue('code', result);
  };

  // Сохранение промокода
  const onSubmit = async (data: PromoCodeFormData) => {
    setIsSubmitting(true);
    try {
      const endpoint = editingPromoCode 
        ? `/api/admin/promocodes/${editingPromoCode.id}` 
        : "/api/admin/promocodes";
      
      const method = editingPromoCode ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Ошибка при сохранении промокода");
      }

      toast({
        title: "Успешно",
        description: editingPromoCode 
          ? "Промокод успешно обновлен" 
          : "Промокод успешно создан",
      });

      // Перезагрузка списка промокодов
      loadPromoCodes();
      
      // Сброс формы
      form.reset();
      setEditingPromoCode(null);
    } catch (error) {
      console.error("Error saving promo code:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить промокод",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Установка значений формы при редактировании
  const handleEditPromoCode = (promoCode: PromoCode) => {
    setEditingPromoCode(promoCode);
    
    form.reset({
      code: promoCode.code,
      reward: promoCode.reward,
      type: promoCode.type,
      description: promoCode.description || "",
      isActive: promoCode.isActive,
      expiresAt: promoCode.expiresAt ? new Date(promoCode.expiresAt).toISOString().split('T')[0] : "",
      usageLimit: promoCode.usageLimit || 0,
    });
  };

  // Удаление промокода
  const handleDeletePromoCode = async (promoCodeId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот промокод?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/promocodes/${promoCodeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении промокода");
      }

      toast({
        title: "Успешно",
        description: "Промокод успешно удален",
      });

      // Перезагрузка списка промокодов
      loadPromoCodes();
    } catch (error) {
      console.error("Error deleting promo code:", error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить промокод",
        variant: "destructive",
      });
    }
  };

  // Получение типа промокода для отображения
  const getPromoCodeTypeLabel = (type: string) => {
    switch (type) {
      case "tokens": return "Токены";
      case "discount": return "Скидка";
      case "status_boost": return "Бонус к статусу";
      default: return type;
    }
  };

  // Проверка срока действия промокода
  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // Проверка лимита использования промокода
  const isLimitReached = (usageLimit?: number, usageCount = 0) => {
    if (!usageLimit || usageLimit === 0) return false;
    return usageCount >= usageLimit;
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
        <h2 className="text-xl font-semibold">Управление промокодами</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingPromoCode(null);
                form.reset({
                  code: "",
                  reward: 10,
                  type: "tokens",
                  description: "",
                  isActive: true,
                  expiresAt: "",
                  usageLimit: 0,
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Создать промокод
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingPromoCode ? "Редактировать" : "Создать"} промокод
              </DialogTitle>
              <DialogDescription>
                Заполните поля ниже, чтобы {editingPromoCode ? "обновить" : "создать"} промокод
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Код</FormLabel>
                        <FormControl>
                          <Input placeholder="Введите промокод" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomCode}
                  >
                    Сгенерировать
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="reward"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Награда</FormLabel>
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
                        <FormLabel>Тип награды</FormLabel>
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
                            <SelectItem value="tokens">Токены</SelectItem>
                            <SelectItem value="discount">Скидка</SelectItem>
                            <SelectItem value="status_boost">Бонус к статусу</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите описание промокода" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата окончания (необязательно)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormDescription>
                          Оставьте пустым для бессрочного промокода
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="usageLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Лимит использований</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" {...field} />
                        </FormControl>
                        <FormDescription>
                          0 = без ограничений
                        </FormDescription>
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
                          Промокод может использоваться пользователями
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
                    {editingPromoCode ? "Обновить" : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      {promoCodes.length === 0 ? (
        <Card className="w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Промокоды отсутствуют</p>
            <p className="text-sm text-muted-foreground mt-1">Создайте первый промокод нажав на кнопку выше</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {promoCodes.map(promoCode => {
            const expired = isExpired(promoCode.expiresAt);
            const limitReached = isLimitReached(promoCode.usageLimit, promoCode.usageCount);
            const isInactive = !promoCode.isActive || expired || limitReached;
            
            return (
              <Card key={promoCode.id} className={isInactive ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-2 text-primary" />
                      <span>{promoCode.code}</span>
                    </div>
                    {isInactive && (
                      <span className="bg-muted text-muted-foreground text-xs py-1 px-2 rounded-md">
                        {expired ? "Истёк" : limitReached ? "Лимит" : "Не активен"}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{promoCode.description || 'Без описания'}</CardDescription>
                </CardHeader>
                
                <CardContent className="pb-2">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Награда:</span>
                      <div className="flex items-center">
                        {promoCode.type === 'tokens' ? (
                          <Coins className="h-4 w-4 mr-1 text-amber-500" />
                        ) : (
                          <Gift className="h-4 w-4 mr-1 text-primary" />
                        )}
                        <span>{promoCode.reward} {getPromoCodeTypeLabel(promoCode.type)}</span>
                      </div>
                    </div>
                    
                    {promoCode.expiresAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Истекает:</span>
                        <div className="flex items-center">
                          <Timer className="h-4 w-4 mr-1" />
                          <span>{new Date(promoCode.expiresAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Использований:</span>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>
                          {promoCode.usageCount} {promoCode.usageLimit ? `/ ${promoCode.usageLimit}` : ""}
                        </span>
                      </div>
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
                        onClick={() => handleEditPromoCode(promoCode)}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> Редактировать
                      </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Редактировать промокод</DialogTitle>
                        <DialogDescription>
                          Измените данные промокода
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
                    onClick={() => handleDeletePromoCode(promoCode.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Удалить
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
} 