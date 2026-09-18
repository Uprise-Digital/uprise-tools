export type PageSpeedDeviceStrategy = "MOBILE" | "DESKTOP" | "BOTH";

export interface PageSpeedAutoAuditSchedule {
  enabled: boolean;
  frequency: "WEEKLY" | "MONTHLY";
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  dayOfMonth: number; // 1 ... 28
  time: string; // "HH:MM" 24h format, e.g. "09:00"
  lastRunAt?: string;
}

export interface PageSpeedSettings {
  scope: "ALL" | "ENABLED_ONLY";
  deviceStrategy: PageSpeedDeviceStrategy;
  autoAudit: PageSpeedAutoAuditSchedule;
}

export const DEFAULT_PAGE_SPEED_SETTINGS: PageSpeedSettings = {
  scope: "ALL",
  deviceStrategy: "MOBILE",
  autoAudit: {
    enabled: false,
    frequency: "WEEKLY",
    dayOfWeek: 1, // Monday
    dayOfMonth: 1, // 1st
    time: "09:00",
  },
};
