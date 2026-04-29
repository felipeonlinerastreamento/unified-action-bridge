import { createFileRoute } from "@tanstack/react-router";
import { pollAllActiveEmailChannels, pollEmailChannel } from "@/lib/email-poll.server";

export const Route = createFileRoute("/api/public/email-poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const channelId = url.searchParams.get("channelId");
        try {
          const results = channelId
            ? [await pollEmailChannel(channelId)]
            : await pollAllActiveEmailChannels();
          return Response.json({ success: true, results });
        } catch (e: any) {
          return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
        }
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const channelId = url.searchParams.get("channelId");
        try {
          const results = channelId
            ? [await pollEmailChannel(channelId)]
            : await pollAllActiveEmailChannels();
          return Response.json({ success: true, results });
        } catch (e: any) {
          return Response.json({ success: false, error: e?.message || String(e) }, { status: 500 });
        }
      },
    },
  },
});
