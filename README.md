# Meta Mo Compare

**Command center para análise de performance de tráfego pago no Meta Ads.**

Uma ferramenta construída para gestores de tráfego sêniores que precisam ir
além do Ads Manager: comparar períodos com rigor estatístico, detectar
anomalias antes que virem prejuízo, simular cenários de orçamento,
identificar criativos em fadiga e priorizar ações com base em evidência — em
segundos, não horas.

---

## Para quem é

- Gestores de tráfego solo ou em equipes enxutas que rodam múltiplas contas
- Times de growth/performance que querem uma camada analítica sobre o Meta
- Consultores e agências que precisam apresentar comparativos claros a clientes

Se você já se perguntou "essa queda de CPL é ruído ou sinal?" ou "esse
criativo ainda performa ou está saturado?", essa ferramenta foi desenhada
para te dar a resposta — com números, não achismo.

---

## O que ela faz

### Análise & comparação
- **Comparação período vs. período** com testes estatísticos (proporções com
  Wilson CI, z-score de duas amostras) para dizer se a diferença é
  significativa ou ruído
- **Visão executiva** com KPIs, variações e verdicts em linguagem humana
- **Funis real e virtual** (impressões → cliques → leads → qualificados →
  vendas) reconciliados entre Meta e CRM
- **Heatmap** tático por campanha / adset / ad com semáforo de performance
  e virtualização para rodar com 10k+ linhas sem travar

### Estatística avançada (`src/lib/stats`)
- **Forecasting**: regressão linear + Holt's smoothing para projeção de
  CPL, CTR, conversões — com intervalos de confiança
- **Detecção de anomalias**: MAD-z-score robusto, descobre dias atípicos
  ignorando outliers
- **Elasticidade de orçamento**: estima como CPL responde a aumentos de
  budget com base no histórico
- **Testes A/B**: two-proportion z-test e Wilson interval para comparar
  criativos/audiences sem depender de ferramentas externas
- **Distribuições**: média, mediana, desvio padrão, percentis — tudo sem
  dependências de libs pesadas

### Insights & alertas (`src/lib/insights`, `src/lib/alerts`)
- Engine de regras configurável: CPL subindo, CTR despencando, frequência
  acima de 3, gasto acelerando vs. baseline semanal, etc.
- Scoring de insights por impacto (gasto afetado) × confiança (estatística)
- Verdicts em português: "escalar", "pausar", "revisar criativo",
  "ajustar público"
- Banner global e view dedicada com priorização automática

### Data quality (`src/lib/dataQuality.ts`)
- Score por campanha de completude (UTMs, pixel, conversões configuradas)
- Painel de "missing data" que aponta exatamente o que falta consertar
- Parser robusto (`src/lib/parser.ts`) que normaliza exports de Meta
  Business Suite, Meta Ads Manager e CRMs com colunas diferentes

### Produtividade
- **Command palette** (`⌘K` / `Ctrl+K`) para navegação instantânea entre
  23+ views, ações rápidas (limpar filtros, exportar CSV, sincronizar) e
  busca de campanhas/adsets/ads por nome
- **Saved views**: salve combinações de filtros (período, nível, busca) e
  recarregue com um clique. Compartilhe via URL com deep linking automático
- **Export**: CSV (UTF-8 BOM para Excel pt-BR) e PDF em qualquer tabela,
  colunas customizáveis
- **UTM builder**, **budget simulator**, **decision log** (registra e
  justifica mudanças), **onboarding tour**, **modo claro/escuro**

### Performance & robustez
- Virtualização (`@tanstack/react-virtual`) em todas as tabelas grandes —
  leads (500+), heatmap, ranking de criativos
- Error boundaries por view: uma view quebrada não derruba o dashboard
- Skeletons consistentes durante loads — nunca tela branca ao trocar de aba
- A11y: `role`/`aria-label` em toda navegação, foco visível, suporte a
  leitor de tela em pt-BR

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Build | Vite 5 + SWC |
| UI | React 18 + TypeScript (strict) |
| Componentes | shadcn/ui (Radix) + Tailwind CSS |
| Data fetching | TanStack React Query |
| Estado | `useReducer` + Context, com persistência em localStorage |
| Roteamento | React Router 6 |
| Gráficos | Recharts |
| Backend | Supabase (auth + Postgres) |
| Testes | Vitest + Testing Library + jsdom |
| Planilhas/PDF | `xlsx`, `papaparse`, `jspdf` + `jspdf-autotable` |

Zero dependências pesadas para estatística: `src/lib/stats` é
auto-contido (regressão, z-tests, MAD, Holt's, Wilson) em ~400 linhas de TS
puro — testado e sem magia numérica externa.

---

## Setup local

Requisitos: **Node 18+** e **npm**. Recomendado instalar via
[nvm](https://github.com/nvm-sh/nvm).

```sh
# 1. Clone
git clone https://github.com/pedrobwild/meta-mo-compare.git
cd meta-mo-compare

# 2. Dependências
npm install

# 3. Dev server com HMR
npm run dev
```

O app sobe em `http://localhost:5173`.

### Scripts

```sh
npm run dev          # desenvolvimento com HMR
npm run build        # build de produção (dist/)
npm run build:dev    # build sem minificação (para debug)
npm run preview      # serve o dist/ localmente
npm run lint         # ESLint
npm run test         # Vitest (uma rodada)
npm run test:watch   # Vitest em watch mode
```

### Variáveis de ambiente

Para conectar ao Supabase, crie um `.env.local` na raiz:

```ini
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

Sem essas variáveis o app roda em modo demo/local com dados mockados.

---

## Arquitetura

```
src/
├── components/         # UI (views de topo + widgets reutilizáveis)
│   ├── ui/             # primitivos shadcn
│   ├── CommandPalette.tsx
│   ├── ErrorBoundary.tsx
│   ├── SavedViewsMenu.tsx
│   └── ...             # AnomalyDetectionView, ForecastView, ABTestAnalyzer, etc.
├── lib/
│   ├── stats/          # forecast, anomalies, proportions, elasticity, distributions
│   ├── insights/       # rules, scoring, verdicts, thresholds
│   ├── alerts/         # engine de alertas
│   ├── metrics/        # registry + agregações
│   ├── parser.ts       # normaliza imports de Meta/CRM/planilhas
│   ├── dataQuality.ts  # score de integridade de dados
│   ├── savedViews.ts   # persistência + URL encoding
│   ├── store.tsx       # useReducer global + Context
│   ├── crossFilter.tsx # filtros cruzados entre views
│   ├── workspace.tsx   # contexto de conta/workspace
│   └── persistence.ts  # helpers de localStorage versionados
└── pages/
    └── Index.tsx       # shell + router de abas + URL state sync
```

### Princípios de design

- **Views isoladas**: cada aba do sidebar é wrapped em `ErrorBoundary` e
  recebe `label` para rastreabilidade
- **Estado previsível**: um único `useReducer` no `store.tsx` centraliza
  filtros globais; side effects de persistência em `useEffect` guardados
  por `hydrated` ref para evitar ping-pong com URL
- **pt-BR na UI, inglês no código**: comentários, nomes de variáveis e
  tipos em inglês; strings visíveis ao usuário e domínios (CPL, CAC,
  verdicts) em português
- **Statísticamente honesto**: nunca reportamos variação como
  "significativa" sem respaldo de z-test ou intervalo de confiança

---

## Roadmap

Ideias sob avaliação (contribuições bem-vindas):

- Integração nativa com Meta Marketing API (hoje via import/Supabase)
- Integração com GA4 para cruzar attribution
- Model selection automática (linear vs. Holt's vs. Holt-Winters com sazonalidade)
- Benchmarks por vertical (e-commerce, lead-gen, SaaS) calibrados
- Recomendações de budget com programação linear

---

## Licença

Projeto privado — uso interno.  Abra uma issue ou PR caso queira contribuir.
