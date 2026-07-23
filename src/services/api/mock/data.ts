/** Static placeholder data. Swap this file for real fetchers when the backend is live. */
import type { Hero, Notification, Poster } from "../types";

export const heroes: Hero[] = [
  {
    id: "h-1",
    title: "أسطورة الأسد",
    subtitle: "رحلة ملحمية عبر ممالك منسية — حصريًا على Nova TV.",
    badge: "مميز اليوم",
    gradient: "from-fuchsia-900 via-neutral-900 to-black",
    imdb: 8.9,
    genres: ["ملحمي", "مغامرة", "درامي"],
    year: "2026",
    ageRating: "+13",
  },
  {
    id: "h-2",
    title: "ليالي الصحراء",
    subtitle: "قصة حب وخيانة تحت سماء الصحراء الذهبية.",
    badge: "جديد كليًا",
    gradient: "from-amber-800 via-red-950 to-black",
    imdb: 8.1,
    genres: ["رومانسي", "درامي"],
    year: "2026",
    ageRating: "+16",
  },
  {
    id: "h-3",
    title: "ظلال المدينة",
    subtitle: "جريمة غامضة تهز أعتى شوارع العاصمة.",
    badge: "الأكثر مشاهدة",
    gradient: "from-cyan-900 via-slate-900 to-black",
    imdb: 8.5,
    genres: ["جريمة", "غموض", "إثارة"],
    year: "2025",
    ageRating: "+18",
  },
  {
    id: "h-4",
    title: "قسمة ونصيب",
    subtitle: "دراما عائلية تُلامس قلوب الملايين.",
    badge: "حصري",
    gradient: "from-rose-800 via-purple-950 to-black",
    imdb: 8.8,
    genres: ["عائلي", "درامي"],
    year: "2026",
    ageRating: "+7",
  },
];

export const continueWatching: Poster[] = [
  { id: "cw-1", title: "قسمة ونصيب — ح٩", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900", tag: "عائلي", duration: "٤٢ د متبقية", progress: 0.62, ageRating: "+7" },
  { id: "cw-2", title: "The East Palace — ح٤", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black", tag: "تاريخي", duration: "١٨ د متبقية", progress: 0.83, ageRating: "+13" },
  { id: "cw-3", title: "Silent Verdict — ح٢", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black", tag: "جريمة", duration: "٣٠ د متبقية", progress: 0.35, ageRating: "+16" },
  { id: "cw-4", title: "Silver Coast", year: "2025", gradient: "from-amber-500 via-orange-800 to-neutral-900", tag: "مغامرة", duration: "٥٥ د متبقية", progress: 0.48, ageRating: "+13" },
];

export const newMovies: Poster[] = [
  { id: "m-1", title: "They Fight", year: "2026", gradient: "from-slate-800 via-red-900 to-black", tag: "أكشن", rating: 8.4, quality: "4K", duration: "١ س ٥٨ د", description: "معركة أخيرة بين فارسين في عالم مُنهار.", badges: ["NEW", "DOLBY_ATMOS"], ageRating: "+16", rank: 1 },
  { id: "m-2", title: "The Bay", year: "2026", gradient: "from-sky-700 via-blue-900 to-slate-950", tag: "غموض", rating: 7.9, quality: "HD", duration: "٢ س ١٢ د", description: "أسرار الخليج تعود إلى السطح بعد عقود.", badges: ["NEW"], ageRating: "+13", rank: 2 },
  { id: "m-3", title: "Stop! That! Train!", year: "2026", gradient: "from-pink-500 via-fuchsia-700 to-indigo-900", tag: "كوميدي", rating: 7.1, quality: "HD", duration: "١ س ٤٠ د", description: "مطاردة جنونية على متن قطار عبر القارات.", ageRating: "+7", rank: 3 },
  { id: "m-4", title: "Kill Trip", year: "2026", gradient: "from-red-700 via-red-950 to-black", tag: "إثارة", rating: 8.0, quality: "4K", duration: "٢ س ٠٥ د", description: "رحلة عطلة تتحول إلى كابوس دموي.", badges: ["HDR", "DOLBY_VISION"], ageRating: "+18", rank: 4 },
  { id: "m-5", title: "Night Runner", year: "2026", gradient: "from-emerald-700 via-slate-900 to-black", tag: "درامي", rating: 7.6, quality: "HD", duration: "١ س ٥٠ د", description: "عدّاء ليلي يهرب من ماضيه في شوارع المدينة.", ageRating: "+13", rank: 5 },
  { id: "m-6", title: "Silver Coast", year: "2025", gradient: "from-amber-500 via-orange-800 to-neutral-900", tag: "مغامرة", rating: 8.2, quality: "4K", duration: "٢ س ١٨ د", description: "بحث عن كنز مفقود على ساحل مسحور.", badges: ["DOLBY_ATMOS"], ageRating: "+13", rank: 6 },
  { id: "m-7", title: "Iron Vow", year: "2025", gradient: "from-zinc-700 via-neutral-900 to-black", tag: "حربي", rating: 8.7, quality: "4K", duration: "٢ س ٣٠ د", description: "قسم لا يُنقض في زمن الحرب الكبرى.", badges: ["HDR"], ageRating: "+16" },
];

export const newSeries: Poster[] = [
  { id: "s-1", title: "قسمة ونصيب", year: "2026", gradient: "from-amber-600 via-rose-800 to-neutral-900", tag: "عائلي", rating: 8.8, quality: "4K", duration: "٢٤ حلقة", description: "دراما عائلية تعبر أجيالًا وحدود.", badges: ["NEW", "DOLBY_VISION"], ageRating: "+7", rank: 1 },
  { id: "s-2", title: "The Map of Longing", year: "2026", gradient: "from-violet-500 via-purple-800 to-indigo-950", tag: "رومانسي", rating: 8.1, quality: "HD", duration: "١٦ حلقة", description: "خارطة قديمة تقود عاشقين نحو مصيرهما.", badges: ["NEW"], ageRating: "+13", rank: 2 },
  { id: "s-3", title: "The East Palace", year: "2026", gradient: "from-emerald-800 via-teal-900 to-black", tag: "تاريخي", rating: 9.0, quality: "4K", duration: "٣٢ حلقة", description: "مؤامرات القصر الشرقي في عصر الإمبراطورية.", badges: ["HDR", "DOLBY_ATMOS"], ageRating: "+13", rank: 3 },
  { id: "s-4", title: "Tomb Raider King", year: "2026", gradient: "from-yellow-500 via-orange-700 to-slate-900", tag: "أنمي", rating: 8.5, quality: "HD", duration: "١٢ حلقة", description: "صياد كنوز يواجه أرواح المقابر القديمة.", ageRating: "+13", rank: 4 },
  { id: "s-5", title: "Silent Verdict", year: "2026", gradient: "from-cyan-700 via-blue-900 to-black", tag: "جريمة", rating: 8.3, quality: "4K", duration: "١٠ حلقات", description: "محاكمة صامتة تكشف أسرار مدينة كاملة.", badges: ["DOLBY_VISION"], ageRating: "+16", rank: 5 },
  { id: "s-6", title: "قلوب متصلة", year: "2025", gradient: "from-rose-500 via-pink-800 to-neutral-900", tag: "درامي", rating: 7.9, quality: "HD", duration: "٢٠ حلقة", description: "قلوب تجمعها الصدفة وتفرقها الأقدار.", ageRating: "+13" },
  { id: "s-7", title: "ظلال المدينة", year: "2025", gradient: "from-indigo-700 via-slate-900 to-black", tag: "غموض", rating: 8.4, quality: "4K", duration: "١٨ حلقة", description: "ظلال تتحرك في شوارع لا تنام.", badges: ["HDR"], ageRating: "+16" },
];

export const trendingSearches = [
  "أسطورة الأسد",
  "The East Palace",
  "قسمة ونصيب",
  "Kill Trip",
  "Silent Verdict",
];

export const notifications: Notification[] = [
  { id: 1, title: "حلقة جديدة", body: "الحلقة ١٢ من «قسمة ونصيب» متاحة الآن.", unread: true, time: "قبل ٥ د" },
  { id: 2, title: "توصية لك", body: "قد يعجبك «The East Palace».", unread: true, time: "قبل ساعة" },
  { id: 3, title: "قائمتي", body: "«Kill Trip» متاح للمشاهدة.", unread: false, time: "أمس" },
];
