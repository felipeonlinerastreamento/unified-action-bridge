import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracoes")({
  component: ConfiguracoesLayout,
});

function ConfiguracoesLayout() {
  return <Outlet />;
}
