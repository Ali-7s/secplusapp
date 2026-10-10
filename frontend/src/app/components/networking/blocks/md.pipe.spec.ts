import { MdPipe, formatInline } from './md.pipe';

describe('formatInline', () => {
  it('formats bold and code', () => {
    expect(formatInline('Use **SSH** on `22`.')).toBe('Use <strong>SSH</strong> on <code class="md-code">22</code>.');
  });

  it('escapes HTML so lesson text can never inject markup', () => {
    expect(formatInline('<script>alert(1)</script> & **ok**')).toBe('&lt;script&gt;alert(1)&lt;/script&gt; &amp; <strong>ok</strong>');
    expect(formatInline('`<b>`')).toBe('<code class="md-code">&lt;b&gt;</code>');
  });

  it('returns an empty string for missing text', () => {
    expect(formatInline('')).toBe('');
    expect(formatInline(null)).toBe('');
    expect(formatInline(undefined)).toBe('');
  });

  it('is available as a pipe', () => {
    expect(new MdPipe().transform('**x**')).toBe('<strong>x</strong>');
  });
});
