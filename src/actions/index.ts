import { appFiles, createDeepSpaceAI } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Env } from '../../worker'

const MAX_NOTES_BYTES = 5 * 1024 * 1024
const MAX_NOTES_CHARS = 60_000
const QUESTION_COUNT = 10

const questionsSchema = z.object({
  questions: z
    .array(
      z.object({
        prompt: z.string().max(500),
        choices: z.array(z.string()).length(4),
        correctIndex: z.number().int().min(0).max(3),
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
  notesFileKey?: string
  notesFileName?: string
}

const fail = (code: string, error: string) => ({ success: false as const, code, error })

/**
 * generateQuestions({ quizId }): host-only. Actions run with per-record RBAC
 * off, so the host check below is the authorization boundary.
 */
const generateQuestions: ActionHandler<Env> = async ({ userId, params, tools, env, callerJwt }) => {
  const quizId = params.quizId
  if (typeof quizId !== 'string' || !quizId) return fail('invalid_params', 'quizId is required')

  const found = await tools.get<QuizFields>('quizzes', quizId)
  if (!found.success) return fail('not_found', 'Quiz not found')
  const quiz = found.data.record.data

  // userId comes from the verified JWT, never from params.
  if (quiz.hostId !== userId) return fail('forbidden', 'Only the host can generate questions')
  if (quiz.status !== 'lobby') return fail('bad_state', 'Questions can only be generated in the lobby')
  if (!quiz.notesFileKey) return fail('no_notes', 'Upload notes first')

  // Scoped to the caller's own private folder.
  let bytes: Uint8Array
  try {
    const res = await appFiles(env, { scope: 'self', userId }).download(quiz.notesFileKey)
    bytes = new Uint8Array(await res.arrayBuffer())
  } catch {
    return fail('notes_unreadable', 'Could not read the uploaded notes. Try uploading again.')
  }
  if (bytes.byteLength > MAX_NOTES_BYTES) return fail('file_too_large', 'Notes must be under 5 MB')

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

  // Everything below is scoped to the quiz verified above.
  const cleared = await tools.deleteWhere('questions', { quizId })
  if (!cleared.success) return cleared
  for (const [index, q] of questions.entries()) {
    const created = await tools.create('questions', {
      quizId,
      index,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      hostId: userId,
    })
    if (!created.success) return created
  }
  const updated = await tools.update('quizzes', quizId, { questionCount: QUESTION_COUNT })
  if (!updated.success) return updated

  return { success: true as const, data: { count: QUESTION_COUNT } }
}

export const actions: Record<string, ActionHandler<Env>> = { generateQuestions }
