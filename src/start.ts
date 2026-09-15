import { createStart, createMiddleware } from '@tanstack/react-start';
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher';

// Let /lovable/* server routes (email webhooks, previews) through untouched.
const lovableBypass = createMiddleware({ type: 'request' }).server(({ next }) => next());

export const startInstance = createStart(() => ({
  requestMiddleware: [lovableBypass],
  functionMiddleware: [attachSupabaseAuth],
}));

