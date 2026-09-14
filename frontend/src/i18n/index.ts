// Forge Fitness i18n — DE / EN / ES / FR / IT.
// Device language auto-detected; user override persisted in storage.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getLocales } from "expo-localization";

import { storage } from "@/src/utils/storage";
import { en } from "./locales/en";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { fr } from "./locales/fr";
import { it } from "./locales/it";

export const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
];

const LANG_KEY = "forge.language";

const resources = {
  en: { translation: en },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
};

function detectLanguage(): string {
  try {
    const locales = getLocales();
    const code = locales?.[0]?.languageCode;
    if (code && ["en", "de", "es", "fr", "it"].includes(code)) return code;
  } catch {}
  return "en";
}

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export async function initLanguage() {
  const saved = await storage.getItem<string>(LANG_KEY, "");
  const lng = saved || detectLanguage();
  await i18n.changeLanguage(lng);
  return lng;
}

export async function setLanguage(code: string) {
  await storage.setItem(LANG_KEY, code);
  await i18n.changeLanguage(code);
}

export default i18n;
