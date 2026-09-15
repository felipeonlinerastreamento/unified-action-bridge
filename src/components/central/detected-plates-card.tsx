import React from "react";
import { Badge } from "@/components/ui/badge";

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
  );
}
