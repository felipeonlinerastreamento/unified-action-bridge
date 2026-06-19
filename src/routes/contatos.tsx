import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getClientes, getClienteContatos, getClienteEnderecos, getFaturas } from "@/lib/gsystem-api.functions";
import {
  Search,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileText,
  Building2,
  Eye,
  Wrench,
} from "lucide-react";
import { SubClientsAdmin } from "@/components/contatos/sub-clients-admin";
import { TechniciansAdmin } from "@/components/contatos/technicians-admin";

export const Route = createFileRoute("/contatos")({
  component: ContatosPage,
});

function ContatosPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // Fetch clients from GSystem API
  const { data: clientes = [], isLoading: clientesLoading, error: clientesError, refetch } = useQuery({
    queryKey: ["gsystem-clientes"],
    queryFn: async () => {
      const result = await getClientes({
        data: {},
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: isAuthenticated,
    retry: 1,
  });

  // Client contacts when detail open
  const { data: clientContatos = [], isLoading: contatosLoading } = useQuery({
    queryKey: ["gsystem-cliente-contatos", selectedClient?.Key || selectedClient?.key],
    queryFn: async () => {
      const key = selectedClient?.Key || selectedClient?.key;
      if (!key) return [];
      const result = await getClienteContatos({
        data: { clientKey: String(key) },
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: !!selectedClient && detailOpen,
    retry: 1,
  });

  // Client addresses when detail open
  const { data: clientEnderecos = [], isLoading: enderecosLoading } = useQuery({
    queryKey: ["gsystem-cliente-enderecos", selectedClient?.Key || selectedClient?.key],
    queryFn: async () => {
      const key = selectedClient?.Key || selectedClient?.key;
      if (!key) return [];
      const result = await getClienteEnderecos({
        data: { clientKey: String(key) },
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: !!selectedClient && detailOpen,
    retry: 1,
  });

  // Faturas for selected client
  const cpfCnpj = selectedClient?.CpfCnpj || selectedClient?.cpfCnpj || selectedClient?.CNPJ || selectedClient?.cnpj;
  const { data: faturas = [], isLoading: faturasLoading } = useQuery({
    queryKey: ["gsystem-faturas", cpfCnpj],
    queryFn: async () => {
      if (!cpfCnpj) return [];
      const result = await getFaturas({
        data: { cpfCnpj: String(cpfCnpj).replace(/\D/g, "") },
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: !!cpfCnpj && detailOpen,
    retry: 1,
  });

  if (isLoading || !isAuthenticated) return null;

  const hasSearch = search.trim().length > 0;
  const filtered = !hasSearch ? [] : clientes.filter((c: any) => {
    const s = search.toLowerCase();
    const nome = (c.Nome || c.nome || c.RazaoSocial || c.razaoSocial || "").toLowerCase();
    const cpf = (c.CpfCnpj || c.cpfCnpj || c.CNPJ || c.cnpj || "").toLowerCase();
    const fantasia = (c.NomeFantasia || c.nomeFantasia || "").toLowerCase();
    return nome.includes(s) || cpf.includes(s) || fantasia.includes(s);
  });

  const openDetail = (client: any) => {
    setSelectedClient(client);
    setDetailOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clientes / Contatos</h1>
          </div>
        </div>

        <Tabs defaultValue="clientes">
          <TabsList>
            <TabsTrigger value="clientes" className="gap-1">
              <Building2 className="h-4 w-4" /> Clientes GSystem
            </TabsTrigger>
            <TabsTrigger value="subclientes" className="gap-1">
              <Users className="h-4 w-4" /> Sub-clientes
            </TabsTrigger>
            <TabsTrigger value="tecnicos" className="gap-1">
              <Wrench className="h-4 w-4" /> Técnicos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {clientes.length} cliente(s) no GSystem
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={clientesLoading}>
                <RefreshCw className={`h-4 w-4 ${clientesLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ ou fantasia..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {clientesError ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-6 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Erro ao consultar clientes</p>
                    <p className="text-sm text-muted-foreground">{String(clientesError)}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome / Razão Social</TableHead>
                        <TableHead>Nome Fantasia</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-16">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : !hasSearch ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Use o campo de busca acima para consultar clientes.
                          </TableCell>
                        </TableRow>
                      ) : filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Nenhum cliente encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.slice(0, 100).map((client: any, i: number) => {
                          const nome = client.Nome || client.nome || client.RazaoSocial || client.razaoSocial || "—";
                          const fantasia = client.NomeFantasia || client.nomeFantasia || "—";
                          const cpf = client.CpfCnpj || client.cpfCnpj || client.CNPJ || client.cnpj || "—";
                          const status = client.Status || client.status;
                          const isActive = status === "Ativo" || status === 1 || status === "1" || status === true;
                          return (
                            <TableRow key={client.Key || client.key || client.Id || client.id || i}>
                              <TableCell className="font-medium">{nome}</TableCell>
                              <TableCell>{fantasia}</TableCell>
                              <TableCell className="font-mono text-sm">{cpf}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={isActive ? "default" : "secondary"}
                                  className={isActive
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-muted text-muted-foreground"}
                                >
                                  {isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => openDetail(client)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  {filtered.length > 100 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Exibindo 100 de {filtered.length} resultados. Use a busca para refinar.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="subclientes" className="mt-4">
            <SubClientsAdmin />
          </TabsContent>
        </Tabs>
      </div>

      {/* Client detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedClient?.Nome || selectedClient?.nome || selectedClient?.RazaoSocial || "Cliente"}
            </DialogTitle>
          </DialogHeader>

          {selectedClient && (
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">CPF/CNPJ</p>
                  <p className="font-mono">{selectedClient.CpfCnpj || selectedClient.cpfCnpj || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Nome Fantasia</p>
                  <p>{selectedClient.NomeFantasia || selectedClient.nomeFantasia || "—"}</p>
                </div>
              </div>

              <Separator />

              {/* Contacts */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" /> Contatos
                </h3>
                {contatosLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : clientContatos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {clientContatos.map((c: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded p-2 text-sm">
                        <p className="font-medium">
                          {c.Descricao || c.descricao || c.Tipo || c.tipo || "Contato"}
                        </p>
                        <p className="text-muted-foreground">
                          {c.Valor || c.valor || c.Telefone || c.telefone || c.Email || c.email || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Addresses */}
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4" /> Endereços
                </h3>
                {enderecosLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : clientEnderecos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {clientEnderecos.map((e: any, i: number) => (
                      <div key={i} className="bg-muted/50 rounded p-2 text-sm">
                        <p>
                          {[e.Logradouro || e.logradouro, e.Numero || e.numero, e.Bairro || e.bairro]
                            .filter(Boolean).join(", ")}
                        </p>
                        <p className="text-muted-foreground">
                          {[e.Cidade || e.cidade, e.UF || e.uf, e.CEP || e.cep]
                            .filter(Boolean).join(" - ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Faturas */}
              {cpfCnpj && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" /> Faturas
                  </h3>
                  {faturasLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : faturas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {faturas.slice(0, 10).map((f: any, i: number) => (
                        <div key={i} className="bg-muted/50 rounded p-2 text-sm flex justify-between">
                          <div>
                            <p className="font-medium">{f.Descricao || f.descricao || `Fatura ${i + 1}`}</p>
                            <p className="text-xs text-muted-foreground">
                              Venc: {f.DataVencimento || f.dataVencimento || "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {f.Valor != null ? `R$ ${Number(f.Valor || f.valor).toFixed(2)}` : "—"}
                            </p>
                            <Badge variant="outline" className="text-[10px]">
                              {f.Status || f.status || "—"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
