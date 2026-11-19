import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  FIELD_LIMITS,
  type CondominiumSettings,
  type MonthlyDocument,
  type Receipt,
  type ReceiptVisibility,
  type Transaction,
  type Unit,
  type UnitStatementEntry,
  type UserInvite,
  type UserRole,
} from '../types/condo';
import { buildMonthlyReportPayload, computeAllMonthlySummaries } from '../utils/accounting';
import { parseCondoCsv } from '../utils/csvHelper';
import { emailToInviteId, sanitizeId } from '../utils/formatters';
import { DEFAULT_CONDOMINIUM_SETTINGS, INITIAL_UNITS } from '../data/seedCupertino';

export async function ensureBootstrappedAdminProfile(
  uid: string,
  email: string,
  displayName: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email: email.toLowerCase(),
        displayName: (displayName || 'Síndico').slice(0, FIELD_LIMITS.NAME_MAX),
        role: 'admin',
        unitId: null,
        inviteId: null,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function checkUserInviteByEmail(email: string): Promise<UserInvite | null> {
  const inviteId = emailToInviteId(email);
  try {
    const snap = await getDoc(doc(db, 'invites', inviteId));
    if (!snap.exists()) return null;
    const data = snap.data() as Omit<UserInvite, 'id'>;
    if (data.status !== 'pendente') return null;
    return { id: snap.id, ...data };
  } catch {
    return null;
  }
}

export async function acceptInviteAndCreateProfile(
  invite: UserInvite,
  uid: string,
  email: string,
  displayName: string
): Promise<void> {
  const batch = writeBatch(db);
  const userRef = doc(db, 'users', uid);
  const inviteRef = doc(db, 'invites', invite.id);

  batch.set(userRef, {
    uid,
    email: email.toLowerCase(),
    displayName: (displayName || invite.displayName || 'Morador').slice(0, FIELD_LIMITS.NAME_MAX),
    role: invite.role,
    unitId: invite.unitId ?? null,
    inviteId: invite.id,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.update(inviteRef, {
    status: 'aceito',
    acceptedUid: uid,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export async function initializeCondoDefaults(uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    const settingsRef = doc(db, 'condominium', 'settings');
    batch.set(settingsRef, {
      ...DEFAULT_CONDOMINIUM_SETTINGS,
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });

    for (const unit of INITIAL_UNITS) {
      batch.set(doc(db, 'units', unit.id), {
        ...unit,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'unit_statements', unit.id), {
        unitId: unit.id,
        unitCode: unit.code,
        entries: [],
        totalPending: 0,
        totalPaid: 0,
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'condominium/settings');
  }
}

export async function saveSettings(
  settings: Omit<CondominiumSettings, 'updatedAt' | 'updatedBy'>,
  uid: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'condominium', 'settings'), {
      name: settings.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      cnpj: (settings.cnpj ?? '').trim().slice(0, 32),
      address: (settings.address ?? '').trim().slice(0, 200),
      timezone: settings.timezone || 'America/Sao_Paulo',
      currency: settings.currency || 'BRL',
      initialBalance: Number(settings.initialBalance) || 0,
      initialBalanceDate: settings.initialBalanceDate || '2024-06-01',
      defaultDueDay: Math.min(28, Math.max(1, Number(settings.defaultDueDay) || 15)),
      defaultConventionalFee: Math.max(0, Number(settings.defaultConventionalFee) || 0),
      defaultPenthouseFee: Math.max(0, Number(settings.defaultPenthouseFee) || 0),
      rateioRule: (settings.rateioRule ?? '').trim().slice(0, 240),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'condominium/settings');
  }
}

export async function saveUnit(unit: Omit<Unit, 'updatedAt'>): Promise<void> {
  try {
    await setDoc(doc(db, 'units', unit.id), {
      ...unit,
      code: unit.code.trim().slice(0, 60),
      displayName: unit.displayName.trim().slice(0, 80),
      ownerName: unit.ownerName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      contact: (unit.contact ?? '').trim().slice(0, FIELD_LIMITS.NAME_MAX),
      allocationRule: unit.allocationRule.trim().slice(0, 180),
      monthlyFee: Math.max(0, Number(unit.monthlyFee) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `units/${unit.id}`);
  }
}

export async function syncUnitStatementForUnit(
  unit: Unit,
  allTransactions: Transaction[]
): Promise<void> {
  const unitTxs = allTransactions
    .filter((t) => t.type === 'income' && t.unitId === unit.id && t.status !== 'cancelado')
    .sort((a, b) => b.competence.localeCompare(a.competence) || b.dueDate.localeCompare(a.dueDate));

  let totalPending = 0;
  let totalPaid = 0;

  const entries: UnitStatementEntry[] = unitTxs.slice(0, 450).map((t) => {
    const settled = t.settledAmount || 0;
    const pending =
      t.status === 'pendente' || t.status === 'parcial' || t.status === 'agendado'
        ? Math.max(0, Math.round((t.expectedAmount - settled) * 100) / 100)
        : 0;
    totalPending = Math.round((totalPending + pending) * 100) / 100;
    totalPaid = Math.round((totalPaid + settled) * 100) / 100;

    return {
      txId: t.id,
      description: t.description,
      category: t.category,
      competence: t.competence,
      dueDate: t.dueDate,
      settlementDate: t.settlementDate ?? null,
      expectedAmount: t.expectedAmount,
      settledAmount: settled,
      status: t.status,
      notes: t.notes,
      receiptId: t.receiptId ?? null,
      receiptUrl: t.receiptUrl ?? null,
    };
  });

  try {
    await setDoc(doc(db, 'unit_statements', unit.id), {
      unitId: unit.id,
      unitCode: unit.code,
      entries,
      totalPending,
      totalPaid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `unit_statements/${unit.id}`);
  }
}

export async function saveTransaction(
  tx: Omit<Transaction, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  allTransactions: Transaction[],
  units: Unit[]
): Promise<void> {
  const id = tx.id && FIELD_LIMITS.ID_PATTERN.test(tx.id)
    ? tx.id
    : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const payload = {
    id,
    type: tx.type,
    description: tx.description.trim().slice(0, FIELD_LIMITS.DESC_MAX),
    expenseGroup: tx.type === 'expense' ? tx.expenseGroup ?? 'manutencao_servicos' : null,
    category: tx.category.trim().slice(0, FIELD_LIMITS.CAT_MAX),
    competence: tx.competence,
    dueDate: tx.dueDate,
    settlementDate: tx.settlementDate ?? null,
    expectedAmount: Math.max(0, Math.round(tx.expectedAmount * 100) / 100),
    settledAmount: Math.max(0, Math.round(tx.settledAmount * 100) / 100),
    status: tx.status,
    unitId: tx.unitId ?? null,
    unitLabel: tx.unitLabel ? tx.unitLabel.slice(0, 64) : null,
    notes: (tx.notes ?? '').trim().slice(0, FIELD_LIMITS.NOTES_MAX),
    installmentLabel: tx.installmentLabel ? tx.installmentLabel.slice(0, 40) : null,
    receiptId: tx.receiptId ?? null,
    receiptUrl: tx.receiptUrl ? tx.receiptUrl.slice(0, FIELD_LIMITS.URL_MAX) : null,
    createdBy: tx.createdBy,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'transactions', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'transactions', id), payload);
    }

    if (payload.unitId) {
      const unit = units.find((u) => u.id === payload.unitId);
      if (unit) {
        const merged = isNew
          ? [...allTransactions, { ...payload, createdAt: null, updatedAt: null }]
          : allTransactions.map((t) => (t.id === id ? { ...t, ...payload } : t));
        await syncUnitStatementForUnit(unit, merged);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${id}`);
  }
}

export async function deleteTransaction(
  tx: Transaction,
  allTransactions: Transaction[],
  units: Unit[]
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'transactions', tx.id));
    if (tx.unitId) {
      const unit = units.find((u) => u.id === tx.unitId);
      if (unit) {
        const remaining = allTransactions.filter((t) => t.id !== tx.id);
        await syncUnitStatementForUnit(unit, remaining);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `transactions/${tx.id}`);
  }
}

export async function generateMonthlyChargesForCompetence(
  competence: string,
  dueDay: number,
  extraConventional: number,
  extraPenthouse: number,
  extraDescription: string,
  units: Unit[],
  existingTransactions: Transaction[],
  uid: string
): Promise<number> {
  const activeUnits = units.filter((u) => u.active).sort((a, b) => a.order - b.order);
  const dueDate = `${competence}-${String(Math.min(28, Math.max(1, dueDay))).padStart(2, '0')}`;
  const batch = writeBatch(db);
  let createdCount = 0;

  const updatedTxs = [...existingTransactions];

  for (const unit of activeUnits) {
    const alreadyHasMonthly = existingTransactions.some(
      (t) =>
        t.type === 'income' &&
        t.competence === competence &&
        t.unitId === unit.id &&
        t.category === 'Condomínio mensal' &&
        t.status !== 'cancelado'
    );

    if (!alreadyHasMonthly && unit.monthlyFee > 0) {
      const txId = `tx_${competence.replace('-', '')}_cond_${sanitizeId(unit.id)}`;
      const txObj: Omit<Transaction, 'createdAt' | 'updatedAt'> = {
        id: txId,
        type: 'income',
        description: 'Condomínio mensal',
        expenseGroup: null,
        category: 'Condomínio mensal',
        competence,
        dueDate,
        settlementDate: null,
        expectedAmount: unit.monthlyFee,
        settledAmount: 0,
        status: 'pendente',
        unitId: unit.id,
        unitLabel: unit.code,
        notes: `Cobrança automática (${unit.allocationRule})`,
        installmentLabel: null,
        receiptId: null,
        receiptUrl: null,
        createdBy: uid,
      };
      batch.set(doc(db, 'transactions', txId), {
        ...txObj,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updatedTxs.push({ ...txObj, createdAt: null, updatedAt: null });
      createdCount++;
    }

    const extraValue = unit.type === 'cobertura' ? extraPenthouse : extraConventional;
    if (extraValue > 0) {
      const extraId = `tx_${competence.replace('-', '')}_ext_${sanitizeId(unit.id)}_${Date.now().toString(36).slice(-4)}`;
      const txExtra: Omit<Transaction, 'createdAt' | 'updatedAt'> = {
        id: extraId,
        type: 'income',
        description: extraDescription.trim() || 'Taxa Extra',
        expenseGroup: null,
        category: 'Taxa extraordinária',
        competence,
        dueDate,
        settlementDate: null,
        expectedAmount: extraValue,
        settledAmount: 0,
        status: 'pendente',
        unitId: unit.id,
        unitLabel: unit.code,
        notes: 'Taxa extra gerada no lançamento mensal',
        installmentLabel: null,
        receiptId: null,
        receiptUrl: null,
        createdBy: uid,
      };
      batch.set(doc(db, 'transactions', extraId), {
        ...txExtra,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updatedTxs.push({ ...txExtra, createdAt: null, updatedAt: null });
      createdCount++;
    }
  }

  if (createdCount === 0) return 0;

  try {
    await batch.commit();
    for (const unit of activeUnits) {
      await syncUnitStatementForUnit(unit, updatedTxs);
    }
    return createdCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'transactions');
  }
}

export async function publishMonthlyReport(
  competence: string,
  published: boolean,
  notes: string,
  allTransactions: Transaction[],
  units: Unit[],
  initialBalance: number,
  uid: string
): Promise<void> {
  const summaries = computeAllMonthlySummaries(allTransactions, units, initialBalance, competence, [
    competence,
  ]);
  const summary = summaries.find((s) => s.competence === competence);
  if (!summary) return;

  const payload = buildMonthlyReportPayload(summary, published, notes, uid);

  try {
    await setDoc(doc(db, 'monthly_reports', competence), {
      ...payload,
      publishedAt: published ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `monthly_reports/${competence}`);
  }
}

export async function importCsvTransactionsIntoFirestore(
  csvText: string,
  uid: string,
  currentUnits: Unit[],
  currentSettings: CondominiumSettings,
  publishClosedUpTo = '2026-10'
): Promise<{ importedCount: number; competencesCount: number; warnings: string[] }> {
  const parsed = parseCondoCsv(csvText, uid);
  if (parsed.transactions.length === 0) {
    return { importedCount: 0, competencesCount: 0, warnings: parsed.warnings };
  }

  const targetUnits: Unit[] =
    currentUnits.length > 0
      ? currentUnits
      : INITIAL_UNITS.map((u) => ({ ...u, updatedAt: null }));

  try {
    // Atualiza saldo inicial preservando apenas campos permitidos pelas regras de segurança
    await setDoc(doc(db, 'condominium', 'settings'), {
      name: (currentSettings.name || DEFAULT_CONDOMINIUM_SETTINGS.name)
        .trim()
        .slice(0, FIELD_LIMITS.NAME_MAX),
      cnpj: (currentSettings.cnpj ?? '').trim().slice(0, 32),
      address: (currentSettings.address ?? '').trim().slice(0, 200),
      timezone: currentSettings.timezone || 'America/Sao_Paulo',
      currency: currentSettings.currency || 'BRL',
      initialBalance: parsed.initialBalance,
      initialBalanceDate: currentSettings.initialBalanceDate || '2024-06-01',
      defaultDueDay: Math.min(28, Math.max(1, Number(currentSettings.defaultDueDay) || 15)),
      defaultConventionalFee: Math.max(0, Number(currentSettings.defaultConventionalFee) || 0),
      defaultPenthouseFee: Math.max(0, Number(currentSettings.defaultPenthouseFee) || 0),
      rateioRule: (currentSettings.rateioRule ?? DEFAULT_CONDOMINIUM_SETTINGS.rateioRule ?? '')
        .trim()
        .slice(0, 240),
      updatedAt: serverTimestamp(),
      updatedBy: uid,
    });

    // Preserva createdAt e createdBy caso um lançamento já exista (reimportação idempotente)
    const existingSnap = await getDocs(collection(db, 'transactions'));
    const existingMeta = new Map<string, { createdAt: unknown; createdBy: string }>();
    for (const d of existingSnap.docs) {
      const data = d.data();
      existingMeta.set(d.id, {
        createdAt: data.createdAt,
        createdBy: typeof data.createdBy === 'string' ? data.createdBy : uid,
      });
    }

    // Escreve transações em lotes de 350
    const chunkSize = 350;
    for (let i = 0; i < parsed.transactions.length; i += chunkSize) {
      const chunk = parsed.transactions.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const tx of chunk) {
        const existing = existingMeta.get(tx.id);
        batch.set(doc(db, 'transactions', tx.id), {
          ...tx,
          createdBy: existing ? existing.createdBy : uid,
          createdAt: existing ? existing.createdAt : serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // Recalcula prestações de contas mensais e extratos das unidades
    const fullTxList: Transaction[] = parsed.transactions.map((t) => ({
      ...t,
      createdAt: null,
      updatedAt: null,
    }));

    const summaries = computeAllMonthlySummaries(
      fullTxList,
      targetUnits,
      parsed.initialBalance
    );

    // Publica automaticamente meses encerrados até publishClosedUpTo
    for (let i = 0; i < summaries.length; i += 200) {
      const chunk = summaries.slice(i, i + 200);
      const batch = writeBatch(db);
      for (const sum of chunk) {
        const isClosed = sum.competence <= publishClosedUpTo;
        const reportPayload = buildMonthlyReportPayload(
          sum,
          isClosed,
          isClosed ? 'Prestação de contas consolidada a partir do histórico oficial.' : '',
          isClosed ? uid : null
        );
        batch.set(doc(db, 'monthly_reports', sum.competence), {
          ...reportPayload,
          publishedAt: isClosed ? serverTimestamp() : null,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    for (const unit of targetUnits) {
      await syncUnitStatementForUnit(unit, fullTxList);
    }

    return {
      importedCount: parsed.transactions.length,
      competencesCount: summaries.length,
      warnings: parsed.warnings,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'transactions');
  }
}

export async function restoreBackupJson(
  payload: {
    settings: CondominiumSettings;
    units: Unit[];
    transactions: Transaction[];
  },
  uid: string
): Promise<void> {
  try {
    // Limpar transações antigas antes de restaurar
    const existingSnap = await getDocs(collection(db, 'transactions'));
    const deleteDocs = existingSnap.docs;
    for (let i = 0; i < deleteDocs.length; i += 350) {
      const batch = writeBatch(db);
      for (const d of deleteDocs.slice(i, i + 350)) {
        batch.delete(d.ref);
      }
      await batch.commit();
    }

    await saveSettings(payload.settings, uid);
    for (const u of payload.units) {
      await saveUnit(u);
    }

    for (let i = 0; i < payload.transactions.length; i += 350) {
      const batch = writeBatch(db);
      for (const tx of payload.transactions.slice(i, i + 350)) {
        batch.set(doc(db, 'transactions', tx.id), {
          ...tx,
          createdBy: tx.createdBy || uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    for (const u of payload.units) {
      await syncUnitStatementForUnit(u, payload.transactions);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'backup/restore');
  }
}

export async function uploadReceiptAndLink(
  tx: Transaction,
  fileName: string,
  mimeType: string,
  dataUrl: string,
  visibility: ReceiptVisibility,
  uid: string,
  allTransactions: Transaction[],
  units: Unit[]
): Promise<string> {
  const receiptId = `rec_${tx.id}_${Date.now().toString(36)}`;
  const receiptData: Omit<Receipt, 'createdAt'> = {
    id: receiptId,
    txId: tx.id,
    unitId: tx.unitId ?? null,
    competence: tx.competence,
    fileName: fileName.slice(0, 180),
    mimeType: mimeType.slice(0, 80),
    dataUrl,
    visibility,
    createdBy: uid,
  };

  try {
    await setDoc(doc(db, 'receipts', receiptId), {
      ...receiptData,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'transactions', tx.id), {
      receiptId,
      updatedAt: serverTimestamp(),
    });

    if (tx.unitId) {
      const unit = units.find((u) => u.id === tx.unitId);
      if (unit) {
        const merged = allTransactions.map((t) =>
          t.id === tx.id ? { ...t, receiptId } : t
        );
        await syncUnitStatementForUnit(unit, merged);
      }
    }
    return receiptId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `receipts/${receiptId}`);
  }
}

export async function createOrResendInvite(
  email: string,
  displayName: string,
  role: UserRole,
  unitId: string | null,
  createdBy: string
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const inviteId = emailToInviteId(normalized);
  try {
    await setDoc(doc(db, 'invites', inviteId), {
      email: normalized,
      displayName: displayName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      role,
      unitId: role === 'morador' ? unitId : unitId ?? null,
      status: 'pendente',
      acceptedUid: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `invites/${inviteId}`);
  }
}

export async function revokeInvite(inviteId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'invites', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `invites/${inviteId}`);
  }
}

export async function updateUserAccess(
  userId: string,
  displayName: string,
  role: UserRole,
  unitId: string | null,
  active: boolean
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      displayName: displayName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
      role,
      unitId: role === 'morador' ? unitId : unitId ?? null,
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function saveMonthlyDocument(
  docData: Omit<MonthlyDocument, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const id =
    docData.id && FIELD_LIMITS.ID_PATTERN.test(docData.id)
      ? docData.id.slice(0, 128)
      : `doc_${docData.competence.replace('-', '')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const storageMode = docData.storageMode === 'external_link' ? 'external_link' : 'embedded';
  const payload = {
    id,
    competence: docData.competence,
    documentDate:
      docData.documentDate && FIELD_LIMITS.DATE_PATTERN.test(docData.documentDate)
        ? docData.documentDate
        : null,
    title: docData.title.trim().slice(0, FIELD_LIMITS.DESC_MAX),
    category: docData.category,
    fileName: docData.fileName.trim().slice(0, FIELD_LIMITS.FILE_NAME_MAX),
    mimeType: docData.mimeType.trim().slice(0, 80),
    storageMode,
    dataUrl:
      storageMode === 'embedded' && docData.dataUrl
        ? docData.dataUrl.slice(0, FIELD_LIMITS.DATA_URL_MAX)
        : null,
    externalUrl:
      storageMode === 'external_link' && docData.externalUrl
        ? docData.externalUrl.trim().slice(0, FIELD_LIMITS.URL_MAX)
        : null,
    visibility: docData.visibility,
    notes: (docData.notes ?? '').trim().slice(0, FIELD_LIMITS.NOTES_MAX),
    createdBy: docData.createdBy,
    updatedAt: serverTimestamp(),
  };

  try {
    if (isNew) {
      await setDoc(doc(db, 'monthly_documents', id), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'monthly_documents', id), payload);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `monthly_documents/${id}`);
  }
}

export async function deleteMonthlyDocument(docId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'monthly_documents', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `monthly_documents/${docId}`);
  }
}
