/** Where an overlay sits against the element it opens from, as the Angular CDK describes it */
export interface UiConnectedPosition {
  originX: 'start' | 'center' | 'end';
  originY: 'top' | 'center' | 'bottom';
  overlayX: 'start' | 'center' | 'end';
  overlayY: 'top' | 'center' | 'bottom';
  offsetX?: number;
  offsetY?: number;
}

/** Below the element, lined up with its start, else above it, else with its end: the CDK's default for a dropdown */
export const STANDARD_DROPDOWN_BELOW_POSITIONS: UiConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];

let container: HTMLElement | null = null;
let overlayCount = 0;

/** The element overlays open in, at the end of <body>, as the CDK's .cdk-overlay-container */
export function overlayContainer(): HTMLElement {
  if (!container || !container.isConnected) {
    container = document.createElement('div');
    container.className = 'cdk-overlay-container';
    document.body.appendChild(container);
  }
  return container;
}

/** An id for an overlay's pane, as the CDK numbers them: cdk-overlay-0, cdk-overlay-1… */
export function nextOverlayId(): string {
  return `cdk-overlay-${overlayCount++}`;
}

/**
 * Places an overlay's pane against an element, as the CDK's flexible connected position strategy does with
 * withFlexibleDimensions(false): the first position where the pane fits the window whole, else the one where most of
 * it shows, pushed into the window. Returns the index of the position used, to keep while the overlay is open
 * (withLockedPosition) and pass back as `locked`.
 */
export function placeOverlay(pane: HTMLElement, origin: Element, positions: UiConnectedPosition[], locked?: number): number {
  const rect = origin.getBoundingClientRect();
  const overlay = pane.getBoundingClientRect();
  // The window, scrollbars included, for whether it fits (the CDK's ViewportRuler); the page's width, for a right edge
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const page = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };

  const pointFor = (position: UiConnectedPosition) => {
    const originX = position.originX === 'start' ? rect.left : position.originX === 'end' ? rect.right : rect.left + rect.width / 2;
    const originY = position.originY === 'top' ? rect.top : position.originY === 'bottom' ? rect.bottom : rect.top + rect.height / 2;
    const x = (position.overlayX === 'start' ? originX : position.overlayX === 'end' ? originX - overlay.width : originX - overlay.width / 2) + (position.offsetX ?? 0);
    const y = (position.overlayY === 'top' ? originY : position.overlayY === 'bottom' ? originY - overlay.height : originY - overlay.height / 2) + (position.offsetY ?? 0);
    return { x, y };
  };
  const visibleArea = ({ x, y }: { x: number; y: number }) => {
    const width = Math.max(0, overlay.width - Math.max(0, -x) - Math.max(0, x + overlay.width - viewport.width));
    const height = Math.max(0, overlay.height - Math.max(0, -y) - Math.max(0, y + overlay.height - viewport.height));
    return width * height;
  };

  let index = locked ?? positions.findIndex(position => visibleArea(pointFor(position)) === overlay.width * overlay.height);
  let push = false;
  if (index < 0) {
    // Nowhere does it fit whole: where most of it shows, pushed onto the screen
    index = positions.reduce((best, position, i) => visibleArea(pointFor(position)) > visibleArea(pointFor(positions[best])) ? i : best, 0);
    push = true;
  }
  const position = positions[index];
  let { x, y } = pointFor(position);
  if (push) {
    x += overlay.width <= viewport.width ? Math.max(-x, 0) || -Math.max(x + overlay.width - viewport.width, 0) : 0;
    y += overlay.height <= viewport.height ? Math.max(-y, 0) || -Math.max(y + overlay.height - viewport.height, 0) : 0;
  }

  // As the CDK writes it: from the side the pane is lined up on
  const style = pane.style;
  style.top = position.overlayY === 'bottom' ? '' : `${y}px`;
  style.bottom = position.overlayY === 'bottom' ? `${page.height - (y + overlay.height)}px` : '';
  style.left = position.overlayX === 'end' ? '' : `${x}px`;
  style.right = position.overlayX === 'end' ? `${page.width - (x + overlay.width)}px` : '';
  return index;
}
