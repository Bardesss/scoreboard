import { describe, it, expect } from 'vitest'
import { escapeHtml, playedGameApprovedEmail, connectionRequestEmail, reactionReceivedEmail } from './emailTemplates'

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })
})

describe('email templates escape interpolated values', () => {
  it('escapes a malicious league name', () => {
    const { html } = playedGameApprovedEmail('en', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
  it('escapes a malicious actor name', () => {
    const { html } = connectionRequestEmail('en', '<img src=x onerror=alert(1)>')
    expect(html).not.toContain('<img src=x')
  })
})

describe('branded layout', () => {
  it('uses the brand amber button colour, not the old indigo', () => {
    const { html } = connectionRequestEmail('en', 'Alice', 'https://example.com')
    expect(html).toContain('#f5a623')
    expect(html).not.toContain('#4f46e5')
  })

  it('renders a Dice Vault wordmark header', () => {
    const { html } = playedGameApprovedEmail('en', 'My League', 'https://example.com')
    expect(html).toContain('Dice Vault')
  })

  it('links to the email preferences page in the recipient locale (en)', () => {
    const { html } = reactionReceivedEmail('en', '🎲', 'bob@example.com', 'https://example.com')
    expect(html).toContain('https://example.com/en/app/settings')
    expect(html).toMatch(/manage.*email preferences/i)
  })

  it('links to the email preferences page in the recipient locale (nl)', () => {
    const { html } = reactionReceivedEmail('nl', '🎲', 'bob@example.com', 'https://example.com')
    expect(html).toContain('https://example.com/nl/app/settings')
    expect(html).toMatch(/e-mailvoorkeuren/i)
  })
})
