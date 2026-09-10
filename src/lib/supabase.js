import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://rdrvoyxaxyorekbxsxbc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkcnZveXhheHlvcmVrYnhzeGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5ODA4NzksImV4cCI6MjEwNDU1Njg3OX0.gV0QNpG6VxgEZjuq4h_XT5QHDNsCpZWAsoKPhtD_zw4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const ML_LIMIT = 14;
export const CL_LIMIT = 14;
export const CL_MONTHLY_LIMIT = 2;
export const ADMIN_PASSWORD = "12345";
export const VP_PASSWORD = "67890";

export function getSchoolYear(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 3 ? year : year - 1;
}

export function getSchoolYearLabel(startYear) {
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}

export function schoolYearStart(startYear) {
  return `${startYear}-04-01`;
}

export function schoolYearEnd(startYear) {
  return `${startYear + 1}-03-31`;
}

// ─── Holiday helpers ──────────────────────────────────────────────────────────

/** Fetch holidays for a school year from Supabase. Returns array of date strings 'YYYY-MM-DD'. */
export async function fetchHolidayDates(schoolYear) {
  const { data } = await supabase
    .from("holidays")
    .select("date")
    .eq("school_year", schoolYear);
  return (data || []).map((h) => h.date); // ['2025-10-02', ...]
}

/** Check if a date string is a Sunday */
export function isSunday(dateStr) {
  return new Date(dateStr).getDay() === 0;
}

/** Check if a date string is a Saturday */
export function isSaturday(dateStr) {
  return new Date(dateStr).getDay() === 6;
}

// ─── Sandwich Rule ────────────────────────────────────────────────────────────
/**
 * Detect if a leave range is a "sandwich" leave:
 * Leave ends on Friday (day before) AND starts Monday,
 * OR the range itself spans a Fri→Mon gap (i.e., starts Fri, ends Mon, or straddles a weekend).
 *
 * For our purposes: if fromDate is Friday OR toDate is Monday,
 * the Sat/Sun in between count as leave days.
 *
 * We check: does the range contain any Saturday/Sunday that falls
 * between a Friday leave day and a Monday leave day?
 */
export function hasSandwich(fromDateStr, toDateStr) {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);

  // Walk each day; if we see a Friday followed eventually by Monday with only
  // Sat/Sun in between within the range, it's a sandwich.
  let d = new Date(from);
  while (d <= to) {
    const day = d.getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
    if (day === 5) {
      // Friday found in range — if Monday is also in range (2 days later)
      const nextMon = new Date(d);
      nextMon.setDate(nextMon.getDate() + 3);
      if (nextMon <= to) return true;
    }
    d.setDate(d.getDate() + 1);
  }
  return false;
}

// ─── Core day counter ─────────────────────────────────────────────────────────
/**
 * Count leave days between fromDate and toDate (inclusive).
 *
 * Rules:
 * 1. Sundays are ALWAYS excluded — unless sandwich rule applies for that Sun.
 * 2. Holidays are excluded — UNLESS they fall inside a sandwich weekend gap.
 * 3. Sandwich: if the range contains Fri→(Sat/Sun)→Mon, those Sat/Sun count.
 *
 * @param {string} fromDateStr  'YYYY-MM-DD'
 * @param {string} toDateStr    'YYYY-MM-DD'
 * @param {string[]} holidayDates  array of 'YYYY-MM-DD' holiday dates
 * @returns {number} number of counted leave days
 */
export function countLeaveDays(fromDateStr, toDateStr, holidayDates = []) {
  const holidaySet = new Set(holidayDates);
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);

  // Build set of "sandwich weekend dates" within the range:
  // Any Saturday or Sunday that sits between a Friday and Monday in the range.
  const sandwichDates = new Set();
  let d = new Date(from);
  while (d <= to) {
    if (d.getDay() === 5) {
      // Friday
      const sat = new Date(d);
      sat.setDate(sat.getDate() + 1);
      const sun = new Date(d);
      sun.setDate(sun.getDate() + 2);
      const mon = new Date(d);
      mon.setDate(mon.getDate() + 3);
      // Only if that Monday is also within the range
      if (mon <= to) {
        sandwichDates.add(sat.toISOString().split("T")[0]);
        sandwichDates.add(sun.toISOString().split("T")[0]);
      }
    }
    d.setDate(d.getDate() + 1);
  }

  let count = 0;
  d = new Date(from);
  while (d <= to) {
    const dateStr = d.toISOString().split("T")[0];
    const isSun = d.getDay() === 0;
    const isHoliday = holidaySet.has(dateStr);
    const isSandwichDay = sandwichDates.has(dateStr);

    if (isSandwichDay) {
      // Sandwich overrides everything — always count
      count++;
    } else if (isSun) {
      // Sunday — skip (not a sandwich Sunday)
    } else if (isHoliday) {
      // Holiday — skip (not a sandwich holiday)
    } else {
      count++;
    }

    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, count);
}

export const TEACHERS = [
  { name: "Afreen Sultana", phone: "9382281994", pin: "7415" },
  { name: "Anirban Dutta", phone: "9932635565", pin: "0495" },
  { name: "Gulfishan Nikhat", phone: "9883040767", pin: "2467" },
  { name: "Rajani Sharma", phone: "9971027099", pin: "0098" },
  { name: "Kainat Hossain", phone: "7596905870", pin: "3094" },
  { name: "Megha Barui", phone: "8017054621", pin: "2758" },
  { name: "Mohamed Lukhman A", phone: "9605611076", pin: "5047" },
  { name: "Mohd Ashique Raza", phone: "7070312177", pin: "5819" },
  { name: "Mohd Fasihul Qamar", phone: "7504752690", pin: "7283" },
  { name: "Muhammed Arif P A", phone: "9995389526", pin: "8361" },
  { name: "Munazza Tabrez", phone: "9123323282", pin: "6381" },
  { name: "Nayab khan", phone: "6290400755", pin: "9153" },
  { name: "Nafeesa Hossain", phone: "0000000000", pin: "2931" },
  { name: "Nilakshi Khatoon", phone: "8777218646", pin: "5247" },
  { name: "Sabiha Yasmin", phone: "8013504747", pin: "9032" },
  { name: "Saima Bux Siddiqui", phone: "8337083439", pin: "4720" },
  { name: "Samprikta Chakraborty", phone: "9875637877", pin: "1678" },
  { name: "Shavian Affrin", phone: "9057267373", pin: "4775" },
];