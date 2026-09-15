import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Coins, Target, RefreshCw, AlertTriangle, Info, Sparkles, TrendingUp, Award, ArrowUpRight } from "lucide-react";
import { getTopGamificOverview } from "@/lib/topgamific.functions";

export const Route = createFileRoute("/top-gamific")({
  head: () => ({
    meta: [
      { title: "Top Gamific | Resumo de engajamento" },
      {
        name: "description",
        content:
          "Resumo de engajamento, últimos lançamentos e desafios em aberto da plataforma de gamificação.",
      },
      { property: "og:title", content: "Top Gamific | Resumo de engajamento" },
      {
        property: "og:description",
        content:
          "Acompanhe seu engajamento, últimos lançamentos e desafios ativos da gamificação em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TopGamificPage,
});

function TopGamificPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <TopGamificContent />
    </AppLayout>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function TopGamificContent() {
  const fetchOverview = useServerFn(getTopGamificOverview);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["top-gamific-overview"],
    queryFn: () => fetchOverview({ data: undefined }),
    refetchInterval: 120000,
    staleTime: 60000,
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Top Gamific
          </h1>
          <p className="text-sm text-muted-foreground">
            Resumo do seu engajamento, lançamentos e desafios em aberto.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">Esta página é um resumo da sua participação</p>
          <p className="text-muted-foreground">
            Aqui você vê seus últimos lançamentos, saldo de moedas e desafios em aberto. O acesso
            completo — com ranking, histórico detalhado e configurações — fica no{" "}
            <a
              href="https://gamify-support-heroes.lovable.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground underline hover:text-primary"
            >
              portal Top Gamific
            </a>
            .
          </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Engajamento e progresso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O Top Gamific transforma suas conquistas diárias em reconhecimento. O objetivo é
            motivar, acompanhar o progresso e recompensar quem entrega cada vez melhor.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
            <li className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Visualize sua evolução de desempenho de forma transparente</span>
            </li>
            <li className="flex items-start gap-2">
              <Target className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <span>Complete desafios e metas para acelerar seus resultados</span>
            </li>
            <li className="flex items-start gap-2">
              <Award className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Troque conquistas por moedas e reconhecimento no time</span>
            </li>
            <li className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
              <span>Entenda quais ações mais contribuem para o seu progresso</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {data?.error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>{data.error}</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-28 max-w-xs" />
      ) : (
        <>
          <Card className="max-w-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Moedas (90 dias)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-semibold">
              <Coins className="h-5 w-5 text-amber-500" />
              {data?.totalCoins ?? 0}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Últimos 3 lançamentos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.entries?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum lançamento encontrado para {data?.userName || "seu usuário"}.
                </p>
              ) : (
                data!.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.metricName}</span>
                        {entry.category && <Badge variant="secondary">{entry.category}</Badge>}
                      </div>
                      {entry.notes && (
                        <p className="text-sm text-muted-foreground break-words">{entry.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          entry.coins < 0 ? "text-destructive font-semibold" : "text-emerald-600 font-semibold"
                        }
                      >
                        {entry.coins > 0 ? `+${entry.coins}` : entry.coins} moedas
                      </span>
                      {entry.points !== 0 && <span className="font-semibold">{entry.points} pts</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Desafios em aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(data?.missions?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum desafio em aberto no momento.</p>
              ) : (
                data!.missions.map((mission) => (
                  <div key={mission.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{mission.title}</span>
                      {mission.category && <Badge variant="outline">{mission.category}</Badge>}
                      {mission.reward != null && (
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          {mission.reward} moedas
                        </Badge>
                      )}
                    </div>
                    {mission.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {mission.description}
                      </p>
                    )}
                    {mission.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expira em {formatDate(mission.expiresAt)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
