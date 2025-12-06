import { describe, it, expect } from 'vitest'
import { escapeHtml } from './html.util'

describe('escapeHtml', () => {
  it('should escape ampersand', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('should escape less than', () => {
    expect(escapeHtml('5 < 10')).toBe('5 &lt; 10')
  })

  it('should escape greater than', () => {
    expect(escapeHtml('10 > 5')).toBe('10 &gt; 5')
  })

  it('should escape double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;')
  })

  it('should escape single quotes', () => {
    expect(escapeHtml("it's nice")).toBe('it&#039;s nice')
  })

  it('should escape all special characters together', () => {
    const input = '<script>alert("XSS & malicious\'code")</script>'
    const expected =
      '&lt;script&gt;alert(&quot;XSS &amp; malicious&#039;code&quot;)&lt;/script&gt;'
    expect(escapeHtml(input)).toBe(expected)
  })

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('should handle string with no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })
})
