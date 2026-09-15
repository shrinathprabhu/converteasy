// Read native Cloudflare static-asset rules for the lightweight local server.
// Production consumes src/static/_headers and _redirects through dist/.
export function routePattern(pattern) {
  const tokens = pattern.split(/(\*|:[A-Za-z]\w*)/);
  return new RegExp('^' + tokens.map((token) => {
    if (token === '*') return '(?<splat>.*)';
    if (token.startsWith(':')) return `(?<${token.slice(1)}>[^/]+)`;
    return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('') + '$');
}

export function parseHeaders(text) {
  const rules = [];
  let rule;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      rule = { re: routePattern(line.trim()), operations: [] };
      rules.push(rule);
    } else {
      if (!rule) throw new Error('Header declared without a URL pattern');
      const value = line.trim();
      if (value.startsWith('! ')) rule.operations.push({ remove: value.slice(2) });
      else {
        const colon = value.indexOf(':');
        if (colon < 1) throw new Error(`Invalid header: ${value}`);
        rule.operations.push({ key: value.slice(0, colon), value: value.slice(colon + 1).trim() });
      }
    }
  }
  return rules;
}

export function headersFor(rules, pathname) {
  const headers = new Headers();
  for (const rule of rules) if (rule.re.test(pathname)) {
    for (const operation of rule.operations) {
      if (operation.remove) headers.delete(operation.remove);
      else headers.append(operation.key, operation.value);
    }
  }
  return headers;
}

export function parseRedirects(text) {
  return text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const [source, dest, code = '302'] = line.split(/\s+/);
    return { re: routePattern(source), dest, code: Number(code) };
  });
}
