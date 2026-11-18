# Build log

## Planning
- Agent (Opus, plan mode) explored the scaffold and wrote PLAN.md.
- I reviewed it: host-only control via 'own' permissions, answer-once via uniqueOn, scores computed (not stored), and generateQuestions checks the caller is the host.
- I removed a leftover instruction line from PLAN.md.
- Tradeoff accepted: correctIndex is readable by players (cheating possible via devtools) — fine for a game among friends, keeps scope small.
- To verify later: AI billing uses the host's credits — test with a second account.

## Step 1 — schemas + create room
- Agent created 4 schemas (quizzes, questions, players, answers), registered them, added /quiz and /quiz/:id pages and a Quiz nav link.
- I checked the schema permissions match PLAN.md (ownerField hostId, uniqueOn for code and for answer-once).
- I tested: created room RKGQAP, refreshed (code persisted), opened the same room as a second account in incognito — both see it.

## Step 2 — join by code + live lobby
- Agent added a Join card, a useJoinQuiz hook, and a lobby with presence dots.
- I told the agent not to edit NOTES.md (I keep this log myself).
- I tested with 2 accounts: player appears live in host's window; dot turns grey when the tab closes and green on return; rejoining doesn't duplicate; wrong code shows "No room found".
- Design note: the host is not listed as a player (host runs the game).