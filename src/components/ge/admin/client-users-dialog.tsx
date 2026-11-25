import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { createClientUser, listClientUsers, updateUserPassword } from "@/lib/ge/users.functions";

type Role = "admin_client" | "operator";

export function ClientUsersDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listClientUsers);
  const createUser = useServerFn(createClientUser);
  const updatePasswordFn = useServerFn(updateUserPassword);

  const queryKey = ["client-users", clientId];
  const { data: users, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchUsers({ data: { clientId } }),
    enabled: open,
  });

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [submitting, setSubmitting] = useState(false);

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createUser({
        data: { email, fullName, password: newPassword, role, clientId, groupId: null },
      });
      toast.success("Usuário criado");
      setEmail(""); setFullName(""); setNewPassword(""); setRole("operator");
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar usuário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingId) return;
    setSavingReset(true);
    try {
      await updatePasswordFn({ data: { targetUserId: resettingId, password: resetPwValue } });
      toast.success("Senha atualizada");
      setResettingId(null);
      setResetPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar senha");
    } finally {
      setSavingReset(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Usuários — {clientName}</DialogTitle>
          <DialogDescription>
            Crie acessos vinculados a este cliente e envie redefinição de senha quando precisar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 rounded border bg-muted/30 p-3 text-sm">
          <div className="space-y-1">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Senha inicial</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </div>
          <div className="space-y-1">
            <Label>Papel</Label>
            <select
              className="h-9 w-full rounded border bg-background px-2"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="operator">Operador</option>
              <option value="admin_client">Admin do cliente</option>
            </select>
          </div>
          <div className="col-span-2">
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Criando..." : "Adicionar usuário"}
            </Button>
          </div>
        </form>

        <div className="rounded border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : (users ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum usuário ainda</TableCell></TableRow>
              ) : (users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{u.email}</TableCell>
                  <TableCell className="text-xs">{u.roles.join(", ") || "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => { setResettingId(u.id); setResetPwValue(""); }}>
                      Reset senha
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
