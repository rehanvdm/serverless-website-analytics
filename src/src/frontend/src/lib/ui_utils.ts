export function humanizeNumber(value: number) {
  const absValue = Math.abs(value);
  if (absValue < 1_000) {
    return value;
  }
  if (absValue < 1_000_000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  if (absValue < 1000000000) {
    return `${(value / 1000_000).toFixed(1)}m`;
  }

  return `${(value / 1000_000_000).toFixed(1)}b`;
}
