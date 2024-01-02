type Point = {
  coordinates: number[];
  value: number;
};

export type ObjectiveFunction = (params: number[]) => number;

export function nelderMeadOptimization(
  objectiveFunction: ObjectiveFunction,
  initialPoints: number[][],
  tolerance = 1e-6,
  maxIterations = 1000
): Point {
  const alpha = 1;
  const beta = 1;
  const gamma = 1;
  // const alpha = 0.5;
  // const beta = 0.5;
  // const gamma = 0.5;
  // const alpha = 0.3;
  // const beta = 0.3;
  // const gamma = 0.3;

  const simplex: Point[] = initialPoints.map((coordinates) => ({ coordinates, value: objectiveFunction(coordinates) }));

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    simplex.sort((a, b) => a.value - b.value);

    const best = simplex[0];
    const worst = simplex[simplex.length - 1];
    const secondWorst = simplex[simplex.length - 2];
    const centroid = calculateCentroid(simplex.slice(0, -1));

    if (Math.abs(best.value - worst.value) < tolerance) {
      return best;
    }

    const reflected = reflect(objectiveFunction, centroid, worst, alpha);
    if (reflected.value >= best.value && reflected.value < secondWorst.value) {
      simplex[simplex.length - 1] = reflected;
    } else if (reflected.value < best.value) {
      const expanded = reflect(objectiveFunction, centroid, worst, gamma);
      if (expanded.value < reflected.value) {
        simplex[simplex.length - 1] = expanded;
      } else {
        simplex[simplex.length - 1] = reflected;
      }
    } else {
      const contracted = reflect(objectiveFunction, centroid, worst, beta);
      if (contracted.value < worst.value) {
        simplex[simplex.length - 1] = contracted;
      } else {
        shrink(objectiveFunction, simplex, best);
      }
    }
  }

  return simplex[0];
}

function calculateCentroid(points: Point[]): number[] {
  const dimension = points[0].coordinates.length;
  const centroid = new Array(dimension).fill(0);

  for (const point of points) {
    for (let i = 0; i < dimension; i++) {
      centroid[i] += point.coordinates[i];
    }
  }

  for (let i = 0; i < dimension; i++) {
    centroid[i] /= points.length;
  }

  return centroid;
}

function reflect(objectiveFunction: ObjectiveFunction, centroid: number[], point: Point, alpha: number): Point {
  const reflectedCoordinates: number[] = centroid.map((c, i) => c + alpha * (c - point.coordinates[i]));
  const reflectedValue: number = objectiveFunction(reflectedCoordinates);
  return { coordinates: reflectedCoordinates, value: reflectedValue };
}

function shrink(objectiveFunction: ObjectiveFunction, simplex: Point[], best: Point): void {
  for (let i = 1; i < simplex.length; i++) {
    for (let j = 0; j < best.coordinates.length; j++) {
      simplex[i].coordinates[j] = (simplex[i].coordinates[j] + best.coordinates[j]) / 2;
    }
    simplex[i].value = objectiveFunction(simplex[i].coordinates);
  }
}
