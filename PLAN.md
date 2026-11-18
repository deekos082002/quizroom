# QuizRoom: build plan

## Context
QuizRoom is a one-day DeepSpace build exercise, built on the scaffold in this repo (React frontend in `src/pages`, Cloudflare worker in `worker.ts` + `src/server`).

How it works:
- A signed-in **host** creates a room with a 6-character join code, uploads study notes (.txt or .pdf), and has AI generate 10 multiple-choice questions.
- **Players** sign in and join with the code. Everyone sees who is in the room.
- The host starts the game and moves through the questions. Each player answers each question once.
- A live leaderboard updates for everyone, and the game ends on a final results screen.

The goal is the smallest version that works end to end, using DeepSpace's built-in features wherever possible.



---

## 1. Collections, fields, permissions

**Roles:** DeepSpace roles apply to the whole app. Every signed-in user is a `member` (the SDK default), and signed-out visitors are `viewer`s. "Host" is not a role. The host is simply the **owner of the quiz row** (`ownerField: 'hostId'`), and `'own'` permissions are what give the host control. All four collections are new files in `src/schemas/` and are registered in `src/schemas.ts`.

**Field options used below:**
- `userBound`: the server fills in the signed-in user's id.
- `immutable`: the field can never change after the row is created.
- `ownerField`: the column that `'own'` permissions check.
- `uniqueOn`: no two rows may share these values.
- `writableFields`: the only fields a client is allowed to send.

### `quizzes`: one row per game room (`src/schemas/quizzes-schema.ts`)
| Field | Type | Notes |
|---|---|---|
| `code` | text, required, immutable, maxLength 6 | Join code; `uniqueOn: ['code']` |
| `title` | text | Optional display name |
| `hostId` | text, `userBound`, immutable | `ownerField` |
| `status` | text, select `lobby \| playing \| finished`, default `lobby` | |
| `currentIndex` | number, default 0 | Question currently shown |
| `notesFileKey` | text | R2 key of the uploaded notes |
| `notesFileName` | text | Shown in the UI |
| `questionCount` | number, default 0 | Set by the generate action |

Permissions:
- viewer: `read: false`, `create: false`, `update: false`, `delete: false`
- member: `read: true` (players must look up a room by code), `create: true`, `update: 'own'`, `delete: 'own'`, `writableFields: ['title','status','currentIndex','notesFileKey','notesFileName']`
- admin: everything `true`

### `questions`: 10 per quiz, written only by the server (`src/schemas/questions-schema.ts`)
| Field | Type | Notes |
|---|---|---|
| `quizId` | text, required, immutable | |
| `index` | number, required | 0–9 |
| `prompt` | text, required, maxLength 500 | |
| `choices` | text, json, required | Array of exactly 4 strings |
| `correctIndex` | number, required | 0–3 |
| `hostId` | text, required | `ownerField` |

Permissions:
- viewer: all `false`
- member: `read: true`, and `create`, `update`, `delete` all `false`. Only the `generateQuestions` action writes questions.
- admin: everything `true`

### `players`: who joined which quiz (`src/schemas/players-schema.ts`)
| Field | Type | Notes |
|---|---|---|
| `quizId` | text, required, immutable | |
| `playerId` | text, `userBound`, immutable | `ownerField` |
| `displayName` | text, maxLength 40 | |

`uniqueOn: ['quizId','playerId']` stops anyone from joining the same quiz twice.

Permissions:
- viewer: all `false`
- member: `read: true`, `create: true`, `update: false`, `delete: 'own'` (leave a room), `writableFields: ['quizId','displayName']`
- admin: everything `true`

### `answers`: one per player per question (`src/schemas/answers-schema.ts`)
| Field | Type | Notes |
|---|---|---|
| `quizId` | text, required, immutable | |
| `questionId` | text, required, immutable | |
| `choiceIndex` | number, required, immutable | 0–3 |
| `playerId` | text, `userBound`, immutable | `ownerField` |

`uniqueOn: ['questionId','playerId']`. Together with `update: false`, the server enforces **answer once**.

Permissions:
- viewer: all `false`
- member: `read: true` (the leaderboard needs everyone's answers), `create: true`, `update: false`, `delete: false`, `writableFields: ['quizId','questionId','choiceIndex']`
- admin: everything `true`

**Scores are never stored.** The leaderboard is calculated from `answers` and `questions.correctIndex`, so a player cannot fake a score.

---

## 2. Built-in DeepSpace features per part

| Part | What we use |
|---|---|
| Sign-in | Existing `(app)/(protected)/` layout with `AuthGate`; `useUser()` for the name |
| Create room / start / next / finish | `useMutations('quizzes')`: `create`, then `put(id, { status, currentIndex })`. The server's `'own'` rule means only the host can do this. |
| Join with code | `useQuery('quizzes', { where: { code } })`, then `useMutations('players').create(...)` |
| Who's in the room | `usePresenceRoom(\`quiz:${quizId}\`)` gives live peers (it excludes yourself). It is shown next to the `players` list (`useQuery('players', { where: { quizId } })`) so each player has an online dot. |
| Upload notes | `useR2Files().upload(file)` (default private `self` scope), then save the key on the quiz with `put` |
| Generate questions | Custom action `generateQuestions`, called with `POST /api/actions/generateQuestions` (see §3/§4) |
| Questions / answers / live leaderboard | `useQuery('questions' \| 'answers', { where: { quizId } })`. The WebSocket keeps everyone's screen up to date with no polling. |
| Answer | `useMutations('answers').create({ quizId, questionId, choiceIndex })`. A duplicate is rejected by `uniqueOn` and shown by the existing `onWriteError` toast. |

**Add-on features from `npx deepspace add`:**
- **`leaderboard`: don't add.** Its table stores a `score` that each member writes for themselves, which would let players set their own score. It is also a single global page, not per quiz. We compute the ranking from `answers` instead (about 20 lines). Its medal styling can be copied for the top 3 if wanted.
- **`file-attachments`: don't add.** It brings heavy preview libraries (pdfjs, CodeMirror, ExcelJS, docx-preview) and its own collection and page. We only need one upload, which `useR2Files` already does.
- No other features are needed.

---

## 3. Custom server actions

Only **one** action is needed: **`generateQuestions({ quizId })`** in `src/actions/index.ts`. Everything else is a normal record write, protected by the schema permissions above.

Actions run with per-record permission checks **off** (see `src/server/action-routes.ts`). So the action checks the host itself before doing anything:
1. `const r = await tools.get('quizzes', quizId)`. If the quiz doesn't exist, return a not-found error.
2. **If `r.data.hostId !== userId`, return a `forbidden` error.** `userId` comes from the verified JWT via `resolveAuth`, never from `params`.
3. If `status !== 'lobby'`, refuse (no regenerating questions mid-game).
4. If `notesFileKey` is missing, refuse.
5. Read the file with `appFiles(env, { scope: 'self', userId })`. This is scoped to the **caller's** private folder, so a key pointing at another user's file can't be read.
6. Any `deleteWhere` / `create` calls are limited to `{ quizId }` of the quiz verified in step 2.

**Game control needs no action.** Start, next and finish are `put`s on the quiz row, and the server's `update: 'own'` rule already allows only the host.

---

## 4. How AI question generation works (server-side)

Flow inside `generateQuestions`, after the checks in §3:
1. **Load notes.** `appFiles(...).download(notesFileKey)`. Reject files over 5 MB.
   - `.txt`: decode the bytes to text and cut it to about 60k characters.
   - `.pdf`: send the bytes to Claude as an AI SDK file part (`{ type: 'file', mediaType: 'application/pdf', data }`). Claude reads PDFs directly, so no parsing library is needed.
2. **Call the model.**
   - `const model = createDeepSpaceAI(env, 'anthropic', { authToken: callerJwt })('claude-sonnet-5-5')`, using `createDeepSpaceAI` from `deepspace/worker`.
   - `generateText({ model, system, messages, output: Output.object({ schema }) })`, using `generateText` and `Output` from the `ai` package already installed.
   - The zod `schema` is `{ questions: z.array(z.object({ prompt, choices: z.array(z.string()).length(4), correctIndex: z.number().int().min(0).max(3) })).length(10) }`.
   - The system prompt says: "write questions answerable only from these notes; one unambiguous correct choice."
3. **Save.** `tools.deleteWhere('questions', { quizId })` clears any earlier attempt. Then `tools.create('questions', {...})` ×10 with `hostId: userId`, and `tools.update('quizzes', quizId, { questionCount: 10 })`.
4. **Return.** `{ success: true, data: { count: 10 } }`. The questions appear on every screen through `useQuery`.

**Secrets / API keys: none.** `createDeepSpaceAI` sends the request through the DeepSpace AI proxy. Passing `callerJwt` bills the **host's** DeepSpace credits. Leaving it out would bill the app owner (`APP_OWNER_JWT`, which `deepspace dev` and `deploy` set up automatically). Nothing goes in `npx deepspace secrets`.

**Risks:**
- **The proxy might not accept PDF file parts.** We check this first in step 3. Fallback: pull the text out of the PDF in the browser with `pdfjs-dist` and send it as text.
- **Generation might be too slow for one request.** If it regularly takes more than about 25s, move it into `src/jobs.ts` with `useJobs`. Not planned for today.

---

## 5. What we will NOT build (and why)

- **Payments, subscriptions, credits UI:** not part of the exercise.
- **Synced countdown timers or speed bonuses:** they need a server clock and a server-side cut-off. The host moves on by hand instead.
- **Other question types** (true/false, free text, images): multiple choice with 4 options only. That keeps the AI schema and scoring trivial.
- **Hiding answers from determined cheaters:** `correctIndex` is readable by members, so a player could find it with devtools, and answering past or future questions is only blocked in the UI. Fixing this would need server-side scoring actions. Fine for a game among friends.
- **Editing AI questions by hand, more than 10 questions, more than one notes file:** the host can regenerate instead.
- **Kicking players, host transfer, rejoin as another name, anonymous play:** everyone must sign in.
- **Mobile app, custom theme work, landing page, AI chat panel:** not needed for the flow.
- **Cleaning up old quizzes or files:** later.

---

## 6. Build order: 5 small steps, each testable on its own

Pages:
- `src/pages/(app)/(protected)/quiz/index.tsx` → `/quiz` (create or join)
- `src/pages/(app)/(protected)/quiz/[quizId].tsx` → `/quiz/:quizId` (shows lobby, game or results depending on `status`)
- Add a `Quiz` item to `src/nav.ts`.

**Step 1. Schemas + create room.**
- Build: add the 4 schema files, register them in `src/schemas.ts`, and build `/quiz` with a "Create room" button. The browser generates a 6-character code from an unambiguous alphabet (no O/0/I/1) and retries if `uniqueOn` rejects it. Then go to `/quiz/:id`, which shows the code.
- Test: `npm run validate` passes. In `npm run dev`, creating a room shows its code. A second account can see the room but gets a permission toast when it tries to change it.

**Step 2. Join by code + lobby with presence.**
- Build: a join form on `/quiz` that finds the room by code, creates a `players` row and navigates to it. The lobby lists the players with online dots from `usePresenceRoom`.
- Test: use two browsers (normal + incognito, two accounts). The second joins with the code and both see each other within a few seconds. Joining twice does not create a duplicate.

**Step 3. Upload notes + `generateQuestions` action.**
- Build: a host-only upload control (`useR2Files`, accepts `.txt`/`.pdf`), a "Generate questions" button that calls the action, and the action from §3/§4.
- Test:
  - With a .txt file and then a .pdf, 10 questions appear for the host and the players.
  - The action called with a player's token returns `forbidden`. Check with `curl` and the player's bearer token, or a temporary button.

**Step 4. Game flow + answering once.**
- Build: host buttons Start → Next → Finish (all `put` on the quiz). Players see the current question and 4 buttons. The buttons lock once the player has an answer row for that question. The host sees "N/M answered".
- Test: with two browsers, the question moves forward for everyone. Answering twice is rejected: the button is disabled, and a forced second write returns the `uniqueOn` error toast.

**Step 5. Live leaderboard + results screen.**
- Build: a leaderboard component that counts each player's correct answers (`answers` joined to `questions.correctIndex`), excluding the host, sorted by score then name. It shows in the game view, and as a full results screen with the top 3 highlighted when `status === 'finished'`.
- Test: scores update live in both browsers as answers come in. Finishing shows the same final ranking to everyone.

---

## Verification (end to end)
- `npm run validate` (type-check + unit tests) and `npm run lint` after each step.
- `npm run dev` with two signed-in browsers: play through create → join → upload → generate → start → answer → next ×10 → finish.
- Optional: add a case to `tests/collab.spec.ts` (two users: join, answer, leaderboard), run with `npm run test:e2e`.
- Commit, then `npx deepspace deploy` and repeat the two-browser run on `quizroom.app.space`.
