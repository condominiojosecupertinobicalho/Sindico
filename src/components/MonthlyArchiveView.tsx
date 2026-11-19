import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Lock,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  MONTHLY_DOC_CATEGORY_LABELS,
  OFFICIAL_MONTHLY_ARCHIVE,
} from '../data/monthlyArchiveManifest';
import {
  FIELD_LIMITS,
  type MonthlyDocument,
  type MonthlyDocumentCategory,
  type ReceiptVisibility,
  type UserRole,
} from '../types/condo';
import {
  formatCompetenceLabel,
  formatCompetenceShort,
  formatDateBR,
  getTodaySaoPauloISO,
} from '../utils/formatters';

interface MonthlyArchiveViewProps {
  role: UserRole;
  userId: string;
  selectedCompetence: string;
  onSelectCompetence: (comp: string) => void;
  firestoreDocuments: MonthlyDocument[];
  onSaveDocument: (
    doc: Omit<MonthlyDocument, 'createdAt' | 'updatedAt'>,
    isNew: boolean
  ) => Promise<string>;
  onDeleteDocument: (docId: string) => Promise<void>;
  embedded?: boolean;
}

type CategoryFilter = 'todos' | MonthlyDocumentCategory;

function getDocUrl(doc: MonthlyDocument): string | null {
  if (doc.storageMode === 'embedded') return doc.dataUrl ?? null;
  return doc.externalUrl ?? null;
}

function getFileIcon(mimeType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (mimeType.startsWith('video/') || lower.endsWith('.mp4')) {
    return <Film className="w-4 h-4 text-orange-700 shrink-0" />;
  }
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|jfif|webp)$/i.test(lower)) {
    return <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />;
  }
  if (mimeType.includes('xml') || lower.endsWith('.xml')) {
    return <FileCode2 className="w-4 h-4 text-stone-600 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-amber-700 shrink-0" />;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.src = String(reader.result ?? '');
    };
    reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
    img.onload = () => {
      const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponível.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    reader.readAsDataURL(file);
  });
}

function formatXmlPretty(xmlText: string): string {
  try {
    const reg = /(>)(<)(\/*)/g;
    const formatted = xmlText.replace(reg, '$1\n$2$3');
    let pad = 0;
    return formatted
      .split('\n')
      .map((node) => {
        let indent = 0;
        if (node.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (node.match(/^<\/\w/)) {
          if (pad > 0) pad -= 1;
        } else if (node.match(/^<\w([^>]*[^/])?>.*$/)) {
          indent = 1;
        }
        const line = '  '.repeat(pad) + node;
        pad += indent;
        return line;
      })
      .join('\n');
  } catch {
    return xmlText;
  }
}

export function MonthlyArchiveView({
  role,
  userId,
  selectedCompetence,
  onSelectCompetence,
  firestoreDocuments,
  onSaveDocument,
  onDeleteDocument,
  embedded = false,
}: MonthlyArchiveViewProps) {
  const isAdmin = role === 'admin';
  const isAdminOrCouncil = role === 'admin' || role === 'conselheiro';

  const [scopeAllMonths, setScopeAllMonths] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('todos');
  const [search, setSearch] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'todos' | ReceiptVisibility>('todos');

  // Visualizador e Download
  const [previewDoc, setPreviewDoc] = useState<MonthlyDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewXmlText, setPreviewXmlText] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Modal de upload/cadastro (admin)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [formCompetence, setFormCompetence] = useState(selectedCompetence);
  const [formDocDate, setFormDocDate] = useState(getTodaySaoPauloISO());
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<MonthlyDocumentCategory>('comprovante_pagamento');
  const [formVisibility, setFormVisibility] = useState<ReceiptVisibility>('published_residents');
  const [formStorageMode, setFormStorageMode] = useState<'embedded' | 'external_link'>('embedded');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  // Exclusão
  const [deleteTarget, setDeleteTarget] = useState<MonthlyDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  // Unifica acervo oficial estático + novos documentos gravados no Firestore
  const allAccessibleDocuments = useMemo(() => {
    const visibleArchive = OFFICIAL_MONTHLY_ARCHIVE.filter(
      (d) => isAdminOrCouncil || d.visibility === 'published_residents'
    );
    const visibleFirestore = firestoreDocuments.filter(
      (d) => isAdminOrCouncil || d.visibility === 'published_residents'
    );
    return [...visibleFirestore, ...visibleArchive];
  }, [firestoreDocuments, isAdminOrCouncil]);

  // Lista de pastas mensais disponíveis ordenadas da mais recente para a mais antiga
  const foldersByYear = useMemo(() => {
    const map = new Map<
      string,
      { competence: string; count: number; hasStatement: boolean }[]
    >();

    const counts = new Map<string, { count: number; hasStatement: boolean }>();
    for (const d of allAccessibleDocuments) {
      const prev = counts.get(d.competence) ?? { count: 0, hasStatement: false };
      counts.set(d.competence, {
        count: prev.count + 1,
        hasStatement: prev.hasStatement || d.category === 'extrato_bancario',
      });
    }

    // Garante que a competência selecionada apareça na lista mesmo se ainda estiver vazia
    if (FIELD_LIMITS.COMPETENCE_PATTERN.test(selectedCompetence) && !counts.has(selectedCompetence)) {
      counts.set(selectedCompetence, { count: 0, hasStatement: false });
    }

    const sortedCompetences = Array.from(counts.keys()).sort((a, b) => b.localeCompare(a));
    for (const comp of sortedCompetences) {
      const year = comp.slice(0, 4);
      const info = counts.get(comp)!;
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push({ competence: comp, ...info });
    }

    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [allAccessibleDocuments, selectedCompetence]);

  // Se o mês selecionado não tem documentos mas existem pastas no acervo, mantém seleção do usuário ou permite trocar com 1 clique
  const activeFolderCompetence = selectedCompetence;

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAccessibleDocuments
      .filter((d) => {
        if (!scopeAllMonths && d.competence !== activeFolderCompetence) return false;
        if (categoryFilter !== 'todos' && d.category !== categoryFilter) return false;
        if (visibilityFilter !== 'todos' && d.visibility !== visibilityFilter) return false;
        if (q) {
          const hay = `${d.title} ${d.fileName} ${d.notes} ${MONTHLY_DOC_CATEGORY_LABELS[d.category]} ${d.competence}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.competence.localeCompare(a.competence) ||
          a.category.localeCompare(b.category) ||
          a.title.localeCompare(b.title)
      );
  }, [
    allAccessibleDocuments,
    scopeAllMonths,
    activeFolderCompetence,
    categoryFilter,
    visibilityFilter,
    search,
  ]);

  const monthStats = useMemo(() => {
    const docsInScope = allAccessibleDocuments.filter(
      (d) => scopeAllMonths || d.competence === activeFolderCompetence
    );
    const hasExtrato = docsInScope.some((d) => d.category === 'extrato_bancario');
    const proofsCount = docsInScope.filter(
      (d) => d.category === 'comprovante_pagamento' || d.category === 'recibo'
    ).length;
    const invoicesCount = docsInScope.filter(
      (d) =>
        d.category === 'nota_fiscal' ||
        d.category === 'boleto_guia' ||
        d.category === 'contrato'
    ).length;
    return {
      total: docsInScope.length,
      hasExtrato,
      proofsCount,
      invoicesCount,
    };
  }, [allAccessibleDocuments, scopeAllMonths, activeFolderCompetence]);

  // Carrega Blob tipado ou texto XML para o visualizador de auditoria
  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    async function preparePreview() {
      setPreviewXmlText(null);
      setPreviewBlobUrl(null);
      setPreviewError(null);

      if (!previewDoc) return;
      const url = getDocUrl(previewDoc);
      if (!url) {
        setPreviewError('Documento sem endereço disponível para visualização.');
        return;
      }

      if (previewDoc.storageMode === 'external_link') {
        return;
      }

      const isXml =
        previewDoc.mimeType.includes('xml') ||
        previewDoc.fileName.toLowerCase().endsWith('.xml');
      const isPdf = previewDoc.mimeType === 'application/pdf';
      const isImage = previewDoc.mimeType.startsWith('image/');

      if (isXml) {
        setPreviewLoading(true);
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('Falha ao carregar XML.');
          const text = await resp.text();
          if (!cancelled) setPreviewXmlText(formatXmlPretty(text));
        } catch {
          if (!cancelled) setPreviewError('Não foi possível ler o conteúdo XML neste navegador.');
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
        return;
      }

      // Para arquivos embutidos (dataUrl) ou PDFs/imagens sem extensão no acervo,
      // criamos um Blob com MIME explícito para garantir renderização correta no iframe/img.
      if (
        (isPdf || isImage) &&
        (previewDoc.storageMode === 'embedded' ||
          (previewDoc.storageMode === 'official_archive' &&
            !/\.(pdf|png|jpe?g|jfif|webp)$/i.test(url)))
      ) {
        setPreviewLoading(true);
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error('Falha ao carregar documento.');
          const buf = await resp.arrayBuffer();
          const blob = new Blob([buf], { type: previewDoc.mimeType });
          const objUrl = URL.createObjectURL(blob);
          revokedUrl = objUrl;
          if (!cancelled) setPreviewBlobUrl(objUrl);
        } catch {
          if (!cancelled) setPreviewError('Não foi possível abrir o arquivo para pré-visualização.');
        } finally {
          if (!cancelled) setPreviewLoading(false);
        }
      }
    }

    void preparePreview();

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [previewDoc]);

  const handleDownloadDoc = async (docItem: MonthlyDocument) => {
    const url = getDocUrl(docItem);
    if (!url) return;

    setDownloadingDocId(docItem.id);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Falha ao baixar o documento.');
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], {
        type: docItem.mimeType || 'application/octet-stream',
      });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = docItem.fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.download = docItem.fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleOpenUploadModal = () => {
    setFormCompetence(activeFolderCompetence);
    setFormDocDate(getTodaySaoPauloISO());
    setFormTitle('');
    setFormCategory('comprovante_pagamento');
    setFormVisibility('published_residents');
    setFormStorageMode('embedded');
    setFormExternalUrl('');
    setFormNotes('');
    setFormFile(null);
    setFormError(null);
    setShowUploadModal(true);
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!FIELD_LIMITS.COMPETENCE_PATTERN.test(formCompetence)) {
      setFormError('Informe a competência no formato YYYY-MM.');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Informe um título descritivo para o documento.');
      return;
    }

    setSavingDoc(true);
    try {
      let dataUrl: string | null = null;
      let externalUrl: string | null = null;
      let fileName = 'documento';
      let mimeType = 'application/pdf';

      if (formStorageMode === 'embedded') {
        if (!formFile) {
          setFormError('Selecione um arquivo PDF, imagem ou XML para salvar na pasta mensal.');
          return;
        }
        fileName = formFile.name.slice(0, FIELD_LIMITS.FILE_NAME_MAX);
        mimeType = formFile.type || 'application/octet-stream';

        if (formFile.type.startsWith('image/')) {
          dataUrl = await compressImageToDataUrl(formFile, 1400, 0.8);
          mimeType = 'image/jpeg';
        } else {
          if (formFile.size > 520 * 1024) {
            setFormError(
              'Arquivos acima de 500 KB devem ser salvos via opção "Link externo (Drive / Nuvem)".'
            );
            return;
          }
          dataUrl = await readFileAsDataUrl(formFile);
          if (!mimeType || mimeType === 'application/octet-stream') {
            if (fileName.toLowerCase().endsWith('.xml')) mimeType = 'application/xml';
            else if (fileName.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
          }
        }

        if (dataUrl.length > FIELD_LIMITS.DATA_URL_MAX - 10000) {
          setFormError(
            'Arquivo excedeu o limite seguro do banco após codificação. Utilize a opção "Link externo".'
          );
          return;
        }
      } else {
        const trimmedUrl = formExternalUrl.trim();
        if (!/^https:\/\/.+/.test(trimmedUrl)) {
          setFormError('O link externo deve começar com https://');
          return;
        }
        externalUrl = trimmedUrl.slice(0, FIELD_LIMITS.URL_MAX);
        fileName = `${formTitle.trim().slice(0, 80).replace(/[^a-zA-Z0-9_-]+/g, '_')}.url`;
        mimeType = 'text/uri-list';
      }

      await onSaveDocument(
        {
          id: '',
          competence: formCompetence,
          documentDate: formDocDate || null,
          title: formTitle.trim(),
          category: formCategory,
          fileName,
          mimeType,
          storageMode: formStorageMode,
          dataUrl,
          externalUrl,
          visibility: formVisibility,
          notes: formNotes.trim(),
          createdBy: userId,
        },
        true
      );

      onSelectCompetence(formCompetence);
      setScopeAllMonths(false);
      setShowUploadModal(false);
    } catch {
      setFormError('Não foi possível salvar o documento. Verifique o arquivo e tente novamente.');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleExportIndexCsv = () => {
    const header = [
      'Competência',
      'Data Documento',
      'Categoria',
      'Título',
      'Arquivo',
      'Origem',
      'Visibilidade',
      'Observações',
    ];
    const rows = filteredDocuments.map((d) => [
      d.competence,
      d.documentDate ? formatDateBR(d.documentDate) : '',
      MONTHLY_DOC_CATEGORY_LABELS[d.category],
      d.title,
      d.fileName,
      d.storageMode === 'official_archive'
        ? 'Acervo Oficial'
        : d.storageMode === 'embedded'
          ? 'Arquivo no Sistema'
          : 'Link Externo',
      d.visibility === 'published_residents' ? 'Moradores e Auditoria' : 'Síndico e Conselho',
      d.notes ?? '',
    ]);
    const csvContent = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indice_auditoria_${scopeAllMonths ? 'completo' : activeFolderCompetence}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-stone-200">
          <p className="text-sm text-stone-600">
            Arquivo permanente por mês com extratos bancários, comprovantes, boletos, notas fiscais, contratos e recibos.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportIndexCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-stone-600" />
              Exportar índice (CSV)
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Adicionar documento
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-stone-200">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
              Pasta Mensal e Auditoria de Documentos
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">
              Arquivo permanente por mês com extratos bancários, comprovantes, boletos, notas fiscais, contratos e recibos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportIndexCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-stone-600" />
              Exportar índice (CSV)
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Adicionar documento
              </button>
            )}
          </div>
        </div>
      )}

      {/* Layout Principal: Árvore de Pastas Mensais + Conteúdo da Pasta */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Pastas por Ano/Mês */}
        <aside className="lg:col-span-3 bg-white border border-stone-200 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              Pastas Mensais
            </h2>
            <button
              type="button"
              onClick={() => setScopeAllMonths(!scopeAllMonths)}
              className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                scopeAllMonths
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {scopeAllMonths ? 'Todos os meses' : 'Ver todos'}
            </button>
          </div>

          <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
            {foldersByYear.map(([year, months]) => (
              <div key={year} className="space-y-1">
                <p className="text-xs font-semibold text-stone-400 px-2">{year}</p>
                {months.map((m) => {
                  const isSelected = !scopeAllMonths && m.competence === activeFolderCompetence;
                  return (
                    <button
                      key={m.competence}
                      type="button"
                      onClick={() => {
                        setScopeAllMonths(false);
                        onSelectCompetence(m.competence);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : 'text-stone-700 hover:bg-stone-100 border border-transparent'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {isSelected ? (
                          <FolderOpen className="w-4 h-4 text-amber-700 shrink-0" />
                        ) : (
                          <Folder className="w-4 h-4 text-stone-400 shrink-0" />
                        )}
                        <span className="truncate">{formatCompetenceShort(m.competence)}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {m.hasStatement && (
                          <span title="Extrato bancário anexado">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </span>
                        )}
                        <span className="font-mono tabular-nums text-[11px] text-stone-500">
                          {m.count}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Coluna Direita: Resumo de Auditoria + Filtros + Lista de Documentos */}
        <div className="lg:col-span-9 space-y-5 min-w-0">
          {/* KPIs da Pasta Selecionada */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500">Pasta selecionada</p>
              <p className="text-sm font-semibold text-stone-900 mt-1 truncate">
                {scopeAllMonths ? 'Acervo Completo' : formatCompetenceLabel(activeFolderCompetence)}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500">Total de arquivos</p>
              <p className="text-lg font-mono font-semibold tabular-nums text-stone-900 mt-0.5">
                {monthStats.total}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500">Extrato bancário</p>
              <p
                className={`text-sm font-semibold mt-1 ${
                  monthStats.hasExtrato ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {monthStats.hasExtrato ? 'Arquivado' : 'Não anexado'}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500">Comprovantes / NFs</p>
              <p className="text-lg font-mono font-semibold tabular-nums text-stone-900 mt-0.5">
                {monthStats.proofsCount + monthStats.invoicesCount}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por fornecedor, título, tipo ou nome do arquivo..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              {isAdminOrCouncil && (
                <select
                  value={visibilityFilter}
                  onChange={(e) =>
                    setVisibilityFilter(e.target.value as 'todos' | ReceiptVisibility)
                  }
                  className="px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white text-stone-700"
                >
                  <option value="todos">Todas as visibilidades</option>
                  <option value="published_residents">Transparência (Moradores)</option>
                  <option value="council_and_admin">Restrito (Síndico e Conselho)</option>
                </select>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'extrato_bancario', label: 'Extratos' },
                  { id: 'comprovante_pagamento', label: 'Comprovantes' },
                  { id: 'boleto_guia', label: 'Boletos / DARF' },
                  { id: 'nota_fiscal', label: 'Notas Fiscais / XML' },
                  { id: 'contrato', label: 'Contratos' },
                  { id: 'recibo', label: 'Recibos' },
                  ...(isAdminOrCouncil
                    ? [{ id: 'encargos_fiscais' as const, label: 'Encargos Terceirizada' }]
                    : []),
                  { id: 'vistoria_midia', label: 'Vistoria / Vídeos' },
                ] as { id: CategoryFilter; label: string }[]
              ).map((tab) => {
                const active = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategoryFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      active
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lista de Documentos */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            {filteredDocuments.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Folder className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-sm font-medium text-stone-700">
                  Nenhum documento encontrado para {scopeAllMonths ? 'os filtros atuais' : formatCompetenceLabel(activeFolderCompetence)}.
                </p>
                <p className="text-xs text-stone-500">
                  {isAdmin
                    ? 'Clique em "Adicionar documento" para arquivar comprovantes, extratos ou notas fiscais deste mês.'
                    : 'Selecione um mês com arquivos na barra lateral ou visualize todo o acervo.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {!scopeAllMonths && allAccessibleDocuments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const latest = allAccessibleDocuments
                          .map((d) => d.competence)
                          .sort((a, b) => b.localeCompare(a))[0];
                        if (latest) {
                          onSelectCompetence(latest);
                          setCategoryFilter('todos');
                          setSearch('');
                        }
                      }}
                      className="px-3.5 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg"
                    >
                      Abrir pasta mais recente com arquivos
                    </button>
                  )}
                  {!scopeAllMonths && (
                    <button
                      type="button"
                      onClick={() => setScopeAllMonths(true)}
                      className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg"
                    >
                      Ver todo o acervo
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-stone-600">
                  <span className="font-medium">
                    {filteredDocuments.length}{' '}
                    {filteredDocuments.length === 1
                      ? 'documento encontrado'
                      : 'documentos encontrados'}
                  </span>
                  <span className="hidden sm:inline text-stone-500">
                    Clique no documento ou em Visualizar para abrir
                  </span>
                </div>

                <div className="divide-y divide-stone-100">
                  {filteredDocuments.map((docItem) => {
                    const docUrl = getDocUrl(docItem);
                    const isFirestoreDoc = docItem.storageMode !== 'official_archive';
                    return (
                      <div
                        key={docItem.id}
                        className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/90 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(docItem)}
                          className="flex items-start gap-3 text-left min-w-0 flex-1 group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded-lg"
                        >
                          <div className="mt-0.5 p-2 rounded-lg bg-stone-100 group-hover:bg-amber-50 transition-colors shrink-0">
                            {getFileIcon(docItem.mimeType, docItem.fileName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-stone-900 group-hover:text-amber-800 group-hover:underline leading-snug break-words">
                              {docItem.title}
                            </p>
                            <p className="text-xs text-stone-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{MONTHLY_DOC_CATEGORY_LABELS[docItem.category]}</span>
                              {scopeAllMonths && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums text-stone-700">
                                    {formatCompetenceShort(docItem.competence)}
                                  </span>
                                </>
                              )}
                              {docItem.documentDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="font-mono tabular-nums">
                                    {formatDateBR(docItem.documentDate)}
                                  </span>
                                </>
                              )}
                              {isAdminOrCouncil && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`inline-flex items-center gap-1 ${
                                      docItem.visibility === 'published_residents'
                                        ? 'text-emerald-700'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {docItem.visibility === 'published_residents' ? (
                                      <>
                                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                        Moradores
                                      </>
                                    ) : (
                                      <>
                                        <Lock className="w-3.5 h-3.5 shrink-0" />
                                        Conselho/Síndico
                                      </>
                                    )}
                                  </span>
                                </>
                              )}
                            </p>
                            <p className="text-[11px] text-stone-400 font-mono truncate mt-0.5">
                              {docItem.fileName}
                            </p>
                            {docItem.notes && (
                              <p className="text-xs text-stone-600 mt-1">{docItem.notes}</p>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0 pl-11 sm:pl-0">
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(docItem)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            Visualizar
                          </button>

                          {docUrl && docItem.storageMode === 'external_link' ? (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              Abrir link
                            </a>
                          ) : docUrl ? (
                            <button
                              type="button"
                              onClick={() => void handleDownloadDoc(docItem)}
                              disabled={downloadingDocId === docItem.id}
                              title="Baixar arquivo"
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" />
                              {downloadingDocId === docItem.id ? 'Baixando...' : 'Baixar'}
                            </button>
                          ) : null}

                          {isAdmin && isFirestoreDoc && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(docItem)}
                              title="Excluir documento"
                              className="inline-flex items-center justify-center p-2 text-xs font-medium text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Visualizador de Auditoria */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium text-amber-700">
                  {formatCompetenceLabel(previewDoc.competence)} —{' '}
                  {MONTHLY_DOC_CATEGORY_LABELS[previewDoc.category]}
                </p>
                <h3 className="text-sm font-semibold text-stone-900 truncate">
                  {previewDoc.title}
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(previewBlobUrl ?? getDocUrl(previewDoc)) && (
                  <a
                    href={(previewBlobUrl ?? getDocUrl(previewDoc))!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Nova aba
                  </a>
                )}
                {getDocUrl(previewDoc) && previewDoc.storageMode !== 'external_link' && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadDoc(previewDoc)}
                    disabled={downloadingDocId === previewDoc.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {downloadingDocId === previewDoc.id ? 'Baixando...' : 'Baixar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto flex-1 bg-stone-50">
              {previewLoading && (
                <div className="py-16 text-center text-sm text-stone-500">
                  Carregando documento...
                </div>
              )}

              {previewError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
                  {previewError}
                </div>
              )}

              {!previewLoading && !previewError && previewDoc.storageMode === 'external_link' && (
                <div className="bg-white border border-stone-200 rounded-xl p-6 text-center space-y-3">
                  <Link2 className="w-8 h-8 text-amber-700 mx-auto" />
                  <p className="text-sm font-medium text-stone-900">
                    Documento armazenado via link externo seguro
                  </p>
                  <p className="text-xs text-stone-500 break-all">{previewDoc.externalUrl}</p>
                  {previewDoc.externalUrl && (
                    <a
                      href={previewDoc.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 rounded-lg"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Abrir documento externo
                    </a>
                  )}
                </div>
              )}

              {!previewLoading && !previewError && previewXmlText !== null && (
                <pre className="p-4 bg-stone-900 text-stone-100 rounded-lg text-xs font-mono overflow-auto max-h-[540px] leading-relaxed">
                  {previewXmlText}
                </pre>
              )}

              {!previewLoading &&
                !previewError &&
                previewXmlText === null &&
                previewDoc.storageMode !== 'external_link' && (
                  <>
                    {previewDoc.mimeType.startsWith('image/') && (
                      <div className="flex justify-center">
                        <img
                          src={previewBlobUrl ?? getDocUrl(previewDoc) ?? ''}
                          alt={previewDoc.title}
                          className="max-h-[580px] rounded-lg border border-stone-200 bg-white"
                        />
                      </div>
                    )}

                    {previewDoc.mimeType.startsWith('video/') && (
                      <video
                        controls
                        src={getDocUrl(previewDoc) ?? ''}
                        className="w-full max-h-[540px] rounded-lg bg-black"
                      />
                    )}

                    {previewDoc.mimeType === 'application/pdf' && (
                      <div className="space-y-2">
                        <iframe
                          title={previewDoc.title}
                          src={previewBlobUrl ?? getDocUrl(previewDoc) ?? ''}
                          className="w-full h-[560px] border border-stone-300 rounded-lg bg-white"
                        />
                        <p className="text-xs text-stone-500 text-center">
                          Se o PDF não carregar na janela acima, utilize os botões{' '}
                          <span className="font-medium text-stone-700">Nova aba</span> ou{' '}
                          <span className="font-medium text-stone-700">Baixar</span> no topo.
                        </p>
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Documento à Pasta Mensal (Síndico) */}
      {showUploadModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-stone-900">
                Arquivar Documento na Pasta Mensal
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Pasta Mensal (Competência)
                  </label>
                  <input
                    type="month"
                    required
                    value={formCompetence}
                    onChange={(e) => setFormCompetence(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Data do documento
                  </label>
                  <input
                    type="date"
                    value={formDocDate}
                    onChange={(e) => setFormDocDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Título / Descrição do arquivo
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.DESC_MAX}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex.: Extrato Bancário Banco Inter (Março/2026)"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as MonthlyDocumentCategory)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    {(Object.keys(MONTHLY_DOC_CATEGORY_LABELS) as MonthlyDocumentCategory[]).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {MONTHLY_DOC_CATEGORY_LABELS[cat]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Visibilidade
                  </label>
                  <select
                    value={formVisibility}
                    onChange={(e) => setFormVisibility(e.target.value as ReceiptVisibility)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white"
                  >
                    <option value="published_residents">Moradores e Auditoria</option>
                    <option value="council_and_admin">Restrito (Síndico e Conselho)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Forma de armazenamento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormStorageMode('embedded')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border ${
                      formStorageMode === 'embedded'
                        ? 'bg-amber-50 border-amber-600 text-amber-900'
                        : 'bg-white border-stone-300 text-stone-700'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Enviar arquivo (até 500 KB)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormStorageMode('external_link')}
                    className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border ${
                      formStorageMode === 'external_link'
                        ? 'bg-amber-50 border-amber-600 text-amber-900'
                        : 'bg-white border-stone-300 text-stone-700'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link externo (Drive / Nuvem)
                  </button>
                </div>
              </div>

              {formStorageMode === 'embedded' ? (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    Selecionar arquivo (PDF, Imagem ou XML)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/*,text/xml,application/xml,.pdf,.xml,.png,.jpg,.jpeg,.jfif"
                    onChange={(e) => setFormFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-amber-50 file:text-amber-800 hover:file:bg-amber-100"
                  />
                  <p className="text-[11px] text-stone-500 mt-1">
                    Imagens são comprimidas automaticamente. Para PDFs ou vídeos maiores que 500 KB, use "Link externo".
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    URL segura (https://...)
                  </label>
                  <input
                    type="url"
                    required
                    maxLength={FIELD_LIMITS.URL_MAX}
                    value={formExternalUrl}
                    onChange={(e) => setFormExternalUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Observações para auditoria (opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={FIELD_LIMITS.NOTES_MAX}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex.: Referente à 2ª parcela aprovada em assembleia..."
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 rounded-lg"
                >
                  {savingDoc ? 'Salvando...' : 'Salvar na pasta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmação de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">Excluir documento da pasta?</h3>
            <p className="text-sm text-stone-600">
              Tem certeza que deseja remover <strong>{deleteTarget.title}</strong> ({formatCompetenceLabel(deleteTarget.competence)})? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingDoc}
                onClick={async () => {
                  setDeletingDoc(true);
                  try {
                    await onDeleteDocument(deleteTarget.id);
                    setDeleteTarget(null);
                  } finally {
                    setDeletingDoc(false);
                  }
                }}
                className="px-3.5 py-2 text-sm font-medium text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 rounded-lg"
              >
                {deletingDoc ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
