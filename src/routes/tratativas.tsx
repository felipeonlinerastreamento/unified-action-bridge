import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Pencil, Plus, Trash2, FileText } from "lucide-react";
import { TratativaFormDialog, type TratativaRow, type Categoria } from "@/components/tratativas/tratativa-form-dialog";
import { generateTratativaPDF } from "@/lib/tratativa-pdf";

export const Route = createFileRoute("/tratativas")({
  component: TratativasPage,
});

function TratativasPage() {
  const { isAuthenticated, isLoading: authLoading, hasRole } = useAuth();
  const qc = useQueryClient();
  const [categoria, setCategoria] = useState<Categoria>("telemetria");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TratativaRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["tratativas", categoria],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tratativas" as any)
        .select("*")
        .eq("categoria", categoria)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TratativaRow[];
    },
    enabled: isAuthenticated,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tratativas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tratativa removida");
      qc.invalidateQueries({ queryKey: ["tratativas"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const handleExport = async (t: TratativaRow) => {
    try {
      await generateTratativaPDF({
        categoria: t.categoria,
        numero_ocorrencia: t.numero_ocorrencia,
        situacao: t.situacao,
        cliente: t.cliente,
        identificador: t.identificador,
        imei: t.imei,
        tipo: t.tipo,
        responsavel_email: t.responsavel_email,
        data_tratativa: t.data_tratativa,
        primeiro_alarme: t.primeiro_alarme,
        ultimo_alarme: t.ultimo_alarme,
        motorista_nome: t.motorista_nome,
        motorista_situacao: t.motorista_situacao,
        motorista_observacoes: t.motorista_observacoes,
        alarmes: t.alarmes || [],
      });
      toast.success("PDF gerado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF");
    }
  };

  const canDelete = hasRole("admin") || hasRole("gestor");

  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6" /> Tratativas
            </h1>
            <p className="text-sm text-muted-foreground">
              Registro de ocorrências de Telemetria e Fadiga com exportação em PDF.
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova tratativa
          </Button>
        </div>

        <Tabs value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
          <TabsList>
            <TabsTrigger value="telemetria">Telemetria</TabsTrigger>
            <TabsTrigger value="fadiga">Fadiga</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Ocorrência</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhuma tratativa registrada nesta categoria.</TableCell></TableRow>
              ) : rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono">{t.numero_ocorrencia}</TableCell>
                  <TableCell>{t.cliente || "—"}</TableCell>
                  <TableCell>{t.identificador || "—"}</TableCell>
                  <TableCell>{t.tipo || "—"}</TableCell>
                  <TableCell>
                    {t.situacao ? <Badge variant="outline">{t.situacao}</Badge> : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{t.responsavel_email || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {t.data_tratativa
                      ? new Date(t.data_tratativa).toLocaleString("pt-BR")
                      : (t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "—")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" title="Exportar PDF" onClick={() => handleExport(t)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" title="Remover"
                          onClick={() => { if (confirm("Remover esta tratativa?")) deleteMut.mutate(t.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <TratativaFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categoria={categoria}
        editing={editing}
      />
    </AppLayout>
  );
}
