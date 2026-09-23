import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  statusLabel: string;
  identifier: string;
  title: string;
  client: string;
  technician: string;
  time: string;
  address: string;
  activity: any;
};

interface Props {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpenDetails: (activity: any) => void;
}

function pinIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${selected ? 30 : 24}px;height:${selected ? 30 : 24}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);"></div>`,
    iconSize: [selected ? 30 : 24, selected ? 30 : 24],
    iconAnchor: [selected ? 15 : 12, selected ? 15 : 12],
    popupAnchor: [0, selected ? -16 : -13],
  });
}

/** Evita que dois pontos no mesmo endereço fiquem sobrepostos. */
function spread(points: MapPoint[]): MapPoint[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0) return p;
    const angle = (n * 2 * Math.PI) / 8;
    const r = 0.00022 * (1 + Math.floor(n / 8));
    return { ...p, lat: p.lat + r * Math.cos(angle), lng: p.lng + r * Math.sin(angle) };
  });
}

function FitBounds({ points, selectedId }: { points: MapPoint[]; selectedId: string | null }) {
  const map = useMap();
  const signature = points.map((p) => p.id).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const target = points.find((p) => p.id === selectedId);
    if (target) map.setView([target.lat, target.lng], Math.max(map.getZoom(), 15), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return null;
}

export default function MapaLeaflet({ points, selectedId, onSelect, onOpenDetails }: Props) {
  const spreadPoints = useMemo(() => spread(points), [points]);
  const markerRefs = useRef<Record<string, L.Marker | null>>({});

  useEffect(() => {
    if (selectedId && markerRefs.current[selectedId]) markerRefs.current[selectedId]?.openPopup();
  }, [selectedId]);

  return (
    <MapContainer
      center={[-19.9167, -43.9345]}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={spreadPoints} selectedId={selectedId} />
      {spreadPoints.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={pinIcon(p.color, p.id === selectedId)}
          ref={(ref) => {
            markerRefs.current[p.id] = ref;
          }}
          eventHandlers={{ click: () => onSelect(p.id) }}
        >
          <Popup>
            <div className="space-y-1 text-xs min-w-[200px]">
              <div className="font-semibold text-sm">
                {p.identifier !== "—" ? `OS ${p.identifier}` : p.title}
              </div>
              <div>{p.title}</div>
              <div><span className="opacity-70">Cliente:</span> {p.client}</div>
              <div><span className="opacity-70">Técnico:</span> {p.technician}</div>
              <div><span className="opacity-70">Horário:</span> {p.time}</div>
              <div><span className="opacity-70">Status:</span> {p.statusLabel}</div>
              <div className="opacity-70">{p.address}</div>
              <Button size="sm" className="w-full mt-2" onClick={() => onOpenDetails(p.activity)}>
                Ver detalhes da OS
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
