import { createStart } from '@tanstack/react-start';
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher';
import { anexarModoTeste } from '@/lib/modo-teste.middleware';

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, anexarModoTeste],
}));
