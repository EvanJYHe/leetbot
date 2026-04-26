export type ReportPeriod = "week" | "month" | "all_time";

export interface PeriodRange {
  period: ReportPeriod;
  label: string;
  start: Date | null;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getPeriodRange(period: ReportPeriod, now = new Date()): PeriodRange {
  if (period === "week") {
    return {
      period,
      label: "Last 7 days",
      start: new Date(now.getTime() - 7 * DAY_MS),
      end: now
    };
  }

  if (period === "month") {
    return {
      period,
      label: "Last 30 days",
      start: new Date(now.getTime() - 30 * DAY_MS),
      end: now
    };
  }

  return {
    period,
    label: "All time",
    start: null,
    end: now
  };
}

export function parseReportPeriod(value: string | null): ReportPeriod {
  if (value === "month" || value === "all_time") {
    return value;
  }

  return "week";
}
