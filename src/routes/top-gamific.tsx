import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Coins, Target, RefreshCw, AlertTriangle } from "lucide-react";
import { getTopGamificOverview } from "@/lib/topgamific.functions";

export const Route = createFileRoute("/top-gamific")({
  head: () => ({
    meta: [
      { title: "Top Gamific | Lançamentos e desafios do operador" },
      {
        name: "description",
        content:
          "Acompanhe seus últimos lançamentos de pontos e moedas e os desafios em aberto da plataforma de gamificação.",
      },
      { property: "og:title", content: "Top Gamific | Lançamentos e desafios" },
      {
        property: "og:description",
        content:
          "Seus três últimos lançamentos e os desafios ativos da gamificação, em um só lugar.",
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
            Seus últimos lançamentos e os desafios em aberto.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {data?.error && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <span>{data.error}</span>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Moedas (90 dias)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 text-2xl font-semibold">
                <Coins className="h-5 w-5 text-amber-500" />
                {data?.totalCoins ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pontos (90 dias)</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data?.totalPoints ?? 0}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Lançamentos</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{data?.totalEntries ?? 0}</CardContent>
            </Card>
          </div>

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
