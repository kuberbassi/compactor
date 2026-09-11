import { expect, it } from 'vitest';
import { csvToHtmlTable, textToHtml } from '../utils/universalConverters';

it('exports HTML metacharacters as content, including empty CSV fallbacks and titles', () => {
  const payload = '<script>alert(1)</script>';
  for (const html of [textToHtml(payload, payload), csvToHtmlTable(`Name\n${payload}`, payload), csvToHtmlTable(payload, payload)]) {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  }
});
