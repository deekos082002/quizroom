/**
 * Final results: ranking with the top 3 highlighted, then every question with
 * the correct answer and what the viewer picked.
 */
import type { RankedPlayer } from '@/lib/scoring'

export interface ResultQuestion {
  id: string
  index: number
  prompt: string
  choices: string[]
  correctIndex: number
}

interface Props {
  ranking: RankedPlayer[]
  questions: ResultQuestion[]
  /** questionId -> choice the viewer picked (absent = no answer). */
  myPicks: Map<string, number>
  meId?: string
  showMine: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM = [
  'border-yellow-500/60 bg-yellow-500/10',
  'border-slate-400/60 bg-slate-400/10',
  'border-amber-700/60 bg-amber-700/10',
]

export function Results({ ranking, questions, myPicks, meId, showMine }: Props) {
  return (
    <>
      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Final results</h2>
        {ranking.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No players took part.</p>
        ) : (
          <ol className="mt-3 space-y-2" data-testid="results-ranking">
            {ranking.map((p) => {
              const top = p.rank <= 3
              return (
                <li
                  key={p.playerId}
                  data-testid={top ? 'results-top' : undefined}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                    top ? `${PODIUM[p.rank - 1]} font-semibold` : 'border-transparent'
                  }`}
                >
                  <span className="w-8">{top ? MEDALS[p.rank - 1] : p.rank}</span>
                  <span className="flex-1">
                    {p.name}
                    {p.playerId === meId ? ' (you)' : ''}
                  </span>
                  <span className="font-mono">
                    {p.score}/{questions.length}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
      <section className="mt-6 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Answers</h2>
        <ol className="mt-4 space-y-5 text-sm" data-testid="results-questions">
          {questions.map((q) => {
            const mine = myPicks.get(q.id)
            return (
              <li key={q.id}>
                <p className="font-medium">
                  {q.index + 1}. {q.prompt}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {q.choices.map((c, i) => {
                    const isCorrect = i === q.correctIndex
                    const isMine = mine === i
                    return (
                      <li
                        key={i}
                        className={isCorrect ? 'font-medium text-green-600' : isMine ? 'text-red-500' : 'text-muted-foreground'}
                      >
                        {String.fromCharCode(65 + i)}. {c}
                        {isCorrect && ' ✓ correct'}
                        {showMine && isMine && ' ← your pick'}
                      </li>
                    )
                  })}
                </ul>
                {showMine && mine === undefined && (
                  <p className="mt-1 text-muted-foreground">You didn't answer this one.</p>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}
