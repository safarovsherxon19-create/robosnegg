/** Position along the moving snake, not the board cell where the bite happened. */
export function digestionPulse(age: number, length: number) {
  const position = Math.max(0, age) * 2.5;
  const tail = length - 1;
  if (age < 0 || tail < 1 || position > tail + 0.6) return null;
  const fade = Math.min(1, Math.max(0, (tail + 0.6 - position) / 1.2));
  return { position: Math.min(position, tail), swelling: 0.23 * fade };
}