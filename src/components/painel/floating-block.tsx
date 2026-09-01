import { useEffect, useRef, useState, type ReactNode, type MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export type FloatRect = { x: number; y: number; w: number; h: number };

type Props = {
  id: string;
  label: string;
  rect: FloatRect;
  canvas: HTMLElement | null;
  /** escala aplicada ao container (transform: scale) */
  scaleRef: MutableRefObject<number>;
  onChange: (rect: FloatRect) => void;
  onCommit: (rect: FloatRect) => void;
  children: ReactNode;
};

const MIN_W = 160;
const MIN_H = 90;

export function FloatingBlock({ label, rect, canvas, scaleRef, onChange, onCommit, children }: Props) {
  const [active, setActive] = useState<null | "move" | "resize">(null);
  const start = useRef({ px: 0, py: 0, rect });

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (e.clientX - start.current.px) / s;
      const dy = (e.clientY - start.current.py) / s;
      const r = start.current.rect;
      const next: FloatRect =
        active === "move"
          ? { ...r, x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy) }
          : { ...r, w: Math.max(MIN_W, r.w + dx), h: Math.max(MIN_H, r.h + dy) };
      onChange(next);
    };
    const onUp = (e: PointerEvent) => {
      const s = scaleRef.current || 1;
      const dx = (e.clientX - start.current.px) / s;
      const dy = (e.clientY - start.current.py) / s;
      const r = start.current.rect;
      const next: FloatRect =
        active === "move"
          ? { ...r, x: Math.max(0, r.x + dx), y: Math.max(0, r.y + dy) }
          : { ...r, w: Math.max(MIN_W, r.w + dx), h: Math.max(MIN_H, r.h + dy) };
      setActive(null);
      onCommit(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [active, onChange, onCommit, scaleRef]);

  if (!canvas) return null;

  const begin = (mode: "move" | "resize") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    start.current = { px: e.clientX, py: e.clientY, rect };
    setActive(mode);
  };

  return createPortal(
    <div
      className={cn(
        "absolute group rounded-xl",
        active && "z-50 ring-2 ring-emerald-500/60 shadow-[0_0_40px_rgba(16,185,129,0.25)]",
      )}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
    >
      {/* alça de arraste */}
      <div
        onPointerDown={begin("move")}
        title={`Arrastar ${label}`}
        className="absolute -top-3 left-2 z-20 flex items-center gap-1 rounded-md bg-slate-800/90 border border-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing select-none"
      >
        <GripVertical className="h-3 w-3" />
        {label}
      </div>

      <div className="h-full w-full overflow-hidden rounded-xl [&>*]:h-full [&>*]:w-full">{children}</div>

      {/* alça de redimensionar */}
      <div
        onPointerDown={begin("resize")}
        title="Redimensionar"
        className="absolute -bottom-1 -right-1 z-20 h-5 w-5 cursor-nwse-resize rounded-sm border-b-4 border-r-4 border-emerald-500/70 opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>,
    canvas,
  );
}
