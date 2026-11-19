export type UserRole = 'admin' | 'conselheiro' | 'morador';

export type UnitType = 'convencional' | 'cobertura';

export type OccupancyStatus = 'ocupado_proprietario' | 'alugado' | 'desocupado';

export type TransactionType = 'income' | 'expense';

export type ExpenseGroup = 'custos_fixos' | 'manutencao_servicos';

export type TransactionStatus =
  | 'pendente'
  | 'parcial'
  | 'recebido'
  | 'pago'
  | 'agendado'
  | 'debito_automatico'
  | 'adiado'
  | 'cancelado';

export type ReceiptVisibility = 'council_and_admin' | 'published_residents';

export interface CondominiumSettings {
  name: string;
  cnpj?: string;
  address?: string;
  timezone: string;
  currency: string;
  initialBalance: number;
  initialBalanceDate: string; // YYYY-MM-DD
  defaultDueDay: number;
  defaultConventionalFee: number;
  defaultPenthouseFee: number;
  rateioRule?: string;
  updatedAt?: unknown;
  updatedBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  unitId: string | null;
  inviteId?: string | null;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserInvite {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  unitId: string | null;
  status: 'pendente' | 'aceito' | 'revogado';
  acceptedUid?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface Unit {
  id: string;
  code: string;
  displayName: string;
  type: UnitType;
  ownerName: string;
  contact?: string;
  occupancyStatus: OccupancyStatus;
  monthlyFee: number;
  allocationRule: string;
  active: boolean;
  order: number;
  updatedAt?: unknown;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  expenseGroup?: ExpenseGroup | null;
  category: string;
  competence: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
  settlementDate?: string | null; // YYYY-MM-DD
  expectedAmount: number;
  settledAmount: number;
  status: TransactionStatus;
  unitId?: string | null;
  unitLabel?: string | null;
  notes: string;
  installmentLabel?: string | null;
  receiptId?: string | null;
  receiptUrl?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export interface ReportLineItem {
  label: string;
  category: string;
  amount: number;
  status?: string;
  count?: number;
}

export interface MonthlyReport {
  competence: string; // YYYY-MM
  label: string; // e.g. Outubro/2026
  published: boolean;
  previousBalance: number;
  totalIncome: number;
  totalFixedExpenses: number;
  totalMaintenanceExpenses: number;
  totalExpenses: number;
  monthResult: number;
  currentBalance: number;
  incomeItems: ReportLineItem[];
  fixedExpenseItems: ReportLineItem[];
  maintenanceExpenseItems: ReportLineItem[];
  notes?: string;
  publishedAt?: unknown;
  updatedAt?: unknown;
  publishedBy?: string | null;
}

export interface UnitStatementEntry {
  txId: string;
  description: string;
  category: string;
  competence: string;
  dueDate: string;
  settlementDate?: string | null;
  expectedAmount: number;
  settledAmount: number;
  status: TransactionStatus;
  notes: string;
  receiptId?: string | null;
  receiptUrl?: string | null;
}

export interface UnitStatement {
  unitId: string;
  unitCode: string;
  entries: UnitStatementEntry[];
  totalPending: number;
  totalPaid: number;
  updatedAt?: unknown;
}

export interface Receipt {
  id: string;
  txId: string;
  unitId?: string | null;
  competence: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  visibility: ReceiptVisibility;
  createdAt?: unknown;
  createdBy: string;
}

export type MonthlyDocumentCategory =
  | 'extrato_bancario'
  | 'comprovante_pagamento'
  | 'boleto_guia'
  | 'nota_fiscal'
  | 'contrato'
  | 'recibo'
  | 'encargos_fiscais'
  | 'vistoria_midia';

export type MonthlyDocumentStorageMode = 'embedded' | 'external_link' | 'official_archive';

export interface MonthlyDocument {
  id: string;
  competence: string; // YYYY-MM
  documentDate?: string | null; // YYYY-MM-DD
  title: string;
  category: MonthlyDocumentCategory;
  fileName: string;
  mimeType: string;
  storageMode: MonthlyDocumentStorageMode;
  dataUrl?: string | null;
  externalUrl?: string | null;
  visibility: ReceiptVisibility;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
}

export const FIELD_LIMITS = {
  NAME_MAX: 120,
  DESC_MAX: 180,
  CAT_MAX: 80,
  NOTES_MAX: 500,
  REPORT_NOTES_MAX: 1000,
  URL_MAX: 500,
  FILE_NAME_MAX: 180,
  DATA_URL_MAX: 750000,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  COMPETENCE_PATTERN: /^\d{4}-\d{2}$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
} as const;
