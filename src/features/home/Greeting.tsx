import { useHydrated } from "@/hooks/use-hydrated";

function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "ليلة هادئة";
  if (h < 12) return "صباح الخير";
  if (h < 17) return "مساء النور";
  return "مساء الخير";
}

/** Time-of-day greeting with gradient headline. */
export function Greeting() {
  const hydrated = useHydrated();
  const label = hydrated ? greetingFor(new Date()) : "أهلًا بك";
  return (
    <section aria-label="ترحيب" className="pt-6 motion-safe:animate-fade-up">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-lime shadow-[0_0_12px_color-mix(in_oklab,var(--lime)_80%,transparent)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lime/90">{label}</p>
      </div>
      <h2 className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
        ماذا <span className="text-gradient-brand">تود مشاهدته</span> اليوم؟
      </h2>
    </section>
  );
}
