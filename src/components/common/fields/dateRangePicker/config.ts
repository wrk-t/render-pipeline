import type { DateObject } from "react-multi-date-picker";

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export type TTimeUnit =
  | "seconds"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months";

export type TDateRange = { from: number; to: number };

export type TDatePickerValue =
  | AbsoluteDateValue
  | QuickSelectValue
  | CustomQuickValue;

// ─── Base class ──────────────────────────────────────────────────

export abstract class DatePickerValueBase {
  abstract readonly label: string;
  abstract resolve(): TDateRange;
}

// ─── AbsoluteDateValue — fixed calendar range ────────────────────

export class AbsoluteDateValue extends DatePickerValueBase {
  constructor(
    public fromDate: DateObject,
    public toDate: DateObject,
    public fromTime: string,
    public toTime: string,
  ) {
    super();
  }

  get formattedFrom() {
    return this.fromDate.format("YYYY-MM-DD");
  }

  get formattedTo() {
    return this.toDate.format("YYYY-MM-DD");
  }

  private formatJalali(date: DateObject): string {
    return date.format("YYYY/MM/DD");
  }

  get label(): string {
    if (this.isSameDay()) return this.formattedFrom;
    return `${this.formattedFrom} - ${this.formattedTo}`;
  }

  /** Returns locale-aware label (Jalali for fa, Gregorian for en). */
  getLabel(isJalali: boolean): string {
    if (isJalali) {
      if (this.isSameDay()) return this.formatJalali(this.fromDate);
      return `${this.formatJalali(this.fromDate)} - ${this.formatJalali(this.toDate)}`;
    }
    return this.label;
  }

  resolve(): TDateRange {
    const [fromH, fromM] = this.fromTime.split(":").map(Number);
    const [toH, toM] = this.toTime.split(":").map(Number);
    const from = this.fromDate.toDate();
    from.setHours(fromH, fromM, 0, 0);
    const to = this.toDate.toDate();
    to.setHours(toH, toM, 0, 0);
    return { from: from.getTime(), to: to.getTime() };
  }

  withFromTime(time: string): AbsoluteDateValue {
    return new AbsoluteDateValue(this.fromDate, this.toDate, time, this.toTime);
  }

  withToTime(time: string): AbsoluteDateValue {
    return new AbsoluteDateValue(this.fromDate, this.toDate, this.fromTime, time);
  }

  isSameDay() {
    return this.formattedFrom === this.formattedTo;
  }
}

// ─── QuickSelectValue (abstract) ─────────────────────────────────

export abstract class QuickSelectValue extends DatePickerValueBase {
  abstract readonly id: string;
  abstract resolve(): TDateRange;

  get label(): string {
    return this.id;
  }
}

// ─── Concrete QuickSelect types ──────────────────────────────────

export class DefaultQuickSelect extends QuickSelectValue {
  readonly id = "default";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.hours.ms * 6, to: Date.now() };
  }
}

export class Past1Hour extends QuickSelectValue {
  readonly id = "past1Hour";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.hours.ms, to: Date.now() };
  }
}

export class Past24Hours extends QuickSelectValue {
  readonly id = "past24Hours";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.hours.ms * 24, to: Date.now() };
  }
}

export class Past30Minutes extends QuickSelectValue {
  readonly id = "past30Minutes";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.minutes.ms * 30, to: Date.now() };
  }
}

export class Past3Days extends QuickSelectValue {
  readonly id = "past3Days";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.days.ms * 3, to: Date.now() };
  }
}

export class Past7Days extends QuickSelectValue {
  readonly id = "past7Days";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.days.ms * 7, to: Date.now() };
  }
}

export class Past30Days extends QuickSelectValue {
  readonly id = "past30Days";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.days.ms * 30, to: Date.now() };
  }
}

export class Past60Days extends QuickSelectValue {
  readonly id = "past60Days";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.days.ms * 60, to: Date.now() };
  }
}

export class Past90Days extends QuickSelectValue {
  readonly id = "past90Days";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.days.ms * 90, to: Date.now() };
  }
}

export class Past1Year extends QuickSelectValue {
  readonly id = "past1Year";
  resolve(): TDateRange {
    return { from: Date.now() - DateTimeParts.months.ms * 12, to: Date.now() };
  }
}

export class Today extends QuickSelectValue {
  readonly id = "today";
  resolve(): TDateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { from: start.getTime(), to: Date.now() };
  }
}

export class Yesterday extends QuickSelectValue {
  readonly id = "yesterday";
  resolve(): TDateRange {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { from: start.getTime(), to: end.getTime() };
  }
}

// ─── CustomQuickValue — N units ago ──────────────────────────────

export class CustomQuickValue extends DatePickerValueBase {
  constructor(
    public number: number = 15,
    public unit: TTimeUnit = "minutes",
  ) {
    super();
  }

  get label(): string {
    return this.number.toString();
  }

  resolve(): TDateRange {
    return {
      from: Date.now() - DateTimeParts[this.unit].ms * this.number,
      to: Date.now(),
    };
  }

  withNumber(n: number): CustomQuickValue {
    return new CustomQuickValue(n, this.unit);
  }

  withUnit(u: TTimeUnit): CustomQuickValue {
    return new CustomQuickValue(this.number, u);
  }
}

// ─── Auto-refresh ────────────────────────────────────────────────

export type TAutoRefreshItem = {
  id: string;
  label: string;
  intervalMs: number;
};

// ─── Config ──────────────────────────────────────────────────────

export type TDatePickerConfig = {
  quickSelects: QuickSelectValue[];
  autoRefreshItems: TAutoRefreshItem[];
  hideQuickSelectsTab: boolean;
  hideDateRangeTab: boolean;
  hideFavoriteTimeButton: boolean;
  hideAutoRefresh: boolean;
  defaultActiveTab: "calendar" | "quickSelect";
};

// ─── Constants ───────────────────────────────────────────────────

export const DEFAULT_QUICK_SELECTS = [
  new DefaultQuickSelect(),
  new Past1Hour(),
  new Past24Hours(),
  new Past30Minutes(),
  new Past3Days(),
  new Past7Days(),
  new Past30Days(),
  new Past60Days(),
  new Past90Days(),
  new Past1Year(),
  new Today(),
  new Yesterday(),
] as const;

export const DateTimeParts: Record<
  TTimeUnit,
  { label: string; ms: number; max: number }
> = {
  seconds: { label: "seconds", ms: 1000, max: 99 },
  minutes: { label: "minutes", ms: 60_000, max: 99 },
  hours: { label: "hours", ms: 3_600_000, max: 99 },
  days: { label: "days", ms: 86_400_000, max: 99 },
  weeks: { label: "weeks", ms: 604_800_000, max: 99 },
  months: { label: "months", ms: 2_629_743_000, max: 99 },
};

export const ExactTimes = [
  "00:00", "00:30", "01:00", "01:30", "02:00", "02:30",
  "03:00", "03:30", "04:00", "04:30", "05:00", "05:30",
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
  "23:59",
] as const;

export const defaultAutoRefreshItems: TAutoRefreshItem[] = [
  { id: "every5Minutes", label: "every5Minutes", intervalMs: DateTimeParts.minutes.ms * 5 },
  { id: "every15Minutes", label: "every15Minutes", intervalMs: DateTimeParts.minutes.ms * 15 },
  { id: "every30Minutes", label: "every30Minutes", intervalMs: DateTimeParts.minutes.ms * 30 },
  { id: "every60Minutes", label: "every60Minutes", intervalMs: DateTimeParts.minutes.ms * 60 },
];

export const defaultDatePickerConfig: TDatePickerConfig = {
  quickSelects: [...DEFAULT_QUICK_SELECTS],
  autoRefreshItems: defaultAutoRefreshItems,
  hideQuickSelectsTab: false,
  hideDateRangeTab: false,
  hideFavoriteTimeButton: false,
  hideAutoRefresh: true,
  defaultActiveTab: "quickSelect",
};
