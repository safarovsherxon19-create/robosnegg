export const BANNER_HOOKS = [
  "Can I fill every last cell?",
  "One board. No room for mistakes.",
  "The final half is the hardest.",
  "Every bite brings me closer.",
  "Watch the last empty cell.",
  "Half full. All the way to perfect.",
  "One more bite. One less space.",
  "My most satisfying finish?",
];

export function bannerStage(length: number, total: number) {
  const progress = length / total;
  if (progress >= 1) return "EVERY CELL FILLED";
  if (progress >= 0.95) return "THE LAST FEW BITES";
  if (progress >= 0.8) return "RUNNING OUT OF ROOM";
  if (progress >= 0.65) return "GETTING CLOSER";
  return "HALFWAY TO PERFECT";
}