import { useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  CalendarPlus,
  Check,
  Download,
  ExternalLink,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import {
  FIELD_LIMITS,
  type ExpenseGroup,
  type Receipt,
  type ReceiptVisibility,
  type Transaction,
  type TransactionStatus,
  type TransactionType,
  type Unit,
  type UserRole,
} from '../types/condo';
import {
  FIXED_EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MAINTENANCE_EXPENSE_CATEGORIES,
  formatBRL,
  formatCompetenceLabel,
  formatDateBR,
  getTodaySaoPauloISO,
  statusLabel,
} from '../utils/formatters';

interface TransactionsViewProps {
  role: UserRole;
  userId: string;
  selectedCompetence: string;
  onSelectCompetence: (comp: string) => void;
  availableCompetences: string[];
  transactions: Transaction[];
  units: Unit[];
  defaultDueDay: number;
  onSaveTransaction: (tx: Omit<Transaction, 'createdAt' | 'updatedAt'>, isNew: boolean) => Promise<void>;
  onDeleteTransaction: (tx: Transaction) => Promise<void>;
  onGenerateMonthlyCharges: (
    competence: string,
    dueDay: number,
    extraConventional: number,
    extraPenthouse: number,
    extraDescription: string
  ) => Promise<number>;
  onUploadReceipt: (
    tx: Transaction,
    fileName: string,
    mimeType: string,
    dataUrl: string,
    visibility: ReceiptVisibility
  ) => Promise<void>;
}

type TabFilter = 'todos' | 'receitas' | 'custos_fixos' | 'manutencao' | 'pendentes';

export function TransactionsView({
  role,
  userId,
  selectedCompetence,
  onSelectCompetence,
  availableCompetences,
  transactions,
  units,
  defaultDueDay,
  onSaveTransaction,
  onDeleteTransaction,
  onGenerateMonthlyCharges,
  onUploadReceipt,
}: TransactionsViewProps) {
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState<TabFilter>('todos');
  const [scopeAllMonths, setScopeAllMonths] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  // Modais
  const [editingTx, setEditingTx] = useState<Partial<Transaction> | null>(null);
  const [isNewTx, setIsNewTx] = useState(true);
  const [savingTx, setSavingTx] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genCompetence, setGenCompetence] = useState(selectedCompetence);
  const [genDueDay, setGenDueDay] = useState(defaultDueDay);
  const [genExtraMode, setGenExtraMode] = useState<'manual' | 'fracao_ideal' | 'igualitario'>(
    'fracao_ideal'
  );
  const [genExtraTotal, setGenExtraTotal] = useState('0');
  const [genExtraConv, setGenExtraConv] = useState('0');
  const [genExtraCob, setGenExtraCob] = useState('0');
  const [genExtraDesc, setGenExtraDesc] = useState('Taxa Extra');
  const [genStatusMsg, setGenStatusMsg] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Comprovantes
  const [receiptTargetTx, setReceiptTargetTx] = useState<Transaction | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<Receipt | null>(null);
  const [receiptVisibility, setReceiptVisibility] = useState<ReceiptVisibility>('published_residents');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (!scopeAllMonths && tx.competence !== selectedCompetence) return false;
        if (tab === 'receitas' && tx.type !== 'income') return false;
        if (tab === 'custos_fixos' && (tx.type !== 'expense' || tx.expenseGroup !== 'custos_fixos'))
          return false;
        if (
          tab === 'manutencao' &&
          (tx.type !== 'expense' || tx.expenseGroup !== 'manutencao_servicos')
        )
          return false;
        if (
          tab === 'pendentes' &&
          tx.status !== 'pendente' &&
          tx.status !== 'parcial' &&
          tx.status !== 'agendado' &&
          tx.status !== 'adiado'
        )
          return false;
        if (statusFilter !== 'todos' && tx.status !== statusFilter) return false;
        if (q) {
          const hay = `${tx.description} ${tx.category} ${tx.unitLabel ?? ''} ${tx.notes}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.competence.localeCompare(a.competence) || b.dueDate.localeCompare(a.dueDate));
  }, [transactions, scopeAllMonths, selectedCompetence, tab, statusFilter, search]);

  const totals = useMemo(() => {
    let incomeSettled = 0;
    let expenseSettled = 0;
    let pending = 0;
    for (const tx of filteredTransactions) {
      if (tx.status === 'cancelado') continue;
      if (tx.type === 'income') {
        incomeSettled += tx.settledAmount;
        if (tx.status === 'pendente' || tx.status === 'parcial' || tx.status === 'agendado') {
          pending += Math.max(0, tx.expectedAmount - tx.settledAmount);
        }
      } else {
        expenseSettled += tx.settledAmount;
      }
    }
    return { incomeSettled, expenseSettled, pending };
  }, [filteredTransactions]);

  const openCreateModal = (defaultType: TransactionType, defaultGroup?: ExpenseGroup) => {
    setIsNewTx(true);
    setEditingTx({
      id: '',
      type: defaultType,
      description: '',
      expenseGroup: defaultType === 'expense' ? defaultGroup ?? 'custos_fixos' : null,
      category:
        defaultType === 'income'
          ? INCOME_CATEGORIES[0]
          : defaultGroup === 'manutencao_servicos'
            ? MAINTENANCE_EXPENSE_CATEGORIES[0]
            : FIXED_EXPENSE_CATEGORIES[0],
      competence: selectedCompetence,
      dueDate: `${selectedCompetence}-${String(defaultDueDay).padStart(2, '0')}`,
      settlementDate: getTodaySaoPauloISO(),
      expectedAmount: 0,
      settledAmount: 0,
      status: defaultType === 'income' ? 'pendente' : 'pago',
      unitId: null,
      unitLabel: null,
      notes: '',
      installmentLabel: null,
      receiptUrl: null,
    });
  };

  const openEditModal = (tx: Transaction) => {
    setIsNewTx(false);
    setEditingTx({ ...tx });
  };

  const handleQuickSettle = async (tx: Transaction) => {
    const today = getTodaySaoPauloISO();
    const newStatus: TransactionStatus = tx.type === 'income' ? 'recebido' : 'pago';
    await onSaveTransaction(
      {
        ...tx,
        status: newStatus,
        settledAmount: tx.expectedAmount,
        settlementDate: today,
      },
      false
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    setSavingTx(true);
    try {
      const unitObj = units.find((u) => u.id === editingTx.unitId);
      const expected = Number(editingTx.expectedAmount) || 0;
      const status = (editingTx.status ?? 'pendente') as TransactionStatus;
      let settled = Number(editingTx.settledAmount) || 0;
      if ((status === 'recebido' || status === 'pago' || status === 'debito_automatico') && settled === 0) {
        settled = expected;
      }
      if (status === 'pendente' || status === 'agendado' || status === 'adiado' || status === 'cancelado') {
        settled = 0;
      }

      await onSaveTransaction(
        {
          id: editingTx.id || '',
          type: editingTx.type ?? 'expense',
          description: (editingTx.description ?? '').trim(),
          expenseGroup:
            editingTx.type === 'expense'
              ? editingTx.expenseGroup ?? 'manutencao_servicos'
              : null,
          category: (editingTx.category ?? 'Outras despesas').trim(),
          competence: editingTx.competence ?? selectedCompetence,
          dueDate: editingTx.dueDate ?? `${selectedCompetence}-15`,
          settlementDate: settled > 0 ? editingTx.settlementDate || getTodaySaoPauloISO() : null,
          expectedAmount: expected,
          settledAmount: settled,
          status,
          unitId: editingTx.type === 'income' ? editingTx.unitId ?? null : null,
          unitLabel: editingTx.type === 'income' && unitObj ? unitObj.code : null,
          notes: editingTx.notes ?? '',
          installmentLabel: editingTx.installmentLabel || null,
          receiptId: editingTx.receiptId ?? null,
          receiptUrl: editingTx.receiptUrl || null,
          createdBy: editingTx.createdBy || userId,
        },
        isNewTx
      );
      setEditingTx(null);
    } finally {
      setSavingTx(false);
    }
  };

  const computedExtra = useMemo(() => {
    const total = Math.max(0, Number(genExtraTotal) || 0);
    if (genExtraMode === 'fracao_ideal') {
      const conv = Math.round(total * 0.16 * 100) / 100;
      const cob = Math.round(total * 0.18 * 100) / 100;
      return { conv, cob };
    }
    if (genExtraMode === 'igualitario') {
      const each = Math.round((total / 6) * 100) / 100;
      return { conv: each, cob: each };
    }
    return {
      conv: Math.max(0, Number(genExtraConv) || 0),
      cob: Math.max(0, Number(genExtraCob) || 0),
    };
  }, [genExtraMode, genExtraTotal, genExtraConv, genExtraCob]);

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenStatusMsg(null);
    try {
      const count = await onGenerateMonthlyCharges(
        genCompetence,
        genDueDay,
        computedExtra.conv,
        computedExtra.cob,
        genExtraDesc
      );
      if (count === 0) {
        setGenStatusMsg('Todas as cobranças mensais desta competência já estavam geradas.');
      } else {
        setGenStatusMsg(`${count} lançamento(s) criado(s) com sucesso em ${formatCompetenceLabel(genCompetence)}.`);
        onSelectCompetence(genCompetence);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenReceiptViewer = async (tx: Transaction) => {
    setReceiptError(null);
    setReceiptTargetTx(tx);
    setReceiptPreview(null);
    if (tx.receiptId) {
      try {
        const snap = await getDoc(doc(db, 'receipts', tx.receiptId));
        if (snap.exists()) {
          setReceiptPreview(snap.data() as Receipt);
        }
      } catch {
        setReceiptError('Não foi possível carregar o comprovante anexado.');
      }
    }
  };

  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !receiptTargetTx) return;
    setReceiptError(null);
    setUploadingReceipt(true);
    try {
      let dataUrl: string;
      let mimeType = file.type || 'application/octet-stream';

      if (file.type.startsWith('image/')) {
        dataUrl = await compressImageToDataUrl(file, 1280, 0.78);
        mimeType = 'image/jpeg';
      } else {
        if (file.size > 520 * 1024) {
          setReceiptError('Arquivos PDF devem ter no máximo 500 KB (ou utilize um link do Drive no lançamento).');
          return;
        }
        dataUrl = await readFileAsDataUrl(file);
      }

      if (dataUrl.length > 740000) {
        setReceiptError('Arquivo muito grande após compressão. Reduza o tamanho ou informe um link.');
        return;
      }

      await onUploadReceipt(receiptTargetTx, file.name, mimeType, dataUrl, receiptVisibility);
      setReceiptTargetTx(null);
      setReceiptPreview(null);
    } finally {
      setUploadingReceipt(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
            Receitas e Despesas
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {isAdmin
              ? 'Gerencie cobranças condominiais, custos fixos mensais, manutenções e comprovantes'
              : 'Consulta detalhada das movimentações financeiras e comprovantes autorizados'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setGenCompetence(selectedCompetence);
                setGenStatusMsg(null);
                setShowGenerateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4" />
              Gerar cobranças do mês
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('income')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-emerald-700" />
              Nova receita
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('expense', 'custos_fixos')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nova despesa
            </button>
          </div>
        )}
      </div>

      {/* Filtros e Abas */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Abas segmentadas */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'receitas', label: 'Receitas' },
                { id: 'custos_fixos', label: 'Custos fixos' },
                { id: 'manutencao', label: 'Manutenções' },
                { id: 'pendentes', label: 'Pendentes' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === item.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Controles de busca e competência */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar descrição, unidade..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
              />
            </div>

            <select
              aria-label="Filtrar competência"
              value={scopeAllMonths ? 'ALL' : selectedCompetence}
              onChange={(e) => {
                if (e.target.value === 'ALL') {
                  setScopeAllMonths(true);
                } else {
                  setScopeAllMonths(false);
                  onSelectCompetence(e.target.value);
                }
              }}
              className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <option value="ALL">Todas as competências</option>
              {availableCompetences
                .slice()
                .reverse()
                .map((c) => (
                  <option key={c} value={c}>
                    {formatCompetenceLabel(c)}
                  </option>
                ))}
            </select>

            <select
              aria-label="Filtrar situação"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-sm border border-stone-300 rounded-lg bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <option value="todos">Todas as situações</option>
              <option value="recebido">Recebido</option>
              <option value="pago">Pago</option>
              <option value="debito_automatico">Débito Automático</option>
              <option value="pendente">Pendente</option>
              <option value="agendado">Agendado</option>
              <option value="parcial">Parcial</option>
              <option value="adiado">Adiado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Barra de totais do recorte atual */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pt-2 border-t border-stone-100 text-xs text-stone-600">
          <span>
            Registros: <strong className="font-mono text-stone-900">{filteredTransactions.length}</strong>
          </span>
          <span>
            Recebido:{' '}
            <strong className="font-mono tabular-nums text-emerald-700">
              {formatBRL(totals.incomeSettled)}
            </strong>
          </span>
          <span>
            Pago:{' '}
            <strong className="font-mono tabular-nums text-red-700">
              -{formatBRL(totals.expenseSettled)}
            </strong>
          </span>
          <span>
            A receber:{' '}
            <strong className="font-mono tabular-nums text-amber-700">
              {formatBRL(totals.pending)}
            </strong>
          </span>
        </div>
      </div>

      {/* Tabela responsiva de lançamentos */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500">
            Nenhum lançamento encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                  <th className="py-3 px-4">Data / Comp.</th>
                  <th className="py-3 px-4">Descrição e categoria</th>
                  <th className="py-3 px-4">Unidade / Detalhe</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Previsto</th>
                  <th className="py-3 px-4 text-right">Liquidado</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-sm">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const isPending =
                    tx.status === 'pendente' || tx.status === 'parcial' || tx.status === 'agendado';
                  return (
                    <tr key={tx.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-xs text-stone-600 tabular-nums">
                        <div className="text-stone-900 font-medium">{formatDateBR(tx.dueDate)}</div>
                        <div className="text-stone-400">{formatCompetenceLabel(tx.competence)}</div>
                      </td>
                      <td className="py-2.5 px-4 min-w-[220px]">
                        <div className="font-medium text-stone-900">{tx.description}</div>
                        <div className="text-xs text-stone-500">
                          {tx.category}
                          {!isIncome && tx.expenseGroup && (
                            <>
                              {' · '}
                              {tx.expenseGroup === 'custos_fixos' ? 'Custo fixo' : 'Manutenção'}
                            </>
                          )}
                          {tx.installmentLabel ? ` · Parcela ${tx.installmentLabel}` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-stone-600 max-w-[220px]">
                        {tx.unitLabel && (
                          <div className="font-medium text-stone-800">{tx.unitLabel}</div>
                        )}
                        {tx.notes && (
                          <div className="truncate text-stone-500" title={tx.notes}>
                            {tx.notes}
                          </div>
                        )}
                        {!tx.unitLabel && !tx.notes && <span className="text-stone-400">—</span>}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-xs font-medium">
                        <span
                          className={
                            tx.status === 'recebido' || tx.status === 'pago' || tx.status === 'debito_automatico'
                              ? 'text-emerald-700'
                              : tx.status === 'pendente' || tx.status === 'parcial' || tx.status === 'agendado'
                                ? 'text-amber-700'
                                : 'text-stone-500'
                          }
                        >
                          {statusLabel(tx.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums text-stone-600">
                        {isIncome ? '' : '-'}
                        {formatBRL(tx.expectedAmount)}
                      </td>
                      <td
                        className={`py-2.5 px-4 whitespace-nowrap text-right font-mono tabular-nums font-medium ${
                          tx.settledAmount === 0
                            ? 'text-stone-400'
                            : isIncome
                              ? 'text-emerald-700'
                              : 'text-red-700'
                        }`}
                      >
                        {tx.settledAmount > 0 ? (isIncome ? '' : '-') : ''}
                        {formatBRL(tx.settledAmount)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {(tx.receiptId || tx.receiptUrl || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => void handleOpenReceiptViewer(tx)}
                              title={tx.receiptId || tx.receiptUrl ? 'Ver comprovante' : 'Anexar comprovante'}
                              className={`p-1.5 rounded-md transition-colors ${
                                tx.receiptId || tx.receiptUrl
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                              }`}
                            >
                              <Paperclip className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && isPending && (
                            <button
                              type="button"
                              onClick={() => void handleQuickSettle(tx)}
                              title={isIncome ? 'Registrar recebimento' : 'Registrar pagamento'}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(tx)}
                                title="Editar lançamento"
                                className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-md transition-colors"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(tx)}
                                title="Excluir lançamento"
                                className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Criar / Editar Lançamento */}
      {editingTx && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-xl max-w-xl w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">
                {isNewTx
                  ? editingTx.type === 'income'
                    ? 'Nova Receita'
                    : 'Nova Despesa'
                  : 'Editar Lançamento'}
              </h2>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitForm(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Tipo</label>
                  <select
                    value={editingTx.type ?? 'expense'}
                    onChange={(e) => {
                      const t = e.target.value as TransactionType;
                      setEditingTx({
                        ...editingTx,
                        type: t,
                        expenseGroup: t === 'expense' ? 'custos_fixos' : null,
                        category:
                          t === 'income' ? INCOME_CATEGORIES[0] : FIXED_EXPENSE_CATEGORIES[0],
                        status: t === 'income' ? 'pendente' : 'pago',
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                </div>

                {editingTx.type === 'expense' ? (
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Grupo de despesa
                    </label>
                    <select
                      value={editingTx.expenseGroup ?? 'custos_fixos'}
                      onChange={(e) => {
                        const grp = e.target.value as ExpenseGroup;
                        setEditingTx({
                          ...editingTx,
                          expenseGroup: grp,
                          category:
                            grp === 'custos_fixos'
                              ? FIXED_EXPENSE_CATEGORIES[0]
                              : MAINTENANCE_EXPENSE_CATEGORIES[0],
                        });
                      }}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="custos_fixos">Custos mensais recorrentes</option>
                      <option value="manutencao_servicos">Manutenções e serviços</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Unidade relacionada
                    </label>
                    <select
                      value={editingTx.unitId ?? ''}
                      onChange={(e) =>
                        setEditingTx({ ...editingTx, unitId: e.target.value || null })
                      }
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                    >
                      <option value="">Geral / Não vinculada</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} ({u.ownerName})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Descrição</label>
                  <input
                    required
                    maxLength={FIELD_LIMITS.DESC_MAX}
                    value={editingTx.description ?? ''}
                    onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })}
                    placeholder="Ex: Conta de água - Copasa"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Categoria</label>
                  <select
                    value={editingTx.category ?? ''}
                    onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    {(editingTx.type === 'income'
                      ? INCOME_CATEGORIES
                      : editingTx.expenseGroup === 'custos_fixos'
                        ? FIXED_EXPENSE_CATEGORIES
                        : MAINTENANCE_EXPENSE_CATEGORIES
                    ).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Competência
                  </label>
                  <input
                    type="month"
                    required
                    value={editingTx.competence ?? selectedCompetence}
                    onChange={(e) => setEditingTx({ ...editingTx, competence: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Vencimento</label>
                  <input
                    type="date"
                    required
                    value={editingTx.dueDate ?? ''}
                    onChange={(e) => setEditingTx({ ...editingTx, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Data liquidação
                  </label>
                  <input
                    type="date"
                    value={editingTx.settlementDate ?? ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, settlementDate: e.target.value || null })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Valor previsto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingTx.expectedAmount ?? 0}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, expectedAmount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Valor liquidado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingTx.settledAmount ?? 0}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, settledAmount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Situação</label>
                  <select
                    value={editingTx.status ?? 'pendente'}
                    onChange={(e) => {
                      const s = e.target.value as TransactionStatus;
                      const expected = Number(editingTx.expectedAmount) || 0;
                      setEditingTx({
                        ...editingTx,
                        status: s,
                        settledAmount:
                          s === 'recebido' || s === 'pago' || s === 'debito_automatico'
                            ? expected
                            : s === 'pendente' || s === 'agendado' || s === 'adiado' || s === 'cancelado'
                              ? 0
                              : editingTx.settledAmount ?? 0,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="pendente">Pendente</option>
                    <option value="parcial">Parcial</option>
                    <option value="recebido">Recebido</option>
                    <option value="pago">Pago</option>
                    <option value="agendado">Agendado</option>
                    <option value="debito_automatico">Débito Automático</option>
                    <option value="adiado">Adiado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Link externo de comprovante (opcional)
                  </label>
                  <input
                    type="url"
                    maxLength={FIELD_LIMITS.URL_MAX}
                    value={editingTx.receiptUrl ?? ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, receiptUrl: e.target.value || null })
                    }
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Parcela (opcional)
                  </label>
                  <input
                    maxLength={40}
                    value={editingTx.installmentLabel ?? ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, installmentLabel: e.target.value || null })
                    }
                    placeholder="Ex: 4 de 6"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Observações</label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.NOTES_MAX}
                  value={editingTx.notes ?? ''}
                  onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTx}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg"
                >
                  {savingTx ? 'Salvando...' : 'Salvar lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Gerar Cobranças Mensais */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">
                Gerar cobranças condominiais do mês
              </h2>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleGenerateSubmit(e)} className="space-y-4">
              <p className="text-xs text-stone-600 leading-relaxed">
                Cria automaticamente a cobrança mensal pendente para as 6 unidades ativas utilizando
                a taxa configurada de cada unidade (sem duplicar cobranças já existentes).
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Competência
                  </label>
                  <input
                    type="month"
                    required
                    value={genCompetence}
                    onChange={(e) => setGenCompetence(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Dia de vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={genDueDay}
                    onChange={(e) => setGenDueDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-800">
                    Taxa Extra opcional (deixe 0 para não gerar)
                  </p>
                  <select
                    aria-label="Critério de rateio da taxa extra"
                    value={genExtraMode}
                    onChange={(e) =>
                      setGenExtraMode(e.target.value as 'manual' | 'fracao_ideal' | 'igualitario')
                    }
                    className="px-2.5 py-1 text-xs border border-stone-300 rounded-md bg-white text-stone-800"
                  >
                    <option value="fracao_ideal">Fração Ideal da Convenção (16% / 18%)</option>
                    <option value="igualitario">Divisão Igualitária (1/6 por unidade)</option>
                    <option value="manual">Informar valores por tipo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-stone-600 mb-1">Descrição da taxa extra</label>
                  <input
                    value={genExtraDesc}
                    onChange={(e) => setGenExtraDesc(e.target.value)}
                    placeholder="Ex: Taxa Extra — Obra emergencial (1 de 3)"
                    className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg"
                  />
                </div>

                {genExtraMode === 'manual' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        Convencional 101–202 (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={genExtraConv}
                        onChange={(e) => setGenExtraConv(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-stone-600 mb-1">
                        Cobertura 301–302 (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={genExtraCob}
                        onChange={(e) => setGenExtraCob(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">
                      Valor total a ratear entre as 6 unidades (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={genExtraTotal}
                      onChange={(e) => setGenExtraTotal(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-stone-300 rounded-lg font-mono"
                    />
                  </div>
                )}

                {(computedExtra.conv > 0 || computedExtra.cob > 0) && (
                  <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Convencionais (4×):{' '}
                      <strong className="font-mono text-stone-900">
                        {formatBRL(computedExtra.conv)}
                      </strong>
                    </span>
                    <span>
                      Coberturas (2×):{' '}
                      <strong className="font-mono text-stone-900">
                        {formatBRL(computedExtra.cob)}
                      </strong>
                    </span>
                    <span>
                      Total:{' '}
                      <strong className="font-mono text-amber-800">
                        {formatBRL(computedExtra.conv * 4 + computedExtra.cob * 2)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              {genStatusMsg && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  {genStatusMsg}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg"
                >
                  {generating ? 'Gerando...' : 'Gerar cobranças'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Comprovante */}
      {receiptTargetTx && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">
                Comprovante — {receiptTargetTx.description}
              </h2>
              <button
                type="button"
                onClick={() => setReceiptTargetTx(null)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {receiptTargetTx.receiptUrl && (
              <a
                href={receiptTargetTx.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir link externo do comprovante
              </a>
            )}

            {receiptPreview && (
              <div className="border border-stone-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs text-stone-600">
                  <span className="truncate font-medium">{receiptPreview.fileName}</span>
                  <a
                    href={receiptPreview.dataUrl}
                    download={receiptPreview.fileName}
                    className="inline-flex items-center gap-1 text-amber-700 font-medium hover:underline shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                </div>
                {receiptPreview.mimeType.startsWith('image/') ? (
                  <img
                    src={receiptPreview.dataUrl}
                    alt={receiptPreview.fileName}
                    className="max-h-72 w-full object-contain rounded bg-stone-50"
                  />
                ) : (
                  <div className="p-4 bg-stone-50 rounded text-xs text-stone-600 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-500" />
                    Documento anexado ({receiptPreview.mimeType}). Clique em Baixar acima para abrir.
                  </div>
                )}
              </div>
            )}

            {receiptError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {receiptError}
              </div>
            )}

            {isAdmin && (
              <div className="pt-2 border-t border-stone-200 space-y-3">
                <label className="block text-xs font-medium text-stone-700">
                  Visibilidade do comprovante
                </label>
                <select
                  value={receiptVisibility}
                  onChange={(e) => setReceiptVisibility(e.target.value as ReceiptVisibility)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                >
                  <option value="published_residents">
                    Conselheiros e moradores (quando aplicável)
                  </option>
                  <option value="council_and_admin">Somente Síndico e Conselheiros</option>
                </select>

                <label className="block">
                  <span className="block text-xs font-medium text-stone-700 mb-1">
                    {receiptPreview ? 'Substituir arquivo (Imagem ou PDF até 500 KB)' : 'Anexar arquivo (Imagem ou PDF até 500 KB)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploadingReceipt}
                    onChange={(e) => void handleReceiptFileChange(e)}
                    className="block w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-stone-300 file:text-xs file:font-medium file:bg-stone-50 file:text-stone-700 hover:file:bg-stone-100"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-stone-900 mb-2">Excluir lançamento?</h2>
            <p className="text-sm text-stone-600 mb-5">
              Confirma a exclusão de <strong>{deleteTarget.description}</strong> ({formatBRL(deleteTarget.expectedAmount)}) em {formatCompetenceLabel(deleteTarget.competence)}?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  void onDeleteTransaction(target);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file: File, maxDim: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponível'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };
    img.src = url;
  });
}
