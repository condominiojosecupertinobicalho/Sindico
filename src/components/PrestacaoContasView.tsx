import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  EyeOff,
  FileCheck2,
  FileSpreadsheet,
  FolderArchive,
  Printer,
  Send,
} from 'lucide-react';
import { OFFICIAL_MONTHLY_ARCHIVE } from '../data/monthlyArchiveManifest';
import type { MonthlyDocument, MonthlyReport, Transaction, UserRole } from '../types/condo';
import type { MonthlySummary } from '../utils/accounting';
import { exportTransactionsToCsv, downloadTextFile } from '../utils/csvHelper';
import { formatBRL, formatCompetenceLabel } from '../utils/formatters';
import { MonthlyArchiveView } from './MonthlyArchiveView';

interface PrestacaoContasViewProps {
  role: UserRole;
  userId: string;
  selectedCompetence: string;
  onSelectCompetence: (competence: string) => void;
  availableCompetences: string[];
  summary: MonthlySummary | null;
  reportDoc: MonthlyReport | null;
  monthTransactions: Transaction[];
  monthlyDocuments: MonthlyDocument[];
  onPublishToggle: (competence: string, publish: boolean, notes: string) => Promise<void>;
  onSaveMonthlyDocument: (
    doc: Omit<MonthlyDocument, 'createdAt' | 'updatedAt'>,
    isNew: boolean
  ) => Promise<string>;
  onDeleteMonthlyDocument: (docId: string) => Promise<void>;
}

export function PrestacaoContasView({
  role,
  userId,
  selectedCompetence,
  onSelectCompetence,
  availableCompetences,
  summary,
  reportDoc,
  monthTransactions,
  monthlyDocuments,
  onPublishToggle,
  onSaveMonthlyDocument,
  onDeleteMonthlyDocument,
}: PrestacaoContasViewProps) {
  const isAdmin = role === 'admin';
  const isResident = role === 'morador';
  const isAdminOrCouncil = role === 'admin' || role === 'conselheiro';

  const [activeSection, setActiveSection] = useState<'relatorio' | 'pasta_mensal'>('relatorio');
  const [notes, setNotes] = useState(reportDoc?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const monthDocsCount = useMemo(() => {
    const visibleArchive = OFFICIAL_MONTHLY_ARCHIVE.filter(
      (d) =>
        d.competence === selectedCompetence &&
        (isAdminOrCouncil || d.visibility === 'published_residents')
    );
    const visibleFirestore = monthlyDocuments.filter(
      (d) =>
        d.competence === selectedCompetence &&
        (isAdminOrCouncil || d.visibility === 'published_residents')
    );
    return visibleArchive.length + visibleFirestore.length;
  }, [monthlyDocuments, selectedCompetence, isAdminOrCouncil]);

  useEffect(() => {
    setNotes(reportDoc?.notes ?? '');
  }, [reportDoc?.notes, selectedCompetence]);

  const data = isResident
    ? reportDoc
      ? {
          label: reportDoc.label,
          previousBalance: reportDoc.previousBalance,
          totalIncome: reportDoc.totalIncome,
          totalFixedExpenses: reportDoc.totalFixedExpenses,
          totalMaintenanceExpenses: reportDoc.totalMaintenanceExpenses,
          totalExpenses: reportDoc.totalExpenses,
          monthResult: reportDoc.monthResult,
          currentBalance: reportDoc.currentBalance,
          incomeItems: reportDoc.incomeItems,
          fixedExpenseItems: reportDoc.fixedExpenseItems,
          maintenanceExpenseItems: reportDoc.maintenanceExpenseItems,
          published: reportDoc.published,
          notes: reportDoc.notes ?? '',
        }
      : null
    : summary
      ? {
          label: summary.label,
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
          published: reportDoc?.published ?? false,
          notes: reportDoc?.notes ?? '',
        }
      : null;

  const handlePublish = async (publish: boolean) => {
    setSaving(true);
    try {
      await onPublishToggle(selectedCompetence, publish, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleExportReportCsv = () => {
    if (!data) return;
    if (!isResident && monthTransactions.length > 0) {
      const csv = exportTransactionsToCsv(monthTransactions);
      downloadTextFile(
        csv,
        `prestacao_contas_${selectedCompetence}.csv`,
        'text/csv;charset=utf-8;'
      );
      return;
    }

    // Para morador: exporta exclusivamente os itens consolidados do relatório publicado
    const lines = [
      'Grupo;Item;Categoria;Valor (BRL)',
      ...data.incomeItems.map((i) => `Receitas;"${i.label}";"${i.category}";"${i.amount.toFixed(2).replace('.', ',')}"`),
      ...data.fixedExpenseItems.map((i) => `Despesas - Custos Mensais;"${i.label}";"${i.category}";"-${i.amount.toFixed(2).replace('.', ',')}"`),
      ...data.maintenanceExpenseItems.map((i) => `Despesas - Manutenções e Serviços;"${i.label}";"${i.category}";"-${i.amount.toFixed(2).replace('.', ',')}"`),
      `Resumo;Saldo Anterior;;"${data.previousBalance.toFixed(2).replace('.', ',')}"`,
      `Resumo;Receita do Mês;;"${data.totalIncome.toFixed(2).replace('.', ',')}"`,
      `Resumo;Despesa do Mês;;"-${data.totalExpenses.toFixed(2).replace('.', ',')}"`,
      `Resumo;Resultado do Mês;;"${data.monthResult.toFixed(2).replace('.', ',')}"`,
      `Resumo;Saldo Atual em Conta;;"${data.currentBalance.toFixed(2).replace('.', ',')}"`,
    ];
    downloadTextFile(
      '\uFEFF' + lines.join('\r\n'),
      `prestacao_contas_${selectedCompetence}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de ações */}
      <div className="no-print space-y-4 pb-4 border-b border-stone-200">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
              Prestação de Contas — {formatCompetenceLabel(selectedCompetence)}
            </h1>
            <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-2">
              {data?.published ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="text-emerald-700 font-medium">Publicada aos moradores</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-amber-700 shrink-0" />
                  <span className="text-amber-700 font-medium">Rascunho interno (não publicado)</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Selecionar competência"
              value={selectedCompetence}
              onChange={(e) => onSelectCompetence(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              {availableCompetences
                .slice()
                .reverse()
                .map((c) => (
                  <option key={c} value={c}>
                    {formatCompetenceLabel(c)}
                  </option>
                ))}
            </select>

            {activeSection === 'relatorio' && data && (
              <>
                <button
                  type="button"
                  onClick={handleExportReportCsv}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
              </>
            )}

            {activeSection === 'relatorio' && isAdmin && data && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handlePublish(!data.published)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  data.published
                    ? 'text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300'
                    : 'text-white bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {data.published ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    {saving ? 'Salvando...' : 'Voltar para rascunho'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {saving ? 'Publicando...' : 'Fechar e publicar prestação'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Sub-navegação: Relatório Contábil | Pasta Mensal */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-stone-100 border border-stone-200 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveSection('relatorio')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'relatorio'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Resumo Contábil</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('pasta_mensal')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              activeSection === 'pasta_mensal'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Pasta Mensal e Documentos ({monthDocsCount})
            </span>
          </button>
        </div>
      </div>

      {activeSection === 'pasta_mensal' ? (
        <MonthlyArchiveView
          embedded
          role={role}
          userId={userId}
          selectedCompetence={selectedCompetence}
          onSelectCompetence={onSelectCompetence}
          firestoreDocuments={monthlyDocuments}
          onSaveDocument={onSaveMonthlyDocument}
          onDeleteDocument={onDeleteMonthlyDocument}
        />
      ) : !data ? (
        <div className="bg-white border border-stone-200 rounded-xl p-8 text-sm text-stone-600">
          Esta competência ainda não possui prestação de contas publicada.
        </div>
      ) : (
        <div className="print-only-full space-y-6">
          {/* Cabeçalho impresso */}
          <div className="hidden print:block border-b border-stone-300 pb-3 mb-4">
            <h1 className="text-lg font-bold text-stone-900">
              Condomínio José Cupertino Bicalho — Prestação de Contas ({data.label})
            </h1>
            <p className="text-xs text-stone-600">
              Documento consolidado gerado pelo sistema Condomínio Fácil
            </p>
          </div>

          {/* Grade 3 colunas preservando o modelo Looker Studio */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Coluna 1: Receitas */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                  Receitas
                </h2>
                <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
                  {formatBRL(data.totalIncome)}
                </span>
              </div>
              <div className="divide-y divide-stone-100">
                {data.incomeItems.length === 0 ? (
                  <p className="p-4 text-xs text-stone-500">Nenhuma receita liquidada no mês.</p>
                ) : (
                  data.incomeItems.map((item, idx) => (
                    <div
                      key={`${item.label}-${idx}`}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-stone-700 truncate" title={item.label}>
                        {item.label}
                        {item.count && item.count > 1 ? ` (${item.count})` : ''}
                      </span>
                      <span className="font-mono tabular-nums text-emerald-700 font-medium shrink-0">
                        {formatBRL(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-sm font-semibold">
                <span className="text-stone-800">Total geral</span>
                <span className="font-mono tabular-nums text-emerald-800">
                  {formatBRL(data.totalIncome)}
                </span>
              </div>
            </div>

            {/* Coluna 2: Despesas (Custos Mensais) */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-red-900">
                  Despesas (Custos Mensais)
                </h2>
                <span className="text-xs font-mono font-semibold text-red-800 tabular-nums">
                  -{formatBRL(data.totalFixedExpenses)}
                </span>
              </div>
              <div className="divide-y divide-stone-100">
                {data.fixedExpenseItems.length === 0 ? (
                  <p className="p-4 text-xs text-stone-500">Nenhum custo fixo liquidado no mês.</p>
                ) : (
                  data.fixedExpenseItems.map((item, idx) => (
                    <div
                      key={`${item.label}-${idx}`}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-stone-700 truncate" title={item.label}>
                        {item.label}
                      </span>
                      <span className="font-mono tabular-nums text-red-700 shrink-0">
                        -{formatBRL(item.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-sm font-semibold">
                <span className="text-stone-800">Total geral</span>
                <span className="font-mono tabular-nums text-red-800">
                  -{formatBRL(data.totalFixedExpenses)}
                </span>
              </div>
            </div>

            {/* Coluna 3: Despesas (Manutenções e Serviços) */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                  Despesas (Manutenções e Serviços)
                </h2>
                <span className="text-xs font-mono font-semibold text-amber-900 tabular-nums">
                  -{formatBRL(data.totalMaintenanceExpenses)}
                </span>
              </div>
              <div className="divide-y divide-stone-100">
                {data.maintenanceExpenseItems.length === 0 ? (
                  <p className="p-4 text-xs text-stone-500">Nenhuma manutenção paga no mês.</p>
                ) : (
                  data.maintenanceExpenseItems.map((item, idx) => (
                    <div
                      key={`${item.label}-${idx}`}
                      className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-stone-700 truncate" title={item.label}>
                        {item.label}
                        {item.status === 'adiado' ? ' (Adiado)' : ''}
                      </span>
                      <span className="font-mono tabular-nums text-red-700 shrink-0">
                        {item.amount > 0 ? `-${formatBRL(item.amount)}` : formatBRL(0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between text-sm font-semibold">
                <span className="text-stone-800">Total geral</span>
                <span className="font-mono tabular-nums text-red-800">
                  -{formatBRL(data.totalMaintenanceExpenses)}
                </span>
              </div>
            </div>
          </div>

          {/* Fechamento Contábil (Espelho do Looker Studio) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500">Saldo anterior</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-stone-800 mt-1">
                  {formatBRL(data.previousBalance)}
                </p>
              </div>
              <div className="pt-4 border-t border-stone-200">
                <p className="text-xs font-medium text-stone-500">Saldo atual em conta</p>
                <p
                  className={`text-3xl font-semibold font-mono tabular-nums mt-1 ${
                    data.currentBalance >= 0 ? 'text-amber-700' : 'text-red-700'
                  }`}
                >
                  {formatBRL(data.currentBalance)}
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl divide-y divide-stone-200">
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Receita do mês</span>
                <span className="text-lg font-semibold font-mono tabular-nums text-emerald-700">
                  {formatBRL(data.totalIncome)}
                </span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Despesa do mês</span>
                <span className="text-lg font-semibold font-mono tabular-nums text-red-700">
                  -{formatBRL(data.totalExpenses)}
                </span>
              </div>
              <div className="px-5 py-4 flex items-center justify-between bg-stone-50 rounded-b-xl">
                <span className="text-sm font-semibold text-stone-900">
                  Resultado financeiro do mês
                </span>
                <span
                  className={`text-xl font-semibold font-mono tabular-nums ${
                    data.monthResult >= 0 ? 'text-amber-700' : 'text-red-700'
                  }`}
                >
                  {(data.monthResult >= 0 ? '+' : '') + formatBRL(data.monthResult)}
                </span>
              </div>
            </div>
          </div>

          {/* Observações do Síndico */}
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-stone-800 mb-2">
              <FileCheck2 className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-semibold">Observações da prestação de contas</h3>
            </div>
            {isAdmin ? (
              <div className="space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Registre esclarecimentos sobre obras, revisões de contas ou saldo para os moradores..."
                  className="no-print w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                {notes && <p className="hidden print:block text-sm text-stone-700">{notes}</p>}
                <div className="no-print flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handlePublish(data.published)}
                    className="px-3.5 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Salvar observações
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-600 leading-relaxed">
                {data.notes || 'Sem observações adicionais registradas para esta competência.'}
              </p>
            )}
          </div>
          {/* Atalho contextual para Pasta Mensal / Auditoria */}
          <div className="no-print bg-amber-50/70 border border-amber-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FolderArchive className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-stone-900">
                  Documentos de auditoria de {formatCompetenceLabel(selectedCompetence)}
                </p>
                <p className="text-xs text-stone-600 mt-0.5">
                  {monthDocsCount > 0
                    ? `${monthDocsCount} arquivo(s) arquivado(s) nesta competência (extratos bancários, comprovantes, boletos, notas fiscais e recibos).`
                    : 'Acesse a Pasta Mensal para anexar ou consultar comprovantes e extratos deste período.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('pasta_mensal')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <span>Abrir Pasta Mensal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
