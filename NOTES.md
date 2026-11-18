# Build log

## Planning
- Agent (Opus, plan mode) explored the scaffold and wrote PLAN.md.
- I reviewed it: host-only control via 'own' permissions, answer once via uniqueOn, scores computed (not stored), and generateQuestions checks the caller is the host.
- I removed a leftover instruction line from PLAN.md.
- Tradeoff accepted: correctIndex is readable by players (cheating possible via devtools) — fine for a game among friends, keeps scope small.
- To verify later: AI billing uses the host's credits — test with a second account.

## Step 1 - schemas + create room
- Agent created 4 schemas (quizzes, questions, players, answers), registered them, added /quiz and /quiz/:id pages and a Quiz nav link.
- I checked the schema permissions match PLAN.md (ownerField hostId, uniqueOn for code and for answer-once).
- I tested: created room RKGQAP, refreshed (code persisted), opened the same room as a second account in incognito — both see it.

## Step 2 - join by code + live lobby
- Agent added a Join card, a useJoinQuiz hook, and a lobby with presence dots.
- I told the agent not to edit NOTES.md (I keep this log myself).
- I tested with 2 accounts: player appears live in host's window; dot turns grey when the tab closes and green on return; rejoining doesn't duplicate; wrong code shows "No room found".
- Design note: the host is not listed as a player (host runs the game).

## Step 3 - notes upload + AI question generation
- Agent built a host-only upload and a generateQuestions server action (host check uses the verified login, not request data).
- I asked it to skip a throwaway PDF probe and to hide questions from players before the game (no spoilers).
- Bug I diagnosed: "Failed to fetch". Network tab showed requests going to localhost:8795 instead of the app on :5173; server log showed nothing arrived. Agent had used getApiUrl() (platform API) instead of a relative URL. Fixed.
- Bug found by testing as a non-owner account: members couldn't create rooms ("Role 'member' cannot modify field 'code'"). My owner account is admin and bypassed the rules, so earlier tests missed it. Fixed writableFields.
- PDF test with my 37-page lecture: server log showed the model read it (60k tokens) but returned >10 questions, failing a strict "exactly 10" check. Changed to accept 10+ and keep 10.
- Verified: player sees only "10 questions ready"; generation works on a non-owner account (billing OK).

## Step 4 — game flow + answer once
- I added lessons from Step 3 to the prompt (member permissions, relative URLs) so the agent wouldn't repeat those bugs; its plan needed no schema changes.
- Agent added host controls (Start/Next/Finish) and a QuizQuestion component; correctIndex is never passed to players.
- I tested with 2 accounts through all 10 questions: screens sync live, answers lock, host counter updates, player has no host controls, both see "Game finished".

## Step 5 — live leaderboard + results
- Agent added scoring.ts (scores computed, never stored) with 3 unit tests, plus Leaderboard and Results components.
- Design tradeoff the agent raised and I kept: scores update only when the host moves on, not on each answer, so the leaderboard can't leak whether an answer was correct. Players see a ✓ when someone has answered.
- Plan mode wasn't on for this step, so I reviewed all 5 changed files in Source Control afterwards.
- I tested a full game: correct/incorrect picks shown in green/red to the player, host sees only correct answers, same final ranking on both screens.