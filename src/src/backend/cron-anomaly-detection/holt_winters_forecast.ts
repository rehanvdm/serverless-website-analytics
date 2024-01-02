type HoltWintersResult = {
  level: number[];
  trend: number[];
  seasonality: number[];
  forecast: number[];
};

/**
 * Holt-Winters smoothing method for time series forecasting.
 *
 * @param {number[]} data - The input time series data.
 * @param {number} alpha - The smoothing parameter for level.
 * @param {number} beta - The smoothing parameter for trend.
 * @param {number} gamma - The smoothing parameter for seasonality.
 * @param {number} seasonLength - The length of the seasonality period.
 * @param {number} forecastLength - The length of the forecast period.
 *
 * @return {HoltWintersResult} The result of Holt-Winters smoothing, containing the levels, trends, seasonality, and forecast.
 */
export function holtWintersForecast(
  data: number[],
  alpha: number,
  beta: number,
  gamma: number,
  seasonLength: number,
  forecastLength: number
): HoltWintersResult {
  const level: number[] = [data[0]];
  const trend: number[] = [data[1] - data[0]]; // Initialize with the initial trend value
  const seasonality: number[] = Array.from({ length: seasonLength }, (_, i) => data[i % seasonLength] - level[0]);
  const forecast: number[] = [];

  // Initialize level, trend, and seasonality
  for (let i = 1; i < data.length; i++) {
    level[i] = alpha * (data[i] - seasonality[i % seasonLength]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
    trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
    seasonality[i % seasonLength] =
      gamma * (data[i] - level[i - 1] - trend[i - 1]) + (1 - gamma) * seasonality[i % seasonLength];
  }

  // Generate forecast (scaled back to the original scale)
  for (let i = 0; i < forecastLength; i++) {
    const nextIndex = data.length + i;
    const scaledForecast = level[data.length - 1] + i * trend[data.length - 1] + seasonality[nextIndex % seasonLength];
    forecast.push(scaledForecast);
  }

  return { level, trend, seasonality, forecast };
}
