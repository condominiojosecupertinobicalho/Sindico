# Especificação de Segurança — Condomínio Fácil (José Cupertino Bicalho)

## 1. Invariantes de Dados e Controle de Acesso (RBAC)
1. **Acesso Restrito por Convite**: Nenhum usuário autenticado recebe acesso automático aos dados financeiros sem um perfil ativo em `/users/{uid}` criado pelo Síndico ou via convite nominal válido em `/invites/{inviteId}` com `email_verified == true`.
2. **Isolamento de PII de Moradores**: Moradores (`role == 'morador'`) só podem ler o próprio cadastro `/units/{unitId}` e o próprio extrato `/unit_statements/{unitId}`. Nenhuma consulta `list` em `/units`, `/users`, `/invites`, `/transactions` ou `/unit_statements` é permitida a moradores.
3. **Transparência Somente de Prestações Publicadas**: Moradores só podem consultar documentos em `/monthly_reports/{competence}` quando `published == true`, contendo exclusivamente dados consolidados por categoria sem identificação pessoal de outros condôminos.
4. **Conselheiro Somente-Leitura**: Conselheiros (`role == 'conselheiro'`) podem ler todas as movimentações, unidades e comprovantes autorizados, porém todas as operações de escrita (`create`, `update`, `delete`) são estritamente bloqueadas.
5. **Integridade Temporal e Imutabilidade**: Campos de auditoria (`createdAt`, `createdBy`, `uid`, `id`) são imutáveis após criação e validados contra `request.time` e `request.auth.uid`.
6. **Visibilidade Controlada na Pasta Mensal (`/monthly_documents/{docId}`)**: Moradores (`role == 'morador'`) só podem ler e listar documentos em `/monthly_documents` cujo campo `visibility == 'published_residents'`. Documentos marcados como `council_and_admin` (como guias nominais de empregados terceirizados) ficam restritos ao Síndico e Conselho. Apenas o Síndico (`admin`) pode criar, editar ou excluir documentos mensais.

## 2. Payloads Adversariais ("Dirty Dozen")
1. **Auto-promoção para Síndico**: Morador tenta criar `/users/{uid}` com `role: 'admin'` sem convite válido -> `PERMISSION_DENIED`.
2. **Escalada de Privilégio em Update**: Conselheiro tenta atualizar `/users/{uid}` alterando `role` para `'admin'` -> `PERMISSION_DENIED`.
3. **Spoofing de E-mail não Verificado**: Usuário com `email_verified: false` tentando criar perfil ou ler convite -> `PERMISSION_DENIED`.
4. **Leitura Transversal de Unidade**: Morador da unidade `apto_101` tenta `get` em `/units/apto_102` ou `/unit_statements/apto_102` -> `PERMISSION_DENIED`.
5. **Listagem Indevida de Transações por Morador**: Morador executa `list` em `/transactions` tentando ler pagamentos de outros moradores -> `PERMISSION_DENIED`.
6. **Leitura de Prestação de Contas em Rascunho**: Morador tenta `get` ou `list` em `/monthly_reports/2026-11` com `published: false` -> `PERMISSION_DENIED`.
7. **Conselheiro Tentando Lançamento**: Conselheiro tenta `create` em `/transactions/tx_evil` -> `PERMISSION_DENIED`.
8. **Shadow Field Injection**: Síndico ou usuário envia campo não permitido (`isSuperAdmin: true`) em `/units/apto_101` ou `/monthly_documents/doc_1` -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Requisição com ID contendo `/` ou >128 chars em `/transactions/{txId}` -> `PERMISSION_DENIED`.
10. **Falsificação de Timestamp**: Criação de transação ou documento mensal com `createdAt` diferente de `request.time` -> `PERMISSION_DENIED`.
11. **Reuso de Convite Já Aceito**: Usuário tenta criar conta usando convite com `status: 'aceito'` -> `PERMISSION_DENIED`.
12. **Acesso a Comprovante ou Documento Restrito**: Morador tenta ler `/receipts/{id}` ou listar `/monthly_documents` com `visibility: 'council_and_admin'` ou pertencente a outra unidade -> `PERMISSION_DENIED`.
13. **Escrita Indevida na Pasta Mensal / Link Não-HTTPS**: Conselheiro ou morador tenta `create` em `/monthly_documents/{docId}` ou Síndico tenta salvar `externalUrl` com esquema `javascript:` -> `PERMISSION_DENIED`.
