/**
 * Says something to screen readers without moving focus, as the Angular CDK's LiveAnnouncer: one polite live region
 * at the end of <body>, visually hidden, whose text changes a moment after it is emptied so the same words are read
 * again.
 *
 *   announce('Display size 110%');
 */
let region: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): Promise<void> {
  if (!region || !region.isConnected) {
    region = document.createElement('div');
    region.className = 'cdk-live-announcer-element cdk-visually-hidden';
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  const element = region;
  element.setAttribute('aria-live', politeness);
  element.textContent = '';
  clearTimeout(timer);
  return new Promise(resolve => {
    timer = setTimeout(() => {
      element.textContent = message;
      resolve();
    }, 100);
  });
}
