import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Home,
  Pencil,
  Phone,
  User,
  X,
} from 'lucide-react';
import type {
  OccupancyStatus,
  Transaction,
  Unit,
  UnitStatement,
  UnitType,
  UserRole,
} from '../types/condo';
import { UNIT_CONVENTION_SPECS } from '../data/seedCupertino';
import {
  formatBRL,
  formatCompetenceLabel,
  formatDateBR,
  occupancyLabel,
  statusLabel,
  unitTypeLabel,
} from '../utils/formatters';

interface UnitsViewProps {
  role: UserRole;
  units: Unit[];
  transactions: Transaction[];
  myUnit: Unit | null;
  myUnitStatement: UnitStatement | null;
  selectedCompetence: string;
  onSaveUnit: (unit: Omit<Unit, 'updatedAt'>) => Promise<void>;
  onQuickPayTx?: (tx: Transaction) => Promise<void>;
}

export function UnitsView({
  role,
  units,
  transactions,
  myUnit,
  myUnitStatement,
  selectedCompetence,
  onSaveUnit,
  onQuickPayTx,
}: UnitsViewProps) {
  const isAdmin = role === 'admin';
  const isResident = role === 'morador';

  const [editingUnit, setEditingUnit] = useState<Omit<Unit, 'updatedAt'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [historyUnit, setHistoryUnit] = useState<Unit | null>(null);

  const sortedUnits = useMemo(
    () => units.slice().sort((a, b) => a.order - b.order),
    [units]
  );

  // Visão exclusiva do Morador: apenas sua própria unidade
  if (isResident) {
    if (!myUnit) {
      return (
        <div className="bg-white border border-stone-200 rounded-xl p-8 max-w-2xl">
          <h1 className="text-lg font-semibold text-stone-900 mb-2">Minha Unidade</h1>
          <p className="text-sm text-stone-600">
            Seu perfil ainda não está vinculado a uma unidade específica. Solicite ao síndico a
            vinculação do seu apartamento.
          </p>
        </div>
      );
    }

    const entries = myUnitStatement?.entries ?? [];

    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-stone-200">
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
            Minha Unidade — {myUnit.displayName}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Consulta individual de cobranças, pagamentos e regras de rateio da sua unidade
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-stone-500">Identificação e tipo</p>
            <p className="text-base font-semibold text-stone-900 mt-1">{myUnit.code}</p>
            <p className="text-xs text-stone-600 mt-1">
              {unitTypeLabel(myUnit.type)} · {occupancyLabel(myUnit.occupancyStatus)}
            </p>
            {UNIT_CONVENTION_SPECS[myUnit.id] && (
              <p className="text-xs text-stone-500 mt-1">
                Fração {UNIT_CONVENTION_SPECS[myUnit.id].idealFractionLabel} ·{' '}
                {UNIT_CONVENTION_SPECS[myUnit.id].totalAreaM2.toLocaleString('pt-BR')} m² ·{' '}
                {UNIT_CONVENTION_SPECS[myUnit.id].garageSpots}{' '}
                {UNIT_CONVENTION_SPECS[myUnit.id].garageSpots > 1 ? 'vagas' : 'vaga'}
              </p>
            )}
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-stone-500">Taxa condominial vigente</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-stone-900 mt-1">
              {formatBRL(myUnit.monthlyFee)}
            </p>
            <p className="text-xs text-stone-500 mt-1">{myUnit.allocationRule}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <p className="text-xs font-medium text-stone-500">Saldo em aberto</p>
            <p
              className={`text-xl font-semibold font-mono tabular-nums mt-1 ${
                (myUnitStatement?.totalPending ?? 0) > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatBRL(myUnitStatement?.totalPending ?? 0)}
            </p>
            <p className="text-xs text-stone-500 mt-1">
              Total pago: {formatBRL(myUnitStatement?.totalPaid ?? 0)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-stone-900">
              Histórico de cobranças e pagamentos
            </h2>
          </div>
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">
              Nenhuma cobrança registrada para esta unidade até o momento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                    <th className="py-2.5 px-4">Competência</th>
                    <th className="py-2.5 px-4">Descrição</th>
                    <th className="py-2.5 px-4">Vencimento</th>
                    <th className="py-2.5 px-4">Situação</th>
                    <th className="py-2.5 px-4 text-right">Previsto</th>
                    <th className="py-2.5 px-4 text-right">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {entries.map((item) => (
                    <tr key={item.txId} className="hover:bg-stone-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-stone-700">
                        {formatCompetenceLabel(item.competence)}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-stone-900">{item.description}</div>
                        {item.notes && <div className="text-xs text-stone-500">{item.notes}</div>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-stone-600">
                        {formatDateBR(item.dueDate)}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-medium">
                        <span
                          className={
                            item.status === 'recebido' || item.status === 'pago'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-600">
                        {formatBRL(item.expectedAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-stone-900">
                        {formatBRL(item.settledAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const historyTxs = historyUnit
    ? transactions
        .filter((t) => t.type === 'income' && t.unitId === historyUnit.id)
        .sort((a, b) => b.competence.localeCompare(a.competence))
    : [];

  const handleSaveUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    setSaving(true);
    try {
      await onSaveUnit(editingUnit);
      setEditingUnit(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
            Unidades Residenciais (6 unidades)
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Apartamentos convencionais e coberturas com taxas e critério de rateio configuráveis
          </p>
        </div>
      </div>

      {/* Grade das 6 unidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedUnits.map((unit) => {
          const monthTxs = transactions.filter(
            (t) =>
              t.type === 'income' &&
              t.unitId === unit.id &&
              t.competence === selectedCompetence &&
              t.status !== 'cancelado'
          );
          const monthExpected = monthTxs.reduce((acc, t) => acc + t.expectedAmount, 0);
          const monthSettled = monthTxs.reduce((acc, t) => acc + t.settledAmount, 0);
          const monthPending = Math.max(0, monthExpected - monthSettled);

          const totalPendingAll = transactions
            .filter(
              (t) =>
                t.type === 'income' &&
                t.unitId === unit.id &&
                (t.status === 'pendente' || t.status === 'parcial' || t.status === 'agendado')
            )
            .reduce((acc, t) => acc + Math.max(0, t.expectedAmount - t.settledAmount), 0);

          return (
            <div
              key={unit.id}
              className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
                      <Home className="w-3.5 h-3.5 text-amber-700" />
                      <span>{unitTypeLabel(unit.type)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{occupancyLabel(unit.occupancyStatus)}</span>
                    </div>
                    <h2 className="text-base font-semibold text-stone-900">{unit.displayName}</h2>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingUnit({ ...unit })}
                      title="Editar unidade"
                      className="p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-stone-600">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="truncate font-medium text-stone-800">
                      {unit.ownerName || 'Não informado'}
                    </span>
                  </div>
                  {unit.contact && (
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{unit.contact}</span>
                    </div>
                  )}
                  {UNIT_CONVENTION_SPECS[unit.id] && (
                    <p className="text-xs text-stone-500">
                      Fração{' '}
                      <span className="font-mono text-stone-700">
                        {UNIT_CONVENTION_SPECS[unit.id].idealFractionLabel}
                      </span>{' '}
                      · {UNIT_CONVENTION_SPECS[unit.id].totalAreaM2.toLocaleString('pt-BR')} m² ·{' '}
                      {UNIT_CONVENTION_SPECS[unit.id].garageSpots}{' '}
                      {UNIT_CONVENTION_SPECS[unit.id].garageSpots > 1 ? 'vagas' : 'vaga'}
                      {UNIT_CONVENTION_SPECS[unit.id].exclusiveRoofAccess ? ' + cobertura' : ''}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-stone-500">Taxa base mensal</p>
                    <p className="text-base font-semibold font-mono tabular-nums text-stone-900">
                      {formatBRL(unit.monthlyFee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">
                      {formatCompetenceLabel(selectedCompetence)}
                    </p>
                    {monthTxs.length === 0 ? (
                      <p className="text-xs text-stone-400 mt-1">Sem cobrança no mês</p>
                    ) : monthPending > 0.01 ? (
                      <p className="text-sm font-semibold font-mono tabular-nums text-amber-700 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatBRL(monthPending)}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Quitado
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-500 truncate" title={unit.allocationRule}>
                  {totalPendingAll > 0
                    ? `Aberto total: ${formatBRL(totalPendingAll)}`
                    : unit.allocationRule}
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryUnit(unit)}
                  className="text-amber-700 font-medium hover:underline whitespace-nowrap shrink-0"
                >
                  Ver histórico
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Editar Unidade */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-stone-200">
              <h2 className="text-base font-semibold text-stone-900">
                Configurar {editingUnit.code}
              </h2>
              <button
                type="button"
                onClick={() => setEditingUnit(null)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={(e) => void handleSaveUnitSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Nome de exibição
                  </label>
                  <input
                    required
                    maxLength={80}
                    value={editingUnit.displayName}
                    onChange={(e) =>
                      setEditingUnit({ ...editingUnit, displayName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Identificação na planilha
                  </label>
                  <input
                    required
                    maxLength={60}
                    value={editingUnit.code}
                    onChange={(e) => setEditingUnit({ ...editingUnit, code: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Tipo</label>
                  <select
                    value={editingUnit.type}
                    onChange={(e) =>
                      setEditingUnit({ ...editingUnit, type: e.target.value as UnitType })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="convencional">Apartamento Convencional</option>
                    <option value="cobertura">Cobertura</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Situação de ocupação
                  </label>
                  <select
                    value={editingUnit.occupancyStatus}
                    onChange={(e) =>
                      setEditingUnit({
                        ...editingUnit,
                        occupancyStatus: e.target.value as OccupancyStatus,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="ocupado_proprietario">Ocupado (Proprietário)</option>
                    <option value="alugado">Alugado</option>
                    <option value="desocupado">Desocupado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Responsável
                  </label>
                  <input
                    maxLength={120}
                    value={editingUnit.ownerName}
                    onChange={(e) =>
                      setEditingUnit({ ...editingUnit, ownerName: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Contato autorizado
                  </label>
                  <input
                    maxLength={120}
                    value={editingUnit.contact ?? ''}
                    onChange={(e) => setEditingUnit({ ...editingUnit, contact: e.target.value })}
                    placeholder="Telefone ou e-mail"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Valor da taxa condominial (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingUnit.monthlyFee}
                    onChange={(e) =>
                      setEditingUnit({ ...editingUnit, monthlyFee: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Critério de rateio
                  </label>
                  <input
                    required
                    maxLength={180}
                    value={editingUnit.allocationRule}
                    onChange={(e) =>
                      setEditingUnit({ ...editingUnit, allocationRule: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 border border-stone-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg"
                >
                  {saving ? 'Salvando...' : 'Salvar unidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Cobranças e Pagamentos da Unidade */}
      {historyUnit && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  Histórico — {historyUnit.displayName}
                </h2>
                <p className="text-xs text-stone-500">
                  Responsável: {historyUnit.ownerName} · {historyUnit.allocationRule}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryUnit(null)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              {historyTxs.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Nenhuma cobrança registrada para esta unidade.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="py-2 pr-3">Competência</th>
                      <th className="py-2 pr-3">Descrição</th>
                      <th className="py-2 pr-3">Situação</th>
                      <th className="py-2 pr-3 text-right">Previsto</th>
                      <th className="py-2 pr-3 text-right">Recebido</th>
                      {isAdmin && <th className="py-2 text-right">Ação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {historyTxs.map((tx) => (
                      <tr key={tx.id}>
                        <td className="py-2 pr-3 font-mono text-xs text-stone-700 whitespace-nowrap">
                          {formatCompetenceLabel(tx.competence)}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-medium text-stone-900">{tx.description}</div>
                          {tx.notes && <div className="text-xs text-stone-500">{tx.notes}</div>}
                        </td>
                        <td className="py-2 pr-3 text-xs font-medium whitespace-nowrap">
                          <span
                            className={
                              tx.status === 'recebido' ? 'text-emerald-700' : 'text-amber-700'
                            }
                          >
                            {statusLabel(tx.status)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-stone-600">
                          {formatBRL(tx.expectedAmount)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums font-medium text-stone-900">
                          {formatBRL(tx.settledAmount)}
                        </td>
                        {isAdmin && (
                          <td className="py-2 text-right whitespace-nowrap">
                            {tx.status !== 'recebido' && onQuickPayTx && (
                              <button
                                type="button"
                                onClick={() => void onQuickPayTx(tx)}
                                className="text-xs font-medium text-amber-700 hover:underline"
                              >
                                Marcar pago
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
