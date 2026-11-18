/**
 * Live leaderboard shown during play. Scores only count questions the host has
 * already moved past, so the current question's answer is never revealed; the
 * check mark shows who has answered the current question.
 */
import type { RankedPlayer } from '@/lib/scoring'

interface Props {
  ranking: RankedPlayer[]
  answeredIds: Set<string>
  meId?: string
}

export function Leaderboard({ ranking, answeredIds, meId }: Props) {
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Leaderboard</h2>
      {ranking.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No players yet.</p>
      ) : (
        <ol className="mt-3 space-y-1.5" data-testid="leaderboard">
          {ranking.map((p) => (
            <li key={p.playerId} className="flex items-center gap-3 text-sm">
              <span className="w-6 text-muted-foreground">{p.rank}</span>
              <span className="flex-1">
                {p.name}
                {p.playerId === meId ? ' (you)' : ''}
              </span>
              {answeredIds.has(p.playerId) && (
                <span aria-label="answered" className="text-green-500">✓</span>
              )}
              <span className="font-mono">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
