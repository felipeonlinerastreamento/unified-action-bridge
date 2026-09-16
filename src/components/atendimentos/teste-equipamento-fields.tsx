import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench } from "lucide-react";
import {
  TesteEquipamentoData,
  TesteEquipamentoSettings,
} from "@/hooks/use-teste-equipamento-settings";
import { useLiberacaoCatalog } from "@/hooks/use-liberacao-equipamento";

interface Props {
  value: TesteEquipamentoData;
  onChange: (next: TesteEquipamentoData) => void;
  settings?: TesteEquipamentoSettings | null;
}

export function TesteEquipamentoFields({ value, onChange, settings }: Props) {
  const reqSub = settings?.require_subtipo ?? true;
  const reqMotivo = settings?.require_motivo_when_cobrar ?? true;
  const reqGar = settings?.require_garantia ?? true;

  // Catálogo de itens de Liberação de Equipamento (mesma fonte da configuração).
  // Só carrega quando o subtipo é Manutenção, para não buscar à toa.
  const { data: equipCatalog = [], isLoading: equipLoading } = useLiberacaoCatalog(
    value.subtipo === "Manutenção",
  );

  const set = (patch: Partial<TesteEquipamentoData>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wrench className="h-4 w-4 text-primary" />
        Teste de Equipamento
      </div>

      <div className="space-y-1">
        <Label className="text-xs">
          Subtipo {reqSub && <span className="text-destructive">*</span>}
        </Label>
        <Select
          value={value.subtipo}
          onValueChange={(v) =>
            set({
              subtipo: v as TesteEquipamentoData["subtipo"],
              ...(v !== "Manutenção"
                ? { necessario_cobrar: "", motivo: "", garantia: "", equipamento: "" }
                : {}),
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Instalação">Instalação</SelectItem>
            <SelectItem value="Retirada">Retirada</SelectItem>
            <SelectItem value="Manutenção">Manutenção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.subtipo === "Manutenção" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Equipamento</Label>
            <Select
              value={value.equipamento || ""}
              onValueChange={(v) => set({ equipamento: v })}
            >
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={equipLoading ? "Carregando..." : "Selecione o equipamento..."}
                />
              </SelectTrigger>
              <SelectContent>
                {equipCatalog.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Nenhum item cadastrado em Configurações → Liberação de Equipamento.
                  </div>
                ) : (
                  equipCatalog.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                Necessário cobrar <span className="text-destructive">*</span>
              </Label>
              <Select
                value={value.necessario_cobrar}
                onValueChange={(v) =>
                  set({
                    necessario_cobrar: v as TesteEquipamentoData["necessario_cobrar"],
                    ...(v !== "Sim" ? { motivo: "" } : {}),
                  })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Garantia {reqGar && <span className="text-destructive">*</span>}
              </Label>
              <Select
                value={value.garantia}
                onValueChange={(v) =>
                  set({ garantia: v as TesteEquipamentoData["garantia"] })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sim">Sim</SelectItem>
                  <SelectItem value="Não">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {value.necessario_cobrar === "Sim" && (
            <div className="space-y-1">
              <Label className="text-xs">
                Motivo da cobrança {reqMotivo && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                value={value.motivo}
                onChange={(e) => set({ motivo: e.target.value })}
                placeholder="Descreva o motivo da cobrança..."
                className="min-h-[60px]"
              />
            </div>
          )}
        </>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="te-pagar-tecnico"
          checked={value.pagar_tecnico}
          onCheckedChange={(checked) => set({ pagar_tecnico: checked === true })}
        />
        <Label htmlFor="te-pagar-tecnico" className="text-xs cursor-pointer">
          Pagar técnico
        </Label>
      </div>
    </div>
  );
}
