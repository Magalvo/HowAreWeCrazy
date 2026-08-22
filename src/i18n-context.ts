import { createContext, useContext } from "react";
import { createI18n } from "./i18n";

export type I18n = ReturnType<typeof createI18n>;

export const I18nContext = createContext<I18n>(createI18n("en"));

export function useI18n() {
  return useContext(I18nContext);
}
