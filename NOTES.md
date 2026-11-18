# Build log

## Planning
- Agent (Opus, plan mode) explored the scaffold and wrote PLAN.md.
- I reviewed it: host-only control via 'own' permissions, answer-once via uniqueOn, scores computed (not stored), and generateQuestions checks the caller is the host.
- I removed a leftover instruction line from PLAN.md.
- Tradeoff accepted: correctIndex is readable by players (cheating possible via devtools) — fine for a game among friends, keeps scope small.
- To verify later: AI billing uses the host's credits — test with a second account.