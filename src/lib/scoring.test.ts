import { describe, expect, it } from 'vitest'
import { rankPlayers } from './scoring'

const players = [
  { playerId: 'h', displayName: 'Host' },
  { playerId: 'a', displayName: 'Zed' },
  { playerId: 'b', displayName: 'Amy' },
  { playerId: 'c', displayName: 'Bob' },
]
const questions = [
  { id: 'q0', index: 0, correctIndex: 1 },
  { id: 'q1', index: 1, correctIndex: 2 },
]
const answers = [
  { questionId: 'q0', playerId: 'a', choiceIndex: 1 },
  { questionId: 'q1', playerId: 'a', choiceIndex: 2 },
  { questionId: 'q0', playerId: 'b', choiceIndex: 1 },
  { questionId: 'q1', playerId: 'b', choiceIndex: 0 },
  { questionId: 'q0', playerId: 'h', choiceIndex: 1 },
]

describe('rankPlayers', () => {
  it('scores from correctIndex, excludes host, sorts by score then name', () => {
    const r = rankPlayers(players, questions, answers, 'h')
    expect(r.map((x) => [x.name, x.score, x.rank])).toEqual([
      ['Zed', 2, 1],
      ['Amy', 1, 2],
      ['Bob', 0, 3],
    ])
  })
  it('ties share a rank', () => {
    const r = rankPlayers(players, questions, answers.slice(0, 1), 'h')
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2])
  })
  it('ignores questions at or past scoredBelow', () => {
    const r = rankPlayers(players, questions, answers, 'h', 1)
    expect(r.map((x) => [x.name, x.score])).toEqual([['Amy', 1], ['Zed', 1], ['Bob', 0]])
  })
})
