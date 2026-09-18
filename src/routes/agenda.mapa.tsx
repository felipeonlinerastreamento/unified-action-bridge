import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Users, Wrench, MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

export const Route = createFileRoute("/agenda/mapa")({
  component: AgendaMapa
});

function AgendaMapa() {
  return (
    <div className="h-full min-h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-4 p-4 md:p-6 bg-background">
      <Card className="w-full md:w-80 flex flex-col h-full shrink-0 shadow-sm">
        <CardHeader>
          <CardTitle>Filtros do Mapa</CardTitle>
          <CardDescription>Busque serviços e técnicos na região</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 flex-1">
          <div className="space-y-2">
            <Label>Localizar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cliente, OS, endereço..." className="pl-9" />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Técnico em Campo</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Todos os técnicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os técnicos</SelectItem>
                <SelectItem value="tecnicoA">Equipe de Instalação A</SelectItem>
                <SelectItem value="tecnicoB">Equipe de Manutenção B</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Serviço</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Todas as categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                <SelectItem value="instalacao">Nova Instalação</SelectItem>
                <SelectItem value="manutencao">Manutenção Corretiva</SelectItem>
                <SelectItem value="retirada">Retirada Equipamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-2">Aplicar Filtros</Button>

          <div className="mt-4 border-t pt-4 pb-2 flex-1 flex flex-col">
            <h4 className="text-sm font-semibold mb-3">Destaques na Região (Exemplos)</h4>
            <ScrollArea className="h-[200px] w-full flex-1 pr-3">
              <div className="space-y-3">
                <div className="p-3 border rounded-md text-sm bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="font-medium flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-orange-500"/> 
                    OS 10923
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs truncate">
                    Av. Raja Gabaglia, 2000 - Estoril
                  </div>
                  <div className="mt-2 font-medium text-xs text-orange-600">
                    Atrasado - Manutenção
                  </div>
                </div>
                
                <div className="p-3 border rounded-md text-sm bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="font-medium flex items-center gap-2 text-primary">
                    <Users className="w-4 h-4"/> 
                    Técnico Anderson
                  </div>
                  <div className="text-muted-foreground mt-1 text-xs">
                    Última att. há 5 min
                  </div>
                  <div className="mt-2 font-medium text-xs text-green-600">
                    Status: Em deslocamento
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 bg-muted/40 border border-dashed rounded-xl overflow-hidden relative flex flex-col items-center justify-center text-muted-foreground min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center">
          <MapPin className="w-16 h-16 mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-semibold mb-2">Área do Mapa</h3>
          <p className="max-w-md text-center text-sm px-4">
            Interface preparada para exibição da localização georreferenciada de técnicos e pontos de serviço em tempo real.
            <br/><br/>
            Esta visão receberá integração futura com o provedor de mapas.
          </p>
        </div>
      </div>
    </div>
  );
}
