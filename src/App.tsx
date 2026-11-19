import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  X,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GovernanceDocsView } from './components/GovernanceDocsView';
import { PrestacaoContasView } from './components/PrestacaoContasView';
import { SettingsAndTransferView } from './components/SettingsAndTransferView';
import { TransactionsView } from './components/TransactionsView';
import { UnitsView } from './components/UnitsView';
import {
  DEFAULT_CONDOMINIUM_SETTINGS,
  INITIAL_UNITS,
  fetchRealSpreadsheetCsv,
} from './data/seedCupertino';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import {
  acceptInviteAndCreateProfile,
  checkUserInviteByEmail,
  createOrResendInvite,
  deleteMonthlyDocument,
  deleteTransaction,
  ensureBootstrappedAdminProfile,
  generateMonthlyChargesForCompetence,
  importCsvTransactionsIntoFirestore,
  initializeCondoDefaults,
  publishMonthlyReport,
  restoreBackupJson,
  revokeInvite,
  saveMonthlyDocument,
  saveSettings,
  saveTransaction,
  saveUnit,
  updateUserAccess,
  uploadReceiptAndLink,
} from './services/condoService';
import type {
  CondominiumSettings,
  MonthlyDocument,
  MonthlyReport,
  ReceiptVisibility,
  Transaction,
  Unit,
  UnitStatement,
  UserInvite,
  UserProfile,
  UserRole,
} from './types/condo';
import { computeAllMonthlySummaries } from './utils/accounting';
import type { CondoBackupPayload } from './utils/csvHelper';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  getCurrentCompetenceSaoPaulo,
  getTodaySaoPauloISO,
  roleLabel,
} from './utils/formatters';

type NavTab =
  | 'dashboard'
  | 'prestacao'
  | 'lancamentos'
  | 'unidades'
  | 'regras'
  | 'administracao';

function CondoAppContent() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [pendingInvite, setPendingInvite] = useState<UserInvite | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] = useState<
    'not_invited' | 'inactive' | 'unverified_email' | null
  >(null);

  // Dados Firestore
  const [settings, setSettings] = useState<CondominiumSettings>({
    ...DEFAULT_CONDOMINIUM_SETTINGS,
    updatedBy: '',
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoaded, setUnitsLoaded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoaded, setTransactionsLoaded] = useState(false);
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [invitesList, setInvitesList] = useState<UserInvite[]>([]);
  const [monthlyDocuments, setMonthlyDocuments] = useState<MonthlyDocument[]>([]);
  const [myUnit, setMyUnit] = useState<Unit | null>(null);
  const [myUnitStatement, setMyUnitStatement] = useState<UnitStatement | null>(null);

  // UI Estado
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedCompetence, setSelectedCompetence] = useState<string>(
    getCurrentCompetenceSaoPaulo()
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const autoSeedStartedRef = useRef(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 4000);
  };

  // 1. Autenticação e perfil do usuário
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setFirebaseUser(user);
      setUserProfile(null);
      setPendingInvite(null);
      setAccessDeniedReason(null);

      if (!user) {
        setAuthLoading(false);
        return;
      }

      if (!user.emailVerified) {
        setAccessDeniedReason('unverified_email');
        setAuthLoading(false);
        return;
      }

      const emailLower = (user.email ?? '').toLowerCase();
      if (emailLower === BOOTSTRAPPED_ADMIN_EMAIL) {
        await ensureBootstrappedAdminProfile(
          user.uid,
          emailLower,
          user.displayName || 'Síndico'
        );
      }

      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid),
        async (snap) => {
          if (snap.exists()) {
            const prof = snap.data() as UserProfile;
            if (!prof.active) {
              setUserProfile(null);
              setAccessDeniedReason('inactive');
            } else {
              setUserProfile(prof);
              setPendingInvite(null);
              setAccessDeniedReason(null);
            }
            setAuthLoading(false);
          } else {
            const invite = emailLower ? await checkUserInviteByEmail(emailLower) : null;
            if (invite) {
              setPendingInvite(invite);
              setAccessDeniedReason(null);
            } else {
              setPendingInvite(null);
              setAccessDeniedReason('not_invited');
            }
            setUserProfile(null);
            setAuthLoading(false);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // 2. Listeners Firestore condicionados ao papel autorizado
  useEffect(() => {
    if (!userProfile || !userProfile.active) {
      setUnitsLoaded(false);
      setTransactionsLoaded(false);
      setReportsLoaded(false);
      setMonthlyDocuments([]);
      autoSeedStartedRef.current = false;
      return;
    }

    const unsubs: (() => void)[] = [];

    // Configurações gerais (todos autorizados)
    unsubs.push(
      onSnapshot(
        doc(db, 'condominium', 'settings'),
        (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as CondominiumSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'condominium/settings')
      )
    );

    if (userProfile.role === 'admin' || userProfile.role === 'conselheiro') {
      unsubs.push(
        onSnapshot(
          collection(db, 'units'),
          (snap) => {
            const loaded = snap.docs.map((d) => d.data() as Unit);
            setUnits(loaded);
            setUnitsLoaded(true);
            if (loaded.length === 0 && userProfile.role === 'admin') {
              void initializeCondoDefaults(userProfile.uid);
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'units')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'transactions'),
          (snap) => {
            setTransactions(snap.docs.map((d) => d.data() as Transaction));
            setTransactionsLoaded(true);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'monthly_reports'),
          (snap) => {
            setReports(snap.docs.map((d) => d.data() as MonthlyReport));
            setReportsLoaded(true);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_reports')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'monthly_documents'),
          (snap) => {
            setMonthlyDocuments(snap.docs.map((d) => d.data() as MonthlyDocument));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_documents')
        )
      );

      if (userProfile.role === 'admin') {
        unsubs.push(
          onSnapshot(
            collection(db, 'users'),
            (snap) => {
              setUsersList(snap.docs.map((d) => d.data() as UserProfile));
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'users')
          )
        );
        unsubs.push(
          onSnapshot(
            collection(db, 'invites'),
            (snap) => {
              setInvitesList(
                snap.docs.map((d) => ({
                  id: d.id,
                  ...(d.data() as Omit<UserInvite, 'id'>),
                }))
              );
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'invites')
          )
        );
      }
    } else if (userProfile.role === 'morador') {
      // Morador lê APENAS relatórios publicados, pasta mensal publicada e sua própria unidade
      unsubs.push(
        onSnapshot(
          query(collection(db, 'monthly_reports'), where('published', '==', true)),
          (snap) => {
            setReports(snap.docs.map((d) => d.data() as MonthlyReport));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_reports')
        )
      );

      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'monthly_documents'),
            where('visibility', '==', 'published_residents')
          ),
          (snap) => {
            setMonthlyDocuments(snap.docs.map((d) => d.data() as MonthlyDocument));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'monthly_documents')
        )
      );

      if (userProfile.unitId) {
        const uId = userProfile.unitId;
        unsubs.push(
          onSnapshot(
            doc(db, 'units', uId),
            (snap) => {
              setMyUnit(snap.exists() ? (snap.data() as Unit) : null);
            },
            (err) => handleFirestoreError(err, OperationType.GET, `units/${uId}`)
          )
        );
        unsubs.push(
          onSnapshot(
            doc(db, 'unit_statements', uId),
            (snap) => {
              setMyUnitStatement(snap.exists() ? (snap.data() as UnitStatement) : null);
            },
            (err) => handleFirestoreError(err, OperationType.GET, `unit_statements/${uId}`)
          )
        );
      }
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [userProfile]);

  const effectiveUnits = useMemo(() => {
    if (units.length > 0) return units;
    return INITIAL_UNITS.map((u) => ({ ...u, updatedAt: null }));
  }, [units]);

  const publishedReports = useMemo(
    () =>
      reports
        .filter((r) => r.published)
        .sort((a, b) => a.competence.localeCompare(b.competence)),
    [reports]
  );

  const summaries = useMemo(() => {
    if (userProfile?.role === 'morador') return [];
    const currentComp = getCurrentCompetenceSaoPaulo();
    return computeAllMonthlySummaries(
      transactions,
      effectiveUnits,
      settings.initialBalance,
      '2024-06',
      [currentComp, selectedCompetence]
    );
  }, [transactions, effectiveUnits, settings.initialBalance, userProfile?.role, selectedCompetence]);

  const availableCompetences = useMemo(() => {
    if (userProfile?.role === 'morador') {
      return publishedReports.map((r) => r.competence);
    }
    const set = new Set(summaries.map((s) => s.competence));
    set.add(getCurrentCompetenceSaoPaulo());
    return Array.from(set).sort();
  }, [userProfile?.role, publishedReports, summaries]);

  // Ajusta competência selecionada se morador entrar e o mês atual ainda não estiver publicado
  useEffect(() => {
    if (availableCompetences.length === 0) return;
    if (!availableCompetences.includes(selectedCompetence)) {
      setSelectedCompetence(availableCompetences[availableCompetences.length - 1]);
    }
  }, [availableCompetences, selectedCompetence]);

  const handleLoadOfficialHistory = async (options?: { keepCurrentCompetence?: boolean }) => {
    if (!userProfile) return;
    setSeedingData(true);
    try {
      if (units.length === 0) {
        await initializeCondoDefaults(userProfile.uid);
      }
      const csvText = await fetchRealSpreadsheetCsv();
      const res = await importCsvTransactionsIntoFirestore(
        csvText,
        userProfile.uid,
        effectiveUnits,
        settings,
        '2026-10'
      );
      showToast(
        `Histórico oficial importado: ${res.importedCount} lançamentos (${res.competencesCount} meses, Jun/2024 a Dez/2026).`
      );
      if (!options?.keepCurrentCompetence) {
        setSelectedCompetence('2026-10');
      }
    } finally {
      setSeedingData(false);
    }
  };

  // Popula automaticamente o histórico oficial da planilha no primeiro acesso do Síndico com base vazia
  useEffect(() => {
    if (
      !userProfile ||
      userProfile.role !== 'admin' ||
      !unitsLoaded ||
      !transactionsLoaded ||
      !reportsLoaded ||
      seedingData ||
      autoSeedStartedRef.current
    ) {
      return;
    }

    if (transactions.length === 0 && reports.length === 0) {
      autoSeedStartedRef.current = true;
      void handleLoadOfficialHistory({ keepCurrentCompetence: true });
    }
  }, [
    userProfile,
    unitsLoaded,
    transactionsLoaded,
    reportsLoaded,
    transactions.length,
    reports.length,
    seedingData,
  ]);

  if (!firebaseUser || !userProfile) {
    return (
      <AuthGate
        firebaseUser={firebaseUser}
        authLoading={authLoading}
        pendingInvite={pendingInvite}
        accessDeniedReason={accessDeniedReason}
        onAcceptInvite={async (invite) => {
          if (!firebaseUser) return;
          await acceptInviteAndCreateProfile(
            invite,
            firebaseUser.uid,
            firebaseUser.email || invite.email,
            firebaseUser.displayName || invite.displayName
          );
        }}
      />
    );
  }

  const role = userProfile.role;
  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Painel Financeiro',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'prestacao',
      label: 'Prestação de Contas',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
    },
    ...(role === 'admin' || role === 'conselheiro'
      ? [
          {
            id: 'lancamentos' as const,
            label: 'Lançamentos',
            icon: <ReceiptText className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
    {
      id: 'unidades',
      label: role === 'morador' ? 'Minha Unidade' : 'Unidades (6)',
      icon: <Home className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'regras',
      label: 'Regras e Atas',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
    },
    ...(role === 'admin'
      ? [
          {
            id: 'administracao' as const,
            label: 'Administração',
            icon: <Settings className="w-4 h-4 shrink-0" />,
          },
        ]
      : []),
  ];

  const currentSummary = summaries.find((s) => s.competence === selectedCompetence) ?? null;
  const currentReportDoc = reports.find((r) => r.competence === selectedCompetence) ?? null;
  const currentMonthTransactions = transactions.filter(
    (t) => t.competence === selectedCompetence
  );

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col lg:flex-row">
      {/* Barra superior mobile (<= 15% da altura) */}
      <header className="no-print lg:hidden bg-stone-900 text-white px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="font-semibold text-sm truncate">Condomínio Fácil</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Abrir menu"
          className="p-2 text-stone-200 hover:text-white rounded-lg"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Menu lateral (Desktop fixo 256px + Mobile drawer) */}
      <aside
        className={`no-print ${
          mobileMenuOpen ? 'fixed inset-0 top-12 z-20 flex' : 'hidden'
        } lg:flex lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen flex-col justify-between bg-stone-900 text-stone-200 border-r border-stone-800`}
      >
        <div className="p-5 space-y-6 overflow-y-auto">
          <div className="hidden lg:block pb-4 border-b border-stone-800">
            <div className="flex items-center gap-2 text-amber-400 mb-1.5">
              <Building2 className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold tracking-tight text-white">
                Condomínio Fácil
              </span>
            </div>
            <p className="text-xs text-stone-400 truncate" title={settings.name}>
              {settings.name}
            </p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-amber-700 text-white'
                      : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé do usuário */}
        <div className="p-4 border-t border-stone-800 space-y-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{userProfile.displayName}</p>
            <p className="text-xs text-stone-400 truncate">{roleLabel(userProfile.role)}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 min-w-0 p-5 lg:p-8 max-w-7xl w-full mx-auto">
        {toastMsg && (
          <div className="no-print mb-5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900 flex items-center justify-between gap-4">
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-amber-700 hover:text-amber-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            role={role}
            selectedCompetence={selectedCompetence}
            onSelectCompetence={setSelectedCompetence}
            availableCompetences={availableCompetences}
            summaries={summaries}
            publishedReports={publishedReports}
            myUnitStatement={myUnitStatement}
            hasData={transactions.length > 0 || unitsLoaded}
            onSeedRealData={role === 'admin' ? () => void handleLoadOfficialHistory() : undefined}
            seedingData={seedingData}
          />
        )}

        {activeTab === 'prestacao' && (
          <PrestacaoContasView
            role={role}
            userId={userProfile.uid}
            selectedCompetence={selectedCompetence}
            onSelectCompetence={setSelectedCompetence}
            availableCompetences={availableCompetences}
            summary={currentSummary}
            reportDoc={currentReportDoc}
            monthTransactions={currentMonthTransactions}
            monthlyDocuments={monthlyDocuments}
            onPublishToggle={async (comp, pub, notes) => {
              await publishMonthlyReport(
                comp,
                pub,
                notes,
                transactions,
                effectiveUnits,
                settings.initialBalance,
                userProfile.uid
              );
              showToast(
                pub
                  ? 'Prestação de contas publicada aos moradores.'
                  : 'Prestação de contas retornada para rascunho.'
              );
            }}
            onSaveMonthlyDocument={async (docData, isNew) => {
              const docId = await saveMonthlyDocument(docData, isNew);
              showToast('Documento arquivado na pasta mensal.');
              return docId;
            }}
            onDeleteMonthlyDocument={async (docId) => {
              await deleteMonthlyDocument(docId);
              showToast('Documento removido da pasta mensal.');
            }}
          />
        )}

        {activeTab === 'lancamentos' && (role === 'admin' || role === 'conselheiro') && (
          <TransactionsView
            role={role}
            userId={userProfile.uid}
            selectedCompetence={selectedCompetence}
            onSelectCompetence={setSelectedCompetence}
            availableCompetences={availableCompetences}
            transactions={transactions}
            units={effectiveUnits}
            defaultDueDay={settings.defaultDueDay}
            onSaveTransaction={async (tx, isNew) => {
              await saveTransaction(tx, isNew, transactions, effectiveUnits);
              showToast(isNew ? 'Lançamento registrado.' : 'Lançamento atualizado.');
            }}
            onDeleteTransaction={async (tx) => {
              await deleteTransaction(tx, transactions, effectiveUnits);
              showToast('Lançamento excluído.');
            }}
            onGenerateMonthlyCharges={async (comp, dueDay, extraConv, extraCob, extraDesc) => {
              const count = await generateMonthlyChargesForCompetence(
                comp,
                dueDay,
                extraConv,
                extraCob,
                extraDesc,
                effectiveUnits,
                transactions,
                userProfile.uid
              );
              if (count > 0) showToast(`${count} cobranças geradas para ${comp}.`);
              return count;
            }}
            onUploadReceipt={async (tx, fileName, mimeType, dataUrl, visibility: ReceiptVisibility) => {
              await uploadReceiptAndLink(
                tx,
                fileName,
                mimeType,
                dataUrl,
                visibility,
                userProfile.uid,
                transactions,
                effectiveUnits
              );
              showToast('Comprovante anexado com sucesso.');
            }}
          />
        )}

        {activeTab === 'unidades' && (
          <UnitsView
            role={role}
            units={effectiveUnits}
            transactions={transactions}
            myUnit={myUnit}
            myUnitStatement={myUnitStatement}
            selectedCompetence={selectedCompetence}
            onSaveUnit={async (unit) => {
              await saveUnit(unit);
              showToast(`Unidade ${unit.code} atualizada.`);
            }}
            onQuickPayTx={
              role === 'admin'
                ? async (tx) => {
                    await saveTransaction(
                      {
                        ...tx,
                        status: 'recebido',
                        settledAmount: tx.expectedAmount,
                        settlementDate: getTodaySaoPauloISO(),
                      },
                      false,
                      transactions,
                      effectiveUnits
                    );
                    showToast(`Pagamento registrado para ${tx.unitLabel ?? tx.description}.`);
                  }
                : undefined
            }
          />
        )}

        {activeTab === 'regras' && <GovernanceDocsView settings={settings} />}

        {activeTab === 'administracao' && role === 'admin' && (
          <SettingsAndTransferView
            currentUid={userProfile.uid}
            settings={settings}
            units={effectiveUnits}
            transactions={transactions}
            users={usersList}
            invites={invitesList}
            onSaveSettings={async (newSettings) => {
              await saveSettings(newSettings, userProfile.uid);
              showToast('Parâmetros do condomínio salvos.');
            }}
            onCreateInvite={async (email, displayName, invRole, unitId) => {
              await createOrResendInvite(email, displayName, invRole, unitId, userProfile.uid);
              showToast(`Convite autorizado para ${email}.`);
            }}
            onRevokeInvite={async (inviteId) => {
              await revokeInvite(inviteId);
              showToast('Convite revogado.');
            }}
            onUpdateUserAccess={async (uid, displayName, uRole: UserRole, unitId, active) => {
              await updateUserAccess(uid, displayName, uRole, unitId, active);
              showToast('Permissão do usuário atualizada.');
            }}
            onImportCsv={async (csvText) => {
              const res = await importCsvTransactionsIntoFirestore(
                csvText,
                userProfile.uid,
                effectiveUnits,
                settings
              );
              showToast(`${res.importedCount} lançamentos importados.`);
              return res;
            }}
            onLoadOfficialHistory={handleLoadOfficialHistory}
            onRestoreBackup={async (payload: CondoBackupPayload) => {
              await restoreBackupJson(payload, userProfile.uid);
              showToast('Backup restaurado com sucesso.');
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CondoAppContent />
    </ErrorBoundary>
  );
}
