# Correção segura dos 3 grupos de segurança

Objetivo: eliminar os alertas sem tirar acesso da equipe. Nada passa a ser "só de quem criou"; a regra vira "só quem é da equipe ativa".

## O que muda para a equipe
- Nada visível no dia a dia: atendentes continuam vendo chamados, lembretes, anexos, fotos do WhatsApp e catálogos dos colegas.
- Pessoas de fora (conta criada sem ser pelo admin) ou usuários inativados deixam de ler qualquer dado interno.
- Links públicos (proposta, termo de serviço) continuam funcionando, pois usam o código do link, não login.

## Passos
1. Conferir primeiro o estado real: lista atual de achados, regras de cada tabela citada e se o auto-cadastro está aberto. Nada é alterado antes disso.
2. Bloquear auto-cadastro público: contas novas só pelo admin em Configurações > Usuários (que já cria usuários assim).
3. Criar uma verificação única "é membro ativo da equipe" (perfil ativo + papel cadastrado).
4. Grupo 1 — chamados e eventos (lembretes, registro de eventos, agentes do chamado): trocar a regra "qualquer logado" por "membro ativo". Escrita continua com as mesmas permissões de hoje.
5. Grupo 2 — catálogos e configurações (categorias, horários, tipos de termo, acessórios, kits): leitura para membro ativo; alteração continua só admin/gestor como hoje.
6. Grupo 3 — arquivos (anexos de chamados e mídias do chat): download e envio só para membro ativo; a mídia recebida pelo WhatsApp continua sendo gravada pelo sistema normalmente.
7. Rodar a verificação de segurança de novo e marcar como corrigidos os achados resolvidos. Achados que forem alarme falso por desenho (ex.: catálogo compartilhado de propósito) serão apresentados para você aprovar ignorar.

## Como vou testar
- Atendente de teste ativo: abre chamado, vê lembretes de outro atendente, escolhe categoria, abre foto do chat — tudo funciona.
- Mesmo usuário inativado: não lê nada.
- Abrir um link público de termo/proposta continua funcionando.

## Riscos
- Usuário ativo sem papel cadastrado perderia acesso. Antes de aplicar, listo quem está nessa situação e corrijo (ou te aviso).
- Robôs internos (webhook, cron) usam acesso de sistema e não são afetados.

## Detalhes técnicos
- Função SECURITY DEFINER `public.is_active_staff()` (profiles.is_active + exists em user_roles), criada antes das políticas.
- Substituir políticas `USING (true)` para authenticated pelas que chamam `is_active_staff()`; manter políticas de escrita/has_role existentes.
- Políticas de storage em `storage.objects` para os buckets ticket-attachments e chat-media com `is_active_staff()`.
- Desativar signup via configure_auth (disable_signup).
