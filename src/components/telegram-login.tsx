"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { signIn } from "next-auth/react";
import Script from "next/script";
import { Loader2 } from "lucide-react";
import type { TelegramAuthData } from "@/types/telegram";

interface TelegramLoginProps {
  onSuccess?: () => void;
}

export default function TelegramLogin({ onSuccess }: TelegramLoginProps) {
  const [isTelegramScriptLoaded, setIsTelegramScriptLoaded] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  
  // Process data from Telegram widget
  const handleTelegramAuth = useCallback((userData: TelegramAuthData) => {
    // Store auth data in localStorage for future auto-login
    if (userData) {
      localStorage.setItem('tg_auth_data', JSON.stringify(userData));
    }
    
    signIn("credentials", {
      telegramData: JSON.stringify(userData),
      redirect: false,
    }).then((res) => {
      if (res?.ok && onSuccess) {
        onSuccess();
      }
    }).finally(() => {
      setIsAutoLoggingIn(false);
    });
  }, [onSuccess]);

  // Check if we're inside Telegram Mini App and attempt auto login
  useEffect(() => {
    // Check if we have stored auth data
    const tryAutoLogin = async () => {
      const storedAuthData = localStorage.getItem('tg_auth_data');
      
      if (storedAuthData) {
        try {
          setIsAutoLoggingIn(true);
          
          const userData = JSON.parse(storedAuthData) as TelegramAuthData;
          // Check if token is still valid (auth_date not too old)
          const authDate = userData.auth_date || 0;
          const currentTime = Math.floor(Date.now() / 1000);
          const maxTokenAge = 7 * 24 * 60 * 60; // 7 days
          
          if (currentTime - authDate < maxTokenAge) {
            // Update the auth date to refresh the token
            userData.auth_date = currentTime;
            handleTelegramAuth(userData);
            return;
          } else {
            // Token expired, remove it
            localStorage.removeItem('tg_auth_data');
            setIsAutoLoggingIn(false);
          }
        } catch (error) {
          console.error("Error during auto-login:", error);
          localStorage.removeItem('tg_auth_data');
          setIsAutoLoggingIn(false);
        }
      }
    };
    
    const isTelegram = Boolean(window?.Telegram?.WebApp);
    setIsMiniApp(isTelegram);

    if (isTelegram && window.Telegram?.WebApp) {
      // We're running inside a Telegram Mini App, get user info from Telegram WebApp API
      const telegramWebApp = window.Telegram.WebApp;
      
      if (telegramWebApp?.initDataUnsafe?.user) {
        // Use the user data provided by Telegram WebApp
        setIsAutoLoggingIn(true);
        const userData = telegramWebApp.initDataUnsafe.user;
        handleTelegramAuth({
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          photo_url: userData.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
        });
      }
    } else {
      // Try auto login from stored auth data
      tryAutoLogin();
    }
  }, [handleTelegramAuth]);

  // Function to render the Telegram login widget
  const renderTelegramLoginWidget = useCallback(() => {
    if (typeof window !== 'undefined' && isTelegramScriptLoaded && !isMiniApp) {
      const TelegramLoginWidget = window.Telegram?.Login?.Widget;
      
      if (TelegramLoginWidget) {
        const widgetElement = document.createElement('div');
        const container = document.getElementById('telegram-login-container');
        
        if (container) {
          container.innerHTML = '';
          container.appendChild(widgetElement);
          
          new TelegramLoginWidget(
            widgetElement, {
              botName: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
              buttonSize: 'medium',
              cornerRadius: 8,
              requestAccess: 'write',
              usePic: false,
              lang: 'ru',
              onAuth: handleTelegramAuth
            }
          );
        }
      }
    }
  }, [isTelegramScriptLoaded, isMiniApp, handleTelegramAuth]);
  
  useEffect(() => {
    renderTelegramLoginWidget();
  }, [renderTelegramLoginWidget]);

  if (isMiniApp) {
    // No need to show login button inside Telegram
    return null;
  }

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-widget.js"
        onLoad={() => setIsTelegramScriptLoaded(true)}
      />
      <div id="telegram-login-container">
        {isAutoLoggingIn ? (
          <Button variant="default" size="sm" className="text-xs py-1 px-2 md:py-2 md:px-4 flex items-center whitespace-nowrap">
            <Loader2 className="mr-1 h-3 w-3 md:h-4 md:w-4 animate-spin" />
            <span className="hidden xs:inline">Вход...</span>
            <span className="xs:hidden">...</span>
          </Button>
        ) : (
          <Button variant="default" size="sm" className="text-xs py-1 px-2 md:py-2 md:px-4 whitespace-nowrap">
            <span className="hidden xs:inline">Войти через Telegram</span>
            <span className="xs:hidden">Войти</span>
          </Button>
        )}
      </div>
    </>
  );
} 