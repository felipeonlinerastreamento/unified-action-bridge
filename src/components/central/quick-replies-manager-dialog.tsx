import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QuickRepliesManager } from "@/components/quick-replies/quick-replies-manager";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickRepliesManagerDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar respostas rápidas</DialogTitle>
          <DialogDescription>
            Crie, edite ou remova templates. Marque "Compartilhar com a equipe" para deixá-los disponíveis para todos.
          </DialogDescription>
        </DialogHeader>
        <QuickRepliesManager />
      </DialogContent>
    </Dialog>
  );
}
