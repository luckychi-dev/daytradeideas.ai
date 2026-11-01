const EPSILON = 1e-9;

export function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

export function isAtLeast(value: number, minimum: number): boolean {
  return value + EPSILON >= minimum;
}

export function roundDownToIncrement(value: number, increment: number): number {
  if (!isFinitePositive(value) || !isFinitePositive(increment)) return 0;
  const steps = Math.floor((value + EPSILON) / increment);
  return Number((steps * increment).toPrecision(12));
}

export function roundCalculation(value: number): number {
  return Number(value.toPrecision(12));
}

