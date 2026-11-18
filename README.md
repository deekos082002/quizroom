# QuizRoom

QuizRoom turns study notes into a live multiplayer quiz. A host uploads a `.txt` or `.pdf` of their notes, AI writes 10 multiple-choice questions from it, and friends join with a 6-character code to play together in real time with a live leaderboard. It's built on DeepSpace, using the platform's built-in features wherever possible.

**Live:** https://quizroom.app.space

## How it works

1. **Create a room.** A signed-in host creates a room and gets a 6-character join code.
2. **Upload notes.** The host uploads a `.txt` or `.pdf` file.
3. **Generate questions.** AI reads the notes and writes 10 questions, each with 4 choices.
4. **Players join by code.** Everyone in the lobby can see who has joined and who is online.
5. **Live game.** The host starts the game and moves through the questions. Each player can answer each question once, and the leaderboard updates live for everyone.
6. **Results.** The game ends on a final results screen with the rankings, the correct answers, and each player's own picks.

## DeepSpace features used

| Feature | Why |
|---|---|
| **Auth** | Hosts and players must sign in, so every row is tied to a verified user id. |
| **Collections with role permissions** | `quizzes`, `questions`, `players` and `answers` each have per-role rules. The host is the quiz's owner (`ownerField`), so `'own'` rules give only the host control. Clients can't write questions at all, and `uniqueOn` stops anyone from joining twice or answering twice. |
| **Real-time `useQuery`** | Lobby, questions, answers and the leaderboard all update over WebSocket with no polling. Scores are never stored; they're calculated from answers, so players can't fake them. |
| **Presence** | `usePresenceRoom` shows who is in the room right now. |
| **File storage** | Notes are uploaded to private R2 storage with `useR2Files`. |
| **Server actions** | `generateQuestions`, `joinQuiz` and `submitAnswer` run on the server and check the caller's identity from the verified token, not from client input. They also enforce game rules the schema can't, like only answering the current question while the game is playing. |
| **AI proxy** | `createDeepSpaceAI` calls Claude through DeepSpace's proxy, so no API keys live in the app or its config. |

## What I left out and why

- **Payments.** A free study tool doesn't need them, and they'd add a lot of scope.
- **Synced timers.** A countdown that stays in sync across every device needs server-driven timing. Having the host advance questions by hand is simpler and works reliably.
- **More question types.** Multiple choice with 4 options is easy to generate, check and score. True/false or free text would need different generation and grading.
- **The scaffold's leaderboard feature.** It lets players write their own score; computing scores from answers is safer.

## Known limitations

- **`correctIndex` can be read by players.** Questions are readable by members, so a player could see the right answers in browser devtools. A full fix means a server-only answer key and server-side scoring. I accepted this for a game among friends; the UI never shows answers during play, and scores only update after the host moves on.
- **No "end game early".** The host has to go through every question to reach results.
- **Open items from my pre-deploy security review:** host-only game transitions aren't validated by a server action, deleting a quiz doesn't delete its questions/answers, and question generation runs inside the request rather than as a background job. The high-priority fixes (server-side answering and joining, generation lock and size checks) are done.

## Run locally

```bash
npm install
npx deepspace auth login
npx deepspace dev start
```

## Build notes

See [NOTES.md](NOTES.md) for my step-by-step build log: what the coding agent did, the bugs I found, and what I verified myself.