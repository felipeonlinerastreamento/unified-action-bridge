import { useRef, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download, FileText, FileSpreadsheet, Image as ImageIcon,
  Maximize2, ZoomIn, ZoomOut, RotateCcw,
} from "lucide-react";
import { exportToCSV, exportToXLSX } from "./export-utils";
import { toast } from "sonner";

type Props = {
  title: string;
  /** Rows behind the chart, used for CSV/XLSX export */
  data?: Record<string, unknown>[];
  /** File name (without extension) used on exports */
  filename?: string;
  /** Extra actions rendered next to the toolbar */
  actions?: ReactNode;
  /** Disable zoom controls (e.g. for pie charts) */
  zoomable?: boolean;
  /** Render without the Card wrapper (for charts already inside a card) */
  bare?: boolean;
  children: ReactNode;
  className?: string;
};


async function exportSvgAsPng(container: HTMLElement | null, filename: string) {
  const svg = container?.querySelector("svg");
  if (!svg) { toast.error("Gráfico não encontrado"); return; }
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const width = Math.max(rect.width, 600);
    const height = Math.max(rect.height, 300);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Inline computed colors so the PNG doesn't depend on CSS variables
    const source = svg.querySelectorAll<SVGElement>("*");
    clone.querySelectorAll<SVGElement>("*").forEach((el, i) => {
      const original = source[i];
      if (!original) return;
      const cs = window.getComputedStyle(original);
      ["fill", "stroke", "stroke-width", "font-size", "font-family", "opacity", "fill-opacity", "stroke-opacity"]
        .forEach((prop) => {
          const v = cs.getPropertyValue(prop);
          if (v) el.style.setProperty(prop, v);
        });
    });

    const xml = new XMLSerializer().serializeToString(clone);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img"));
      img.src = svgUrl;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${filename}.png`;
    a.click();
    toast.success("Imagem exportada");
  } catch {
    toast.error("Não foi possível gerar a imagem");
  }
}

export function ChartFrame({
  title, data, filename, actions, zoomable = true, bare = false, children, className,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const inlineRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const name = filename || title.toLowerCase().replace(/[^a-z0-9]+/gi, "-");

  const toolbar = (inDialog: boolean) => (
    <div className="flex items-center gap-1">
      {zoomable && (
        <>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            aria-label="Diminuir zoom"
            onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <div className="w-20 hidden sm:block">
            <Slider
              value={[zoom]} min={1} max={5} step={0.25}
              onValueChange={(v) => setZoom(v[0])}
              aria-label="Zoom do gráfico"
            />
          </div>
          <Button
            size="icon" variant="ghost" className="h-7 w-7"
            aria-label="Aumentar zoom"
            onClick={() => setZoom((z) => Math.min(5, Math.round((z + 0.25) * 100) / 100))}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground w-8 tabular-nums">{zoom.toFixed(1)}x</span>
          {zoom !== 1 && (
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Restaurar zoom" onClick={() => setZoom(1)}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
      {!inDialog && (
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Tela cheia" onClick={() => setFullscreen(true)}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Exportar gráfico">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => exportSvgAsPng((inDialog ? dialogRef : inlineRef).current, name)}>
            <ImageIcon className="h-3.5 w-3.5 mr-2" /> Imagem (PNG)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!data?.length}
            onClick={() => data && exportToCSV(data, name)}
          >
            <FileText className="h-3.5 w-3.5 mr-2" /> Dados (CSV)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!data?.length}
            onClick={() => data && exportToXLSX(data, name)}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Dados (Excel)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {actions}
    </div>
  );

  return (
    <>
      {bare ? (
        <div className={className}>
          <div className="flex items-center justify-between gap-2 pb-2">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            {toolbar(false)}
          </div>
          <div className="overflow-x-auto" ref={inlineRef}>
            <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
              {children}
            </div>
          </div>
        </div>
      ) : (
        <Card className={className}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm">{title}</CardTitle>
            {toolbar(false)}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto" ref={inlineRef}>
              <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }}>
                {children}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-[95vw] w-[95vw]">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 pr-8 space-y-0">
            <DialogTitle className="text-base">{title}</DialogTitle>
            {toolbar(true)}
          </DialogHeader>
          <div className="overflow-x-auto" ref={dialogRef}>
            <div style={{ width: `${zoom * 100}%`, minWidth: "100%" }} className="[&_.recharts-wrapper]:!h-[65vh] [&>div]:!h-[65vh]">
              {children}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
