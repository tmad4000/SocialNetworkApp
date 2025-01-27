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

  // Normalize and prepare text for comparison
  const normalizeText = (text: string | null | undefined) => 
    (text || '').toLowerCase().trim();

  const user1Bio = normalizeText(user1.bio);
  const user2Bio = normalizeText(user2.bio);
  const user1Looking = normalizeText(user1.lookingFor);
  const user2Looking = normalizeText(user2.lookingFor);

  if (!user1Bio && !user1Looking && !user2Bio && !user2Looking) {
    return {
      score: 0.1,
      reasons: ["Complete profiles to get better matches"]
    };
  }

  // Check for role/skill matches
  const commonRoleKeywords = [
    'developer', 'engineer', 'programmer', 'software', 'web', 'full stack', 
    'fullstack', 'backend', 'frontend', 'devops', 'architect'
  ];

  // Helper function to check if text contains similar roles
  const hasSimilarRole = (text1: string, text2: string) => {
    return commonRoleKeywords.some(keyword => 
      text1.includes(keyword) && text2.includes(keyword) ||
      (text1.includes('full stack') && text2.includes('software')) ||
      (text1.includes('software') && text2.includes('full stack'))
    );
  };

  // Check bio against lookingFor matches
  if (user1Looking && user2Bio) {
    if (hasSimilarRole(user1Looking, user2Bio)) {
      totalScore += 0.6;
      reasons.push("Matching professional roles");
    } else if (user2Bio.includes(user1Looking)) {
      totalScore += 0.5;
      reasons.push("Direct profile match");
    }
  }

  // Check reverse match
  if (user2Looking && user1Bio) {
    if (hasSimilarRole(user2Looking, user1Bio)) {
      totalScore += 0.4;
      reasons.push("Compatible professional backgrounds");
    } else if (user1Bio.includes(user2Looking)) {
      totalScore += 0.3;
      reasons.push("Mutual interest alignment");
    }
  }

  // If no specific matches but both have profiles
  if (totalScore === 0 && (user1Bio || user1Looking) && (user2Bio || user2Looking)) {
    totalScore = 0.2;
    reasons.push("Both have completed profiles");
  }

  return {
    score: Math.min(1, totalScore),
    reasons: reasons.length > 0 ? reasons : ["Basic profile compatibility"]
  };
}