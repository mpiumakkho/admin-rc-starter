import type { AtRule, Plugin } from 'postcss';

/**
 * Angular's emulated view encapsulation, as a PostCSS plugin: a stylesheet that starts with `/* @host app-users-list *\/`
 * applies only inside that element, as a component's styles do in the Angular app, at the same specificity. It lets
 * the components' .scss files be the Angular app's own, :host, :host-context and ::ng-deep included.
 *
 * Angular adds an attribute to the component's elements and to every compound of its selectors. Here each compound
 * gains `:is(._, app-users-list *, [data-host~="app-users-list"] *)` instead (inside the element, or inside an overlay
 * opened from it, such as a menu, whose pane names it in data-host), and :host becomes `:is(._, app-users-list)` (the
 * element itself): each weighs one class, as the attribute does, since no element has the class `_`. A `:where()` that
 * weighs nothing then leaves out what other components render inside it: their elements carry data-emulated
 * (build/emulated-hosts.ts), and only the element itself is the outer component's, as in Angular.
 */
export function emulatedStyles(): Plugin {
  return {
    postcssPlugin: 'emulated-styles',
    Once(root) {
      let host: string | null = null;
      root.walkComments(comment => {
        const match = /^\s*@host\s+([a-z][\w-]*)\s*$/.exec(comment.text);
        if (match) {
          host = match[1];
          comment.remove();
        }
      });
      if (!host) {
        return;
      }
      const tag = host;
      root.walkRules(rule => {
        const parent = rule.parent;
        if (parent?.type === 'atrule' && /keyframes$/i.test((parent as AtRule).name)) {
          return;
        }
        rule.selectors = rule.selectors.flatMap(selector => scopeSelector(selector, tag));
      });
    },
  };
}
emulatedStyles.postcss = true;

/** The selector as Angular's ShadowCss would scope it to `host` */
export function scopeSelector(selector: string, host: string): string[] {
  const hostScope = `:is(._, ${host})`;
  // Inside the element, or inside an overlay opened from it (a menu declared in its template), which names it in
  // data-host; not inside another component's element there
  const contentScope = `:is(._, ${host} *, [data-host~="${host}"] *)`
    + `:where(:not(${host} [data-emulated] *, [data-host~="${host}"] [data-emulated] *))`;

  // :host-context(X) is X on the host itself, or on anything around it
  const context = /:host-context\(((?:[^()]|\([^()]*\))*)\)/.exec(selector);
  if (context) {
    const before = selector.slice(0, context.index);
    const after = selector.slice(context.index + context[0].length);
    // The element around it is the page's, so it is not scoped
    return [
      ...scopeSelector(`${before}${context[1]}:host${after}`, host),
      ...scopeSelector(`${before}:host${after}`, host).map(scoped => `${context[1]} ${scoped}`),
    ];
  }

  const parts = split(selector.trim());
  let deep = false;
  return [parts.map(part => {
    if (part.combinator) {
      return part.text;
    }
    let compound = part.text;
    if (compound.includes('::ng-deep')) {
      deep = true;
      compound = compound.replace('::ng-deep', '');
      return compound;
    }
    if (/:host\b/.test(compound)) {
      // :host(.x) is the host with .x; :host alone, the host
      return compound.replace(/:host\(((?:[^()]|\([^()]*\))*)\)/g, `${hostScope}:is($1)`).replace(/:host\b/g, hostScope);
    }
    if (deep) {
      return compound;
    }
    // Before a pseudo-element, which must come last
    const pseudo = topLevelIndex(compound, '::');
    return pseudo < 0 ? compound + contentScope : compound.slice(0, pseudo) + contentScope + compound.slice(pseudo);
  }).join('').replace(/\s+/g, ' ').trim()];
}

/** A selector's compounds and the combinators between them, outside brackets and parentheses */
function split(selector: string): { text: string; combinator: boolean }[] {
  const parts: { text: string; combinator: boolean }[] = [];
  let depth = 0;
  let current = '';
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index];
    if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      depth--;
    }
    if (depth === 0 && (char === ' ' || char === '>' || char === '+' || char === '~')) {
      if (current) {
        parts.push({ text: current, combinator: false });
        current = '';
      }
      const last = parts[parts.length - 1];
      if (last?.combinator) {
        last.text = char === ' ' ? last.text : ` ${char} `;
      } else {
        parts.push({ text: char === ' ' ? ' ' : ` ${char} `, combinator: true });
      }
      continue;
    }
    current += char;
  }
  if (current) {
    parts.push({ text: current, combinator: false });
  }
  return parts;
}

function topLevelIndex(text: string, needle: string): number {
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      depth--;
    } else if (depth === 0 && text.startsWith(needle, index)) {
      return index;
    }
  }
  return -1;
}
