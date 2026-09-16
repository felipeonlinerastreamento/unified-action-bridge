import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Bot, Plus, Pencil, Info } from "lucide-react";
import { toast } from "sonner";

// PARTE 1: tela do Robô de Atendimento apenas com estado local.
// A persistência (tabelas bot_auto_reply_settings/rules/log com RLS e GRANT)
// entra numa próxima etapa, depois que o banco puder ser lido — assim não
// escrevemos consultas com nomes de coluna adivinhados.

type Rule = {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string;
  reply_text: string;
  required_fields: string;
  target_sector: string;
  from_catalog: boolean;
};

const SAUDACAO_TEXT = "Olá,\nFala com {{operatorName}},\n\nEm que posso ajudar?";

const CATALOG: Array<Omit<Rule, "id" | "enabled">> = [
  {
    name: "Relatório de posições",
    keywords: "relatório, relatorio, posições, posicoes, histórico, historico",
    reply_text: "Claro! Para gerar o relatório de posições, me informe a placa e o período desejado (data inicial e final).",
    required_fields: "placa, período",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Rastreamento / localização do veículo",
    keywords: "rastreamento, localização, localizacao, onde está, onde esta, localizar",
    reply_text: "Vou verificar a localização. Me informe a placa do veículo, por favor.",
    required_fields: "placa",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Equipamento sem comunicação",
    keywords: "sem comunicação, sem comunicacao, sem sinal, offline, não comunica, nao comunica",
    reply_text: "Entendi, vamos verificar o equipamento. Me informe a placa do veículo, por favor.",
    required_fields: "placa",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Instalação / agendamento",
    keywords: "instalação, instalacao, agendar, agendamento, instalar",
    reply_text: "Perfeito! Para agendar a instalação, me informe a cidade e o período desejado.",
    required_fields: "cidade, período desejado",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Financeiro / 2ª via de boleto",
    keywords: "boleto, financeiro, 2ª via, segunda via, fatura, pagamento",
    reply_text: "Vou te ajudar com o financeiro. Me informe o CNPJ ou a razão social do cadastro, por favor.",
    required_fields: "CNPJ ou razão social",
    target_sector: "Financeiro",
    from_catalog: true,
  },
  {
    name: "Suporte ao app / senha",
    keywords: "app, aplicativo, senha, login, acesso, entrar",
    reply_text: "Vou te ajudar com o acesso ao app. Me informe o e-mail ou o usuário cadastrado, por favor.",
    required_fields: "e-mail ou usuário",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Bloqueio / desbloqueio de veículo",
    keywords: "bloqueio, desbloqueio, bloquear, desbloquear",
    reply_text: "Certo! Para bloqueio ou desbloqueio, me informe a placa do veículo, por favor.",
    required_fields: "placa",
    target_sector: "Atendimento",
    from_catalog: true,
  },
  {
    name: "Saudação sem assunto",
    keywords: "oi, olá, ola, bom dia, boa tarde, boa noite, preciso de ajuda",
    reply_text: SAUDACAO_TEXT,
    required_fields: "",
    target_sector: "Atendimento",
    from_catalog: true,
  },
];

const EMPTY_RULE: Omit<Rule, "id"> = {
  name: "",
  enabled: true,
  keywords: "",
  reply_text: "",
  required_fields: "",
  target_sector: "Atendimento",
  from_catalog: false,
};

let idSeq = 0;
const nextId = () => `local-${Date.now()}-${idSeq++}`;

export function BotAutoReplyConfig() {
  const [enabled, setEnabled] = useState(true);
  const [greetingSeconds, setGreetingSeconds] = useState(10);
  const [followUpMinutes, setFollowUpMinutes] = useState(10);
  const [startHour, setStartHour] = useState("08:00");
  const [endHour, setEndHour] = useState("18:00");

  const [rules, setRules] = useState<Rule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState<Omit<Rule, "id">>(EMPTY_RULE);

  const catalogEnabledNames = new Set(rules.filter((r) => r.from_catalog).map((r) => r.name));

  const enableFromCatalog = (entry: Omit<Rule, "id" | "enabled">) => {
    setRules((prev) => [...prev, { ...entry, id: nextId(), enabled: true }]);
    toast.success(`Automação "${entry.name}" habilitada`);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_RULE);
    setDialogOpen(true);
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      name: r.name,
      enabled: r.enabled,
      keywords: r.keywords,
      reply_text: r.reply_text,
      required_fields: r.required_fields,
      target_sector: r.target_sector,
      from_catalog: r.from_catalog,
    });
    setDialogOpen(true);
  };

  const saveRule = () => {
    if (!form.name.trim() || !form.reply_text.trim()) {
      toast.error("Preencha nome e texto de resposta");
      return;
    }
    if (editing) {
      setRules((prev) => prev.map((r) => (r.id === editing.id ? { ...editing, ...form } : r)));
      toast.success("Automação atualizada");
    } else {
      setRules((prev) => [...prev, { ...form, id: nextId() }]);
      toast.success("Automação criada");
    }
    setDialogOpen(false);
  };

  const toggleRule = (id: string, v: boolean) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: v } : r)));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Esta é a primeira parte do Robô de Atendimento. Por enquanto as configurações ficam apenas
          nesta tela (ainda não são salvas), porque as tabelas do banco serão criadas numa próxima
          etapa. Depois disso a tela passa a persistir tudo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" /> Robô de Atendimento
          </CardTitle>
          <CardDescription>
            Recebe a conversa antes do operador, responde saudações e coleta os dados que faltam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Robô ativo</Label>
              <p className="text-sm text-muted-foreground">Liga ou desliga o atendimento automático.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Espera da saudação (segundos)</Label>
              <Input
                type="number"
                min={0}
                value={greetingSeconds}
                onChange={(e) => setGreetingSeconds(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label>Segunda cobrança (minutos)</Label>
              <Input
                type="number"
                min={0}
                value={followUpMinutes}
                onChange={(e) => setFollowUpMinutes(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label>Início do horário de atuação</Label>
              <Input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do horário de atuação</Label>
              <Input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de sugestões prontas</CardTitle>
          <CardDescription>
            Habilite com um clique. Cada uma já vem com texto e os dados que o robô deve pedir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATALOG.map((entry) => {
              const alreadyEnabled = catalogEnabledNames.has(entry.name);
              return (
                <div
                  key={entry.name}
                  className="flex flex-col gap-2 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{entry.name}</span>
                    <Button
                      size="sm"
                      variant={alreadyEnabled ? "secondary" : "default"}
                      disabled={alreadyEnabled}
                      onClick={() => enableFromCatalog(entry)}
                    >
                      {alreadyEnabled ? "Habilitada" : "Habilitar"}
                    </Button>
                  </div>
                  {entry.required_fields ? (
                    <div className="flex flex-wrap gap-1">
                      {entry.required_fields.split(",").map((f) => (
                        <Badge key={f.trim()} variant="outline">
                          {f.trim()}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem dados obrigatórios</span>
                  )}
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{entry.reply_text}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Automações ativas</CardTitle>
            <CardDescription>
              Automações habilitadas ou criadas manualmente. Edite nome, palavras-chave, texto,
              dados obrigatórios e fila de destino.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Criar automação
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma automação ativa. Habilite uma do catálogo acima ou crie uma nova.
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary">{r.target_sector}</Badge>
                      {r.from_catalog && <Badge variant="outline">catálogo</Badge>}
                    </div>
                    {r.keywords && (
                      <p className="truncate text-xs text-muted-foreground">
                        Palavras-chave: {r.keywords}
                      </p>
                    )}
                    <p className="whitespace-pre-line text-sm text-muted-foreground">{r.reply_text}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={r.enabled} onCheckedChange={(v) => toggleRule(r.id, v)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar automação" : "Nova automação"}</DialogTitle>
            <DialogDescription>
              Defina como o robô reconhece e responde este assunto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Palavras-chave (separadas por vírgula)</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Texto de resposta</Label>
              <Textarea
                rows={4}
                value={form.reply_text}
                onChange={(e) => setForm({ ...form, reply_text: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: <code>{"{{operatorName}}"}</code>, <code>{"{{contactName}}"}</code>.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Dados obrigatórios (separados por vírgula)</Label>
              <Input
                value={form.required_fields}
                onChange={(e) => setForm({ ...form, required_fields: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fila de destino</Label>
              <Input
                value={form.target_sector}
                onChange={(e) => setForm({ ...form, target_sector: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveRule}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
