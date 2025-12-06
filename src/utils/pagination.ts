export const parsePositiveInt = (value: any, fallback: number, max: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};
