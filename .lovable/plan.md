## Objetivo
Permitir que a Auditoria encontre atendimentos finalizados ao buscar por termos como `marcus`, mesmo quando o nome do grupo/contato está nos detalhes do log e não apenas no campo principal.

## Diagnóstico
- A busca atual da Auditoria procura somente em: alvo, operador, evento e ID.
- Ela não procura dentro de `metadata/details`, onde ficam dados como telefone, grupo, setor e outros detalhes.
- No banco já existe registro do grupo **Marcus / Seu Instalador** em `zapi_chats`, com finalizadores identificados, mas a Auditoria não retorna pela busca textual atual.

## Plano de implementação
1. Ajustar a função de listagem da Auditoria para buscar também em `metadata::text` e `details::text`.
2. Aplicar o mesmo filtro de busca na exportação CSV, para exportar exatamente o que aparece no relatório.
3. Melhorar o placeholder do campo Busca para deixar claro que aceita grupo/contato/telefone.
4. Validar consultando novamente `marcus` na Auditoria.

## Resultado esperado
Ao pesquisar `marcus` em **Configurações → Auditoria**, o relatório deve retornar eventos relacionados ao grupo/contato quando o termo estiver no alvo ou nos detalhes do atendimento.