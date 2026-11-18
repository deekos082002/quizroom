/**
 * Scores are derived, never stored: a player's score is the number of their
 * answers whose choiceIndex equals the question's correctIndex.
 */
export interface ScorePlayer {
  playerId: string
  displayName?: string
}
export interface ScoreQuestion {
  id: string
  index: number
  correctIndex: number
}
export interface ScoreAnswer {
  questionId: string
  playerId: string
  choiceIndex: number
}
export interface RankedPlayer {
  playerId: string
  name: string
  score: number
  rank: number
}

/**
 * Rank players (host excluded) by score desc, then name. Only questions with
 * index < `scoredBelow` count, so a still-open question can't leak its answer.
 */
export function rankPlayers(
  players: ScorePlayer[],
  questions: ScoreQuestion[],
  answers: ScoreAnswer[],
  hostId: string,
  scoredBelow = Infinity,
): RankedPlayer[] {
  const correct = new Map<string, number>()
  for (const q of questions) if (q.index < scoredBelow) correct.set(q.id, q.correctIndex)
  const scores = new Map<string, number>()
  for (const a of answers) {
    if (correct.get(a.questionId) === a.choiceIndex) {
      scores.set(a.playerId, (scores.get(a.playerId) ?? 0) + 1)
    }
  }
  const rows = players
    .filter((p) => p.playerId !== hostId)
    .map((p) => ({ playerId: p.playerId, name: p.displayName || 'Player', score: scores.get(p.playerId) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  // Standard competition ranking: ties share a rank.
  return rows.map((r, i) => ({
    ...r,
    rank: i > 0 && rows[i - 1].score === r.score ? 0 : i + 1,
  })).map((r, i, arr) => ({ ...r, rank: r.rank || arr[i - 1].rank }))
}
