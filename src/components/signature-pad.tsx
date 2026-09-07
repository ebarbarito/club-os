'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';

export type SignaturePadHandle = { getDataUrl: () => string | null; clear: () => void; isEmpty: () => boolean };

// Firma con el dedo (celular) o el mouse — mismo patrón visual y de
// interacción que el mockup ("Firmá con el dedo o con el mouse" +
// "Borrar y volver a firmar"). El trazo se exporta como PNG data URL,
// que el form manda en un input hidden y el server sube como documento.
export const SignaturePad = forwardRef<SignaturePadHandle, { hiddenInputName: string }>(function SignaturePad(
  { hiddenInputName },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const emptyRef = useRef(true);
  const [empty, setEmpty] = useState(true);
  const [dataUrl, setDataUrl] = useState('');

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#16201b';
    ctx.stroke();
    if (emptyRef.current) {
      emptyRef.current = false;
      setEmpty(false);
    }
  }

  function end() {
    drawingRef.current = false;
    if (!emptyRef.current) setDataUrl(canvasRef.current!.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    emptyRef.current = true;
    setEmpty(true);
    setDataUrl('');
  }

  useImperativeHandle(ref, () => ({
    getDataUrl: () => (emptyRef.current ? null : canvasRef.current!.toDataURL('image/png')),
    clear,
    isEmpty: () => emptyRef.current,
  }));

  return (
    <div>
      <div className="rounded-lg border-2 border-dashed border-line-2 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[160px] touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={() => drawingRef.current && end()}
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-text-mute text-xs">{empty ? 'Sin firmar' : 'Firmado'}</span>
        <button type="button" onClick={clear} className="text-accent text-xs font-semibold">
          Borrar y volver a firmar
        </button>
      </div>
      <input type="hidden" name={hiddenInputName} value={dataUrl} />
    </div>
  );
});
