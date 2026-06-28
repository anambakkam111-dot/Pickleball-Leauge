export function validateScore(s1: number, s2: number): string | null {
  if (!Number.isInteger(s1) || !Number.isInteger(s2)) return 'Scores must be whole numbers';
  if (s1 < 0 || s2 < 0) return 'Scores cannot be negative';
  if (s1 === s2) return 'Scores cannot be tied — someone must win';
  const winner = Math.max(s1, s2);
  const loser = Math.min(s1, s2);
  if (winner < 11) return 'Winning score must be at least 11';
  if (winner === 11 && loser > 9) return 'Must win by 2 — at 11 the loser can have at most 9';
  if (winner > 11 && winner - loser !== 2) return 'Above 11 the winner must lead by exactly 2 (e.g. 12–10, 13–11)';
  return null;
}
