import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calculator,
  Download,
  ExternalLink,
  FileText,
  Gavel,
  Hammer,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  CONDO_GOVERNANCE_INFO,
  OFFICIAL_DOCUMENTS,
  PLUVIAL_PARTICIPANTS,
  UNIT_CONVENTION_SPECS,
  type OfficialDocumentItem,
} from '../data/seedCupertino';
import type { CondominiumSettings } from '../types/condo';
import { formatBRL } from '../utils/formatters';

interface GovernanceDocsViewProps {
  settings: CondominiumSettings;
}

export function GovernanceDocsView({ settings }: GovernanceDocsViewProps) {
  const [selectedDoc, setSelectedDoc] = useState<OfficialDocumentItem | null>(null);
  const [pluvialTotalInput, setPluvialTotalInput] = useState('2747.50');

  const pluvialTotal = Math.max(0, Number(pluvialTotalInput) || 0);
  const totalTechRatio = useMemo(
    () => PLUVIAL_PARTICIPANTS.reduce((acc, p) => acc + p.techShareRatio, 0),
    []
  );

  const pluvialRows = useMemo(() => {
    const totalUnits = PLUVIAL_PARTICIPANTS.reduce((acc, p) => acc + p.units, 0);
    return PLUVIAL_PARTICIPANTS.map((p) => {
      const equalShare = pluvialTotal / PLUVIAL_PARTICIPANTS.length;
      const byUnitShare = (pluvialTotal * p.units) / totalUnits;
      // Preserva exatamente os valores do PDF quando o total é R$ 2.747,50
      const byTechArea =
        Math.abs(pluvialTotal - 2747.5) < 0.01
          ? p.techShareRatio * 2747.5
          : (pluvialTotal * p.techShareRatio) / totalTechRatio;
      return {
        ...p,
        equalShare,
        byUnitShare,
        byTechArea,
      };
    });
  }, [pluvialTotal, totalTechRatio]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="pb-4 border-b border-stone-200">
        <h1 className="text-xl font-semibold text-stone-900 tracking-tight">
          Convenção, Regras de Rateio e Atas
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Base normativa oficial do {settings.name} para consulta de moradores, conselho e futuros síndicos
        </p>
      </div>

      {/* Identificação Institucional & Gestão Vigente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-semibold">Identificação Registral e Endereço</h2>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-stone-500">CNPJ</dt>
              <dd className="font-mono font-semibold text-stone-900 mt-0.5">
                {settings.cnpj || '07.051.131/0001-47'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Registro e Alvará</dt>
              <dd className="text-stone-800 mt-0.5">{CONDO_GOVERNANCE_INFO.permit}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Endereço</dt>
              <dd className="text-stone-800 mt-0.5">
                {settings.address || 'Rua Professor Ziller, nº 328 — Bairro Minas Brasil, Belo Horizonte/MG'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Matrícula</dt>
              <dd className="text-stone-700 mt-0.5">{CONDO_GOVERNANCE_INFO.registry}</dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <Users className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-semibold">Administração e Conselho ({CONDO_GOVERNANCE_INFO.currentTerm})</h2>
          </div>
          <dl className="space-y-2.5 text-xs">
            <div>
              <dt className="text-stone-500">Síndico eleito (mandato 1 ano, não remunerado)</dt>
              <dd className="text-sm font-medium text-stone-900 mt-0.5">
                {CONDO_GOVERNANCE_INFO.sindico}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Conselho Consultivo / Fiscal (2 membros, mandato 2 anos)</dt>
              <dd className="text-stone-800 mt-0.5 space-y-0.5">
                {CONDO_GOVERNANCE_INFO.conselheiras.map((c) => (
                  <div key={c}>{c}</div>
                ))}
              </dd>
            </div>
            <div className="pt-2 border-t border-stone-100 text-stone-600">
              <strong>Fundo de reserva:</strong> extinto em assembleia de 09/07/2024; o valor de R$ 50,00 foi incorporado à cota ordinária do condomínio.
            </div>
          </dl>
        </section>
      </div>

      {/* Tabela de Frações Ideais e Áreas (Convenção) */}
      <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-semibold text-stone-900">
              Critério de Rateio, Frações Ideais e Áreas das Unidades (Convenção)
            </h2>
          </div>
          <span className="text-xs text-stone-500">Soma das frações ideais: 1,00 (100%)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                <th className="py-2.5 px-4">Unidades</th>
                <th className="py-2.5 px-4">Tipo</th>
                <th className="py-2.5 px-4 text-right">Fração Ideal</th>
                <th className="py-2.5 px-4 text-right">Área Privativa</th>
                <th className="py-2.5 px-4 text-right">Área Comum</th>
                <th className="py-2.5 px-4 text-right">Área Total Real</th>
                <th className="py-2.5 px-4">Vagas e Uso Privativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
              <tr className="hover:bg-stone-50">
                <td className="py-3 px-4 font-medium text-stone-900">101, 102, 201 e 202 (4 unid.)</td>
                <td className="py-3 px-4 text-stone-600">Apartamento Convencional</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-stone-900">
                  {UNIT_CONVENTION_SPECS.apto_101.idealFractionLabel}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">109,27 m²</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">97,59 m²</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">206,86 m²</td>
                <td className="py-3 px-4 text-stone-600">1 vaga (veículo pequeno)</td>
              </tr>
              <tr className="hover:bg-stone-50">
                <td className="py-3 px-4 font-medium text-stone-900">301 e 302 (2 unid.)</td>
                <td className="py-3 px-4 text-stone-600">Cobertura</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-stone-900">
                  {UNIT_CONVENTION_SPECS.apto_301.idealFractionLabel}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">109,27 m²</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">129,62 m²</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-stone-700">238,89 m²</td>
                <td className="py-3 px-4 text-stone-600">
                  2 vagas + uso exclusivo da cobertura (5º piso)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 text-xs text-stone-600 space-y-1">
          <p>
            <strong>Aplicação prática nas atas:</strong> A cota ordinária mensal e obras pela fração ideal utilizam proporção diferenciada entre convencionais e coberturas (atualmente{' '}
            <span className="font-mono font-medium text-stone-800">
              {formatBRL(settings.defaultConventionalFee)}
            </span>{' '}
            e{' '}
            <span className="font-mono font-medium text-stone-800">
              {formatBRL(settings.defaultPenthouseFee)}
            </span>
            ). Rateios específicos aprovados em assembleia (como reposição de água em 2023) podem adotar divisão igualitária (1/6 por unidade).
          </p>
          <p>
            <strong>Inadimplência e atraso:</strong> {CONDO_GOVERNANCE_INFO.latePaymentRule}
          </p>
        </div>
      </section>

      {/* Regras de Utilização & Obras de Melhorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-semibold">Normas de Utilização, Estrutura e Assembleias</h2>
          </div>
          <ul className="space-y-2 text-xs text-stone-700 leading-relaxed">
            {CONDO_GOVERNANCE_INFO.structuralRules.map((rule) => (
              <li key={rule} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              <strong>Quóruns de aprovação:</strong> Unanimidade para alterar Convenção ou partes comuns; 2/3 para obras de conservação/embelezamento e despesas extraordinárias; maioria simples para despesas ordinárias e obras urgentes.
            </span>
          </div>
        </section>

        <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-stone-900">
            <Hammer className="w-4 h-4 text-amber-700 shrink-0" />
            <h2 className="text-sm font-semibold">Ordem de Obras de Melhorias (Ata 12/08/2025)</h2>
          </div>
          <div className="space-y-2.5">
            {CONDO_GOVERNANCE_INFO.improvementPlan2025.map((item) => (
              <div
                key={item.priority}
                className="p-3 border border-stone-200 rounded-lg bg-stone-50/70 space-y-0.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-stone-900">
                  <span>{item.priority} — {item.scope}</span>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">{item.details}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Simulador de Rateio Compartilhado — Drenagem Pluvial */}
      <section className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-stone-900">
              <Calculator className="w-4 h-4 text-amber-700 shrink-0" />
              <h2 className="text-sm font-semibold">
                Referência de Rateio — Infraestrutura Compartilhada de Drenagem Pluvial
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Comparativo entre os 5 imóveis vizinhos participantes da rede compartilhada (base técnica do estudo)
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="pluvial-total" className="text-xs font-medium text-stone-700 whitespace-nowrap">
              Valor da manutenção (R$):
            </label>
            <input
              id="pluvial-total"
              type="number"
              step="0.01"
              min="0"
              value={pluvialTotalInput}
              onChange={(e) => setPluvialTotalInput(e.target.value)}
              className="w-32 px-3 py-1.5 text-sm border border-stone-300 rounded-lg font-mono text-right"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-600">
                <th className="py-2.5 px-4">Imóvel participante</th>
                <th className="py-2.5 px-4 text-right">Unidades</th>
                <th className="py-2.5 px-4 text-right">1. Divisão igual (5 imóveis)</th>
                <th className="py-2.5 px-4 text-right">2. Por unidades (16 unid.)</th>
                <th className="py-2.5 px-4 text-right">3. Área contribuinte (estudo)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs sm:text-sm">
              {pluvialRows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    'highlight' in row && row.highlight
                      ? 'bg-amber-50/60 font-medium'
                      : 'hover:bg-stone-50'
                  }
                >
                  <td className="py-2.5 px-4 text-stone-900">{row.label}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-600">
                    {row.units}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-800">
                    {formatBRL(row.equalShare)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-800">
                    {formatBRL(row.byUnitShare)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-stone-900">
                    {formatBRL(row.byTechArea)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Acervo de Documentos Oficiais (PDFs) */}
      <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-stone-900">
          <Gavel className="w-4 h-4 text-amber-700 shrink-0" />
          <h2 className="text-sm font-semibold">Acervo Oficial — Convenção e Atas Digitalizadas</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {OFFICIAL_DOCUMENTS.map((docItem) => {
            const isPreviewing = selectedDoc?.id === docItem.id;
            return (
              <div
                key={docItem.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isPreviewing ? 'border-amber-600 bg-amber-50/30' : 'border-stone-200 bg-white'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                    <span className="font-medium text-amber-800">{docItem.category}</span>
                    <span>{docItem.dateLabel}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-stone-900">{docItem.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{docItem.summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(isPreviewing ? null : docItem)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {isPreviewing ? 'Fechar visualização' : 'Visualizar aqui'}
                  </button>
                  <a
                    href={docItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir PDF
                  </a>
                  <a
                    href={docItem.url}
                    download={docItem.fileName}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded-lg"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {selectedDoc && (
          <div className="pt-4 border-t border-stone-200 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-stone-800">
                Visualizando: {selectedDoc.title}
              </p>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="text-xs text-stone-500 hover:text-stone-900 underline"
              >
                Ocultar leitor
              </button>
            </div>
            <iframe
              title={selectedDoc.title}
              src={selectedDoc.url}
              className="w-full h-[560px] border border-stone-300 rounded-lg bg-stone-100"
            />
          </div>
        )}
      </section>
    </div>
  );
}
