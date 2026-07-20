import { useHydrated } from "@/hooks/use-hydrated";

function greetingFor(date: Date): string {
  return date.getHours() < 12 ? "صباح الخير" : "مساء الخير";
}

/** Time-of-day greeting; renders a stable string during SSR then swaps in on hydration. */
export function Greeting() {
  const hydrated = useHydrated();
  const label = hydrated ? greetingFor(new Date()) : "أهلًا بك";
  return (
    <section aria-label="ترحيب" className="pt-4 animate-fade-in">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <h2 className="mt-1 text-xl sm:text-2xl font-black tracking-tight">ماذا تود مشاهدته اليوم؟</h2>
    </section>
  );
}
