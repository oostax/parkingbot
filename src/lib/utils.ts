import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Рассчитывает расстояние между двумя точками на земной поверхности по формуле гаверсинусов
 * @param lat1 Широта первой точки в градусах
 * @param lon1 Долгота первой точки в градусах
 * @param lat2 Широта второй точки в градусах
 * @param lon2 Долгота второй точки в градусах
 * @returns Расстояние в километрах
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  // Радиус Земли в километрах
  const R = 6371;
  
  // Перевод градусов в радианы
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  
  // Формула гаверсинусов
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Расстояние в километрах
  
  return distance;
}

/**
 * Переводит градусы в радианы
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
