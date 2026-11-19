import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Landmark,
  Wallet,
} from 'lucide-react';
import type { MonthlySummary } from '../utils/accounting';
import type { MonthlyReport, UnitStatement, UserRole } from '../types/condo';
import { formatBRL, formatCompetenceLabel, formatCompetenceShort } from '../utils/formatters';

interface DashboardViewProps {
  role: UserRole;
  selectedCompetence: string;
  onSelectCompetence: (competence: string) => void;
  availableCompetences: string[];
  summaries: MonthlySummary[];
  publishedReports: MonthlyReport[];
  myUnitStatement: UnitStatement | null;
  hasData: boolean;
  onSeedRealData?: () => void;
  seedingData?: boolean;
}

export function DashboardView({
  role,
  selectedCompetence,
  onSelectCompetence,
  availableCompetences,
  summaries,
  publishedReports,
  myUnitStatement,
  hasData,
  onSeedRealData,
  seedingData,
}: DashboardViewProps) {
  const isResident = role === 'morador';

  const currentSummary = useMemo(() => {
    if (isResident) {
      const rep = publishedReports.find((r) => r.competence === selectedCompetence);
      if (!rep) return null;
      return {
        competence: rep.competence,
        label: rep.label,
        shortLabel: formatCompetenceShort(rep.competence),
        previousBalance: rep.previousBalance,
        totalIncomeExpected: rep.totalIncome,
        totalIncomeReceived: rep.totalIncome,
        totalReceivable: 0,
        totalFixedExpensesPaid: rep.totalFixedExpenses,
        totalMaintenanceExpensesPaid: rep.totalMaintenanceExpenses,
        totalExpensesPaid: rep.totalExpenses,
        totalPayable: 0,
        monthResult: rep.monthResult,
        currentBalance: rep.currentBalance,
        compliantUnitsCount: 0,
        delinquentUnitsCount: 0,
        unitStatuses: [],
        incomeItems: rep.incomeItems,
        fixedExpenseItems: rep.fixedExpenseItems,
        maintenanceExpenseItems: rep.maintenanceExpenseItems,
        expenseByCategory: buildCategoriesFromReport(rep),
      } satisfies MonthlySummary;
    }
    return summaries.find((s) => s.competence === selectedCompetence) ?? null;
  }, [isResident, publishedReports, summaries, selectedCompetence]);

  // Série dos últimos 12 meses até a competência selecionada (ou todos se <= 12)
  const chartSeries = useMemo(() => {
    const source = isResident
      ? publishedReports
          .slice()
          .sort((a, b) => a.competence.localeCompare(b.competence))
          .map((r) => ({
            competence: r.competence,
            shortLabel: formatCompetenceShort(r.competence),
            receitas: r.totalIncome,
            previsto: r.totalIncome,
            despesas: r.totalExpenses,
            saldo: r.currentBalance,
          }))
      : summaries.map((s) => ({
          competence: s.competence,
          shortLabel: s.shortLabel,
          receitas: s.totalIncomeReceived,
          previsto: s.totalIncomeExpected,
          despesas: s.totalExpensesPaid,
          saldo: s.currentBalance,
        }));

    const idx = source.findIndex((item) => item.competence === selectedCompetence);
    if (idx === -1) return source.slice(-12);
    const start = Math.max(0, idx - 11);
    return source.slice(start, idx + 1);
  }, [isResident, publishedReports, summaries, selectedCompetence]);

  const selectedYear = selectedCompetence.slice(0, 4);
  const selectedMonth = selectedCompetence.slice(5, 7);

  const years = useMemo(() => {
    const set = new Set(availableCompetences.map((c) => c.slice(0, 4)));
    return Array.from(set).sort();
  }, [availableCompetences]);

  const monthsInYear = useMemo(() => {
    return availableCompetences
      .filter((c) => c.startsWith(`${selectedYear}-`))
      .sort();
  }, [availableCompetences, selectedYear]);

  if (!hasData && !isResident) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 max-w-2xl">
        <h2 className="text-lg font-semibold text-stone-900 mb-2">
          Nenhum lançamento registrado ainda
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed mb-6">
          Você pode começar importando o histórico oficial da planilha do Condomínio José Cupertino
          Bicalho (Junho/2024 a Dezembro/2026) ou cadastrar seu primeiro lançamento manualmente.
        </p>
        {onSeedRealData && (
          <button
            type="button"
            onClick={onSeedRealData}
            disabled={seedingData}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {seedingData
              ? 'Importando histórico oficial...'
              : 'Carregar histórico da planilha (Jun/2024 – Dez/2026)'}
          </button>
        )}
      </div>
    );
  }

  if (isResident && publishedReports.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-8 max-w-2xl">
        <h2 className="text-lg font-semibold text-stone-900 mb-2">
          Nenhuma prestação de contas publicada ainda
        </h2>
        <p className="text-sm text-stone-600 leading-relaxed">
          Assim que o síndico fechar e publicar a prestação de contas mensal, os indicadores
          consolidados e gráficos aparecerão aqui. Enquanto isso, você já pode consultar a situação
          da sua unidade na aba Minha Unidade.
        </p>
      </div>
    );
  }

  const publishedReportForMonth = publishedReports.find(
    (r) => r.competence === selectedCompetence
  );

  return (
    <div className="space-y-6">
      {seedingData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-3 text-sm text-amber-900">
          <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <div>
            <p className="font-medium">Importando histórico oficial da planilha...</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Gravando lançamentos de Junho/2024 a Dezembro/2026, prestações de contas e extratos das 6 unidades.
            </p>
          </div>
        </div>
      )}

      {/* Cabeçalho de Competência */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight text-balance">
            Painel Financeiro — {formatCompetenceLabel(selectedCompetence)}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {isResident
              ? 'Prestação de contas publicada · Valores consolidados em BRL'
              : publishedReportForMonth?.published
                ? 'Competência publicada para moradores · Cálculos automáticos em tempo real'
                : 'Competência em aberto (rascunho) · Cálculos automáticos em tempo real'}
          </p>
        </div>

        {/* Seletor de Ano e Mês */}
        <div className="flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
          <label className="sr-only" htmlFor="select-year">
            Ano
          </label>
          <select
            id="select-year"
            value={selectedYear}
            onChange={(e) => {
              const yr = e.target.value;
              const match = availableCompetences.find((c) => c === `${yr}-${selectedMonth}`) ??
                availableCompetences.find((c) => c.startsWith(`${yr}-`));
              if (match) onSelectCompetence(match);
            }}
            className="px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="select-month">
            Mês
          </label>
          <select
            id="select-month"
            value={selectedCompetence}
            onChange={(e) => onSelectCompetence(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            {(monthsInYear.length > 0 ? monthsInYear : availableCompetences).map((c) => (
              <option key={c} value={c}>
                {formatCompetenceLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Indicadores Principais */}
      {currentSummary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              title="Saldo bancário atual"
              value={formatBRL(currentSummary.currentBalance)}
              subtitle={`Saldo inicial: ${formatBRL(currentSummary.previousBalance)}`}
              icon={<Landmark className="w-4 h-4 text-amber-700" />}
              emphasis={currentSummary.currentBalance >= 0 ? 'neutral' : 'danger'}
            />
            <KpiCard
              title="Receitas recebidas"
              value={formatBRL(currentSummary.totalIncomeReceived)}
              subtitle={
                !isResident && currentSummary.totalReceivable > 0
                  ? `A receber: ${formatBRL(currentSummary.totalReceivable)}`
                  : 'Valores efetivamente em conta'
              }
              icon={<ArrowUpRight className="w-4 h-4 text-emerald-700" />}
              emphasis="positive"
            />
            <KpiCard
              title="Despesas pagas"
              value={formatBRL(currentSummary.totalExpensesPaid)}
              subtitle={`Fixas ${formatBRL(currentSummary.totalFixedExpensesPaid)} · Manut. ${formatBRL(currentSummary.totalMaintenanceExpensesPaid)}`}
              icon={<ArrowDownRight className="w-4 h-4 text-red-700" />}
              emphasis="danger"
            />
            <KpiCard
              title="Resultado do mês"
              value={
                (currentSummary.monthResult >= 0 ? '+' : '') +
                formatBRL(currentSummary.monthResult)
              }
              subtitle={
                currentSummary.monthResult >= 0
                  ? 'Superávit no período'
                  : 'Déficit coberto pelo saldo anterior'
              }
              icon={<Wallet className="w-4 h-4 text-stone-700" />}
              emphasis={currentSummary.monthResult >= 0 ? 'positive' : 'warning'}
            />
          </div>

          {/* Segunda faixa de indicadores: Adimplência / Valores a Receber ou Minha Unidade */}
          {!isResident ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-stone-200 rounded-xl p-5 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-stone-500">Unidades adimplentes</p>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                </div>
                <p className="text-2xl font-semibold text-stone-900 font-mono tabular-nums">
                  {currentSummary.compliantUnitsCount}{' '}
                  <span className="text-sm font-normal text-stone-500">
                    / {currentSummary.unitStatuses.length}
                  </span>
                </p>
                <p className="text-xs font-medium text-emerald-700 mt-1.5">Em dia</p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-stone-500">
                    Unidades pendentes / inadimplentes
                  </p>
                  {currentSummary.delinquentUnitsCount > 0 ? (
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                </div>
                <p className="text-2xl font-semibold text-stone-900 font-mono tabular-nums">
                  {currentSummary.delinquentUnitsCount}
                </p>
                <p
                  className={`text-xs font-medium mt-1.5 ${
                    currentSummary.delinquentUnitsCount > 0
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {currentSummary.delinquentUnitsCount > 0
                    ? 'Acompanhamento'
                    : 'Zero pendências'}
                </p>
              </div>

              <div className="bg-white border border-stone-200 rounded-xl p-5 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-stone-500">Total a receber no mês</p>
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                </div>
                <p className="text-2xl font-semibold text-stone-900 font-mono tabular-nums">
                  {formatBRL(currentSummary.totalReceivable)}
                </p>
                <p className="text-xs font-medium text-stone-600 mt-1.5">
                  Aguardando pagamento
                </p>
              </div>
            </div>
          ) : (
            myUnitStatement && (
              <div className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-stone-500">
                    Resumo financeiro da sua unidade ({myUnitStatement.unitCode})
                  </p>
                  <p className="text-sm text-stone-700 mt-1">
                    Total pago acumulado:{' '}
                    <strong className="font-mono tabular-nums text-stone-900">
                      {formatBRL(myUnitStatement.totalPaid)}
                    </strong>
                    {' · '}
                    Em aberto:{' '}
                    <strong
                      className={`font-mono tabular-nums ${
                        myUnitStatement.totalPending > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatBRL(myUnitStatement.totalPending)}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  {myUnitStatement.totalPending > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                      <Clock className="w-4 h-4" />
                      Possui cobrança em aberto
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      Unidade adimplente
                    </span>
                  )}
                </div>
              </div>
            )
          )}

          {/* Gráficos Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 1: Receitas vs Despesas */}
            <section className="bg-white border border-stone-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-stone-900">
                  Receitas versus despesas por mês
                </h2>
                <p className="text-xs text-stone-500">
                  Valores efetivamente recebidos e pagos nos últimos 12 meses
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#78716C' }}
                      tickFormatter={(v: number) => `R$${Math.round(v / 1000)}k`}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatBRL(Number(value ?? 0))}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E7E5E4',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="receitas" name="Receitas" fill="#B45309" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Gráfico 2: Evolução do Saldo Bancário */}
            <section className="bg-white border border-stone-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-stone-900">
                  Evolução do saldo bancário
                </h2>
                <p className="text-xs text-stone-500">
                  Saldo acumulado em conta ao final de cada competência
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#B45309" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#B45309" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#78716C' }}
                      tickFormatter={(v: number) => `R$${Math.round(v)}`}
                      width={60}
                    />
                    <Tooltip
                      formatter={(value) => formatBRL(Number(value ?? 0))}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E7E5E4',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo em Conta"
                      stroke="#B45309"
                      strokeWidth={2}
                      fill="url(#saldoFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Gráfico 3: Despesas por Categoria */}
            <section className="bg-white border border-stone-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-stone-900">
                  Despesas por categoria ({currentSummary.label})
                </h2>
                <p className="text-xs text-stone-500">
                  Distribuição entre custos mensais recorrentes e manutenções
                </p>
              </div>
              {currentSummary.expenseByCategory.length === 0 ? (
                <div className="h-72 flex items-center justify-center text-sm text-stone-500">
                  Nenhuma despesa liquidada nesta competência.
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={currentSummary.expenseByCategory.slice(0, 8)}
                      layout="vertical"
                      margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#78716C' }}
                        tickFormatter={(v: number) => `R$${Math.round(v)}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="category"
                        width={148}
                        tick={{ fontSize: 11, fill: '#57534E' }}
                      />
                      <Tooltip
                        formatter={(value) => formatBRL(Number(value ?? 0))}
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#E7E5E4',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="amount" name="Despesa" fill="#57534E" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Gráfico 4: Histórico de Arrecadação */}
            <section className="bg-white border border-stone-200 rounded-xl p-5">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-stone-900">
                  Histórico de arrecadação
                </h2>
                <p className="text-xs text-stone-500">
                  {isResident
                    ? 'Evolução das receitas mensais publicadas'
                    : 'Comparativo entre valor previsto lançado e valor efetivamente recebido'}
                </p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" vertical={false} />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11, fill: '#78716C' }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#78716C' }}
                      tickFormatter={(v: number) => `R$${Math.round(v / 1000)}k`}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => formatBRL(Number(value ?? 0))}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E7E5E4',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    {!isResident && (
                      <Bar dataKey="previsto" name="Previsto" fill="#D6D3D1" radius={[4, 4, 0, 0]} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="receitas"
                      name="Arrecadado"
                      stroke="#D97706"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl p-6 text-sm text-stone-600">
          Nenhum dado encontrado para a competência selecionada.
        </div>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  emphasis,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  emphasis: 'neutral' | 'positive' | 'danger' | 'warning';
}) {
  const valueColor =
    emphasis === 'positive'
      ? 'text-emerald-700'
      : emphasis === 'danger'
        ? 'text-red-700'
        : emphasis === 'warning'
          ? 'text-amber-700'
          : 'text-stone-900';

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-stone-500">{title}</span>
        {icon}
      </div>
      <p className={`text-2xl font-semibold font-mono tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </p>
      <p className="text-xs text-stone-500 mt-1.5 truncate">{subtitle}</p>
    </div>
  );
}

function buildCategoriesFromReport(report: MonthlyReport) {
  const map = new Map<string, { amount: number; group: string }>();
  for (const item of report.fixedExpenseItems) {
    const prev = map.get(item.category) ?? { amount: 0, group: 'Custos mensais' };
    map.set(item.category, { amount: prev.amount + item.amount, group: prev.group });
  }
  for (const item of report.maintenanceExpenseItems) {
    const prev = map.get(item.category) ?? { amount: 0, group: 'Manutenções e serviços' };
    map.set(item.category, { amount: prev.amount + item.amount, group: prev.group });
  }
  return Array.from(map.entries())
    .map(([category, info]) => ({ category, amount: info.amount, group: info.group }))
    .sort((a, b) => b.amount - a.amount);
}
