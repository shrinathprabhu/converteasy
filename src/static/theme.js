// Applies a saved light/dark choice before first paint. Kept external and tiny
// so the CSP can forbid inline scripts.
try {
  var t = localStorage.getItem('converteasy.theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
