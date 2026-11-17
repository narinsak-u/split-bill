const MAX_SATANG = 999_999_999_999n;

export function parseSatang(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const satang = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  return satang <= MAX_SATANG ? Number(satang) : null;
}

export function formatMoney(value: string): string {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid money amount.");

  const whole = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${match[1]}${whole}.${match[3]}`;
}

export function formatSatang(satang: number): string {
  if (!Number.isSafeInteger(satang)) throw new RangeError("Satang must be a safe integer");

  const amount = BigInt(satang);
  const digits = (amount < 0n ? -amount : amount).toString().padStart(3, "0");
  const whole = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0n ? "-" : ""}${whole}.${digits.slice(-2)}`;
}
