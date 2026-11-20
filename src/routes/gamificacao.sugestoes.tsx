import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp } from "lucide-react";
import { useMyUserId, fmtDate } from "@/components/gamificacao/gamif-data";

export const Route = createFileRoute("/gamificacao/sugestoes")({
  head: () => ({ meta: [{ title: "Sugestões | Gamificação" }, { name: "description", content: "Envie sugestões e vote nas ideias da equipe." }, { property: "og:title", content: "Sugestões | Gamificação" }, { property: "og:description", content: "Ideias e votos da equipe." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SugestoesPage,
});

function SugestoesPage() {
  const qc = useQueryClient();
  const { data: me } = useMyUserId();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const { data: list = [] } = useQuery({ queryKey: ["gamif-suggestions"], queryFn: async () => (await supabase.from("gamif_suggestions").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: votes = [] } = useQuery({ queryKey: ["gamif-votes"], queryFn: async () => (await supabase.from("gamif_suggestion_votes").select("suggestion_id,user_id")).data ?? [] });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["gamif-suggestions"] }); qc.invalidateQueries({ queryKey: ["gamif-votes"] }); };

  const send = async () => {
    if (!me || title.trim().length < 3) return toast.error("Informe um título.");
    const { error } = await supabase.from("gamif_suggestions").insert({ user_id: me, title: title.trim(), description: desc.trim() || null });
    if (error) return toast.error(error.message);
    setTitle(""); setDesc(""); toast.success("Sugestão enviada"); refresh();
  };
  const toggleVote = async (id: string, voted: boolean) => {
    if (!me) return;
    const q = voted ? supabase.from("gamif_suggestion_votes").delete().eq("suggestion_id", id).eq("user_id", me) : supabase.from("gamif_suggestion_votes").insert({ suggestion_id: id, user_id: me });
    const { error } = await q;
    if (error) toast.error(error.message); else refresh();
  };

  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">Nova sugestão</CardTitle></CardHeader>
        <CardContent className="space-y-2"><Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} /><Textarea placeholder="Descreva a ideia" value={desc} onChange={(e) => setDesc(e.target.value)} /><Button onClick={send}>Enviar</Button></CardContent>
      </Card>
      {list.map((s) => {
        const n = votes.filter((v) => v.suggestion_id === s.id).length;
        const voted = votes.some((v) => v.suggestion_id === s.id && v.user_id === me);
        return (
          <Card key={s.id}><CardContent className="pt-4 text-sm space-y-1">
            <div className="flex justify-between gap-2"><b>{s.title}</b><Badge variant="outline">{s.status}</Badge></div>
            {s.description && <p className="text-muted-foreground">{s.description}</p>}
            {s.admin_response && <p className="border-l-2 pl-2">Resposta: {s.admin_response}</p>}
            <div className="flex items-center justify-between"><span className="text-muted-foreground">{fmtDate(s.created_at)}</span><Button size="sm" variant={voted ? "default" : "outline"} onClick={() => toggleVote(s.id, voted)}><ThumbsUp className="h-3 w-3 mr-1" />{n}</Button></div>
          </CardContent></Card>
        );
      })}
    </div>
  );
}
