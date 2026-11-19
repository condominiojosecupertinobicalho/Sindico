import type {
  MonthlyReport,
  ReportLineItem,
  Transaction,
  Unit,
} from '../types/condo';
import { formatCompetenceLabel, formatCompetenceShort } from './formatters';

export interface MonthlySummary {
  competence: string;
  label: string;
  shortLabel: string;
  previousBalance: number;
  totalIncomeExpected: number;
  totalIncomeReceived: number;
  totalReceivable: number;
  totalFixedExpensesPaid: number;
  totalMaintenanceExpensesPaid: number;
  totalExpensesPaid: number;
  totalPayable: number;
  monthResult: number;
  currentBalance: number;
  compliantUnitsCount: number;
  delinquentUnitsCount: number;
  unitStatuses: UnitMonthStatus[];
  incomeItems: ReportLineItem[];
  fixedExpenseItems: ReportLineItem[];
  maintenanceExpenseItems: ReportLineItem[];
  expenseByCategory: { category: string; amount: number; group: string }[];
}

export interface UnitMonthStatus {
  unitId: string;
  unitCode: string;
  unitDisplayName: string;
  expectedAmount: number;
  settledAmount: number;
  pendingAmount: number;
  status: 'adimplente' | 'parcial' | 'inadimplente' | 'sem_cobranca';
}

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function isCashSettled(tx: Transaction): boolean {
  if (tx.status === 'cancelado' || tx.status === 'adiado' || tx.status === 'pendente' || tx.status === 'agendado') {
    return false;
  }
  return tx.settledAmount > 0;
}

export function isReceivableOrPayable(tx: Transaction): boolean {
  return (
    tx.status === 'pendente' ||
    tx.status === 'parcial' ||
    tx.status === 'agendado'
  );
}

export function computeAllMonthlySummaries(
  transactions: Transaction[],
  units: Unit[],
  initialBalance: number,
  initialCompetence = '2024-06',
  extraCompetences: string[] = []
): MonthlySummary[] {
  const competenceSet = new Set<string>(extraCompetences);
  for (const tx of transactions) {
    if (tx.competence) competenceSet.add(tx.competence);
  }
  if (competenceSet.size === 0) {
    competenceSet.add(initialCompetence);
  }

  const competences = Array.from(competenceSet).sort((a, b) => a.localeCompare(b));
  const byComp = new Map<string, Transaction[]>();
  for (const c of competences) byComp.set(c, []);
  for (const tx of transactions) {
    const arr = byComp.get(tx.competence);
    if (arr) arr.push(tx);
  }

  let runningBalance = roundCents(initialBalance);
  const summaries: MonthlySummary[] = [];

  for (const competence of competences) {
    const txs = byComp.get(competence) ?? [];
    const previousBalance = runningBalance;

    let totalIncomeExpected = 0;
    let totalIncomeReceived = 0;
    let totalReceivable = 0;
    let totalFixedExpensesPaid = 0;
    let totalMaintenanceExpensesPaid = 0;
    let totalPayable = 0;

    const incomeGroupMap = new Map<string, { amount: number; count: number; category: string }>();
    const fixedItems: ReportLineItem[] = [];
    const maintItems: ReportLineItem[] = [];
    const categoryTotals = new Map<string, { amount: number; group: string }>();

    for (const tx of txs) {
      if (tx.status === 'cancelado') continue;

      if (tx.type === 'income') {
        totalIncomeExpected = roundCents(totalIncomeExpected + tx.expectedAmount);

        if (isCashSettled(tx)) {
          totalIncomeReceived = roundCents(totalIncomeReceived + tx.settledAmount);
          const groupKey = tx.category || tx.description;
          const prev = incomeGroupMap.get(groupKey) ?? { amount: 0, count: 0, category: tx.category };
          incomeGroupMap.set(groupKey, {
            amount: roundCents(prev.amount + tx.settledAmount),
            count: prev.count + 1,
            category: tx.category,
          });
        }

        if (isReceivableOrPayable(tx)) {
          const remaining = Math.max(0, roundCents(tx.expectedAmount - tx.settledAmount));
          totalReceivable = roundCents(totalReceivable + remaining);
        }
      } else {
        const isFixed = tx.expenseGroup === 'custos_fixos';
        const settled = isCashSettled(tx) ? tx.settledAmount : 0;

        if (settled > 0) {
          if (isFixed) {
            totalFixedExpensesPaid = roundCents(totalFixedExpensesPaid + settled);
          } else {
            totalMaintenanceExpensesPaid = roundCents(totalMaintenanceExpensesPaid + settled);
          }

          const catKey = tx.category || 'Outras despesas';
          const prevCat = categoryTotals.get(catKey) ?? {
            amount: 0,
            group: isFixed ? 'Custos mensais' : 'Manutenções e serviços',
          };
          categoryTotals.set(catKey, {
            amount: roundCents(prevCat.amount + settled),
            group: prevCat.group,
          });
        }

        if (isReceivableOrPayable(tx) || tx.status === 'adiado') {
          const remaining = Math.max(0, roundCents(tx.expectedAmount - settled));
          totalPayable = roundCents(totalPayable + remaining);
        }

        // Agrupa no modelo do relatório mensal (inclui adiado com R$ 0,00 para transparência)
        if (settled > 0 || tx.status === 'adiado') {
          const item: ReportLineItem = {
            label: tx.description,
            category: tx.category,
            amount: roundCents(settled),
            status: tx.status,
          };
          if (isFixed) {
            fixedItems.push(item);
          } else {
            maintItems.push(item);
          }
        }
      }
    }

    // Consolida despesas fixas de mesma descrição (ex: Cemig + CemigSim sob "Conta de Luz (fixo)" se desejado, ou lista limpa)
    const consolidatedFixed = consolidateLineItems(fixedItems);
    const consolidatedMaint = consolidateLineItems(maintItems);

    const incomeItems: ReportLineItem[] = Array.from(incomeGroupMap.entries()).map(
      ([label, info]) => ({
        label,
        category: info.category,
        amount: info.amount,
        count: info.count,
      })
    );

    const totalExpensesPaid = roundCents(totalFixedExpensesPaid + totalMaintenanceExpensesPaid);
    const monthResult = roundCents(totalIncomeReceived - totalExpensesPaid);
    const currentBalance = roundCents(previousBalance + monthResult);
    runningBalance = currentBalance;

    // Adimplência por unidade
    const unitStatuses: UnitMonthStatus[] = units
      .filter((u) => u.active)
      .sort((a, b) => a.order - b.order)
      .map((u) => {
        const unitTxs = txs.filter(
          (t) => t.type === 'income' && t.unitId === u.id && t.status !== 'cancelado'
        );
        if (unitTxs.length === 0) {
          return {
            unitId: u.id,
            unitCode: u.code,
            unitDisplayName: u.displayName,
            expectedAmount: 0,
            settledAmount: 0,
            pendingAmount: 0,
            status: 'sem_cobranca',
          };
        }
        const expected = roundCents(unitTxs.reduce((acc, t) => acc + t.expectedAmount, 0));
        const settled = roundCents(
          unitTxs.reduce((acc, t) => acc + (isCashSettled(t) ? t.settledAmount : 0), 0)
        );
        const pending = Math.max(0, roundCents(expected - settled));
        let status: UnitMonthStatus['status'] = 'adimplente';
        if (pending > 0.01) {
          status = settled > 0 ? 'parcial' : 'inadimplente';
        }
        return {
          unitId: u.id,
          unitCode: u.code,
          unitDisplayName: u.displayName,
          expectedAmount: expected,
          settledAmount: settled,
          pendingAmount: pending,
          status,
        };
      });

    const compliantUnitsCount = unitStatuses.filter((u) => u.status === 'adimplente').length;
    const delinquentUnitsCount = unitStatuses.filter(
      (u) => u.status === 'inadimplente' || u.status === 'parcial'
    ).length;

    const expenseByCategory = Array.from(categoryTotals.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        group: data.group,
      }))
      .sort((a, b) => b.amount - a.amount);

    summaries.push({
      competence,
      label: formatCompetenceLabel(competence),
      shortLabel: formatCompetenceShort(competence),
      previousBalance,
      totalIncomeExpected,
      totalIncomeReceived,
      totalReceivable,
      totalFixedExpensesPaid,
      totalMaintenanceExpensesPaid,
      totalExpensesPaid,
      totalPayable,
      monthResult,
      currentBalance,
      compliantUnitsCount,
      delinquentUnitsCount,
      unitStatuses,
      incomeItems,
      fixedExpenseItems: consolidatedFixed,
      maintenanceExpenseItems: consolidatedMaint,
      expenseByCategory,
    });
  }

  return summaries;
}

function consolidateLineItems(items: ReportLineItem[]): ReportLineItem[] {
  const map = new Map<string, ReportLineItem>();
  for (const item of items) {
    const key = `${item.label}__${item.status ?? ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount = roundCents(existing.amount + item.amount);
      existing.count = (existing.count ?? 1) + 1;
    } else {
      map.set(key, { ...item, count: 1 });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
}

export function buildMonthlyReportPayload(
  summary: MonthlySummary,
  published: boolean,
  notes: string,
  publishedBy: string | null
): Omit<MonthlyReport, 'updatedAt' | 'publishedAt'> {
  return {
    competence: summary.competence,
    label: summary.label,
    published,
    previousBalance: summary.previousBalance,
    totalIncome: summary.totalIncomeReceived,
    totalFixedExpenses: summary.totalFixedExpensesPaid,
    totalMaintenanceExpenses: summary.totalMaintenanceExpensesPaid,
    totalExpenses: summary.totalExpensesPaid,
    monthResult: summary.monthResult,
    currentBalance: summary.currentBalance,
    incomeItems: summary.incomeItems,
    fixedExpenseItems: summary.fixedExpenseItems,
    maintenanceExpenseItems: summary.maintenanceExpenseItems,
    notes: notes.slice(0, 1000),
    publishedBy,
  };
}
