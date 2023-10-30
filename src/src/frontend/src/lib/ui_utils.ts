export function humanizeNumber(value: number) {
  const absValue = Math.abs(value);
  let ret = '';
  if (absValue < 1_000) {
    ret = value.toFixed(1);
  } else if (absValue < 1_000_000) {
    ret = `${(value / 1000).toFixed(1)}k`;
  } else if (absValue < 1000000000) {
    ret = `${(value / 1000_000).toFixed(1)}m`;
  } else {
    ret = `${(value / 1000_000_000).toFixed(1)}b`;
  }

  if (ret.endsWith('.0')) {
    ret = ret.slice(0, -2);
  }
  return ret;
}
