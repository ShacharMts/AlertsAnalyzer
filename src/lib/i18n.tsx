"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Locale } from "@/types/alerts";
import en from "@/i18n/en.json";
import he from "@/i18n/he.json";

const translations = { en, he } as const;

type Translations = typeof en;

interface I18nContextType {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextType>({
  locale: "he",
  t: he,
  setLocale: () => {},
  dir: "rtl",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("he");

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === "he" ? "rtl" : "ltr";
  }, []);

  // Set HTML attributes on initial mount
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: I18nContextType = {
    locale,
    t: translations[locale],
    setLocale,
    dir: locale === "he" ? "rtl" : "ltr",
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
