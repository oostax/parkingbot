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
import { Loader2, Plus, Pencil, Trash2, User, ShieldCheck, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Схема для валидации формы администратора
const adminSchema = z.object({
  telegramId: z.string().min(1, { message: "Telegram ID обязателен" }),
  username: z.string().optional(),
  fullName: z.string().optional(),
  role: z.string(),
  isActive: z.boolean(),
});

type AdminFormData = z.infer<typeof adminSchema>;

// Интерфейс для администратора
interface AdminUser {
  id: string;
  telegramId: string;
  username?: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  addedById?: string;
  createdAt: string;
}

interface AdminsManagementProps {
  currentUserId: string;
}

export default function AdminsManagement({ currentUserId }: AdminsManagementProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const form = useForm<AdminFormData>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      telegramId: "",
      username: "",
      fullName: "",
      role: "admin",
      isActive: true,
    }
  });

  // Загрузка администраторов
  const loadAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке администраторов");
      }
      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Error loading admins:", error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить список администраторов",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  // Сохранение администратора
  const onSubmit = async (data: AdminFormData) => {
    setIsSubmitting(true);
    try {
      const endpoint = editingAdmin 
        ? `/api/admin/users/${editingAdmin.id}` 
        : "/api/admin/users";
      
      const method = editingAdmin ? "PUT" : "POST";
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Ошибка при сохранении администратора");
      }

      toast({
        title: "Успешно",
        description: editingAdmin 
          ? "Данные администратора обновлены" 
          : "Администратор добавлен",
      });

      // Перезагрузка списка администраторов
      loadAdmins();
      
      // Сброс формы
      form.reset();
      setEditingAdmin(null);
    } catch (error) {
      console.error("Error saving admin:", error);
      toast({
        title: "Ошибка сохранения",
        description: "Не удалось сохранить данные администратора",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Установка значений формы при редактировании
  const handleEditAdmin = (admin: AdminUser) => {
    setEditingAdmin(admin);
    
    form.reset({
      telegramId: admin.telegramId,
      username: admin.username || "",
      fullName: admin.fullName || "",
      role: admin.role,
      isActive: admin.isActive,
    });
  };

  // Удаление администратора
  const handleDeleteAdmin = async (adminId: string, telegramId: string) => {
    // Нельзя удалить себя
    if (telegramId === currentUserId) {
      toast({
        title: "Действие запрещено",
        description: "Вы не можете удалить свою учетную запись",
        variant: "destructive",
      });
      return;
    }
    
    if (!confirm("Вы уверены, что хотите удалить этого администратора?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${adminId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении администратора");
      }

      toast({
        title: "Успешно",
        description: "Администратор удален",
      });

      // Перезагрузка списка администраторов
      loadAdmins();
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast({
        title: "Ошибка удаления",
        description: "Не удалось удалить администратора",
        variant: "destructive",
      });
    }
  };

  // Получение роли администратора для отображения
  const getAdminRoleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "Супер-администратор";
      case "admin": return "Администратор";
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Добавляем основного администратора, если список пуст
  if (admins.length === 0) {
    const defaultAdmin = {
      id: "default",
      telegramId: "760360583",
      username: "Default Admin",
      role: "super_admin",
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    admins.push(defaultAdmin);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Управление администраторами</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              onClick={() => {
                setEditingAdmin(null);
                form.reset({
                  telegramId: "",
                  username: "",
                  fullName: "",
                  role: "admin",
                  isActive: true,
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Добавить администратора
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingAdmin ? "Редактировать" : "Добавить"} администратора
              </DialogTitle>
              <DialogDescription>
                Заполните поля ниже, чтобы {editingAdmin ? "обновить данные" : "добавить нового"} администратора
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="telegramId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telegram ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите Telegram ID" {...field} />
                      </FormControl>
                      <FormDescription>
                        ID пользователя в Telegram (числовое значение)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Логин (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите логин" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Полное имя (необязательно)</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите полное имя" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Роль</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите роль" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Администратор</SelectItem>
                          <SelectItem value="super_admin">Супер-администратор</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Роль определяет уровень доступа к функционалу админ-панели
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Активен</FormLabel>
                        <FormDescription>
                          Активный аккаунт имеет доступ к админ-панели
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
                    {editingAdmin ? "Обновить" : "Добавить"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {admins.map(admin => (
          <Card key={admin.id} className={!admin.isActive ? "opacity-60" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-primary" />
                  <span>{admin.username || `Telegram ID: ${admin.telegramId}`}</span>
                </div>
                {!admin.isActive && (
                  <span className="bg-muted text-muted-foreground text-xs py-1 px-2 rounded-md">
                    Не активен
                  </span>
                )}
              </CardTitle>
              <CardDescription>{admin.fullName || 'Не указано'}</CardDescription>
            </CardHeader>
            
            <CardContent className="pb-2">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Telegram ID:</span>
                  <span className="font-medium">{admin.telegramId}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Роль:</span>
                  <div className="flex items-center">
                    {admin.role === "super_admin" ? (
                      <ShieldAlert className="h-4 w-4 mr-1 text-amber-500" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-1 text-primary" />
                    )}
                    <span>{getAdminRoleLabel(admin.role)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Дата добавления:</span>
                  <span>{new Date(admin.createdAt).toLocaleDateString()}</span>
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
                    onClick={() => handleEditAdmin(admin)}
                  >
                    <Pencil className="h-4 w-4 mr-2" /> Редактировать
                  </Button>
                </DialogTrigger>
                
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Редактировать администратора</DialogTitle>
                    <DialogDescription>
                      Измените данные администратора
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
                onClick={() => handleDeleteAdmin(admin.id, admin.telegramId)}
                disabled={admin.telegramId === currentUserId || admin.telegramId === "760360583"}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Удалить
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
} 