/**
 * Minimal i18n scaffold.
 *
 * RTL is the primary experience; the app ships with an Arabic dictionary
 * and a stable API for adding runtime language switching later. Consumers
 * call `t("path.to.key")` — falling back to the key itself when a string
 * is missing so nothing crashes during a partial translation.
 */

export type Locale = "ar" | "en";

const DICT: Record<Locale, Record<string, string>> = {
  ar: {
    "hero.play": "تشغيل الآن",
    "hero.add": "أضف إلى قائمتي",
    "hero.info": "تفاصيل",
    "nav.home": "الرئيسية",
    "nav.search": "البحث",
    "nav.list": "قائمتي",
    "nav.more": "المزيد",
    "row.viewAll": "عرض الكل",
  },
  en: {
    "hero.play": "Play now",
    "hero.add": "Add to my list",
    "hero.info": "Details",
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.list": "My list",
    "nav.more": "More",
    "row.viewAll": "View all",
  },
};

let current: Locale = "ar";

export function setLocale(l: Locale) {
  current = l;
  if (typeof document !== "undefined") {
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }
}

export function t(key: string): string {
  return DICT[current]?.[key] ?? key;
}
