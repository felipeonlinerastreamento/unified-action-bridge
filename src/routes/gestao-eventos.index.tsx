import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/gestao-eventos/")({
  component: () => <Navigate to="/gestao-eventos/eventos" replace />,
});
