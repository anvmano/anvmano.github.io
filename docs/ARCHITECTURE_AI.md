# ARCHITECTURE_AI

Base de conhecimento gerada a partir dos arquivos reais do projeto em `D:\Documentos\estacao climatica web\atualizacao claude`.

## Visao Geral

Sistema web estatico para exibir dados de uma estacao climatica. O codigo existente carrega dados do Firebase Realtime Database, filtra por data selecionada, calcula estatisticas, renderiza graficos com Chart.js, mostra heatmaps climaticos, tabelas por ambiente, contexto astronomico, chat com IA e exportacao PDF/JSON.

Usuarios nao sao definidos no codigo. Pelo codigo, o fluxo principal e visualizar uma aba global Estacao e abas por dispositivo: Sala, Quarto e Aquario, com selecao global de data.

## Tecnologias

- HTML estatico: `index.html`.
- CSS puro: `style.css` como manifesto e arquivos modulares em `styles/`.
- JavaScript em scripts classicos, sem `type="module"`.
- Modulos globais expostos em `window.*`.
- Chart.js via CDN: `https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js`.
- Firebase SDK modular dinamico: versao `12.13.0`, carregado por `import()` a partir de `https://www.gstatic.com/firebasejs/...`.
- Firebase Realtime Database.
- Firebase App Check com reCAPTCHA Enterprise, inicializado sob demanda para recursos protegidos.
- Firebase AI Logic com Gemini Developer API para o chat.
- Sem React, Angular, Vue, C#, .NET, banco SQL ou codigo Arduino no projeto analisado.
- Sem testes funcionais automatizados e sem build tooling local completo.

## Estrutura Fisica

## Convencao de Nomenclatura

Codigo interno novo ou refatorado deve usar nomes em PT-BR para metodos, funcoes e variaveis, acompanhando o dominio da aplicacao. Devem permanecer com o nome original apenas os campos Firebase, ids/classes DOM, contratos publicos em `window.*`, propriedades exigidas por APIs externas/bibliotecas e chaves estruturais ja consumidas por outros modulos.

```text
.
├── index.html
├── style.css
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── header.css
│   ├── layout.css
│   ├── tabs-toolbar.css
│   ├── feedback.css
│   ├── stats.css
│   ├── charts.css
│   ├── advanced-views.css
│   ├── zoom.css
│   ├── tables.css
│   ├── chat.css
│   └── responsive.css
├── scripts/
│   ├── config.js
│   ├── main.js
│   ├── firebase-service.js
│   ├── chat.js
│   ├── assistant/
│   │   ├── ai-service.js
│   │   ├── assistant-config.js
│   │   ├── assistant-format.js
│   │   ├── assistant-metrics.js
│   │   ├── assistant-solar.js
│   │   ├── assistant-aqi.js
│   │   ├── assistant-intent.js
│   │   ├── assistant-planner.js
│   │   ├── assistant-query.js
│   │   └── assistant-ui.js
│   ├── data/
│   │   ├── data-utils.js
│   │   └── analytics.js
│   ├── charts/
│   │   ├── chart-utils.js
│   │   ├── aqi.js
│   │   ├── season.js
│   │   ├── moon.js
│   │   ├── solar.js
│   │   └── zoom.js
│   ├── ui/
│   │   └── ui.js
│   ├── reports/
│   │   ├── pdf-report.js
│   │   ├── pdf-report-config.js
│   │   ├── pdf-report-format.js
│   │   ├── pdf-report-data.js
│   │   ├── pdf-report-dom.js
│   │   ├── pdf-report-charts.js
│   │   ├── pdf-report-pdf.js
│   │   └── pdf-report-export.js
│   └── views/
│       ├── estacao-view.js
│       ├── quarto-view.js
│       ├── sala-view.js
│       ├── aquario-view.js
│       └── solar-view.js
├── styles/
│   └── reports/
│       └── pdf-report.css
├── package.json
├── tools/
│   └── validate-project.mjs
```

Responsabilidades:

- `index.html`: estrutura DOM, abas, canvases, containers, toolbar de data, scripts.
- `style.css`: manifesto de imports dos estilos modulares.
- `styles/`: tema visual, layout, tabs, graficos, cards, tabelas, estados, heatmaps, zoom e responsividade.
- `scripts/config.js`: configuracao Firebase, cores, ids DOM, paths Firebase, nomes de campos.
- `scripts/main.js`: orquestracao da aplicacao, listeners Firebase, cache de dados, renderizacao por view, contrato de criacao de graficos, opcoes de zoom, indicadores do header e exportacao.
- `scripts/firebase-service.js`: inicializacao Firebase, listeners `onValue`, loading bar e erros.
- `scripts/chat.js`: fachada publica do chat, mantendo `window.ClimateChat.setup` para o `scripts/main.js`.
- `scripts/assistant/ai-service.js`: inicializacao do Firebase AI Logic e envio de prompts ao Gemini.
- `scripts/assistant/assistant-ui.js`: painel do chat, atalhos de perguntas, mensagens, abertura/fechamento, clique/toque fora para fechar e estado ocupado.
- `scripts/assistant/assistant-intent.js`: classificacao de intencao em JSON, ambiente, metrica, data, hora e periodo.
- `scripts/assistant/assistant-planner.js`: normalizacao final da intencao em plano confiavel antes da consulta.
- `scripts/assistant/assistant-query.js`: execucao da consulta, montagem do prompt final e fallback textual local.
- `scripts/assistant/assistant-metrics.js`: estatisticas numericas, aliases de metricas, roteamento de metricas, comparacoes e consultas equivalentes aos heatmaps.
- `scripts/assistant/assistant-solar.js`: consultas e comparacoes solares via `ClimateSolar.getSolarEventsForSelectedDate`; maior/menor duracao de luz usa ano por padrao e mes quando um mes for informado.
- `scripts/assistant/assistant-aqi.js`: consultas de AQI via `ClimateAqi.calculate`.
- `scripts/assistant/assistant-config.js`: constantes, exemplos, ambientes e aliases da assistente.
- `scripts/assistant/assistant-format.js`: normalizacao e formatacao compartilhadas.
- `scripts/data/data-utils.js`: datas, filtros, tabelas, extracao de series, conversoes e formatacao.
- `scripts/charts/chart-utils.js`: defaults Chart.js, criacao de graficos de linha, fallback de grafico vazio, faixa de conforto.
- `scripts/data/analytics.js`: estatisticas, cards de resumo, calendario climatico, heatmap horario e heatmap semanal.
- `scripts/charts/aqi.js`: AQI estimado da Sala/MQ135, chip no header e popover.
- `scripts/charts/season.js`: estacao do ano atual, chip no header, popover, faixa anual da aba Estacao e progresso dentro da estacao atual para o PDF.
- `scripts/charts/moon.js`: fase da lua, chip no header, popover e estado lunar por data.
- `scripts/charts/solar.js`: leitura e renderizacao dos eventos solares, historico nascer/por do sol, ciclo solar do dia, aliases solares centralizados e exposicao de eventos solares para o header.
- `scripts/ui/ui.js`: estados vazios, mensagens em graficos, tabelas, tabs, swipe touch entre abas, colapsaveis, date picker.
- `scripts/charts/zoom.js`: ampliacao de graficos por botao/duplo clique, mantendo tooltip ativo no canvas ampliado.
- `scripts/reports/pdf-report.js`: fachada publica da exportacao PDF/JSON, mantendo `window.ClimatePdfReport.setup`.
- `scripts/reports/pdf-report-config.js`: configuracao das abas, metricas, tabela e inclusao de ciclo solar.
- `scripts/reports/pdf-report-format.js`: formatacao de datas, valores, status, mensagens e HTML seguro.
- `scripts/reports/pdf-report-data.js`: selecao de dados, linhas, resumos, cards contextuais da Estacao, alertas e contrato por aba.
- `scripts/reports/pdf-report-dom.js`: criacao do HTML temporario do relatorio.
- `scripts/reports/pdf-report-charts.js`: captura/renderizacao das imagens de graficos e ciclo solar compacto.
- `scripts/reports/pdf-report-pdf.js`: montagem A4 com html2canvas/jsPDF, paginacao e rodapes.
- `scripts/reports/pdf-report-export.js`: setup do botao, seletor PDF/JSON, build do relatorio e download.
- `styles/reports/pdf-report.css`: layout visual do relatorio PDF em tema escuro.
- `scripts/views/estacao-view.js`: renderizacao da aba global Estacao, incluindo contexto sazonal/lunar, cards globais, graficos comparativos e solares.
- `scripts/views/quarto-view.js`: renderizacao da aba Quarto.
- `scripts/views/sala-view.js`: renderizacao da aba Sala.
- `scripts/views/aquario-view.js`: renderizacao da aba Aquario.
- `scripts/views/solar-view.js`: integracao dos graficos solares usados pela visao global da aba Estacao.
- `tools/validate-project.mjs`: validacao estrutural local de sintaxe, referencias, imports CSS e ids.
- `package.json`: comando `npm run validate`.

## Fluxo de Execucao

1. `index.html` carrega Chart.js via CDN; html2canvas e jsPDF ficam sob demanda no fluxo de exportacao PDF.
2. Scripts sao carregados em ordem:
   - Chart.js CDN
   - `scripts/config.js`
   - `scripts/data/data-utils.js`
   - `scripts/data/analytics.js`
   - `scripts/charts/solar.js`
   - `scripts/charts/chart-utils.js`
   - `scripts/charts/aqi.js`
   - `scripts/charts/season.js`
   - `scripts/charts/moon.js`
   - `scripts/firebase-service.js`
   - `scripts/ui/ui.js`
   - `scripts/charts/zoom.js`
   - `scripts/reports/pdf-report-*.js`
   - `scripts/reports/pdf-report.js`
   - `scripts/chat.js`
   - `scripts/assistant/*.js`
   - `scripts/views/quarto-view.js`
   - `scripts/views/aquario-view.js`
   - `scripts/views/sala-view.js`
   - `scripts/views/solar-view.js`
   - `scripts/views/estacao-view.js`
   - `scripts/main.js`
3. Cada modulo registra um objeto global em `window`.
4. `scripts/main.js` valida a existencia dos modulos.
5. `DOMContentLoaded` executa:
   - `ClimateUI.setupTabs("Tab0")`
   - `ClimateUI.setupTabSwipe(...)`
   - `ClimateUI.setupDateControls(...)`
   - `ClimateUI.setupCollapsibleSections()`
   - `ClimateZoom.setup(...)`
   - `ClimatePdfReport.setup(...)`
   - `ClimateChat.setup(...)`
   - `ClimateAqi.setup()`
   - `ClimateSeason.setup()`
   - `ClimateMoon.setup()`
   - `setupAstroIndicator()`
   - `setupFirebaseListeners()`
6. `FirebaseService.initialize()` importa SDK Firebase e conecta ao Realtime Database; `ensureAppCheckInitialized()` inicializa App Check sob demanda antes de recursos protegidos, como a IA.
7. `FirebaseService.listenToPath()` cria listeners para quatro paths.
8. Cada snapshot atualiza `latestData` e chama a view correspondente; a aba Estacao e rerenderizada quando qualquer fonte global muda.

## Componentes

### AppConfig

Arquivo: `scripts/config.js`.

Responsabilidade: concentrar configuracoes compartilhadas.

Entradas: nenhuma.

Saidas: `window.AppConfig`.

Contem:

- `firebase.sdkVersion`
- URLs do SDK Firebase
- credenciais/configuracao do app Firebase
- `colors`
- `comfortBand`
- `humidityComfortBand`
- `aquariumComfortBand`
- `firebasePaths`
- `ids`
- `fields`

Dependencias: nenhuma.

### FirebaseService

Arquivo: `scripts/firebase-service.js`.

Responsabilidade: inicializar Firebase e expor leitura do Realtime Database.

Entradas:

- `window.AppConfig.firebase`
- path Firebase
- callback `onData`
- callback opcional `onError`

Saidas:

- `window.FirebaseService`
- dados de snapshot via callback
- loading bar em `#loadingBar`
- logs de erro no console

Dependencias diretas:

- Firebase SDK via import dinamico
- DOM `loadingBar`
- `AppConfig.firebase`

### ClimateData

Arquivo: `scripts/data/data-utils.js`.

Responsabilidade: manipulacao de datas, filtro de dados, criacao de tabelas e extracao de series.

Funcoes:

- `dataAtual()`
- `parseFirebaseDate(str)`
- `filterDataByDays(data, days, selectedDate, useSelectedDate = true)`
- `convertInputDateToFirebase(dateString)`
- `convertFirebaseDateToInput(dateString)`
- `createTables(headers, data)`
- `extractData(data, keys)`
- `normalizeMeasurementValue(key, value)`
- `mapRange(value, inMin, inMax, outMin, outMax)`
- `formatTime(value)`
- `formatHoursArray(hours)`
- `secondsToHours(seconds)`

Dependencias: DOM para criar tabelas.

### ClimateCharts

Arquivo: `scripts/charts/chart-utils.js`.

Responsabilidade: configuracao Chart.js e grafico de linha generico.

Funcoes:

- `createDefaults(colors)`
- `mergeDeep(target, source)`
- `registerComfortBand()`
- `createLineChart({...})`

Regras:

- Destroi grafico anterior se `existingChart` for passado.
- Extrai dados com `ClimateData.extractData`.
- Se nao houver pontos numericos, chama `onEmpty` e retorna `null`.
- Se houver dados, chama `onReady`, cria Chart.js e aplica faixa de conforto em metricas de temperatura/sensacao com sufixo `°`.

Dependencias:

- `Chart`
- `ClimateData`

### ClimateAnalytics

Arquivo: `scripts/data/analytics.js`.

Responsabilidade: estatisticas e heatmaps.

Funcoes exportadas:

- `renderStats(type, data, selectedDate)`
- `renderAdvancedClimateViews(data, selectedDate, options = {})`

Config interna:

- `quarto`: Temperatura, Sensacao termica, Umidade.
- `sala`: temperatura, sensacaoTermica, umidade, pressao.
- Sala/MQ135 na tabela/chat: AQI estimado, CO, CO2, Aceton, Alcohol, NH4, Toluen.
- `aquario`: temperaturaDS18B20, PH, TDS, Turbidez.

Heatmaps:

- calendario mensal
- heatmap por hora do dia
- mapa semanal por dia/hora
- destaque visual `.is-selected` para dia selecionado, hora atual de hoje e dia/hora atual do mes exibido
- a assistente consegue responder consultas equivalentes aos heatmaps calculando maior/menor media diaria, por hora do dia e por dia/hora semanal sem depender do DOM

### ClimateSolar

Arquivo: `scripts/charts/solar.js`.

Responsabilidade: eventos solares e graficos de nascer/por do sol.

Leitura de eventos:

- amanhecer: `HoraAmanhecer`/`HourAmanhecer` + minutos.
- nascer do sol: `HourNascerDoSol`/`HoraNascerDoSol` + minutos.
- por do sol: `HoraPorDoSol`/`HourPorDoSol` + minutos.
- anoitecer: `HourAnoitecer`/`HoraAnoitecer` + minutos.
- zenite: `HoraZenite`, `HourZenith`, `HoraZenith`, `HourZenite`, `HoraZenite` com acento quando presente; minutos `MinuteZenite`, `MinutoZenite`, `MinuteZenith`, `MinutoZenith`, `MinutoZenite` com acento quando presente.

Se zenite nao existir, calcula `sunrise + ((sunset - sunrise) / 2)`.

Exporta:

- `createSunriseSunsetChart`
- `createSolarTodayChart`
- `getSunHistoryOptions`
- `getSolarTodayOptions`
- `solarDayBackgroundPlugin`

### ClimateUI

Arquivo: `scripts/ui/ui.js`.

Responsabilidade: DOM generico.

Funcoes:

- `renderEmptyState`
- `renderTable`
- `clearChartMessage`
- `renderChartMessage`
- `renderStartupError`
- `setupTabs`
- `setupCollapsibleSections`
- `setupDateControls`
- `setupTabSwipe`

Persistencia:

- `localStorage.activeTab`

Navegacao por touch:

- ordem configurada em `scripts/main.js`: `["Tab0", "Tab1", "Tab2", "Tab3"]`
- `Tab0` representa Estacao
- `Tab1` representa Sala
- `Tab2` representa Quarto
- `Tab3` representa Aquario
- gesto para esquerda avanca uma aba quando existe proxima aba
- gesto para direita volta uma aba quando existe aba anterior
- nas extremidades, Estacao para direita e Aquario para esquerda nao fazem nada
- gestos iniciados em tabelas, heatmaps ou areas com rolagem horizontal sao ignorados pelo swipe de abas

### ClimateZoom

Arquivo: `scripts/charts/zoom.js`.

Responsabilidade: zoom de graficos.

Fluxo:

- adiciona botao em `.chart-card`
- adiciona duplo clique
- cria overlay `.plot-zoom-overlay`
- clona dados do Chart.js
- aplica opcoes de zoom por tipo de grafico
- fecha com Escape, botao de fechar ou clique/toque no fundo do overlay
- em mobile/touch, toque dentro do canvas ampliado nao fecha o overlay para preservar tooltip do Chart.js

### ClimatePdfReport

Arquivos: `scripts/reports/pdf-report.js` e `scripts/reports/pdf-report-*.js`.

Responsabilidade: gerar relatorio PDF ou JSON da aba ativa sem reconsultar Firebase.

Organizacao interna:

- `pdf-report.js`: fachada publica.
- `pdf-report-config.js`: contrato por aba.
- `pdf-report-format.js`: helpers de formatacao/status.
- `pdf-report-data.js`: dados, tabelas, cards e alertas.
- `pdf-report-dom.js`: HTML temporario do relatorio.
- `pdf-report-charts.js`: imagens dos graficos e ciclo solar compacto.
- `pdf-report-pdf.js`: paginacao e geracao A4.
- `pdf-report-export.js`: orquestracao e download PDF/JSON.

Entradas:

- `activeTab`
- `selectedDate`
- `latestData`
- `chartInstances`
- canvases existentes

Saidas:

- download automatico de PDF A4 retrato ou JSON.

Dependencias diretas:

- `html2canvas`
- `jsPDF`
- `ClimateData`
- `AppConfig`
- `ClimateUI.getActiveTabName`
- `chartInstances`

Fluxo:

- botao `#btnExportData` chama `exportActiveTab`
- controle `name="exportFormat"` define PDF ou JSON e atualiza a label do botao
- coleta dados da aba ativa
- filtra dados pela data selecionada
- cria resumo executivo com cabecalho, metadados, cards principais e alertas do dia
- gera cards de resumo conforme contrato da aba ativa
- na aba Estacao, inclui cards contextuais de Estacao do ano e Fase da lua com rotulos proprios de detalhe, alem dos 6 cards globais da aba
- gera graficos temporarios otimizados para PDF quando precisa juntar metricas
- junta Temperatura e Sensacao termica no mesmo grafico quando ambas existem
- renderiza ciclo solar compacto em Chart.js offscreen a partir de `$solarDayTimes` apenas quando a aba ativa inclui ciclo solar, reutilizando `ClimateSolar.getSolarTodayOptions` e `solarDayBackgroundPlugin`
- monta tabela resumida com uma linha por horario e status geral
- usa tabela MQ135 na Sala, tabela ambiental no Quarto, tabela de aquario no Aquario e nao gera tabela na Estacao
- no JSON, exporta `resumo` com `detalhes`, `tabelaResumida`, `tabelaDetalhada`, `dadosBrutos` e mantem `tabela` como alias de compatibilidade da tabela detalhada antiga
- renderiza os graficos em coluna unica compacta, com legenda e estatisticas de min/max/media quando possivel
- usa html2canvas para capturar cabecalho, resumo, graficos e tabela
- usa jsPDF para montar paginas A4 manualmente
- carrega html2canvas e jsPDF sob demanda somente quando o formato PDF e executado
- organiza resumo, graficos e tabela em secoes/paginas proprias conforme o conteudo da aba ativa
- mantem graficos como blocos inteiros e permite quebra apenas na tabela longa
- adiciona rodape com pagina atual/total
- quando formato e JSON, baixa metadados, resumo, tabela e dados brutos filtrados via Blob

### Views

Arquivos:

- `scripts/views/estacao-view.js`
- `scripts/views/quarto-view.js`
- `scripts/views/sala-view.js`
- `scripts/views/aquario-view.js`
- `scripts/views/solar-view.js`

Responsabilidade: conectar dados filtrados, graficos, tabelas e analytics aos elementos da aba.

## Fluxo de Dados

```text
Firebase Realtime Database
↓
FirebaseService.listenToPath
↓
scripts/main.js latestData
↓
View especifica
↓
ClimateData filtro/extracao/tabela
↓
ClimateAnalytics estatisticas/heatmaps
↓
ClimateCharts ou ClimateSolar
↓
DOM, Chart.js, tabelas e mensagens
```

## Firebase

Banco: Firebase Realtime Database.

Config em `scripts/config.js`:

- `databaseURL`: `https://estacaometereologicaesp32-default-rtdb.firebaseio.com`
- `projectId`: `estacaometereologicaesp32`

Paths lidos:

- `historico/Temperatura`
- `historico/NascePorDoSol`
- `historico/Aquario`
- `historico/AirQuality`

Formato observado pelo codigo:

```text
historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>
```

Para dados solares, `scripts/charts/solar.js` tambem aceita item direto ou aninhado, procurando campos de evento solar no primeiro item encontrado em ordem reversa das chaves.

Escrita no Firebase: nao existe no codigo analisado.

Consultas filtradas no servidor: nao existem. O codigo usa `onValue(ref(database, path))`, recebe o path completo e filtra em JavaScript.

Indices Firebase: nao existem no projeto.

## APIs Externas

- Chart.js UMD por CDN jsDelivr.
- html2canvas por CDN jsDelivr para captura do relatorio, carregado sob demanda.
- jsPDF por CDN jsDelivr para montagem manual das paginas A4, carregado sob demanda.
- Firebase SDK por CDN Google.
- Google Fonts (`Inter`) no HTML.

Nao ha endpoints HTTP proprios.

## Graficos

Chart.js cria:

- Sala: temperatura, sensacao termica, umidade, pressao.
- Sala/MQ135 em tabela/chat: AQI estimado, CO, CO2, Acetona, Alcool, Amonia, Tolueno.
- Quarto: temperatura, sensacao termica, umidade.
- Aquario: temperatura, PH, TDS, turbidez.
- Solar: ciclo solar do dia; historico nascer/por do sol.

Graficos comuns:

- tipo `line`
- gradiente vertical
- tooltip customizado
- fallback visual se nao ha pontos numericos
- faixa de conforto entre 20 e 26 em graficos com sufixo `°` e chave contendo `temperatura` ou `sensacao`

## Eventos

- `DOMContentLoaded`: inicializa aplicacao.
- `click` nos tabs: troca aba.
- `touchstart`/`touchend` no container principal: troca aba por swipe horizontal no fluxo Estacao ⇄ Sala ⇄ Quarto ⇄ Aquario, exceto quando o gesto inicia em tabela, heatmap ou area rolavel horizontal.
- `change` no input `#selectedDate`: converte data e rerenderiza.
- `click` no botao `#btnToday`: volta para data atual.
- `click` em `.collapsible-trigger`: expande/recolhe secao.
- `click` no botao de zoom: abre grafico ampliado.
- `click` no botao `#btnExportData`: gera e baixa PDF ou JSON da aba ativa.
- `dblclick` em `.chart-card`: abre grafico ampliado.
- `keydown Escape`: fecha zoom ou popover aberto.
- `setInterval(updateClock, 1000)`: atualiza relogio do header.
- `setupAstroIndicator`: atualiza a cada minuto o indicador de dia/noite/transicao ao lado do relogio.

## Fluxos Criticos

1. Ordem de scripts: `scripts/main.js` depende de todos os modulos anteriores.
2. Leitura Firebase: sem dados no path, a view exibe estado vazio ou mensagem no card/grafico correspondente.
3. Data selecionada: formato HTML `YYYY-MM-DD`, formato Firebase `DD-MM-AAAA`.
4. Filtro por data: para Sala, Quarto e Aquario, `filterDataByDays` retorna apenas a data selecionada quando `useSelectedDate` e verdadeiro.
5. Grafico vazio: `ClimateCharts.createLineChart` retorna `null`.
6. Solar: `SolarView` usa historico de 365 dias e ciclo solar da data selecionada dentro da aba Estacao.
7. Tabelas: exibem no maximo 24 linhas.
8. Swipe de abas: usa limite minimo horizontal de 60px e rejeita gesto com desvio vertical maior que 80px.
9. Exportacao PDF/JSON: usa dados ja carregados em `latestData` e graficos existentes em `chartInstances`; nao reconsulta Firebase.
10. Header: chips de Estacao do ano, AQI, ciclo solar e Lua usam popovers mutuamente exclusivos.

## Arquivos Mais Importantes

1. `index.html`: DOM e ordem dos scripts.
2. `scripts/main.js`: orquestracao geral.
3. `scripts/config.js`: paths, ids, campos, Firebase.
4. `scripts/firebase-service.js`: conexao Firebase.
5. `scripts/data/data-utils.js`: data, filtro, tabela e series.
6. `scripts/charts/chart-utils.js`: graficos comuns.
7. `scripts/data/analytics.js`: estatisticas e heatmaps.
8. `scripts/charts/solar.js`: regras solares.
9. `scripts/charts/aqi.js`: AQI estimado.
10. `scripts/charts/season.js`: estacao do ano.
11. `scripts/charts/moon.js`: fase da lua.
12. `scripts/views/estacao-view.js`: view global Estacao.
13. `scripts/views/solar-view.js`: conecta solar ao DOM.
14. `scripts/views/quarto-view.js`: view Quarto.
15. `scripts/views/sala-view.js`: view Sala.
16. `scripts/views/aquario-view.js`: view Aquario.
17. `scripts/ui/ui.js`: UI generica.
18. `scripts/charts/zoom.js`: zoom dos graficos.
19. `scripts/reports/pdf-report.js` e `scripts/reports/pdf-report-*.js`: exportacao PDF/JSON.
20. `styles/reports/pdf-report.css`: estilo do PDF.
21. `style.css` e `styles/`: apresentacao visual.

Nao existem 20 arquivos de codigo no projeto; a lista acima inclui todos os arquivos relevantes encontrados.

## Arquivos Complexos

- `scripts/data/analytics.js`: agrega estatisticas, heatmaps mensais, horarios e semanais.
- `scripts/charts/solar.js`: suporta multiplos nomes de campos solares, fallback de zenite e plugin visual.
- `styles/advanced-views.css`: concentra colapsaveis, visualizacoes climaticas e heatmaps.
- `styles/responsive.css`: concentra responsividade.
- `scripts/main.js`: orquestra dependencias, listeners, indicadores globais e views.

## Mapa para IA

Para entender rapidamente:

1. Leia `scripts/config.js` para paths, ids e campos.
2. Leia `scripts/main.js` para fluxo principal.
3. Leia a view desejada (`scripts/views/estacao-view.js`, `scripts/views/sala-view.js`, `scripts/views/quarto-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`).
4. Leia `scripts/data/data-utils.js` para formato dos dados Firebase.
5. Leia `scripts/charts/chart-utils.js`, `scripts/data/analytics.js`, `scripts/charts/solar.js`, `scripts/charts/season.js` ou `scripts/charts/moon.js` conforme o tipo de visualizacao.

## Riscos Tecnicos

- Dependencia forte da ordem de scripts globais.
- Sem testes funcionais automatizados.
- Sem build tooling ou linting completos.
- Existe validacao estrutural local via `npm run validate`.
- Firebase carrega paths inteiros via `onValue`; pode crescer em custo/memoria.
- Variacoes de nomes de campos exigem mapeamento cuidadoso.
- Credenciais Firebase estao no cliente, como esperado para app Firebase web, mas qualquer alteracao de regras Firebase deve considerar exposicao publica do config.
- Tabelas limitadas a 24 linhas de forma fixa.
- Calculos de estacao do ano e fase lunar sao aproximacoes locais de contexto visual, nao efemerides astronomicas de alta precisao.

## Resumo Executivo

Projeto e um dashboard estatico para dados de estacao climatica. Ele usa Firebase Realtime Database como fonte, Chart.js como motor de graficos e modulos JavaScript globais para organizar configuracao, dados, graficos, analytics, UI, zoom e views por aba. Nao ha backend local, framework frontend, testes ou build. A principal area de risco e a dependencia de estrutura/nome dos dados no Firebase e a leitura completa dos paths monitorados.
