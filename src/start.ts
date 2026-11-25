import { createStart } from '@tanstack/react-start';
import { attachSupabaseAuth } from '@/integrations/supabase/auth-attacher';
import { anexarModoTeste } from '@/lib/modo-teste.middleware';
import { travarClienteExterno } from '@/lib/cliente-externo.middleware';

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, anexarModoTeste, travarClienteExterno],
}));
