import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/agenda/")({
  beforeLoad: () => {
    throw redirect({ to: "/agenda/atividades" });
  },
});
