import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FileSpreadsheet, ExternalLink, Pencil, Trash2, Plus, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createChatControleSheet,
  upsertChatControleLink,
  deleteChatControleLink,
  logChatControleOpen,
} from "@/lib/chat-controle.functions";

interface ContactInfo {
  name?: string | null;
  phone?: string | null;
  protocol?: string | null;
  companyName?: string | null;
}

interface Props {
  chatId?: string | null | undefined;
  ticketId?: string | null | undefined;
  contactInfo?: ContactInfo;
}

interface ControleLink {
  id: string;
  chat_id: string | null;
  ticket_id?: string | null;
  url: string;
  label: string | null;
  updated_at: string;
}

const ALLOWED_HOSTS = [
  "office.com", "sharepoint.com", "onedrive.live.com", "1drv.ms", "live.com",
  "docs.google.com", "google.com",
];

function isLikelyExcelOnline(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

export function ChatControleTab({ chatId, ticketId, contactInfo }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ControleLink | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");

  const createSheetFn = useServerFn(createChatControleSheet);
  const upsertLinkFn = useServerFn(upsertChatControleLink);
  const deleteLinkFn = useServerFn(deleteChatControleLink);
  const logOpenFn = useServerFn(logChatControleOpen);

  const targetKey = chatId ? `chat:${chatId}` : ticketId ? `ticket:${ticketId}` : null;

  const { data: link, isLoading } = useQuery({
    queryKey: ["chat-controle-link", targetKey],
    queryFn: async () => {
      if (!targetKey) return null;
      const col = chatId ? "chat_id" : "ticket_id";
      const val = (chatId ?? ticketId)!;
      const { data, error } = await supabase
        .from("chat_controle_links" as any)
        .select("*")
        .eq(col, val)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as ControleLink) || null;
    },
    enabled: !!targetKey,
  });

  const createSheetMut = useMutation({
    mutationFn: async () => {
      if (!targetKey) throw new Error("Atendimento não selecionado");
      return await createSheetFn({
        data: {
          chatId: chatId ?? null,
          ticketId: ticketId ?? null,
          contactName: contactInfo?.name ?? null,
          contactPhone: contactInfo?.phone ?? null,
          protocol: contactInfo?.protocol ?? null,
          companyName: contactInfo?.companyName ?? null,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Planilha criada e compartilhada");
      qc.invalidateQueries({ queryKey: ["chat-controle-link", targetKey] });
      window.open(res.url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao criar planilha"),
  });

  const saveMut = useMutation({
    mutationFn: async (vars: { url: string; label: string }) => {
      if (!targetKey) throw new Error("Atendimento não selecionado");
      return await upsertLinkFn({
        data: {
          id: editing?.id,
          chatId: chatId ?? null,
          ticketId: ticketId ?? null,
          url: vars.url,
          label: vars.label || null,
        },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Link atualizado" : "Planilha adicionada");
      qc.invalidateQueries({ queryKey: ["chat-controle-link", targetKey] });
      setDialogOpen(false);
      setEditing(null);
      setUrlInput("");
      setLabelInput("");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!link) return;
      await deleteLinkFn({ data: { id: link.id, chatId: link.chat_id ?? undefined } });
    },
    onSuccess: () => {
      toast.success("Planilha removida");
      qc.invalidateQueries({ queryKey: ["chat-controle-link", targetKey] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover"),
  });

  const openDialog = (existing: ControleLink | null) => {
    setEditing(existing);
    setUrlInput(existing?.url || "");
    setLabelInput(existing?.label || "");
    setDialogOpen(true);
  };

  const handleSave = () => {
    const url = urlInput.trim();
    if (!url) { toast.error("Informe a URL da planilha"); return; }
    if (!/^https:\/\//i.test(url)) { toast.error("A URL precisa começar com https://"); return; }
    saveMut.mutate({ url, label: labelInput.trim() });
  };

  const handleOpenSheet = () => {
    if (!link) return;
    // Fire-and-forget audit log
    logOpenFn({
      data: { id: link.id, chatId: link.chat_id ?? undefined, url: link.url, label: link.label },
    }).catch(() => {});
    window.open(link.url, "_blank", "noopener,noreferrer");
  };

  if (!targetKey) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Selecione um atendimento para gerenciar a planilha de controle.
      </div>
    );
  }

  const urlValid = !urlInput || isLikelyExcelOnline(urlInput.trim());

  return (
    <div className="p-3 space-y-3">
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Carregando…</div>
      ) : link ? (
        <div className="border rounded-md p-3 space-y-3 bg-card">
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {link.label || "Planilha de controle"}
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { e.preventDefault(); handleOpenSheet(); }}
                className="text-xs text-muted-foreground hover:text-primary truncate block"
                title={link.url}
              >
                {link.url}
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleOpenSheet}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir planilha
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog(link)} title="Editar">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (confirm("Remover a planilha deste atendimento?")) deleteMut.mutate(); }}
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border border-dashed rounded-md p-6 text-center space-y-3">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="text-sm text-muted-foreground">
            Nenhuma planilha de controle vinculada a este atendimento.
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              size="sm"
              onClick={() => createSheetMut.mutate()}
              disabled={createSheetMut.isPending}
            >
              {createSheetMut.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
              )}
              {createSheetMut.isPending ? "Criando…" : "Criar planilha"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog(null)}>
              <Plus className="h-4 w-4 mr-1.5" /> Adicionar link
            </Button>
          </div>
          <div className="text-[11px] text-muted-foreground">
            "Criar planilha" gera uma nova planilha Google na conta corporativa, com permissão de
            edição para quem tiver o link, e registra a ação na auditoria.
          </div>
        </div>
      )}


      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar planilha" : "Adicionar planilha"}</DialogTitle>
            <DialogDescription>
              Cole o link de compartilhamento da planilha (Google Sheets, Excel Online, OneDrive ou SharePoint) com permissão de edição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="controle-url">URL da planilha</Label>
              <Input
                id="controle-url"
                placeholder="https://docs.google.com/spreadsheets/... ou https://onedrive.live.com/..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              {!urlValid && (
                <div className="text-xs text-amber-600 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  A URL não parece ser de uma planilha online (Google Sheets, Office, SharePoint ou OneDrive). Pode continuar, mas confira o link.
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="controle-label">Rótulo (opcional)</Label>
              <Input
                id="controle-label"
                placeholder="Ex: Controle de instalação"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
