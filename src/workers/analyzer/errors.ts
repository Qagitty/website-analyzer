export function checkCommonErrors(html: string, response: Response): object[] {
  const errors: object[] = [];

  if (!response.ok) {
    errors.push({
      message: `Page returned HTTP ${response.status}`,
      type: 'error',
      source: response.url,
      timestamp: Date.now(),
    });
  }

  const errorPatterns = [
    { re: /ReferenceError:/g, label: 'ReferenceError in page' },
    { re: /TypeError:/g, label: 'TypeError in page' },
    { re: /SyntaxError:/g, label: 'SyntaxError in page' },
    { re: /Uncaught\s+\w+Error:/g, label: 'Uncaught JS error in page' },
  ];
  for (const { re, label } of errorPatterns) {
    const matches = html.match(re);
    if (matches) {
      errors.push({
        message: `${label} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`,
        type: 'error',
        source: response.url,
        timestamp: Date.now(),
      });
    }
  }

  if ((html.match(/console\.error/g) || []).length > 3) {
    errors.push({
      message: 'Multiple console.error() calls found in page source',
      type: 'warning',
      source: response.url,
      timestamp: Date.now(),
    });
  }

  return errors;
}
