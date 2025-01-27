export function cosineSim(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

export function calculateBasicMatchScore(
  user1: { bio?: string | null; lookingFor?: string | null },
  user2: { bio?: string | null; lookingFor?: string | null }
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;

  if (!user1.bio && !user1.lookingFor && !user2.bio && !user2.lookingFor) {
    return {
      score: 0.1,
      reasons: ["Complete profiles to get better matches"]
    };
  }

  if (user1.lookingFor && user2.bio) {
    totalScore += 0.5;
    reasons.push("Profiles contain matching keywords");
  }

  if (user2.lookingFor && user1.bio) {
    totalScore += 0.3;
    reasons.push("Mutual interest alignment");
  }

  return {
    score: Math.min(1, totalScore),
    reasons: reasons.length > 0 ? reasons : ["Basic profile compatibility"]
  };
}
