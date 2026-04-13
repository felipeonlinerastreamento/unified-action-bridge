// GSystem API Gateway - Server only
// Handles auth, rate limiting awareness, retry, error normalization, and logging

const GSYSTEM_BASE_URL = "https://api.gsystem.chat/core/v2/api";

interface GSystemRequestOptions {
  method?: string;
  body?: unknown;
  token: string;
  channelId?: string;
}

interface GSystemError {
  errorCode: string;
  message: string;
  statusCode: number;
}

export class GSystemGateway {
  private static async logRequest(
    channelId: string | undefined,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    errorCode?: string,
    errorMessage?: string
  ) {
    // Log integration attempt - imported dynamically to avoid circular deps
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("integration_logs").insert({
        channel_id: channelId ?? null,
        endpoint,
        method,
        status_code: statusCode,
        response_time_ms: responseTimeMs,
        error_code: errorCode ?? null,
        error_message: errorMessage ?? null,
      });
    } catch {
      console.error("[GSystem] Failed to log integration request");
    }
  }

  static async request<T = unknown>(
    endpoint: string,
    options: GSystemRequestOptions,
    retries = 3
  ): Promise<T> {
    const { method = "GET", body, token, channelId } = options;
    const url = `${GSYSTEM_BASE_URL}${endpoint}`;
    const start = Date.now();

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "access-token": token,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const elapsed = Date.now() - start;

        if (res.status === 429) {
          // Rate limited - retry with exponential backoff
          const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          await GSystemGateway.logRequest(channelId, endpoint, method, 429, elapsed, "rate_01", "Rate limit exceeded");
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
          throw { errorCode: "rate_01", message: "Rate limit exceeded after retries", statusCode: 429 } as GSystemError;
        }

        const data = await res.json();

        if (!res.ok) {
          const errorCode = data?.errorCode || `http_${res.status}`;
          const errorMessage = data?.message || res.statusText;
          await GSystemGateway.logRequest(channelId, endpoint, method, res.status, elapsed, errorCode, errorMessage);
          throw { errorCode, message: errorMessage, statusCode: res.status } as GSystemError;
        }

        await GSystemGateway.logRequest(channelId, endpoint, method, res.status, elapsed);
        return data as T;
      } catch (err) {
        if ((err as GSystemError).errorCode) throw err;
        const elapsed = Date.now() - start;
        if (attempt === retries) {
          await GSystemGateway.logRequest(channelId, endpoint, method, 0, elapsed, "fatal_01", String(err));
          throw { errorCode: "fatal_01", message: "Network error", statusCode: 0 } as GSystemError;
        }
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    throw { errorCode: "fatal_01", message: "Unexpected", statusCode: 0 } as GSystemError;
  }

  // Convenience methods
  static get<T = unknown>(endpoint: string, token: string, channelId?: string) {
    return GSystemGateway.request<T>(endpoint, { method: "GET", token, channelId });
  }

  static post<T = unknown>(endpoint: string, body: unknown, token: string, channelId?: string) {
    return GSystemGateway.request<T>(endpoint, { method: "POST", body, token, channelId });
  }

  static put<T = unknown>(endpoint: string, body: unknown, token: string, channelId?: string) {
    return GSystemGateway.request<T>(endpoint, { method: "PUT", body, token, channelId });
  }
}
