export function formatHourSpan(lowMinutes: number, highMinutes: number): string {
  const toHours = (minutes: number) => minutes / 60;
  const low = toHours(lowMinutes);
  const high = toHours(highMinutes);
  if (high < 1) {
    return `${lowMinutes}–${highMinutes} min`;
  }
  const fmt = (hours: number) => {
    const rounded = Math.round(hours * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };
  return `${fmt(low)}–${fmt(high)}`;
}

export function hourUnit(highMinutes: number): string {
  return highMinutes < 60 ? "" : "hrs";
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
