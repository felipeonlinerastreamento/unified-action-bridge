import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { QuickRepliesManager } from "@/components/quick-replies/quick-replies-manager";

export function ZapiQuickRepliesConfig() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Respostas Rápidas</CardTitle>
        <CardDescription>Templates acessíveis via botão ⚡ ou digitando "/" no campo de mensagem.</CardDescription>
      </CardHeader>
      <CardContent>
        <QuickRepliesManager />
      </CardContent>
    </Card>
  );
}
