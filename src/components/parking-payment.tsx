"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ParkingInfo, ParkingPaymentCalculation, VehicleType } from "@/types/parking";
import { Loader2, Car, Truck, Bike, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ParkingPaymentProps {
  parking: ParkingInfo;
  onClose: () => void;
}

export default function ParkingPayment({ parking, onClose }: ParkingPaymentProps) {
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  const [vehicleNumber, setVehicleNumber] = useState<string>("");
  const [duration, setDuration] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [calculation, setCalculation] = useState<ParkingPaymentCalculation | null>(null);
  const [step, setStep] = useState<"input" | "confirm" | "success">("input");
  
  // Функция для валидации номера автомобиля
  const validateVehicleNumber = (number: string): boolean => {
    // Для России: А123БВ77, А123БВ777
    const russianPattern = /^[АВЕКМНОРСТУХ]\d{3}(?<!000)[АВЕКМНОРСТУХ]{2}\d{2,3}$/;
    
    return russianPattern.test(number.toUpperCase());
  };
  
  // Функция для расчета стоимости
  const calculateCost = async () => {
    // Проверяем заполненность полей
    if (!vehicleNumber) {
      toast({
        title: "Ошибка",
        description: "Введите номер транспортного средства",
        variant: "destructive",
      });
      return;
    }
    
    // Проверяем валидность номера
    if (!validateVehicleNumber(vehicleNumber)) {
      toast({
        title: "Ошибка",
        description: "Неверный формат номера транспортного средства",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Если цена парковки неизвестна, используем значение по умолчанию
      if (!parking.price || parking.price === "Бесплатно") {
        toast({
          title: "Внимание",
          description: "Информация о стоимости парковки отсутствует. Будет использована стандартная стоимость 40 руб/час.",
          variant: "default",
        });
      }
      
      const response = await fetch(`/api/parkings/${parking.id}/payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicleType,
          vehicleNumber,
          duration,
          startTime: new Date().toISOString(), // Преобразуем в строку для передачи через JSON
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Ошибка при расчете стоимости");
      }
      
      setCalculation(data);
      setStep("confirm");
    } catch (error) {
      console.error("Ошибка при расчете стоимости:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось рассчитать стоимость парковки",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция для перехода на страницу оплаты
  const proceedToPayment = () => {
    if (!calculation) return;
    
    // Используем Яндекс.Карты для оплаты парковки
    // Согласно https://rb.ru/news/yandex-parking/ Яндекс добавил функцию оплаты парковки в Москве
    const yandexMapsUrl = 'https://yandex.ru/maps/';
    
    // Открываем Яндекс.Карты в новом окне
    window.open(yandexMapsUrl, '_blank');
    
    // Показываем инструкцию пользователю
    toast({
      title: "Переход к оплате",
      description: "Для оплаты парковки используйте Яндекс.Карты. Активируйте слой с парковками (значок P), найдите свою парковку и оплатите в появившейся карточке.",
      variant: "default",
    });
    
    // Переходим к шагу успешного завершения
    setStep("success");
  };
  
  // Функция для закрытия компонента
  const handleClose = () => {
    onClose();
  };
  
  // Функция для форматирования стоимости
  const formatCost = (cost: number, currency: string = "RUB"): string => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(cost);
  };
  
  // Отображаем соответствующий шаг
  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-bold">
          Оплата парковки
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {step === "input" && (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Тип транспортного средства</Label>
              <RadioGroup
                value={vehicleType}
                onValueChange={(value) => setVehicleType(value as VehicleType)}
                className="flex space-x-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="car" id="car" />
                  <Label htmlFor="car" className="flex items-center">
                    <Car className="h-4 w-4 mr-1" />
                    Автомобиль
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="motorcycle" id="motorcycle" />
                  <Label htmlFor="motorcycle" className="flex items-center">
                    <Bike className="h-4 w-4 mr-1" />
                    Мотоцикл
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="truck" id="truck" />
                  <Label htmlFor="truck" className="flex items-center">
                    <Truck className="h-4 w-4 mr-1" />
                    Грузовик
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label htmlFor="vehicle-number" className="mb-2 block">
                Номер транспортного средства
              </Label>
              <Input
                id="vehicle-number"
                placeholder="А123БВ77"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                className="uppercase"
              />
              <p className="text-xs text-gray-500 mt-1">
                Формат: А123БВ77 или А123БВ777
              </p>
            </div>
            
            <div>
              <Label htmlFor="duration" className="mb-2 block">
                Длительность парковки
              </Label>
              <Select
                value={duration.toString()}
                onValueChange={(value) => setDuration(parseInt(value, 10))}
              >
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Выберите длительность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 час</SelectItem>
                  <SelectItem value="2">2 часа</SelectItem>
                  <SelectItem value="3">3 часа</SelectItem>
                  <SelectItem value="4">4 часа</SelectItem>
                  <SelectItem value="5">5 часов</SelectItem>
                  <SelectItem value="6">6 часов</SelectItem>
                  <SelectItem value="12">12 часов</SelectItem>
                  <SelectItem value="24">24 часа</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        
        {step === "confirm" && calculation && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Информация об оплате</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Парковка:</span>
                  <span className="font-medium">{parking.name}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Номер ТС:</span>
                  <span className="font-medium">{vehicleNumber.toUpperCase()}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Тип ТС:</span>
                  <span className="font-medium">
                    {vehicleType === "car" && "Автомобиль"}
                    {vehicleType === "motorcycle" && "Мотоцикл"}
                    {vehicleType === "truck" && "Грузовик"}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Длительность:</span>
                  <span className="font-medium">{calculation.duration} ч.</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Тариф:</span>
                  <span className="font-medium">{formatCost(calculation.hourlyRate)} / час</span>
                </div>
                
                <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                  <span>Итого к оплате:</span>
                  <span className="text-green-700">{formatCost(calculation.totalCost)}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                После нажатия кнопки "Перейти к оплате" вы будете перенаправлены на официальный сайт Московского парковочного пространства для завершения оплаты.
              </p>
            </div>
          </div>
        )}
        
        {step === "success" && (
          <div className="text-center py-4">
            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <p className="text-green-700">
                Для оплаты парковки используйте Яндекс.Карты. Активируйте слой с парковками (значок P), найдите свою парковку и оплатите в появившейся карточке.
              </p>
              <p className="text-green-700 mt-2">
                Информация о парковке:
              </p>
              <ul className="text-green-700 list-disc list-inside mt-1">
                <li>Номер автомобиля: <strong>{vehicleNumber.toUpperCase()}</strong></li>
                <li>Длительность парковки: <strong>{calculation?.duration} ч.</strong></li>
                <li>Стоимость: <strong>{calculation?.totalCost} ₽</strong></li>
                <li>Парковочная зона: <strong>{parking.id}</strong></li>
              </ul>
            </div>
            
            <Button
              onClick={proceedToPayment}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Перейти к оплате
            </Button>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between gap-2">
        {step === "input" && (
          <>
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button
              onClick={calculateCost}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Рассчитать стоимость
            </Button>
          </>
        )}
        
        {step === "confirm" && (
          <>
            <Button
              variant="outline"
              onClick={() => setStep("input")}
              className="flex-1"
            >
              Назад
            </Button>
            <Button
              onClick={proceedToPayment}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Перейти к оплате
            </Button>
          </>
        )}
        
        {step === "success" && (
          <Button
            onClick={handleClose}
            className="flex-1"
          >
            Закрыть
          </Button>
        )}
      </CardFooter>
    </Card>
  );
} 