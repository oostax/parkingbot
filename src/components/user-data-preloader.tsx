"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Компонент для предварительной загрузки данных пользователя
 * Выполняет необходимые запросы сразу после авторизации
 */
export default function UserDataPreloader() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Выполняем запросы только если пользователь авторизован
    if (status === 'authenticated' && session?.user) {
      console.log('Предварительная загрузка данных пользователя...');
      
      // Загружаем профиль пользователя
      fetch('/api/gamification/profile')
        .then(res => {
          if (!res.ok) throw new Error(`Ошибка загрузки профиля: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log('Профиль пользователя загружен:', data);
        })
        .catch(error => {
          console.error('Ошибка при загрузке профиля:', error);
        });
      
      // Загружаем достижения пользователя
      fetch('/api/gamification/achievements')
        .then(res => {
          if (!res.ok) throw new Error(`Ошибка загрузки достижений: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log('Достижения пользователя загружены:', data);
        })
        .catch(error => {
          console.error('Ошибка при загрузке достижений:', error);
        });
      
      // Загружаем количество избранных парковок
      fetch('/api/favorites/count')
        .then(res => {
          if (!res.ok) throw new Error(`Ошибка загрузки количества избранных: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log('Количество избранных парковок загружено:', data);
        })
        .catch(error => {
          console.error('Ошибка при загрузке количества избранных:', error);
        });
    }
  }, [session, status]);

  // Компонент не рендерит никакой UI
  return null;
} 