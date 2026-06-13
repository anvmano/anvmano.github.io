# DEPENDENCY_MAP

## Diagrama Geral

```mermaid
graph TD
    HTML[index.html] --> Config[AppConfig]
    HTML --> Data[ClimateData]
    HTML --> Analytics[ClimateAnalytics]
    HTML --> Solar[ClimateSolar]
    HTML --> Charts[ClimateCharts]
    HTML --> Aqi[ClimateAqi]
    HTML --> Firebase[FirebaseService]
    HTML --> AI[ClimateAIService]
    HTML --> Chat[ClimateChat]
    HTML --> UI[ClimateUI]
    HTML --> Zoom[ClimateZoom]
    HTML --> Pdf[ClimatePdfReport]
    HTML --> Quarto[QuartoView]
    HTML --> Aquario[AquarioView]
    HTML --> Sala[SalaView]
    HTML --> SolarView[SolarView]
    HTML --> Main[scripts/main.js]

    Main --> Config
    Main --> Data
    Main --> Analytics
    Main --> Solar
    Main --> Charts
    Main --> Aqi
    Main --> Firebase
    Main --> Chat
    Main --> UI
    Main --> Zoom
    Main --> Pdf
    Main --> Quarto
    Main --> Aquario
    Main --> Sala
    Main --> SolarView

    Firebase --> FirebaseSDK[Firebase SDK CDN]
    Firebase --> AppCheck[Firebase App Check]
    AI --> Firebase
    AI --> FirebaseAI[Firebase AI Logic]
    Chat --> AI
    Chat --> Data
    Chat --> Solar
    Chat --> Aqi
    Quarto --> Data
    Quarto --> Analytics
    Quarto --> Charts
    Sala --> Data
    Sala --> Analytics
    Sala --> Charts
    Aquario --> Data
    Aquario --> Analytics
    Aquario --> Charts
    SolarView --> Data
    SolarView --> Solar
    Charts --> ChartJS[Chart.js]
    Aqi --> LivingRoomData[historico/AirQuality]
    Solar --> ChartJS
    Zoom --> ChartJS
    Pdf --> Html2Canvas[html2canvas]
    Pdf --> JsPDF[jsPDF]
    Pdf --> Data
    Pdf --> ChartJS
```

## index.html

Responsabilidade: definir DOM, containers, abas, canvases e ordem dos scripts.

Dependencias diretas: CDN Chart.js, scripts locais, Google Fonts, `style.css`.

Dependencias indiretas: todas as dependencias dos scripts.

Quem chama: navegador.

Quem e chamado: todos os scripts.

Impacto da alteracao: Critico. IDs e ordem dos scripts afetam toda a aplicacao.

## package.json

Responsabilidade: expor comandos locais de manutencao.

Dependencias diretas: Node.js local.

Quem chama: desenvolvedor.

Quem e chamado: `tools/validate-project.mjs`.

Impacto da alteracao: Baixo. Nao altera runtime da pagina.

## tools/validate-project.mjs

Responsabilidade: validar sintaxe dos scripts de forma recursiva e contratos basicos entre `index.html` e `scripts/config.js`.

Dependencias diretas: modulos nativos Node.js (`fs`, `path`, `vm`, `url`).

Quem chama: `npm run validate` ou `node tools/validate-project.mjs`.

Quem e chamado: nenhum modulo da aplicacao em runtime.

Impacto da alteracao: Baixo a Medio. Pode detectar quebras de ids, referencias locais ou sintaxe antes de abrir a pagina.

## style.css

Responsabilidade: manifesto de imports dos estilos modulares em `styles/`.

Dependencias diretas: arquivos `styles/*.css`.

Dependencias indiretas: classes e ids do HTML; estados criados por JS (`is-collapsed`, `active`, `chart-message`, etc.).

Quem chama: navegador.

Quem e chamado: nenhum modulo JS.

Impacto da alteracao: Medio a Alto, dependendo do seletor.

## styles/*.css

Responsabilidade: estilo visual separado por responsabilidade.

Arquivos:

- `tokens.css`: variaveis visuais.
- `base.css`: reset e base.
- `header.css`: header, AQI estimado, relogio e indicador astronomico.
- `layout.css`: wrapper principal.
- `tabs-toolbar.css`: abas, toolbar, seletor de data e exportacao.
- `feedback.css`: loading, transicoes, mensagens.
- `stats.css`: cards de estatisticas.
- `charts.css`: cards e canvases de graficos.
- `advanced-views.css`: colapsaveis, visualizacoes climaticas e heatmaps.
- `zoom.css`: overlay de zoom.
- `tables.css`: tabelas.
- `chat.css`: painel, botao flutuante, mensagens e atalhos do chat com IA.
- `responsive.css`: regras mobile.

Impacto da alteracao: Medio a Alto, dependendo do arquivo e seletor.

## scripts/config.js

Responsabilidade: centralizar Firebase, paths, ids, campos, unidades, cores e faixas de conforto.

Dependencias diretas: nenhuma.

Dependencias indiretas: Firebase, DOM e views que usam seus valores.

Quem chama: `scripts/main.js`, `scripts/firebase-service.js`, `scripts/ui/ui.js`, `scripts/charts/zoom.js`, views, `scripts/views/solar-view.js`.

Quem e chamado: nenhum.

Impacto da alteracao: Critico. Qualquer erro em ids/paths/campos quebra leitura ou renderizacao; erro em unidades ou faixas de conforto afeta tabelas, graficos, status e PDF.

## scripts/main.js

Responsabilidade: orquestrar modulos, inicializar UI/Firebase, armazenar cache `latestData`, renderizar views.

Dependencias diretas:

- `AppConfig`
- `ClimateData`
- `ClimateAnalytics`
- `ClimateSolar`
- `ClimateCharts`
- `FirebaseService`
- `ClimateAIService`
- `ClimateChat`
- `ClimateUI`
- `ClimateZoom`
- `QuartoView`
- `AquarioView`
- `SalaView`
- `SolarView`

Dependencias indiretas: Chart.js, Firebase SDK, DOM.

Quem chama: navegador via script e `DOMContentLoaded`.

Quem e chamado:

- `FirebaseService.initialize`
- `FirebaseService.listenToPath`
- `ClimateUI.setupTabs`
- `ClimateUI.setupTabSwipe`
- `ClimateUI.setupDateControls`
- `ClimateUI.setupCollapsibleSections`
- `ClimateZoom.setup`
- `ClimatePdfReport.setup`
- `ClimateChat.setup`
- `ClimateSolar.getSolarEventsForSelectedDate`
- views.

Impacto da alteracao: Critico.

## scripts/firebase-service.js

Responsabilidade: carregar SDK Firebase, conectar database, inicializar App Check quando configurado, criar listeners e controlar loading.

Dependencias diretas:

- `AppConfig.firebase`
- Firebase SDK CDN
- DOM `#loadingBar`

Dependencias indiretas: Realtime Database e Firebase App Check.

Quem chama: `scripts/main.js`, `scripts/assistant/ai-service.js`.

Quem e chamado: Firebase SDK (`initializeApp`, `getDatabase`, `ref`, `onValue`) e Firebase App Check (`initializeAppCheck`, `ReCaptchaEnterpriseProvider`).

Impacto da alteracao: Critico.

## scripts/assistant/ai-service.js

Responsabilidade: inicializar Firebase AI Logic e enviar prompts ao modelo configurado.

Dependencias diretas:

- `FirebaseService.getApp`
- `AppConfig.firebase.aiUrl`
- `AppConfig.firebase.aiModel`

Dependencias indiretas: Firebase AI Logic, Gemini Developer API e Firebase App Check.

Quem chama: `scripts/assistant/assistant-intent.js` e `scripts/assistant/assistant-query.js` por meio de `ClimateAIService`.

Quem e chamado: Firebase AI Logic (`getAI`, `getGenerativeModel`, `GoogleAIBackend`).

Impacto da alteracao: Alto. Pode quebrar o chat ou gerar falhas relacionadas a modelo, App Check ou API Gemini.

## scripts/chat.js

Responsabilidade: fachada publica do chat. Mantem `window.ClimateChat.setup` para preservar o contrato com `scripts/main.js` e delega a implementacao para `scripts/assistant/assistant-ui.js`.

Dependencias diretas:

- `ClimateAssistant.ui`

Dependencias indiretas: todos os modulos de `scripts/assistant/`.

Quem chama: `scripts/main.js`.

Quem e chamado: `ClimateAssistant.ui.setup`.

Impacto da alteracao: Medio. Quebrar este arquivo impede o chat de inicializar, mesmo que os modulos internos estejam corretos.

## scripts/assistant/*.js

Responsabilidade: implementar a assistente com IA em modulos separados.

Arquivos:

- `assistant-config.js`: constantes, exemplos, ambientes, metricas e aliases.
- `assistant-format.js`: normalizacao e formatacao compartilhadas.
- `assistant-ui.js`: painel, mensagens, abertura/fechamento, submit e atalhos.
- `assistant-intent.js`: classificacao de intencao, ambiente, data, hora e periodo.
- `assistant-query.js`: execucao da consulta, prompt final e fallback textual.
- `assistant-metrics.js`: estatisticas numericas, aliases, comparacoes, faixa de conforto e roteamento de metricas.
- `assistant-solar.js`: consulta de ciclo solar para respostas do chat.
- `assistant-aqi.js`: consulta de AQI/IAQ/qualidade do ar reutilizando `ClimateAqi.calculate`.
- `ai-service.js`: inicializacao e chamada do Firebase AI Logic.

Dependencias diretas:

- DOM `#aiChat*`
- botoes `data-chat-question`
- `ClimateAIService`
- `ClimateData`
- `ClimateSolar`
- `ClimateAqi`
- contexto recebido de `scripts/main.js`

Dependencias indiretas: `latestData`, aba ativa, data selecionada, data/periodo mencionados na pergunta, ambiente mencionado na pergunta, classificacao curta do Gemini, eventos solares carregados e dados de Sala/MQ135 para AQI estimado.

Observacao: perguntas sobre `ultimas 24h` reutilizam `ClimateData.filterDataByRollingHours` para consultar a mesma janela movel usada pelos graficos comuns.
Observacao: perguntas com faixa horaria ou maior/menor horario sao classificadas em `assistant-intent.js`, filtradas em `assistant-query.js` e calculadas em `assistant-metrics.js` sem deixar o modelo recalcular os dados.
Observacao: perguntas equivalentes aos heatmaps usam a mesma estrutura de dados, mas calculam localmente em `assistant-metrics.js`: calendario mensal por dia, heatmap por hora do dia e mapa semanal por dia/hora.
Observacao: comparacoes solares sao classificadas em `assistant-intent.js` e calculadas em `assistant-solar.js`, sempre reutilizando `ClimateSolar.getSolarEventsForSelectedDate`.

Quem chama: `scripts/chat.js` e outros modulos da propria pasta.

Quem e chamado: `ClimateAIService.generateText`, `ClimateSolar.getSolarEventsForSelectedDate`, `ClimateAqi.calculate`.

Impacto da alteracao: Alto. Pode afetar consumo de tokens, privacidade dos dados enviados ao modelo, ambiente/data/periodo usados na resposta, calculos de media/maxima/minima/comparacao e respostas do chat.

## scripts/data/data-utils.js

Responsabilidade: utilitarios de data, filtro, tabela e extracao de series.

Dependencias diretas: DOM para tabelas.

Dependencias indiretas: formato de dados Firebase.

Quem chama: `scripts/main.js`, views, `scripts/charts/chart-utils.js`, `scripts/data/analytics.js`, `scripts/charts/solar.js`, `scripts/views/solar-view.js`, `scripts/ui/ui.js`.

Quem e chamado: nenhum modulo externo.

Impacto da alteracao: Alto.

## scripts/charts/chart-utils.js

Responsabilidade: defaults Chart.js, grafico de linha, faixa de conforto, merge de opcoes.

Dependencias diretas:

- `Chart`
- `ClimateData`

Quem chama: `scripts/main.js`.

Quem e chamado: Chart.js.

Impacto da alteracao: Alto.

## scripts/charts/aqi.js

Responsabilidade: calcular o AQI estimado da Sala a partir dos dados do MQ135 e renderizar o chip/popover do header.

Dependencias diretas:

- DOM `#aqiIndicator` e `#aqiPopover`
- dados recebidos de `latestData.livingRoom`

Dependencias indiretas: estrutura de `historico/AirQuality` e campos `CO`, `CO2`, `Toluen`, `NH4`, `Aceton` e `Alcohol`.

Quem chama: `scripts/main.js`.

Quem e chamado: nenhum modulo externo.

Impacto da alteracao: Medio. Pode afetar o header e a leitura rapida da qualidade do ar estimada da Sala.

## scripts/data/analytics.js

Responsabilidade: estatisticas e heatmaps.

Dependencias diretas: DOM.

Dependencias indiretas: estrutura de dados Firebase, ids de containers passados por views.

Quem chama: views.

Quem e chamado: nenhum modulo local.

Impacto da alteracao: Alto para cards e visualizacoes climaticas.

## scripts/charts/solar.js

Responsabilidade: extrair eventos solares e criar graficos solares.

Dependencias diretas:

- `ClimateData`
- `Chart`

Quem chama: `scripts/main.js`, `scripts/views/solar-view.js`, `scripts/charts/zoom.js`.

Quem e chamado: Chart.js.

Impacto da alteracao: Alto.

## scripts/ui/ui.js

Responsabilidade: estados vazios, mensagens, tabelas, tabs, swipe touch entre abas, colapsaveis, date picker.

Dependencias diretas:

- DOM
- `ClimateData`
- `AppConfig` em `renderStartupError`
- `localStorage`

Quem chama: `scripts/main.js`, views, `scripts/views/solar-view.js`.

Quem e chamado: nenhum modulo externo.

Impacto da alteracao: Medio a Alto.

## scripts/charts/zoom.js

Responsabilidade: zoom dos graficos.

Dependencias diretas:

- DOM
- Chart.js
- `AppConfig.ids.charts.solarToday`
- `ClimateSolar.solarDayBackgroundPlugin`

Quem chama: `scripts/main.js`.

Quem e chamado: Chart.js.

Impacto da alteracao: Medio.

## scripts/reports/pdf-report.js e scripts/reports/pdf-report-*.js

Responsabilidade: exportar PDF A4 ou JSON da aba ativa usando dados e graficos ja carregados.

Organizacao:

- `pdf-report.js`: fachada publica `window.ClimatePdfReport.setup`.
- `pdf-report-config.js`: contrato das abas e metricas do relatorio.
- `pdf-report-format.js`: valores, datas, status, slug e HTML seguro.
- `pdf-report-data.js`: coleta, linhas, cards, alertas e tabela compacta.
- `pdf-report-dom.js`: HTML temporario do relatorio.
- `pdf-report-charts.js`: imagens dos graficos e ciclo solar compacto.
- `pdf-report-pdf.js`: captura, paginacao A4, rodapes e jsPDF.
- `pdf-report-export.js`: setup do botao, seletor PDF/JSON, build e download.

Observacoes:

- PDF usa resumo executivo, alertas, graficos otimizados e tabela resumida por horario
- PDF junta Temperatura e Sensacao termica no mesmo grafico quando possivel
- PDF tem contrato por aba: Sala e Quarto incluem ciclo solar; Aquario nao inclui ciclo solar; Sala usa tabela MQ135.
- JSON preserva tabela detalhada com `Horario`, `Indicador`, `Valor` e `Status`
- layout do PDF prioriza blocos compactos em coluna unica para reduzir cortes em A4 retrato
- exportacao JSON inclui metadados, resumo, tabela e dados brutos filtrados

Dependencias diretas:

- DOM
- `html2canvas`
- `jsPDF`
- Blob/URL nativos do navegador para JSON
- `AppConfig`
- `ClimateData`
- `ClimateUI.getActiveTabName`
- `latestData` recebido via `scripts/main.js`
- `chartInstances` recebido via `scripts/main.js`

Quem chama: `scripts/main.js`.

Quem e chamado: modulos internos em `window.ClimatePdfReportModules`, html2canvas para captura do relatorio, jsPDF para montagem manual das paginas e Blob/URL para download JSON.

Impacto da alteracao: Medio a Alto. Pode afetar exportacao PDF/JSON, captura de graficos e download.

## scripts/views/quarto-view.js

Responsabilidade: renderizar Quarto.

Dependencias diretas:

- `AppConfig.ids`
- `AppConfig.fields.room`
- `ClimateData`
- `ClimateAnalytics`
- `createChart` recebido de `scripts/main.js`
- `ClimateUI`

Quem chama: `scripts/main.js`.

Impacto da alteracao: Medio.

## scripts/views/sala-view.js

Responsabilidade: renderizar Sala.

Dependencias diretas:

- `AppConfig.ids`
- `AppConfig.fields.livingRoom`
- `ClimateData`
- `ClimateAnalytics`
- `createChart`
- `ClimateUI`

Quem chama: `scripts/main.js`.

Impacto da alteracao: Medio.

## scripts/views/aquario-view.js

Responsabilidade: renderizar Aquario.

Dependencias diretas:

- `AppConfig.ids`
- `AppConfig.fields.aquarium`
- `ClimateData`
- `ClimateAnalytics`
- `createChart`
- `ClimateUI`

Quem chama: `scripts/main.js`.

Impacto da alteracao: Medio.

## scripts/views/solar-view.js

Responsabilidade: renderizar graficos solares.

Dependencias diretas:

- `AppConfig.ids`
- `ClimateData`
- `ClimateSolar`
- `ClimateUI`
- `chartInstances`

Quem chama: `scripts/main.js`.

Impacto da alteracao: Alto para solar.

## Call Graph

```mermaid
graph TD
    DOMContentLoaded --> SetupTabs
    DOMContentLoaded --> SetupTabSwipe
    DOMContentLoaded --> SetupDate
    DOMContentLoaded --> SetupCollapsible
    DOMContentLoaded --> SetupZoom
    DOMContentLoaded --> SetupPdfReport
    DOMContentLoaded --> SetupChat
    DOMContentLoaded --> SetupFirebase
    SetupFirebase --> FirebaseInitialize
    SetupFirebase --> ListenRoom
    SetupFirebase --> ListenSolar
    SetupFirebase --> ListenAquarium
    SetupFirebase --> ListenLivingRoom
    ListenRoom --> RenderRoom
    ListenSolar --> RenderSolar
    ListenAquarium --> RenderAquarium
    ListenLivingRoom --> RenderLivingRoom
    TouchSwipe --> SetupTabSwipe
    SetupTabSwipe --> SetupTabs
    DateChange --> RerenderDashboard
    RerenderDashboard --> RenderRoom
    RerenderDashboard --> RenderSolar
    RerenderDashboard --> RenderAquarium
    RerenderDashboard --> RenderLivingRoom
    RenderRoom --> ClimateData
    RenderRoom --> ClimateAnalytics
    RenderRoom --> CreateChart
    RenderSolar --> ClimateSolar
    RenderAquarium --> ClimateData
    RenderAquarium --> ClimateAnalytics
    RenderAquarium --> CreateChart
    RenderLivingRoom --> ClimateData
    RenderLivingRoom --> ClimateAnalytics
    RenderLivingRoom --> CreateChart
    CreateChart --> ClimateCharts
    ClimateCharts --> ChartJS
    SetupPdfReport --> PdfReport
    PdfReport --> LatestData
    PdfReport --> ChartInstances
    PdfReport --> Html2Canvas
    PdfReport --> JsPDF
    PdfReport --> JsonDownload[Blob URL]
    SetupChat --> ClimateChat
    ClimateChat --> LatestData
    ClimateChat --> ClimateAIService
    ClimateAIService --> FirebaseAI
```

## Mapa de Impacto

### `scripts/config.js`

Responsabilidade: contratos centrais.

Pode quebrar: todos os renders, Firebase, ids DOM, campos.

Dependencias afetadas: praticamente todos os modulos.

Nivel: Critico.

### `scripts/data/data-utils.js`

Responsabilidade: formato dos dados.

Pode quebrar: graficos, tabelas, filtros, datas.

Nivel: Alto.

### `scripts/data/analytics.js`

Responsabilidade: estatisticas e heatmaps.

Pode quebrar: cards, heatmaps de Sala/Quarto.

Nivel: Alto.

### `scripts/charts/solar.js`

Responsabilidade: graficos solares.

Pode quebrar: ciclo solar, historico solar e zoom solar.

Nivel: Alto.

### `index.html`

Responsabilidade: ids e ordem de scripts.

Pode quebrar: carregamento inteiro, views, CSS.

Nivel: Critico.
