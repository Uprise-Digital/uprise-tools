/**
 * Timezone-safe date utilities for Australia/Melbourne (AEST/AEDT).
 * Normalizes calculations to UTC to avoid server timezone offset shifting.
 */

export function getMelbourneDateStrings(targetDate?: Date) {
  const formatYMD = (d: Date, tz: string = "Australia/Melbourne") => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(d).trim();
  };

  // Get current date string in Melbourne
  const todayStr = targetDate 
    ? formatYMD(targetDate, "UTC") 
    : formatYMD(new Date(), "Australia/Melbourne");

  const [y, m, d] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));

  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const getFullDateName = (date: Date) => {
    const day = date.toLocaleString("en-US", {
      timeZone: "UTC",
      day: "numeric",
    });
    const month = date.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "long",
    });
    const year = date.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
    });
    const weekday = date.toLocaleString("en-US", {
      timeZone: "UTC",
      weekday: "long",
    });
    return `${weekday} ${day} ${month} ${year}`;
  };

  const getMonthDayName = (date: Date) => {
    const day = date.toLocaleString("en-US", {
      timeZone: "UTC",
      day: "numeric",
    });
    const month = date.toLocaleString("en-US", {
      timeZone: "UTC",
      month: "short",
    });
    const weekday = date.toLocaleString("en-US", {
      timeZone: "UTC",
      weekday: "short",
    });
    return `${weekday} ${day} ${month}`;
  };

  return {
    yesterdayStr: formatYMD(yesterday, "UTC"),
    todayStr: formatYMD(today, "UTC"),
    yesterdayFormatted: getMonthDayName(yesterday),
    todayFormatted: getFullDateName(today),
    yesterdayDate: yesterday,
  };
}

/**
 * Returns today's date string (YYYY-MM-DD) in Melbourne timezone.
 */
export function getMelbourneTodayStr(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date()).trim();
}

/**
 * Parses a YYYY-MM-DD string as a UTC Date object.
 */
export function parseUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Formats a Date object in UTC to YYYY-MM-DD.
 */
export function formatUTCDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
