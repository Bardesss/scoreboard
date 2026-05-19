import { describe, it, expect } from 'vitest'
import { computeTopThreeTemplates, type TemplatePlay } from '@/lib/social/trophyShelf'

describe('computeTopThreeTemplates', () => {
  it('returns top 3 by play count with win-rate', () => {
    const input: TemplatePlay[] = [
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: true },
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: false },
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', isWinner: true },
      { templateId: 't2', name: 'Catan', color: '#def', icon: '🐑', isWinner: true },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', isWinner: false },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', isWinner: false },
      { templateId: 't4', name: 'Go', color: '#jkl', icon: '⚫', isWinner: true },
    ]
    expect(computeTopThreeTemplates(input)).toEqual([
      { templateId: 't1', name: 'Risk', color: '#abc', icon: '🎲', plays: 3, winRate: 2 / 3 },
      { templateId: 't3', name: 'Chess', color: '#ghi', icon: '♟️', plays: 2, winRate: 0 },
      { templateId: 't2', name: 'Catan', color: '#def', icon: '🐑', plays: 1, winRate: 1 },
    ])
  })

  it('returns empty array for no plays', () => {
    expect(computeTopThreeTemplates([])).toEqual([])
  })
})
