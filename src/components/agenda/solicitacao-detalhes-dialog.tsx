import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, RotateCcw, Send, X, Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  aprovarSolicitacao,
  cancelarSolicitacao,
  comentarSolicitacao,
  obterSolicitacao,
  recriarSolicitacao,
  recusarSolicitacao,
} from "@/lib/seu-instalador.functions";
import { asList, errorMessage, formatDateTime, pick, saoPauloParts } from "./shared";

interface Props {
  request: any | null;
  technicians: any[];
  onClose: () => void;
  onChanged: () => void;
}

type Mode = null | "approve" | "reject" | "cancel" | "recreate";

export function SolicitacaoDetalhesDialog({ request, technicians, onClose, onChanged }: Props) {
  const load = useServerFn(obterSolicitacao);
  const approve = useServerFn(aprovarSolicitacao);
  const reject = useServerFn(recusarSolicitacao);
  const cancel = useServerFn(cancelarSolicitacao);
  const recreate = useServerFn(recriarSolicitacao);
  const comment = useServerFn(comentarSolicitacao);

  const requestId = request?.id ? String(request.id) : "";
  const detailQuery = useQuery({
    queryKey: ["si-request", requestId],
    enabled: !!requestId,
    queryFn: () => load({ data: { requestId } }),
  });
  const r: any = (detailQuery.data as any)?.data ?? request ?? {};
  const comments = useMemo(() => asList(r?.comments), [r]);

  const [mode, setMode] = useState<Mode>(null);
  const initial = saoPauloParts(r?.desiredAt);
  const [techId, setTechId] = useState("");
  const [date, setDate] = useState(initial?.date ?? "");
  const [time, setTime] = useState(initial?.time ?? "09:00");
  const [text, setText] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  const status = String(r?.status ?? "");
  const pending = status === "pendente";

  async function run(fn: (key: string) => Promise<any>, ok: string, close = true) {
    setBusy(true);
    try {
      await fn(crypto.randomUUID());
      toast.success(ok);
      onChanged();
      detailQuery.refetch();
      setMode(null);
      setText("");
      if (close) onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    const at = date ? `${date}T${time}:00-03:00` : "";
    if (mode === "approve") {
      if (!techId || !at) return toast.error("Escolha o técnico, a data e o horário.");
      void run((k) => approve({ data: { idempotencyKey: k, requestId, technicianId: techId, scheduledAt: at } }), "Solicitação aprovada e OS criada.");
    } else if (mode === "reject") {
      if (!text.trim()) return toast.error("Informe o motivo.");
      void run((k) => reject({ data: { idempotencyKey: k, requestId, reason: text } }), "Solicitação recusada.");
    } else if (mode === "cancel") {
      void run((k) => cancel({ data: { idempotencyKey: k, requestId, reason: text || undefined } }), "Solicitação cancelada.");
    } else if (mode === "recreate") {
      if (!at || !text.trim()) return toast.error("Informe a nova data e uma observação.");
      void run((k) => recreate({ data: { idempotencyKey: k, requestId, desiredAt: at, note: text } }), "Solicitação recriada.");
    }
  }

  const rows: [string, string][] = [
    ["Cliente", r?.client?.name ?? "—"],
    ["Serviço", r?.serviceType?.name ?? "—"],
    ["Data desejada", formatDateTime(r?.desiredAt)],
    ["Duração", `${r?.durationMinutes ?? 60} min`],
    ["Endereço", r?.address || "—"],
    ["Identificador", r?.identifier || "—"],
    ["Contato", [r?.contact?.name, r?.contact?.phone, r?.contact?.email].filter(Boolean).join(" · ") || "—"],
    ["Descrição", r?.description || "—"],
    ["Criada em", formatDateTime(r?.createdAt)],
  ];
  if (r?.rejectionReason) rows.push(["Motivo da recusa", r.rejectionReason]);

  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Solicitação {r?.client?.name ? `· ${r.client.name}` : ""}
            {status && <Badge variant="secondary" className="capitalize">{status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {rows.map(([l, v]) => (
            <div key={l} className="grid grid-cols-3 gap-3 border-b border-border pb-2 text-sm last:border-b-0">
              <span className="text-muted-foreground">{l}</span>
              <span className="col-span-2 whitespace-pre-wrap">{v}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {pending && (
            <>
              <Button size="sm" onClick={() => setMode("approve")}><Check className="mr-2 h-4 w-4" />Aprovar</Button>
              <Button size="sm" variant="outline" onClick={() => setMode("reject")}><X className="mr-2 h-4 w-4" />Recusar</Button>
            </>
          )}
          {status !== "cancelada" && (
            <Button size="sm" variant="outline" onClick={() => setMode("cancel")}><Ban className="mr-2 h-4 w-4" />Cancelar</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setMode("recreate")}><RotateCcw className="mr-2 h-4 w-4" />Recriar</Button>
        </div>

        {mode && (
          <div className="space-y-3 rounded-md border border-border p-3">
            {mode === "approve" && (
              <div className="space-y-1">
                <Label>Técnico</Label>
                <Select value={techId} onValueChange={setTechId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o técnico" /></SelectTrigger>
                  <SelectContent>
                    {technicians.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>{pick(t, ["name", "nome"], String(t.id))}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(mode === "approve" || mode === "recreate") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div className="space-y-1"><Label>Horário</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              </div>
            )}
            {mode !== "approve" && (
              <div className="space-y-1">
                <Label>{mode === "recreate" ? "Observação" : mode === "reject" ? "Motivo" : "Motivo (opcional)"}</Label>
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setMode(null)}>Voltar</Button>
              <Button size="sm" disabled={busy} onClick={confirm}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Comentários</p>
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum comentário.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c: any, i: number) => (
                <li key={c.id || i} className="rounded-md border border-border p-2 text-sm">
                  <p className="whitespace-pre-wrap">{pick(c, ["content", "text", "message"], "")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {pick(c, ["authorName", "userName", "author"], "")} {formatDateTime(c.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input placeholder="Escreva um comentário..." value={newComment} maxLength={2000} onChange={(e) => setNewComment(e.target.value)} />
            <Button
              size="icon"
              disabled={busy || !newComment.trim()}
              onClick={() =>
                void run((k) => comment({ data: { idempotencyKey: k, requestId, content: newComment } }), "Comentário enviado.", false).then(() => setNewComment(""))
              }
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
