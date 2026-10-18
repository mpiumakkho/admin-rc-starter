import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { Plugin } from 'vite';

/**
 * The other half of build/emulated-styles.ts: a component whose stylesheet starts with `/* @host app-users-list *\/`
 * marks its own element, <app-users-list>, with data-emulated. A component's styles reach everything inside its
 * element except what another such component renders, as Angular's reach only what the component's own template
 * declares. The element itself is its parent's, so the parent's styles still reach it.
 */
export function emulatedHosts(): Plugin {
  return {
    name: 'emulated-hosts',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.tsx') || file.includes('node_modules')) {
        return null;
      }
      const hosts = new Set<string>();
      for (const match of code.matchAll(/^import\s+'(\.{1,2}\/[^']+\.scss)';/gm)) {
        const header = /^\s*\/\*\s*@host\s+([a-z][\w-]*)\s*\*\//.exec(readSafely(resolve(dirname(file), match[1])));
        if (header) {
          hosts.add(header[1]);
        }
      }
      if (!hosts.size) {
        return null;
      }
      let marked = code;
      for (const host of hosts) {
        marked = marked.replace(new RegExp(`<${host}(?=[\\s>/])`, 'g'), `<${host} data-emulated=""`);
      }
      return marked === code ? null : { code: marked, map: null };
    },
  };
}

function readSafely(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}
