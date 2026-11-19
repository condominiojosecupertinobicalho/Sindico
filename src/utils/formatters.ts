import type { OccupancyStatus, TransactionStatus, UnitType, UserRole } from '../types/condo';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'condominiojosecupertinobicalho@gmail.com';

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export const INCOME_CATEGORIES = [
  'Condomínio mensal',
  'Taxa extraordinária',
  'Fundo de obra',
  'Multas',
  'Juros',
  'Rendimentos financeiros',
  'Outras receitas',
] as const;

export const FIXED_EXPENSE_CATEGORIES = [
  'Conta de água',
  'Energia elétrica',
  'Conservadora / limpeza',
  'Contador',
  'Contribuições e encargos',
  'Outros custos fixos',
] as const;

export const MAINTENANCE_EXPENSE_CATEGORIES = [
  'Manutenção predial e obras',
  'Jardineiro e paisagismo',
  'Portão e interfone',
  'Segurança e extintores',
  'Seguro condominial',
  'Materiais e compras',
  'Serviços e reembolsos',
] as const;

export function formatBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

export function formatDateBR(isoDate?: string | null): string {
  if (!isoDate) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatCompetenceLabel(competence: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(competence);
  if (!match) return competence;
  const monthIdx = Number(match[2]) - 1;
  const monthName = MONTH_NAMES_PT[monthIdx] ?? match[2];
  return `${monthName}/${match[1]}`;
}

export function formatCompetenceShort(competence: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(competence);
  if (!match) return competence;
  const monthIdx = Number(match[2]) - 1;
  const monthName = MONTH_SHORT_PT[monthIdx] ?? match[2];
  return `${monthName}/${match[1].slice(2)}`;
}

export function getTodaySaoPauloISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function getCurrentCompetenceSaoPaulo(): string {
  return getTodaySaoPauloISO().slice(0, 7);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'Síndico / Administrador';
    case 'conselheiro':
      return 'Conselheiro';
    case 'morador':
      return 'Morador';
  }
}

export function unitTypeLabel(type: UnitType): string {
  return type === 'cobertura' ? 'Cobertura' : 'Convencional';
}

export function occupancyLabel(status: OccupancyStatus): string {
  switch (status) {
    case 'ocupado_proprietario':
      return 'Ocupado (Proprietário)';
    case 'alugado':
      return 'Alugado';
    case 'desocupado':
      return 'Desocupado';
  }
}

export function statusLabel(status: TransactionStatus): string {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'parcial':
      return 'Parcial';
    case 'recebido':
      return 'Recebido';
    case 'pago':
      return 'Pago';
    case 'agendado':
      return 'Agendado';
    case 'debito_automatico':
      return 'Débito Automático';
    case 'adiado':
      return 'Adiado';
    case 'cancelado':
      return 'Cancelado';
  }
}

export function isSettledStatus(status: TransactionStatus): boolean {
  return (
    status === 'recebido' ||
    status === 'pago' ||
    status === 'debito_automatico' ||
    status === 'parcial'
  );
}

export function emailToInviteId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return `inv_${hex.slice(0, 110)}`;
}

export function sanitizeId(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}
