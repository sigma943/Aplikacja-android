import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDbDate(dateString: string | null | undefined): Date {
  if (!dateString) return new Date();
  // SQLite CURRENT_TIMESTAMP generates "YYYY-MM-DD HH:MM:SS" (in UTC)
  // To ensure the browser parses it as UTC instead of local time, we must format it as ISO 8601
  if (dateString.length === 19 && dateString.includes(' ')) {
    return new Date(dateString.replace(' ', 'T') + 'Z');
  }
  return new Date(dateString);
}
