import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, Download, FileSpreadsheet, FileText, Filter } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  period: string;
  onPeriodChange: (v: string) => void;
  onExport: (format: "csv" | "xlsx" | "pdf") => void;
  extraFilters?: React.ReactNode;
  plate?: string;
  onPlateChange?: (v: string) => void;
};

export function ReportFilters({
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  period, onPeriodChange, onExport, extraFilters,
  plate, onPlateChange,
}: Props) {
  const applyPeriod = (p: string) => {
    onPeriodChange(p);
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (p === "7d") {
      const from = new Date(now); from.setDate(from.getDate() - 7);
      onDateFromChange(fmt(from)); onDateToChange(fmt(now));
    } else if (p === "30d") {
      const from = new Date(now); from.setDate(from.getDate() - 30);
      onDateFromChange(fmt(from)); onDateToChange(fmt(now));
    } else if (p === "90d") {
      const from = new Date(now); from.setDate(from.getDate() - 90);
      onDateFromChange(fmt(from)); onDateToChange(fmt(now));
    } else if (p === "year") {
      onDateFromChange(`${now.getFullYear()}-01-01`); onDateToChange(fmt(now));
    }
  };

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Filtros</span>
      </div>
      <div>
        <Label className="text-xs">Período</Label>
        <Select value={period} onValueChange={applyPeriod}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">De</Label>
        <Input type="date" value={dateFrom} onChange={(e) => { onDateFromChange(e.target.value); onPeriodChange("custom"); }} className="h-8 text-xs w-[140px]" />
      </div>
      <div>
        <Label className="text-xs">Até</Label>
        <Input type="date" value={dateTo} onChange={(e) => { onDateToChange(e.target.value); onPeriodChange("custom"); }} className="h-8 text-xs w-[140px]" />
      </div>
      {onPlateChange && (
        <div>
          <Label className="text-xs">Placa</Label>
          <div className="relative">
            <Input
              value={plate ?? ""}
              onChange={(e) => onPlateChange(e.target.value.toUpperCase().replace(/\s|-/g, ""))}
              placeholder="ABC1D23"
              className="h-8 text-xs w-[140px] pr-7"
              maxLength={8}
            />
            {plate && (
              <button
                type="button"
                onClick={() => onPlateChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs px-1"
                aria-label="Limpar placa"
              >×</button>
            )}
          </div>
        </div>
      )}
      {extraFilters}
      <div className="ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("csv")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("xlsx")}>
              <FileSpreadsheet className="h-3.5 w-3.5 mr-2" /> Excel (XLSX)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("pdf")}>
              <FileText className="h-3.5 w-3.5 mr-2" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
