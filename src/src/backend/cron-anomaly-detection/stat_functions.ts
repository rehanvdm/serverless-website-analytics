export function calculateStandardDeviation(data: number[]): number {
  const n = data.length;
  if (n === 0) throw new Error('Input array is empty');

  const mean = data.reduce((sum, value) => sum + value, 0) / n;
  const sumSquaredDifferences = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0);
  return Math.sqrt(sumSquaredDifferences / n);
}

export function calculateMSE(actualValues: number[], predictedValues: number[]): number {
  if (actualValues.length !== predictedValues.length) {
    throw new Error('Input arrays must have the same length');
  }

  const n = actualValues.length;
  let sumSquaredDifferences = 0;

  for (let i = 0; i < n; i++) {
    const squaredDifference = Math.pow(actualValues[i] - predictedValues[i], 2);
    sumSquaredDifferences += squaredDifference;
  }

  return sumSquaredDifferences / n;
}
