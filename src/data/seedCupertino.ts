import type { CondominiumSettings, Unit } from '../types/condo';

export const DEFAULT_CONDOMINIUM_SETTINGS: Omit<CondominiumSettings, 'updatedAt'> = {
  name: 'Condomínio Edifício José Cupertino Bicalho',
  cnpj: '07.051.131/0001-47',
  address: 'Rua Professor Ziller, nº 328 — Bairro Minas Brasil, Belo Horizonte/MG',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
  initialBalance: 3037.65,
  initialBalanceDate: '2024-06-01',
  defaultDueDay: 15,
  defaultConventionalFee: 466.0,
  defaultPenthouseFee: 518.0,
  rateioRule:
    'Convenção (Cláusula Sexta): fração ideal 0,16 (16%) para apartamentos 101–202 e 0,18 (18%) para coberturas 301–302. Taxas extras pontuais podem seguir a fração ideal ou divisão igualitária (1/6) conforme assembleia.',
  updatedBy: '',
};

export interface UnitConventionSpec {
  idealFraction: number;
  idealFractionLabel: string;
  privateAreaM2: number;
  commonAreaM2: number;
  totalAreaM2: number;
  garageSpots: number;
  exclusiveRoofAccess: boolean;
}

export const UNIT_CONVENTION_SPECS: Record<string, UnitConventionSpec> = {
  apto_101: {
    idealFraction: 0.16,
    idealFractionLabel: '0,16 (16%)',
    privateAreaM2: 109.27,
    commonAreaM2: 97.59,
    totalAreaM2: 206.86,
    garageSpots: 1,
    exclusiveRoofAccess: false,
  },
  apto_102: {
    idealFraction: 0.16,
    idealFractionLabel: '0,16 (16%)',
    privateAreaM2: 109.27,
    commonAreaM2: 97.59,
    totalAreaM2: 206.86,
    garageSpots: 1,
    exclusiveRoofAccess: false,
  },
  apto_201: {
    idealFraction: 0.16,
    idealFractionLabel: '0,16 (16%)',
    privateAreaM2: 109.27,
    commonAreaM2: 97.59,
    totalAreaM2: 206.86,
    garageSpots: 1,
    exclusiveRoofAccess: false,
  },
  apto_202: {
    idealFraction: 0.16,
    idealFractionLabel: '0,16 (16%)',
    privateAreaM2: 109.27,
    commonAreaM2: 97.59,
    totalAreaM2: 206.86,
    garageSpots: 1,
    exclusiveRoofAccess: false,
  },
  apto_301: {
    idealFraction: 0.18,
    idealFractionLabel: '0,18 (18%)',
    privateAreaM2: 109.27,
    commonAreaM2: 129.62,
    totalAreaM2: 238.89,
    garageSpots: 2,
    exclusiveRoofAccess: true,
  },
  apto_302: {
    idealFraction: 0.18,
    idealFractionLabel: '0,18 (18%)',
    privateAreaM2: 109.27,
    commonAreaM2: 129.62,
    totalAreaM2: 238.89,
    garageSpots: 2,
    exclusiveRoofAccess: true,
  },
};

export const INITIAL_UNITS: Omit<Unit, 'updatedAt'>[] = [
  {
    id: 'apto_101',
    code: 'Apartamento 101',
    displayName: 'Apartamento 01 (101)',
    type: 'convencional',
    ownerName: 'Lourdes Aparecida Martins Rocha',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 466.0,
    allocationRule: 'Fração ideal 0,16 (16%) · 1 vaga de garagem',
    active: true,
    order: 1,
  },
  {
    id: 'apto_102',
    code: 'Apartamento 102',
    displayName: 'Apartamento 02 (102)',
    type: 'convencional',
    ownerName: 'Fernanda Aparecida Rezende Gatti',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 466.0,
    allocationRule: 'Fração ideal 0,16 (16%) · 1 vaga de garagem',
    active: true,
    order: 2,
  },
  {
    id: 'apto_201',
    code: 'Apartamento 201',
    displayName: 'Apartamento 03 (201)',
    type: 'convencional',
    ownerName: 'Tânia Marli Antunes Morais',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 466.0,
    allocationRule: 'Fração ideal 0,16 (16%) · 1 vaga de garagem',
    active: true,
    order: 3,
  },
  {
    id: 'apto_202',
    code: 'Apartamento 202',
    displayName: 'Apartamento 04 (202)',
    type: 'convencional',
    ownerName: 'Rafael Moreira de Carvalho Souza',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 466.0,
    allocationRule: 'Fração ideal 0,16 (16%) · 1 vaga de garagem',
    active: true,
    order: 4,
  },
  {
    id: 'apto_301',
    code: 'Apartamento 301',
    displayName: 'Cobertura 01 (301)',
    type: 'cobertura',
    ownerName: 'Lucas Tadeu',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 518.0,
    allocationRule: 'Fração ideal 0,18 (18%) · 2 vagas + cobertura (5º piso)',
    active: true,
    order: 5,
  },
  {
    id: 'apto_302',
    code: 'Apartamento 302',
    displayName: 'Cobertura 02 (302)',
    type: 'cobertura',
    ownerName: 'Lydiane Menezes',
    contact: '',
    occupancyStatus: 'ocupado_proprietario',
    monthlyFee: 518.0,
    allocationRule: 'Fração ideal 0,18 (18%) · 2 vagas + cobertura (5º piso)',
    active: true,
    order: 6,
  },
];

export interface OfficialDocumentItem {
  id: string;
  title: string;
  category: 'Convenção' | 'Ata de Assembleia' | 'Estudo de Rateio';
  dateLabel: string;
  summary: string;
  url: string;
  fileName: string;
}

export const OFFICIAL_DOCUMENTS: OfficialDocumentItem[] = [
  {
    id: 'convencao_resumo_2025',
    title: 'Resumo da Convenção de Condomínio (2025)',
    category: 'Convenção',
    dateLabel: 'Atualizado em 2025',
    summary:
      'Síntese organizada das áreas privativas/comuns, frações ideais (0,16 e 0,18), vagas de garagem, direitos da cobertura, quóruns de assembleia e restrições estruturais.',
    url: '/assets/aistudio/Conven__o_de_Condom_nio__resumo_2025__29889189.pdf',
    fileName: 'Convencao_Condominio_Resumo_2025.pdf',
  },
  {
    id: 'convencao_original',
    title: 'Convenção de Condomínio Original Registrada',
    category: 'Convenção',
    dateLabel: 'Registro 30/01/1992 · Escritura 10/05/1991',
    summary:
      'Instrumento particular registrado no 3º Ofício de Registro de Imóveis de BH (Matrícula 30002, Reg. Auxiliar 2072), incluindo croqui da disposição das vagas de garagem.',
    url: '/assets/aistudio/Conven__o_de_Condom_nio__original__114873c8.pdf',
    fileName: 'Convencao_Condominio_Original_1992.pdf',
  },
  {
    id: 'ata_2025_08_12',
    title: 'Ata da Assembleia Geral Ordinária — Agosto/2025',
    category: 'Ata de Assembleia',
    dateLabel: '12/08/2025',
    summary:
      'Reeleição do síndico Rafael Carvalho (Ap. 202) e conselheiras Tânia (201) e Lourdes (101); aprovação de obras emergenciais (R$ 4.850,00 em 3x) e ordem das 4 obras de melhorias.',
    url: '/assets/aistudio/Ata_Assembleia_Jose_Cupertino_2025_08_12_f382ca17.pdf',
    fileName: 'ATA_Assembleia_2025_08_12.pdf',
  },
  {
    id: 'ata_2024_07_09',
    title: 'Ata da Assembleia Geral Ordinária — Julho/2024',
    category: 'Ata de Assembleia',
    dateLabel: '09/07/2024 · Reg. 1º RTD BH nº 01704859',
    summary:
      'Eleição do síndico Rafael Carvalho e conselho fiscal; extinção do fundo de reserva separado com reversão de R$ 50,00 para a taxa ordinária (R$ 466,00 e R$ 518,00).',
    url: '/assets/aistudio/ATA_2024_07_09_4d567cd0.pdf',
    fileName: 'ATA_Assembleia_2024_07_09.pdf',
  },
  {
    id: 'ata_2023_07_25',
    title: 'Ata da Assembleia Geral Ordinária — Julho/2023',
    category: 'Ata de Assembleia',
    dateLabel: '25/07/2023',
    summary:
      'Rateio igualitário (1/6) para cobertura de saldo negativo após conta extraordinária da Copasa (6x de R$ 56,58) e registro de responsabilidades sobre infiltração na unidade 102.',
    url: '/assets/aistudio/ATA_2023_07_25_fc2a4883.pdf',
    fileName: 'ATA_Assembleia_2023_07_25.pdf',
  },
  {
    id: 'rateio_drenagem_pluvial',
    title: 'Comparativo de Rateio — Infraestrutura de Água Pluvial',
    category: 'Estudo de Rateio',
    dateLabel: 'Referência técnica (R$ 2.747,50)',
    summary:
      'Estudo comparativo entre os 5 imóveis vizinhos (Casa A, Casa B, Casa C, Prédio Prof. Ziller 6 aptos e Prédio Lourival Pinto Coelho 7 aptos) sob 3 critérios de divisão.',
    url: '/assets/aistudio/Rateio_Infra_de__gua_Pluvial_c261e125.pdf',
    fileName: 'Rateio_Infra_Agua_Pluvial.pdf',
  },
];

export const CONDO_GOVERNANCE_INFO = {
  registry: '3º Ofício de RI de Belo Horizonte · Matrícula 30002 · Reg. Auxiliar 2072 (30/01/1992)',
  permit: 'Alvará de Construção nº 2955 (27/12/1989)',
  currentTerm: 'Mandato vigente (Ata 12/08/2025)',
  sindico: 'Rafael Moreira de Carvalho Souza (Apartamento 202)',
  conselheiras: [
    'Lourdes Aparecida Martins Rocha (Apartamento 101)',
    'Tânia Marli Antunes Morais (Apartamento 201)',
  ],
  latePaymentRule:
    'Convenção (Cláusula Sexta, Parágrafo Único): juros de 1% ao mês + correção monetária + multa prevista de 20% na escritura de 1991 (observado o teto legal vigente de 2% do Código Civil, Art. 1.336 §1º).',
  structuralRules: [
    'Alvenaria autoportante: é estritamente vedada a abertura de vãos ou alterações em paredes estruturais.',
    'Sobrecarga máxima das lajes: 150 kg/m².',
    'Garagem: 1 vaga para veículo pequeno nos apartamentos 101, 102, 201 e 202 e 2 vagas para veículo pequeno nas coberturas 301–302, conforme croqui anexo à Convenção.',
    'Coberturas (301 e 302): direito de uso exclusivo e privativo da área correspondente do 5º piso, arcando os proprietários com as despesas e encargos decorrentes dessa utilização.',
    'Assembleia Geral Ordinária (AGO): realizada anualmente em janeiro para prestação de contas e eleições (Síndico: mandato 1 ano sem remuneração; Conselho Consultivo: 2 membros, mandato 2 anos).',
    'Quóruns de instalação: 1ª convocação com 2/3 dos condôminos; 2ª convocação (1h depois) com qualquer número.',
  ],
  improvementPlan2025: [
    {
      priority: '1ª Obra',
      scope: 'Lajes da entrada e do hall',
      details:
        'Limpeza das duas lajes (sobre o portão de entrada e acesso ao hall) com aplicação de argamassa e manta líquida externa.',
    },
    {
      priority: '2ª Obra',
      scope: 'Garagem e muro vizinho',
      details:
        'Manutenção e limpeza das caixas de passagem na garagem, reparo de trincas/fissuras na rampa e muro com a casa vizinha, e fixação das pedras soltas na garagem superior.',
    },
    {
      priority: '3ª Obra',
      scope: 'Muros laterais',
      details:
        'Tratamento dos muros laterais do hall de entrada e do muro lateral externo do Apartamento 102 com reparo de trincas, textura e pintura.',
    },
    {
      priority: '4ª Obra',
      scope: 'Pintura geral',
      details: 'Pintura de manutenção geral do condomínio, incluindo platibandas das coberturas.',
    },
  ],
};

export const PLUVIAL_PARTICIPANTS = [
  { id: 'casa_a', label: 'Guilherme (Casa A)', units: 1, techShareRatio: 467.08 / 2747.5 },
  { id: 'casa_b', label: 'Maria do Carmo (Casa B)', units: 1, techShareRatio: 357.18 / 2747.5 },
  { id: 'casa_c', label: 'Vânia e Adalberto (Casa C)', units: 1, techShareRatio: 686.88 / 2747.5 },
  {
    id: 'predio_ziller',
    label: 'Prédio Prof. Ziller (6 aptos — Nosso Condomínio)',
    units: 6,
    techShareRatio: 659.4 / 2747.5,
    highlight: true,
  },
  {
    id: 'predio_lourival',
    label: 'Prédio Lourival Pinto Coelho (7 aptos)',
    units: 7,
    techShareRatio: 604.95 / 2747.5,
  },
] as const;

export async function fetchRealSpreadsheetCsv(): Promise<string> {
  const response = await fetch('/assets/aistudio/Condom_nio_Extratos_d78ac5e9');
  if (!response.ok) {
    throw new Error('Não foi possível carregar o arquivo histórico do condomínio.');
  }
  return await response.text();
}
