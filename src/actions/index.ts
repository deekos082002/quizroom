import { appFiles, createDeepSpaceAI } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Env } from '../../worker'

const MAX_NOTES_BYTES = 5 * 1024 * 1024
const MAX_NOTES_CHARS = 60_000
const QUESTION_COUNT = 10
const CHOICE_COUNT = 4
/** A lock older than this is from a crashed run and may be taken over. */
const LOCK_STALE_MS = 5 * 60 * 1000

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().max(500),
        choices: z.array(z.string()).length(CHOICE_COUNT),
        correctIndex: z.number().int().min(0).max(CHOICE_COUNT - 1),
      }),
    )
    .min(QUESTION_COUNT),
})

const SYSTEM_PROMPT =
  `You write multiple-choice quiz questions from study notes. Write exactly ${QUESTION_COUNT} questions ` +
  'answerable only from these notes. Each has exactly 4 choices and one unambiguous correct choice. ' +
  'Keep each prompt under 500 characters and vary the position of the correct answer.'

interface QuizFields extends Record<string, unknown> {
  hostId: string
  status: string
  currentIndex?: number
  notesFileKey?: string
  notesFileName?: string
}

interface QuestionFields extends Record<string, unknown> {
  quizId: string
  index: number
  choices: string[]
}

interface LockFields extends Record<string, unknown> {
  quizId: string
  startedAt: number
}

const fail = (code: string, error: string) => ({ success: false as const, code, error })

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0

/** Thrown when a download is over the byte cap. */
class TooLargeError extends Error {}

/**
 * Read a Response body as bytes without ever buffering more than `max`.
 * Refuses early on Content-Length, then enforces the cap while streaming
 * in case the header is missing or wrong. (The SDK's readBoundedBodyText
 * does the same but returns text; PDFs need bytes.)
 */
async function readBoundedBytes(res: Response, max: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) throw new TooLargeError()
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      throw new TooLargeError()
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

/**
 * Take the per-quiz generation lock. uniqueOn(quizId) makes the create
 * atomic in the record room, so only one concurrent caller wins. A lock left
 * behind by a crashed run is taken over once it is stale.
 */
async function acquireLock(tools: ActionTools, quizId: string): Promise<string | null> {
  const created = await tools.create<LockFields>('generation_locks', { quizId, startedAt: Date.now() })
  if (created.success) return created.data.recordId
  const existing = await tools.query<LockFields>('generation_locks', { where: { quizId }, limit: 1 })
  const lock = existing.success ? existing.data.records[0] : undefined
  if (!lock || Date.now() - lock.data.startedAt < LOCK_STALE_MS) return null
  await tools.remove('generation_locks', lock.recordId)
  const retry = await tools.create<LockFields>('generation_locks', { quizId, startedAt: Date.now() })
  return retry.success ? retry.data.recordId : null
}

/**
 * generateQuestions({ quizId }): host-only. Actions run with per-record RBAC
 * off, so the host check below is the authorization boundary.
 */
const generateQuestions: ActionHandler<Env> = async ({ userId, params, tools, env, callerJwt }) => {
  const quizId = params.quizId
  if (!isNonEmptyString(quizId)) return fail('invalid_params', 'quizId is required')

  const found = await tools.get<QuizFields>('quizzes', quizId)
  if (!found.success) return fail('not_found', 'Quiz not found')
  const quiz = found.data.record.data

  // userId comes from the verified JWT, never from params.
  if (quiz.hostId !== userId) return fail('forbidden', 'Only the host can generate questions')
  if (quiz.status !== 'lobby') return fail('bad_state', 'Questions can only be generated in the lobby')
  if (!quiz.notesFileKey) return fail('no_notes', 'Upload notes first')

  const lockId = await acquireLock(tools, quizId)
  if (!lockId) return fail('busy', 'Questions are already being generated for this quiz')

  try {
    // Scoped to the caller's own private folder.
    let bytes: Uint8Array
    try {
      const res = await appFiles(env, { scope: 'self', userId }).download(quiz.notesFileKey)
      if (!res.ok) throw new Error(`download ${res.status}`)
      bytes = await readBoundedBytes(res, MAX_NOTES_BYTES)
    } catch (e) {
      if (e instanceof TooLargeError) return fail('file_too_large', 'Notes must be under 5 MB')
      return fail('notes_unreadable', 'Could not read the uploaded notes. Try uploading again.')
    }

    const isPdf = (quiz.notesFileName ?? quiz.notesFileKey).toLowerCase().endsWith('.pdf')
    const text = isPdf ? '' : new TextDecoder().decode(bytes).slice(0, MAX_NOTES_CHARS)
    if (!isPdf && !text.trim()) return fail('empty_notes', 'The notes file is empty')
    const content = isPdf
      ? [
          { type: 'text' as const, text: 'Write the quiz from the attached notes.' },
          { type: 'file' as const, mediaType: 'application/pdf', data: bytes },
        ]
      : [{ type: 'text' as const, text: `Notes:\n\n${text}` }]

    let questions: z.infer<typeof questionsSchema>['questions']
    try {
      // Bills the host's credits.
      const model = createDeepSpaceAI(env, 'anthropic', { authToken: callerJwt })('claude-sonnet-5-5')
      const result = await generateText({
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
        output: Output.object({ schema: questionsSchema }),
      })
      // The model sometimes returns extra questions; keep the first 10.
      questions = result.output.questions.slice(0, QUESTION_COUNT)
    } catch (e) {
      console.error('[generateQuestions] model call failed', e)
      return fail(
        'generation_failed',
        isPdf
          ? 'Could not generate questions from this PDF. Try again or use a .txt file.'
          : 'Could not generate questions. Try again.',
      )
    }

    // The model call is slow: re-check the quiz is still in the lobby before
    // replacing questions, so a game started meanwhile is never disturbed.
    const again = await tools.get<QuizFields>('quizzes', quizId)
    if (!again.success) return fail('not_found', 'Quiz not found')
    if (again.data.record.data.status !== 'lobby') {
      return fail('bad_state', 'The game started before questions finished generating')
    }

    // Everything below is scoped to the quiz verified above. questionCount
    // drops to 0 first so Start stays disabled until the new set is complete.
    const saveFailed = () => fail('save_failed', 'Could not save the questions. Try again.')
    const zeroed = await tools.update('quizzes', quizId, { questionCount: 0 })
    if (!zeroed.success) return saveFailed()
    const cleared = await tools.deleteWhere('questions', { quizId })
    if (!cleared.success) return saveFailed()
    for (const [index, q] of questions.entries()) {
      const created = await tools.create('questions', {
        quizId,
        index,
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correctIndex,
        hostId: userId,
      })
      if (!created.success) {
        console.error('[generateQuestions] create failed', created.error)
        // Don't leave a partial set behind; questionCount is already 0.
        await tools.deleteWhere('questions', { quizId })
        return saveFailed()
      }
    }
    const updated = await tools.update('quizzes', quizId, { questionCount: questions.length })
    if (!updated.success) return saveFailed()

    return { success: true as const, data: { count: questions.length } }
  } finally {
    await tools.remove('generation_locks', lockId)
  }
}

/**
 * joinQuiz({ quizId }): adds the caller to a quiz's players. Rooms that have
 * finished can't be joined, the host can't join their own room, and the
 * display name comes from the caller's user record, not from params.
 * Idempotent: joining twice is a success.
 */
const joinQuiz: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const quizId = params.quizId
  if (!isNonEmptyString(quizId)) return fail('invalid_params', 'quizId is required')

  const found = await tools.get<QuizFields>('quizzes', quizId)
  if (!found.success) return fail('not_found', 'Quiz not found')
  const quiz = found.data.record.data
  if (quiz.hostId === userId) return fail('forbidden', 'The host cannot join their own room')
  if (quiz.status === 'finished') return fail('bad_state', 'This game has already finished')

  const alreadyJoined = async () => {
    const existing = await tools.query('players', { where: { quizId, playerId: userId }, limit: 1 })
    return existing.success && existing.data.records.length > 0
  }
  if (await alreadyJoined()) return { success: true as const, data: { joined: true } }

  const me = await tools.get<{ name?: string }>('users', userId)
  const name = (me.success && me.data.record.data.name) || 'Player'

  // playerId is userBound: the record room stamps it with the caller's id.
  const created = await tools.create('players', { quizId, displayName: name.slice(0, 40) })
  if (!created.success) {
    // uniqueOn rejected a racing duplicate: already joined, which is fine.
    if (await alreadyJoined()) return { success: true as const, data: { joined: true } }
    console.error('[joinQuiz] create failed', created.error)
    return fail('save_failed', 'Could not join the room. Try again.')
  }
  return { success: true as const, data: { joined: true } }
}

/**
 * submitAnswer({ questionId, choiceIndex }): the only way to write an answer.
 * Accepts it only while the quiz is playing, for the current question, from
 * a joined player, with a valid choice. quizId comes from the question, never
 * from params. uniqueOn(questionId, playerId) keeps it answer-once.
 */
const submitAnswer: ActionHandler<Env> = async ({ userId, params, tools }) => {
  const { questionId, choiceIndex } = params
  if (!isNonEmptyString(questionId)) return fail('invalid_params', 'questionId is required')
  if (typeof choiceIndex !== 'number' || !Number.isInteger(choiceIndex)) {
    return fail('invalid_params', 'choiceIndex must be an integer')
  }

  const q = await tools.get<QuestionFields>('questions', questionId)
  if (!q.success) return fail('not_found', 'Question not found')
  const question = q.data.record.data
  if (choiceIndex < 0 || choiceIndex >= question.choices.length) {
    return fail('invalid_params', 'choiceIndex is out of range')
  }

  const found = await tools.get<QuizFields>('quizzes', question.quizId)
  if (!found.success) return fail('not_found', 'Quiz not found')
  const quiz = found.data.record.data
  if (quiz.status !== 'playing') return fail('bad_state', 'The game is not running')
  if ((quiz.currentIndex ?? 0) !== question.index) {
    return fail('not_current', 'That question is no longer open')
  }

  const player = await tools.query('players', {
    where: { quizId: question.quizId, playerId: userId },
    limit: 1,
  })
  if (!player.success || player.data.records.length === 0) {
    return fail('not_player', 'Join the room to answer')
  }

  const existing = await tools.query('answers', { where: { questionId, playerId: userId }, limit: 1 })
  if (existing.success && existing.data.records.length > 0) {
    return fail('already_answered', 'You can answer each question once')
  }

  // playerId is userBound: the record room stamps it with the caller's id.
  const created = await tools.create('answers', { quizId: question.quizId, questionId, choiceIndex })
  if (!created.success) {
    // Lost a race against our own double submit: uniqueOn rejected it.
    const again = await tools.query('answers', { where: { questionId, playerId: userId }, limit: 1 })
    if (again.success && again.data.records.length > 0) {
      return fail('already_answered', 'You can answer each question once')
    }
    console.error('[submitAnswer] create failed', created.error)
    return fail('save_failed', 'Could not submit the answer. Try again.')
  }
  return { success: true as const, data: { answerId: created.data.recordId } }
}

export const actions: Record<string, ActionHandler<Env>> = { generateQuestions, joinQuiz, submitAnswer }
