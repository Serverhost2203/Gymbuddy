import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function bmiCategory(bmi: number | null | undefined): string {
  if (!bmi) return "";
  if (bmi < 18.5) return "bmi.underweight";
  if (bmi < 25) return "bmi.normal";
  if (bmi < 30) return "bmi.overweight";
  return "bmi.obese";
}

export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export function shortDate(iso: string): string {
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return iso;
  }
}

export function daysAgo(iso: string): number {
  try {
    return differenceInCalendarDays(new Date(), parseISO(iso));
  } catch {
    return 0;
  }
}

export function mondayOf(d = new Date()): string {
  const day = d.getDay(); // 0 sun .. 6 sat
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return format(m, "yyyy-MM-dd");
}

export const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function clampNum(v: string): number {
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? 0 : n;
}
