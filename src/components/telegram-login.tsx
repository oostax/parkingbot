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
    console.log("Telegram auth data received:", userData);
    
    // Store auth data in localStorage for future auto-login
    if (userData) {
      localStorage.setItem('tg_auth_data', JSON.stringify(userData));
    }
    
    signIn("credentials", {
      telegramData: JSON.stringify(userData),
      redirect: false,
    }).then((res) => {
      console.log("Sign in result:", res);
      if (res?.ok && onSuccess) {
        onSuccess();
      }
    }).finally(() => {
      setIsAutoLoggingIn(false);
    });
  }, [onSuccess]);

  // Parse Telegram WebApp data from URL hash
  const parseTelegramWebAppDataFromUrl = useCallback(() => {
    // Check for hash in URL (Telegram WebApp data)
    const hash = window.location.hash;
    console.log("URL hash:", hash);
    
    if (hash && hash.includes('tgWebAppData=')) {
      try {
        // Extract WebApp data
        const tgWebAppDataMatch = hash.match(/tgWebAppData=([^&]*)/);
        if (tgWebAppDataMatch && tgWebAppDataMatch[1]) {
          console.log("Found tgWebAppData in URL");
          const tgWebAppDataStr = decodeURIComponent(tgWebAppDataMatch[1]);
          
          // Extract user data
          const userMatch = tgWebAppDataStr.match(/user=([^&]*)/);
          if (userMatch && userMatch[1]) {
            try {
              // Decode and parse user JSON
              const userDataStr = decodeURIComponent(userMatch[1]);
              const userData = JSON.parse(userDataStr);
              console.log("Parsed user data from URL:", userData);
              
              if (userData && userData.id) {
                // Create auth data for sign in
                const authData: TelegramAuthData = {
                  id: userData.id,
                  first_name: userData.first_name,
                  last_name: userData.last_name,
                  username: userData.username,
                  photo_url: userData.photo_url,
                  auth_date: Math.floor(Date.now() / 1000),
                };
                
                // Authorize with this data
                handleTelegramAuth(authData);
                return true;
              }
            } catch (e) {
              console.error("Error parsing WebApp user data:", e);
            }
          }
        }
      } catch (e) {
        console.error("Error processing WebApp data from URL:", e);
      }
    }
    
    return false;
  }, [handleTelegramAuth]);

  // Check if we're inside Telegram Mini App and attempt auto login
  useEffect(() => {
    // First try to parse data from URL if present
    const processedFromUrl = parseTelegramWebAppDataFromUrl();
    if (processedFromUrl) {
      // If we successfully processed data from URL, no need to continue
      console.log("Successfully processed Telegram data from URL");
      return;
    }
    
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
    
    // Check if we're in Telegram Mini App
    const isTelegram = Boolean(window?.Telegram?.WebApp);
    console.log("Is Telegram Mini App:", isTelegram);
    setIsMiniApp(isTelegram);

    if (isTelegram && window.Telegram?.WebApp) {
      // We're running inside a Telegram Mini App
      console.log("Running in Telegram Mini App");
      const telegramWebApp = window.Telegram.WebApp;
      console.log("WebApp initDataUnsafe:", telegramWebApp.initDataUnsafe);
      
      if (telegramWebApp?.initDataUnsafe?.user) {
        // Use the user data provided by Telegram WebApp
        setIsAutoLoggingIn(true);
        console.log("User data found in Telegram WebApp:", telegramWebApp.initDataUnsafe.user);
        
        const userData = telegramWebApp.initDataUnsafe.user;
        handleTelegramAuth({
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          photo_url: userData.photo_url,
          auth_date: Math.floor(Date.now() / 1000),
        });
      } else {
        console.warn("No user data in Telegram WebApp initDataUnsafe");
      }
    } else {
      // Try auto login from stored auth data
      console.log("Not in Telegram Mini App, trying auto login");
      tryAutoLogin();
    }
  }, [handleTelegramAuth, parseTelegramWebAppDataFromUrl]);

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