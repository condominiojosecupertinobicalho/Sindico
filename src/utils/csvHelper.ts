import type {
  CondominiumSettings,
  ExpenseGroup,
  Transaction,
  TransactionStatus,
  Unit,
} from '../types/condo';
import { formatDateBR, sanitizeId } from './formatters';

const MONTH_PT_TO_NUM: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

export function parseBRLNumber(raw: string): number {
  const cleaned = raw
    .replace(/R\$/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round((num + Number.EPSILON) * 100) / 100 : 0;
}

export function parseDateBRToISO(raw: string, fallbackCompetence?: string): string {
  const trimmed = raw.trim();
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  }
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return trimmed;
  if (fallbackCompetence && /^\d{4}-\d{2}$/.test(fallbackCompetence)) {
    return `${fallbackCompetence}-15`;
  }
  return '2026-01-15';
}

export function parseFiltroMesToCompetence(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length !== 2) return null;
  const monthKey = parts[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const monthNum = MONTH_PT_TO_NUM[monthKey] ?? MONTH_PT_TO_NUM[parts[0]];
  const year = parts[1].trim();
  if (!monthNum || !/^\d{4}$/.test(year)) return null;
  return `${year}-${monthNum}`;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectUnitFromComment(item: string, comment: string): { unitId: string | null; unitLabel: string | null } {
  const text = `${item} ${comment}`.toLowerCase();
  if (text.includes('101')) return { unitId: 'apto_101', unitLabel: 'Apartamento 101' };
  if (text.includes('102')) return { unitId: 'apto_102', unitLabel: 'Apartamento 102' };
  if (text.includes('201')) return { unitId: 'apto_201', unitLabel: 'Apartamento 201' };
  if (text.includes('202')) return { unitId: 'apto_202', unitLabel: 'Apartamento 202' };
  if (text.includes('301')) return { unitId: 'apto_301', unitLabel: 'Apartamento 301' };
  if (text.includes('302')) return { unitId: 'apto_302', unitLabel: 'Apartamento 302' };
  return { unitId: null, unitLabel: null };
}

function classifyIncomeCategory(item: string): string {
  const low = item.toLowerCase();
  if (low.includes('fundo de obra')) return 'Fundo de obra';
  if (low.includes('taxa extra') || low.includes('taxa exta')) return 'Taxa extraordinária';
  if (low.includes('condom')) return 'Condomínio mensal';
  if (low.includes('cred juros') || low.includes('rem basica') || low.includes('rendimento')) {
    return 'Rendimentos financeiros';
  }
  if (low.includes('multa')) return 'Multas';
  return 'Outras receitas';
}

function classifyExpense(item: string): { category: string; group: ExpenseGroup } {
  const low = item.toLowerCase();
  if (low.includes('água') || low.includes('agua') || low.includes('copasa')) {
    return { category: 'Conta de água', group: 'custos_fixos' };
  }
  if (low.includes('luz') || low.includes('cemig')) {
    return { category: 'Energia elétrica', group: 'custos_fixos' };
  }
  if (low.includes('conservadora') || low.includes('laguna')) {
    return { category: 'Conservadora / limpeza', group: 'custos_fixos' };
  }
  if (low.includes('contador') && !low.includes('documentação')) {
    return { category: 'Contador', group: 'custos_fixos' };
  }
  if (low.includes('inss') || low.includes('contribuição')) {
    return { category: 'Contribuições e encargos', group: 'custos_fixos' };
  }
  if (low.includes('irrf') || low.includes('tarifa') || low.includes('taxa do pix') || low.includes('fixo')) {
    return { category: 'Outros custos fixos', group: 'custos_fixos' };
  }
  if (low.includes('seguro')) {
    return { category: 'Seguro condominial', group: 'manutencao_servicos' };
  }
  if (low.includes('jardineiro') || low.includes('jardinagem') || low.includes('plantas')) {
    return { category: 'Jardineiro e paisagismo', group: 'manutencao_servicos' };
  }
  if (low.includes('portão') || low.includes('portao') || low.includes('interfone') || low.includes('portaria')) {
    return { category: 'Portão e interfone', group: 'manutencao_servicos' };
  }
  if (low.includes('extintor')) {
    return { category: 'Segurança e extintores', group: 'manutencao_servicos' };
  }
  if (low.includes('lâmpada') || low.includes('lampada') || low.includes('material') || low.includes('óleo') || low.includes('oleo') || low.includes('repetidor') || low.includes('refletor')) {
    return { category: 'Materiais e compras', group: 'manutencao_servicos' };
  }
  if (low.includes('manutenção') || low.includes('manutencao') || low.includes('obra') || low.includes('opus') || low.includes('infiltração') || low.includes('caixa') || low.includes('eletricista') || low.includes('desentupir')) {
    return { category: 'Manutenção predial e obras', group: 'manutencao_servicos' };
  }
  return { category: 'Serviços e reembolsos', group: 'manutencao_servicos' };
}

function mapSpreadsheetStatus(
  rawStatus: string,
  isIncome: boolean,
  absValue: number,
  competence: string
): TransactionStatus {
  const s = rawStatus.trim().toLowerCase();
  if (s === 'recebido') return 'recebido';
  if (s === 'pago') return 'pago';
  if (s.includes('aguardando')) return 'pendente';
  if (s.includes('pendente')) {
    return competence <= '2026-10' && !isIncome ? 'pago' : 'pendente';
  }
  if (s.includes('agendado')) return 'agendado';
  if (s.includes('débito') || s.includes('debito')) {
    // Em meses anteriores/fechados até Outubro/2026 foi liquidado em conta
    return competence >= '2026-11' ? 'pendente' : 'debito_automatico';
  }
  if (s.includes('adiado')) return 'adiado';
  if (s.includes('cancelado')) return 'cancelado';

  // Status em branco na planilha
  if (competence >= '2026-11') {
    return 'pendente';
  }
  if (absValue === 0) return 'pendente';
  return isIncome ? 'recebido' : 'pago';
}

export interface CsvParseResult {
  initialBalance: number;
  transactions: Omit<Transaction, 'createdAt' | 'updatedAt'>[];
  competences: string[];
  warnings: string[];
}

export function parseCondoCsv(csvText: string, createdBy: string): CsvParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { initialBalance: 0, transactions: [], competences: [], warnings: ['Arquivo CSV vazio.'] };
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') && !headerLine.includes('","') ? ';' : ',';

  let initialBalance = 3037.65;
  const transactions: Omit<Transaction, 'createdAt' | 'updatedAt'>[] = [];
  const competenceSet = new Set<string>();
  const warnings: string[] = [];

  // Alguns CSVs possuem o último mês duplicado por engano na exportação (ex: Dezembro/2026 aparece 2x após SALDO ATUAL).
  // Detectamos quando "SALDO ATUAL" fecha um mês para evitar duplicar o mesmo mês caso reapareça em bloco repetido.
  const closedCompetences = new Set<string>();
  const seenRowKeys = new Map<string, number>();
  let currentCompetence: string | null = null;
  let lastUnitInCompetence: { competence: string; unitId: string; unitLabel: string } | null = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length < 5) continue;

    const item = (cols[0] ?? '').trim();
    const rawValor = (cols[1] ?? '').trim();
    const comment = (cols[2] ?? '').trim();
    const rawDate = (cols[3] ?? '').trim();
    const rawFiltroMes = (cols[4] ?? '').trim();
    const rawStatus = (cols[5] ?? '').trim();

    if (!item) continue;
    const itemUpper = item.toUpperCase();

    if (itemUpper === 'SALDO INICIAL') {
      initialBalance = parseBRLNumber(rawValor);
      continue;
    }

    const parsedComp: string | null = rawFiltroMes
      ? parseFiltroMesToCompetence(rawFiltroMes)
      : currentCompetence;
    if (!parsedComp) {
      warnings.push(`Linha ${i + 1}: competência inválida (${rawFiltroMes}).`);
      continue;
    }
    const competence: string = parsedComp;
    currentCompetence = competence;

    if (itemUpper === 'SALDO ATUAL') {
      closedCompetences.add(competence);
      lastUnitInCompetence = null;
      continue;
    }

    if (closedCompetences.has(competence)) {
      // Bloco duplicado após SALDO ATUAL do mesmo mês
      continue;
    }

    const numericValue = parseBRLNumber(rawValor);
    const absValue = Math.abs(numericValue);
    const isNegative = numericValue < 0 || rawValor.trim().startsWith('-');
    const isBankYieldIncome =
      !isNegative &&
      (item.toLowerCase().includes('cred juros') || item.toLowerCase().includes('rem basica'));
    const isIncome =
      !isNegative &&
      (isBankYieldIncome ||
        item.toLowerCase().includes('condom') ||
        item.toLowerCase().includes('taxa extra') ||
        item.toLowerCase().includes('fundo de obra') ||
        numericValue > 0);

    // Ignorar linhas zeradas informativas como "Conta de água R$ 0,00 Desconto..." exceto se for ADIADO
    const status = mapSpreadsheetStatus(rawStatus, isIncome, absValue, competence);
    if (absValue === 0 && status !== 'adiado') {
      continue;
    }

    const dueDate = parseDateBRToISO(rawDate, competence);
    const settled =
      status === 'recebido' || status === 'pago' || status === 'debito_automatico'
        ? absValue
        : 0;
    const settlementDate = settled > 0 ? dueDate : null;

    let { unitId, unitLabel } = isIncome
      ? detectUnitFromComment(item, comment)
      : { unitId: null, unitLabel: null };

    if (isIncome && unitId && unitLabel) {
      lastUnitInCompetence = { competence, unitId, unitLabel };
    } else if (
      isIncome &&
      !unitId &&
      (item.toLowerCase().includes('taxa extra') || item.toLowerCase().includes('fundo de obra')) &&
      lastUnitInCompetence &&
      lastUnitInCompetence.competence === competence
    ) {
      unitId = lastUnitInCompetence.unitId;
      unitLabel = lastUnitInCompetence.unitLabel;
    }

    const expenseMeta = isIncome ? null : classifyExpense(item);
    const category = isIncome ? classifyIncomeCategory(item) : expenseMeta!.category;

    const baseKey = `${competence}_${sanitizeId(item)}_${unitId ?? 'geral'}`;
    const count = (seenRowKeys.get(baseKey) ?? 0) + 1;
    seenRowKeys.set(baseKey, count);
    const id = `tx_${competence.replace('-', '')}_${String(i).padStart(4, '0')}`;

    const installmentMatch = /\(([^)]*\bde\b[^)]*)\)/i.exec(item);
    competenceSet.add(competence);

    transactions.push({
      id,
      type: isIncome ? 'income' : 'expense',
      description: item.slice(0, 180),
      expenseGroup: isIncome ? null : expenseMeta!.group,
      category: category.slice(0, 80),
      competence,
      dueDate,
      settlementDate,
      expectedAmount: absValue,
      settledAmount: settled,
      status,
      unitId,
      unitLabel,
      notes: comment.slice(0, 500),
      installmentLabel: installmentMatch ? installmentMatch[1].slice(0, 40) : null,
      receiptId: null,
      receiptUrl: null,
      createdBy,
    });
  }

  return {
    initialBalance,
    transactions,
    competences: Array.from(competenceSet).sort(),
    warnings,
  };
}

export function exportTransactionsToCsv(transactions: Transaction[]): string {
  const header = [
    'Competência',
    'Tipo',
    'Descrição',
    'Grupo Despesa',
    'Categoria',
    'Unidade',
    'Vencimento',
    'Liquidação',
    'Valor Previsto',
    'Valor Liquidado',
    'Situação',
    'Observações',
  ].join(';');

  const rows = transactions
    .slice()
    .sort((a, b) => a.competence.localeCompare(b.competence) || a.dueDate.localeCompare(b.dueDate))
    .map((tx) => {
      const cells = [
        tx.competence,
        tx.type === 'income' ? 'Receita' : 'Despesa',
        tx.description,
        tx.expenseGroup === 'custos_fixos'
          ? 'Custos Mensais'
          : tx.expenseGroup === 'manutencao_servicos'
            ? 'Manutenções e Serviços'
            : '',
        tx.category,
        tx.unitLabel ?? '',
        formatDateBR(tx.dueDate),
        formatDateBR(tx.settlementDate),
        tx.expectedAmount.toFixed(2).replace('.', ','),
        tx.settledAmount.toFixed(2).replace('.', ','),
        tx.status,
        tx.notes.replace(/[\r\n;]+/g, ' '),
      ];
      return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';');
    });

  return '\uFEFF' + [header, ...rows].join('\r\n');
}

export interface CondoBackupPayload {
  version: string;
  exportedAt: string;
  settings: CondominiumSettings;
  units: Unit[];
  transactions: Transaction[];
}

export function downloadTextFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
