import { useRef, type PointerEvent } from 'react';

import { useClinicI18n } from '../i18n/clinic-i18n';

/**
 * A box to sign in with a finger, a pen or the mouse. It gives the signature as a PNG data URL, or '' once cleared.
 * The stroke follows the text colour, so it shows in both themes; the image is drawn dark on white for printing.
 */
export function SignaturePad({ label, onSigned }: { label: string; onSigned: (dataUrl: string) => void }) {
  const { tx } = useClinicI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  const context = (): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const box = canvas.getBoundingClientRect();
    // Sized to the box it is shown in, once, so strokes land under the pointer
    if (canvas.width !== Math.round(box.width) || canvas.height !== Math.round(box.height)) {
      canvas.width = Math.round(box.width);
      canvas.height = Math.round(box.height);
      inked.current = false;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(canvas).color || '#111';
    }
    return ctx;
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const ctx = context();
    if (!ctx) {
      return;
    }
    drawing.current = true;
    canvasRef.current?.setPointerCapture?.(event.pointerId);
    const { offsetX, offsetY } = event.nativeEvent;
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    ctx.lineTo(offsetX + 0.1, offsetY + 0.1);
    ctx.stroke();
    inked.current = true;
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) {
      return;
    }
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.lineTo(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
    ctx?.stroke();
  };

  const end = () => {
    if (!drawing.current) {
      return;
    }
    drawing.current = false;
    if (inked.current && canvasRef.current) {
      onSigned(printable(canvasRef.current));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    inked.current = false;
    onSigned('');
  };

  return (
    <div className="sig-pad">
      <canvas ref={canvasRef} aria-label={label} role="img"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end}></canvas>
      <span className="sig-line" aria-hidden="true"></span>
      <button type="button" className="link sig-clear" onClick={clear}>{tx('ล้างลายเซ็น')}</button>
    </div>
  );
}

/** The signature dark on white, whatever the theme drew it in */
function printable(canvas: HTMLCanvasElement): string {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  if (!ctx) {
    return canvas.toDataURL('image/png');
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.filter = 'grayscale(1) brightness(0)';
  ctx.drawImage(canvas, 0, 0);
  return out.toDataURL('image/png');
}
