import { describe, it, expect } from 'vitest'
import { escapeHtml, playedGameApprovedEmail, connectionRequestEmail } from './emailTemplates'

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
