"use client";

import { createContext, ReactNode } from "react";

interface ShowRouteContextType {
  showRoute: boolean;
}

export const ShowRouteContext = createContext<ShowRouteContextType | null>(null);

interface ShowRouteProviderProps {
  children: ReactNode;
  showRoute: boolean;
}

export function ShowRouteProvider({ children, showRoute }: ShowRouteProviderProps) {
  return (
    <ShowRouteContext.Provider value={{ showRoute }}>
      {children}
    </ShowRouteContext.Provider>
  );
} 