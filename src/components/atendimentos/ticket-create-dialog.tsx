import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TicketCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function TicketCreateDialog({ open, onClose, onCreated }: TicketCreateDialogProps) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("media");
  const [category, setCategory] = useState("");
  const [sector, setSector] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!contactName.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    setLoading(true);
    const attendanceId = `MANUAL-${Date.now()}`;
    const { error } = await supabase.from("service_tickets").insert({
      attendance_id: attendanceId,
      contact_name: contactName,
      contact_phone: contactPhone || null,
      plate: plate || null,
      notes: notes || null,
      priority: priority as any,
      category: category || null,
      sector: sector || null,
      status: "aberto",
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar ticket");
      return;
    }
    toast.success("Ticket criado com sucesso");
    setContactName("");
    setContactPhone("");
    setPlate("");
    setNotes("");
    setPriority("media");
    setCategory("");
    setSector("");
    onCreated();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Ticket</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nome do Contato *</label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nome" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Telefone</label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Placa</label>
              <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC-1234" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Prioridade</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Setor</label>
              <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Setor" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Categoria</label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Categoria" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Observações</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes do atendimento..." />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar Ticket"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
