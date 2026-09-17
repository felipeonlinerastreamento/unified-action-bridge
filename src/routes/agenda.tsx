import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/agenda")({
  component: AgendaLayout,
});

function AgendaLayout() {
  return <Outlet />;
}
