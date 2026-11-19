import { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  MailPlus,
  RotateCcw,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import type {
  CondominiumSettings,
  Transaction,
  Unit,
  UserInvite,
  UserProfile,
  UserRole,
} from '../types/condo';
import {
  downloadTextFile,
  exportTransactionsToCsv,
  parseCondoCsv,
  type CondoBackupPayload,
  type CsvParseResult,
} from '../utils/csvHelper';
import { DEFAULT_CONDOMINIUM_SETTINGS } from '../data/seedCupertino';
import { formatBRL, roleLabel } from '../utils/formatters';

interface SettingsAndTransferViewProps {
  currentUid: string;
  settings: CondominiumSettings;
  units: Unit[];
  transactions: Transaction[];
  users: UserProfile[];
  invites: UserInvite[];
  onSaveSettings: (settings: Omit<CondominiumSettings, 'updatedAt' | 'updatedBy'>) => Promise<void>;
  onCreateInvite: (
    email: string,
    displayName: string,
    role: UserRole,
    unitId: string | null
  ) => Promise<void>;
  onRevokeInvite: (inviteId: string) => Promise<void>;
  onUpdateUserAccess: (
    userId: string,
    displayName: string,
    role: UserRole,
    unitId: string | null,
    active: boolean
  ) => Promise<void>;
  onImportCsv: (csvText: string) => Promise<{
    importedCount: number;
    competencesCount: number;
    warnings: string[];
  }>;
  onLoadOfficialHistory: () => Promise<void>;
  onRestoreBackup: (payload: CondoBackupPayload) => Promise<void>;
}

export function SettingsAndTransferView({
  currentUid,
  settings,
  units,
  transactions,
  users,
  invites,
  onSaveSettings,
  onCreateInvite,
  onRevokeInvite,
  onUpdateUserAccess,
  onImportCsv,
  onLoadOfficialHistory,
  onRestoreBackup,
}: SettingsAndTransferViewProps) {
  const [section, setSection] = useState<'usuarios' | 'parametros' | 'dados' | 'transferencia'>(
    'usuarios'
  );

  // Convite
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<UserRole>('morador');
  const [invUnitId, setInvUnitId] = useState<string>(units[0]?.id ?? 'apto_101');
  const [invFeedback, setInvFeedback] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Parâmetros
  const [formSettings, setFormSettings] = useState({
    name: settings.name,
    cnpj: settings.cnpj ?? '',
    address: settings.address ?? '',
    timezone: settings.timezone,
    currency: settings.currency,
    initialBalance: settings.initialBalance,
    initialBalanceDate: settings.initialBalanceDate,
    defaultDueDay: settings.defaultDueDay,
    defaultConventionalFee: settings.defaultConventionalFee,
    defaultPenthouseFee: settings.defaultPenthouseFee,
    rateioRule: settings.rateioRule ?? '',
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setFormSettings({
      name: settings.name,
      cnpj: settings.cnpj ?? '',
      address: settings.address ?? '',
      timezone: settings.timezone,
      currency: settings.currency,
      initialBalance: settings.initialBalance,
      initialBalanceDate: settings.initialBalanceDate,
      defaultDueDay: settings.defaultDueDay,
      defaultConventionalFee: settings.defaultConventionalFee,
      defaultPenthouseFee: settings.defaultPenthouseFee,
      rateioRule: settings.rateioRule ?? '',
    });
  }, [settings]);

  // CSV Import & Backup
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvParseResult | null>(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [restorePreview, setRestorePreview] = useState<CondoBackupPayload | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvFeedback(null);
    setSendingInvite(true);
    try {
      await onCreateInvite(
        invEmail,
        invName,
        invRole,
        invRole === 'morador' ? invUnitId : null
      );
      setInvFeedback(`Convite registrado para ${invEmail.trim().toLowerCase()}.`);
      setInvEmail('');
      setInvName('');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedMsg(null);
    try {
      await onSaveSettings(formSettings);
      setSettingsSavedMsg('Configurações salvas com sucesso.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setCsvPreview(parseCondoCsv(text, currentUid));
    setImportMsg(null);
  };

  const handleConfirmCsvImport = async () => {
    if (!csvText) return;
    setImportingCsv(true);
    setImportMsg(null);
    try {
      const res = await onImportCsv(csvText);
      setImportMsg(
        `Importados ${res.importedCount} lançamentos em ${res.competencesCount} competências.`
      );
      setCsvText(null);
      setCsvPreview(null);
    } finally {
      setImportingCsv(false);
    }
  };

  const handleExportJsonBackup = () => {
    const backup: CondoBackupPayload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      units,
      transactions,
    };
    downloadTextFile(
      JSON.stringify(backup, null, 2),
      `backup_condominio_bicalho_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8;'
    );
  };

  const handleExportFullCsv = () => {
    const csv = exportTransactionsToCsv(transactions);
    downloadTextFile(
      csv,
      `lancamentos_condominio_bicalho_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;'
    );
  };

  const handleBackupFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CondoBackupPayload;
      if (!parsed.settings || !Array.isArray(parsed.units) || !Array.isArray(parsed.transactions)) {
        setImportMsg('Arquivo de backup JSON inválido.');
        return;
      }
      setRestorePreview(parsed);
      setImportMsg(null);
    } catch {
      setImportMsg('Não foi possível ler o arquivo de backup.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    try {
      await onRestoreBackup(restorePreview);
      setRestorePreview(null);
      setImportMsg('Backup restaurado com sucesso.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
            Administração, Backup e Transferência
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Controle de usuários por convite, parâmetros do condomínio, importação CSV e backup completo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg shrink-0">
          {(
            [
              { id: 'usuarios', label: 'Usuários e convites' },
              { id: 'parametros', label: 'Parâmetros e taxas' },
              { id: 'dados', label: 'Importar e backup' },
              { id: 'transferencia', label: 'Troca de síndico' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                section === item.id
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seção 1: Usuários e Convites */}
      {section === 'usuarios' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulário de convite */}
          <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl p-5">
            <div className="flex items-center gap-2 text-stone-900 mb-3">
              <MailPlus className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-semibold">Convidar usuário autorizado</h2>
            </div>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Somente e-mails cadastrados aqui poderão acessar o sistema ao entrar com o Google.
            </p>

            <form onSubmit={(e) => void handleInviteSubmit(e)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Nome completo
                </label>
                <input
                  required
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  placeholder="Ex: Lourdes (Apto 101)"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  E-mail Google do morador / conselheiro
                </label>
                <input
                  type="email"
                  required
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  placeholder="nome@gmail.com"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Perfil</label>
                <select
                  value={invRole}
                  onChange={(e) => setInvRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                >
                  <option value="morador">Morador (apenas relatórios publicados e própria unidade)</option>
                  <option value="conselheiro">Conselheiro (consulta completa, sem edição)</option>
                  <option value="admin">Síndico / Administrador (acesso total)</option>
                </select>
              </div>
              {invRole === 'morador' && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Unidade vinculada
                  </label>
                  <select
                    value={invUnitId}
                    onChange={(e) => setInvUnitId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} — {u.ownerName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {invFeedback && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  {invFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={sendingInvite}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg"
              >
                {sendingInvite ? 'Registrando convite...' : 'Autorizar e-mail por convite'}
              </button>
            </form>
          </div>

          {/* Listagem de usuários ativos e convites pendentes */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-700" />
                <h2 className="text-sm font-semibold text-stone-900">
                  Usuários cadastrados ({users.length})
                </h2>
              </div>
              <div className="divide-y divide-stone-100">
                {users.map((u) => (
                  <div
                    key={u.uid}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-stone-900">{u.displayName}</p>
                      <p className="text-xs text-stone-500">
                        {u.email} · {roleLabel(u.role)}
                        {u.unitId ? ` · ${u.unitId.replace('apto_', 'Apto ')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Alterar perfil de ${u.displayName}`}
                        value={u.role}
                        disabled={u.uid === currentUid}
                        onChange={(e) =>
                          void onUpdateUserAccess(
                            u.uid,
                            u.displayName,
                            e.target.value as UserRole,
                            u.unitId,
                            u.active
                          )
                        }
                        className="px-2.5 py-1 text-xs border border-stone-300 rounded-md bg-white disabled:opacity-60"
                      >
                        <option value="admin">Síndico</option>
                        <option value="conselheiro">Conselheiro</option>
                        <option value="morador">Morador</option>
                      </select>
                      {u.uid !== currentUid && (
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateUserAccess(
                              u.uid,
                              u.displayName,
                              u.role,
                              u.unitId,
                              !u.active
                            )
                          }
                          className={`px-2.5 py-1 text-xs font-medium rounded-md border ${
                            u.active
                              ? 'border-stone-300 text-stone-700 hover:bg-stone-50'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                          }`}
                        >
                          {u.active ? 'Desativar' : 'Reativar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-stone-900">
                  Convites pendentes ({invites.filter((i) => i.status === 'pendente').length})
                </h2>
              </div>
              {invites.filter((i) => i.status === 'pendente').length === 0 ? (
                <p className="p-5 text-xs text-stone-500">Nenhum convite pendente.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {invites
                    .filter((i) => i.status === 'pendente')
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-stone-900">{inv.displayName}</p>
                          <p className="text-xs text-stone-500">
                            {inv.email} · {roleLabel(inv.role)}
                            {inv.unitId ? ` · ${inv.unitId.replace('apto_', 'Apto ')}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onRevokeInvite(inv.id)}
                          className="p-1.5 text-stone-400 hover:text-red-700 rounded-md"
                          title="Revogar convite"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seção 2: Parâmetros */}
      {section === 'parametros' && (
        <form
          onSubmit={(e) => void handleSaveSettingsSubmit(e)}
          className="bg-white border border-stone-200 rounded-xl p-6 max-w-3xl space-y-5"
        >
          <h2 className="text-base font-semibold text-stone-900">
            Dados e parâmetros contábeis do condomínio
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Nome do condomínio
              </label>
              <input
                required
                value={formSettings.name}
                onChange={(e) => setFormSettings({ ...formSettings, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">CNPJ (opcional)</label>
              <input
                value={formSettings.cnpj}
                onChange={(e) => setFormSettings({ ...formSettings, cnpj: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Endereço oficial
            </label>
            <input
              maxLength={200}
              value={formSettings.address}
              onChange={(e) => setFormSettings({ ...formSettings, address: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Saldo inicial histórico (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formSettings.initialBalance}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, initialBalance: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Data base do saldo
              </label>
              <input
                type="date"
                required
                value={formSettings.initialBalanceDate}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, initialBalanceDate: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Dia padrão de vencimento
              </label>
              <input
                type="number"
                min="1"
                max="28"
                required
                value={formSettings.defaultDueDay}
                onChange={(e) =>
                  setFormSettings({ ...formSettings, defaultDueDay: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Taxa referência — Convencional (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formSettings.defaultConventionalFee}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    defaultConventionalFee: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Taxa referência — Cobertura (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={formSettings.defaultPenthouseFee}
                onChange={(e) =>
                  setFormSettings({
                    ...formSettings,
                    defaultPenthouseFee: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Regra de rateio da convenção
            </label>
            <textarea
              rows={2}
              value={formSettings.rateioRule}
              onChange={(e) => setFormSettings({ ...formSettings, rateioRule: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
            />
          </div>

          {settingsSavedMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {settingsSavedMsg}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setFormSettings({
                  ...formSettings,
                  name: DEFAULT_CONDOMINIUM_SETTINGS.name,
                  cnpj: DEFAULT_CONDOMINIUM_SETTINGS.cnpj ?? '',
                  address: DEFAULT_CONDOMINIUM_SETTINGS.address ?? '',
                  rateioRule: DEFAULT_CONDOMINIUM_SETTINGS.rateioRule ?? '',
                })
              }
              className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg"
            >
              Preencher CNPJ, endereço e regra da Convenção
            </button>
            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg"
            >
              {savingSettings ? 'Salvando...' : 'Salvar parâmetros'}
            </button>
          </div>
        </form>
      )}

      {/* Seção 3: Importação CSV e Backup / Restauração */}
      {section === 'dados' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Importar CSV */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-stone-900">
              <FileSpreadsheet className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-semibold">Importar planilha CSV (Extratos)</h2>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Importe o arquivo CSV exportado do Google Sheets no modelo oficial (colunas Item, Valor,
              Comentário, Mês, Filtro Por Mês, Status) ou recarregue o histórico oficial do
              condomínio.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void onLoadOfficialHistory()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg"
              >
                <Upload className="w-3.5 h-3.5" />
                Carregar histórico oficial (Jun/2024 – Dez/2026)
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Selecionar arquivo CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => void handleCsvFileSelect(e)}
                  className="hidden"
                />
              </label>
            </div>

            {csvPreview && (
              <div className="border border-stone-200 rounded-lg p-4 space-y-3 bg-stone-50">
                <p className="text-xs font-semibold text-stone-800">
                  Prévia da importação: {csvPreview.transactions.length} lançamentos em{' '}
                  {csvPreview.competences.length} competências
                </p>
                <p className="text-xs text-stone-600">
                  Saldo inicial detectado: <strong>{formatBRL(csvPreview.initialBalance)}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={importingCsv}
                    onClick={() => void handleConfirmCsvImport()}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg"
                  >
                    {importingCsv ? 'Importando...' : 'Confirmar importação'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvPreview(null);
                      setCsvText(null);
                    }}
                    className="px-3 py-1.5 text-xs text-stone-600 border border-stone-300 rounded-lg bg-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {importMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                {importMsg}
              </div>
            )}
          </div>

          {/* Backup e Restauração */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-stone-900">
              <DatabaseBackup className="w-4 h-4 text-amber-700" />
              <h2 className="text-sm font-semibold">Backup permanente e restauração</h2>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Exporte todos os dados do condomínio (configurações, unidades e histórico completo de
              lançamentos) em formato JSON para guarda segura ou em CSV para abertura no Excel.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleExportJsonBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar backup completo (JSON)
              </button>
              <button
                type="button"
                onClick={handleExportFullCsv}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar histórico (CSV/Excel)
              </button>
            </div>

            <div className="pt-4 border-t border-stone-200 space-y-3">
              <p className="text-xs font-semibold text-stone-800">Restaurar a partir de backup JSON</p>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />
                Selecionar arquivo .json
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => void handleBackupFileSelect(e)}
                  className="hidden"
                />
              </label>

              {restorePreview && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-900">
                    Confirma substituição dos dados atuais pelo backup de{' '}
                    {restorePreview.exportedAt.slice(0, 10)}?
                  </p>
                  <p className="text-xs text-amber-800">
                    {restorePreview.units.length} unidades · {restorePreview.transactions.length}{' '}
                    lançamentos.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={() => void handleConfirmRestore()}
                      className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg"
                    >
                      {restoring ? 'Restaurando...' : 'Confirmar restauração'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestorePreview(null)}
                      className="px-3 py-1.5 text-xs text-stone-700 border border-stone-300 rounded-lg bg-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seção 4: Transferência de Administração */}
      {section === 'transferencia' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 max-w-3xl space-y-5">
          <div className="flex items-center gap-2 text-stone-900">
            <ArrowRightLeft className="w-5 h-5 text-amber-700" />
            <h2 className="text-base font-semibold">
              Manual de transferência para o próximo síndico
            </h2>
          </div>
          <p className="text-sm text-stone-600 leading-relaxed">
            O Condomínio Fácil foi projetado para que a passagem de bastão ocorra em poucos minutos,
            preservando todo o histórico financeiro e sem dependência de planilhas pessoais.
          </p>
          <ol className="space-y-3 text-sm text-stone-700 list-decimal list-inside">
            <li>
              <strong>Feche a última prestação de contas:</strong> na aba{' '}
              <em>Prestação de Contas</em>, confira o saldo bancário atual e publique o último mês
              da sua gestão.
            </li>
            <li>
              <strong>Gere um backup de encerramento:</strong> na aba{' '}
              <em>Importar e backup</em>, baixe o arquivo JSON completo e o CSV para anexar à ata
              de assembleia.
            </li>
            <li>
              <strong>Convide ou promova o novo síndico:</strong> na aba{' '}
              <em>Usuários e convites</em>, envie um convite com perfil{' '}
              <em>Síndico / Administrador</em> para o e-mail Google do sucessor (ou altere o perfil
              dele caso já seja morador cadastrado).
            </li>
            <li>
              <strong>Ajuste seu perfil após a posse:</strong> quando o novo síndico já estiver
              acessando o painel administrativo, peça que altere o perfil do síndico anterior para{' '}
              <em>Morador</em> ou <em>Conselheiro</em>.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
