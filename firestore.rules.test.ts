// Especificação de testes de segurança (Dirty Dozen) para verificação das regras Firestore.
// Cada caso abaixo valida que operações não autorizadas são rejeitadas com PERMISSION_DENIED.

export interface SecurityTestCase {
  id: string;
  actor: 'anonymous' | 'uninvited' | 'morador_101' | 'conselheiro' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 'DD-01-self-promote-admin',
    actor: 'uninvited',
    operation: 'create',
    path: 'users/uid_attacker',
    payload: { uid: 'uid_attacker', email: 'attacker@example.com', displayName: 'Attacker', role: 'admin', active: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-02-role-escalation-update',
    actor: 'conselheiro',
    operation: 'update',
    path: 'users/uid_conselheiro',
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-03-cross-unit-pii-read',
    actor: 'morador_101',
    operation: 'get',
    path: 'units/apto_102',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-04-cross-unit-statement-read',
    actor: 'morador_101',
    operation: 'get',
    path: 'unit_statements/apto_102',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-05-resident-list-transactions',
    actor: 'morador_101',
    operation: 'list',
    path: 'transactions',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-06-resident-draft-report-read',
    actor: 'morador_101',
    operation: 'get',
    path: 'monthly_reports/2026-11',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-07-council-write-transaction',
    actor: 'conselheiro',
    operation: 'create',
    path: 'transactions/tx_hack',
    payload: { id: 'tx_hack', type: 'expense', expectedAmount: 100 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-08-shadow-field-unit',
    actor: 'admin',
    operation: 'update',
    path: 'units/apto_101',
    payload: { shadowField: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-09-id-poisoning',
    actor: 'admin',
    operation: 'create',
    path: `transactions/${'a'.repeat(140)}`,
    payload: { id: 'a'.repeat(140) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-10-timestamp-spoof',
    actor: 'admin',
    operation: 'create',
    path: 'transactions/tx_spoof',
    payload: { id: 'tx_spoof', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-11-anonymous-settings-read',
    actor: 'anonymous',
    operation: 'get',
    path: 'condominium/settings',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-12-resident-restricted-receipt',
    actor: 'morador_101',
    operation: 'get',
    path: 'receipts/rec_private_102',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-13-resident-restricted-monthly-doc',
    actor: 'morador_101',
    operation: 'get',
    path: 'monthly_documents/doc_council_only',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-14-council-create-monthly-doc',
    actor: 'conselheiro',
    operation: 'create',
    path: 'monthly_documents/doc_hack',
    payload: { id: 'doc_hack', competence: '2026-02', title: 'Teste', category: 'recibo' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 'DD-15-admin-invalid-url-scheme-monthly-doc',
    actor: 'admin',
    operation: 'create',
    path: 'monthly_documents/doc_xss',
    payload: {
      id: 'doc_xss',
      competence: '2026-02',
      title: 'XSS',
      category: 'extrato_bancario',
      fileName: 'extrato.pdf',
      mimeType: 'application/pdf',
      storageMode: 'external_link',
      externalUrl: 'javascript:alert(1)',
      visibility: 'published_residents',
      notes: '',
    },
    expected: 'PERMISSION_DENIED',
  },
];
