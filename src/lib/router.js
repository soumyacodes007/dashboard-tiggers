// Hash routes, so the app is a static site: #/rules, #/rules/new, #/rules/0xabc…, #/settings/account.
import { useSyncExternalStore } from 'react';

function parse() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [a, b] = parts;
  if (!a) return { name: 'overview', params: {} };
  if (a === 'rules' && b === 'new') return { name: 'new', params: {} };
  if (a === 'rules' && b) return { name: 'rule', params: { key: b } };
  if (a === 'settings') return { name: 'settings', params: { sec: b || 'account' } };
  if (['rules', 'activity', 'workers', 'connections'].includes(a)) return { name: a, params: {} };
  return { name: 'notfound', params: {} };
}
let seq = 0;
let route = { ...parse(), seq };
const subs = new Set();
addEventListener('hashchange', () => {
  route = { ...parse(), seq: ++seq };
  subs.forEach(f => f());
  document.querySelector('.content')?.scrollTo(0, 0);
});
export const useRoute = () =>
  useSyncExternalStore(
    f => (subs.add(f), () => subs.delete(f)),
    () => route,
  );
export const go = path => {
  location.hash = '#/' + path.replace(/^\//, '');
};
export const href = path => '#/' + path.replace(/^\//, '');
