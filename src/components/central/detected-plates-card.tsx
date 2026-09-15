import React from "react";
import { Badge } from "@/components/ui/badge";
import { Car } from "lucide-react";

interface DetectedPlatesCardProps {
  plates: string[];
  selectedPlate?: string;
  onSelectPlate?: (plate: string) => void;
}

export function DetectedPlatesCard({
  plates,
  selectedPlate,
  onSelectPlate,
}: DetectedPlatesCardProps) {
  if (!plates || plates.length === 0) return null;

  return (
    <div className="p-3 border rounded-md bg-muted/20 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Car className="h-3.5 w-3.5 text-primary" />
        <span>Placas detectadas no chat:</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plates.map((plate) => (
          <Badge
            key={plate}
            variant={selectedPlate === plate ? "default" : "outline"}
            className="cursor-pointer font-mono text-xs hover:bg-primary/20 transition-colors"
            onClick={() => onSelectPlate?.(plate)}
          >
            {plate}
          </Badge>
        ))}
      </div>
    </div>
  );
}
