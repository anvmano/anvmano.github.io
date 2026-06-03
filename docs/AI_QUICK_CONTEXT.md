# AI_QUICK_CONTEXT

## O que e o sistema

Dashboard web estatico de estacao climatica. Exibe dados de Sala, Quarto, Aquario e eventos solares. A interface tem abas, navegacao por swipe touch entre abas, seletor global de data, graficos, estatisticas, heatmaps, tabelas colapsaveis, zoom de graficos, indicador astronomico no header e exportacao PDF/JSON da aba ativa.

O codigo nao define usuarios, autenticacao, permissoes ou backend local.

## Tecnologias

- HTML, CSS e JavaScript puro.
- Scripts classicos com modulos globais em `window.*`.
- Chart.js `4.5.1` via CDN.
- html2canvas `1.4.1` e jsPDF `2.5.2` via CDN para exportacao PDF.
- Exportacao JSON usa Blob nativo do navegador, sem biblioteca externa.
- Firebase SDK modular `12.13.0` carregado dinamicamente.
- Firebase Realtime Database.
- Google Fonts.
- Sem React, Vue, Angular, .NET, SQL ou Arduino no projeto analisado.
- `npm run validate` executa uma checagem estrutural local sem dependencias externas.

## Arquitetura Resumida

Arquivos principais:

- `index.html`: estrutura DOM e ordem dos scripts.
- `scripts/config.js`: Firebase, paths, ids, cores, campos.
- `scripts/main.js`: orquestrador da aplicacao.
- `scripts/firebase-service.js`: conexao e listeners Firebase.
- `scripts/data-utils.js`: datas, filtros, tabelas e series.
- `scripts/chart-utils.js`: Chart.js comum e faixa de conforto.
- `scripts/analytics.js`: estatisticas e heatmaps.
- `scripts/solar.js`: regras e graficos solares.
- `scripts/ui.js`: tabs, swipe touch entre abas, date picker, mensagens, colapsaveis.
- `scripts/zoom.js`: zoom dos graficos.
- `scripts/pdf-report.js`: exportacao PDF/JSON com dados e canvases ja carregados.
- `pdf-report.css`: visual do relatorio PDF.
- `scripts/views/quarto-view.js`, `scripts/views/sala-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`: renderizacao por dominio.
- `tools/validate-project.mjs`: valida sintaxe JS, referencias locais, imports CSS e contratos HTML/config.

## Fluxo Principal

1. HTML carrega scripts em ordem.
2. `scripts/main.js` valida todos os objetos globais.
3. No `DOMContentLoaded`, inicializa tabs, date picker, colapsaveis, zoom, exportacao PDF/JSON e listeners Firebase.
4. `FirebaseService.initialize()` importa SDK Firebase e cria database.
5. `FirebaseService.listenToPath()` escuta:
   - `historico/Temperatura`
   - `historico/NascePorDoSol`
   - `historico/Aquario`
   - `historico/AirQuality`
6. Dados sao armazenados em `latestData`.
7. Views filtram pela data selecionada e renderizam graficos/tabelas/estatisticas.

## Componentes Criticos

- `scripts/config.js`: se ids ou paths mudarem aqui, as views e listeners mudam.
- `scripts/main.js`: controla listeners e rerender por data.
- `scripts/data-utils.js`: define formato esperado de datas e estrutura dos dados.
- `scripts/chart-utils.js`: cria graficos comuns e fallback de grafico vazio.
- `scripts/analytics.js`: calcula media/min/max/delta/tendencia e heatmaps.
- `scripts/solar.js`: le campos solares e calcula zenite se ausente.

## Onde Estao as Coisas

- Firebase config e paths: `scripts/config.js`.
- Campos dos sensores: `scripts/config.js` em `fields`.
- Sala: `scripts/views/sala-view.js`.
- Quarto: `scripts/views/quarto-view.js`.
- Aquario: `scripts/views/aquario-view.js`.
- Solar: `scripts/solar.js` e `scripts/views/solar-view.js`.
- Tabelas: `scripts/data-utils.js` + views.
- Heatmaps: `scripts/analytics.js`; containers em `index.html`; ids em `scripts/config.js`.
- Zoom: `scripts/zoom.js`.
- PDF: `scripts/pdf-report.js` e `pdf-report.css`.
- Abas e date picker: `scripts/ui.js`.
- Estilo visual: `style.css` importa os arquivos em `styles/`.

## Fluxos Criticos

- Data do input: `YYYY-MM-DD`.
- Data Firebase: `DD-MM-AAAA`.
- Dados por data/hora: `historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>`.
- Graficos comuns usam `ClimateData.extractData`.
- Se grafico comum nao tem pontos numericos, `ClimateCharts.createLineChart` retorna `null` e o caller mostra mensagem no card.
- Cada id em `AppConfig.ids.chartContainers` deve existir no `.chart-card` individual correspondente.
- Tabelas mostram ate 24 linhas.
- Aba ativa e persistida em `localStorage.activeTab`.
- Swipe touch segue o fluxo Sala ⇄ Quarto ⇄ Aquario. Arrastar para esquerda avanca; arrastar para direita volta; extremidades nao mudam de aba.
- Solar usa data selecionada para ciclo do dia e filtro de 365 dias para historico.
- Exportacao PDF/JSON usa automaticamente aba ativa, data selecionada, `latestData` e `chartInstances`; nao reconsulta Firebase.
- Controle `PDF/JSON` em `name="exportFormat"` altera a label do botao `#btnExportData`.
- Tabela do PDF usa `Horario`, `Indicador`, `Valor` e `Status`; unidade fica junto ao valor e o horario nao repete dentro do mesmo grupo de indicadores.
- PDF tem capa compacta com indice; resumo, graficos e tabela iniciam em paginas proprias.
- PDF e montado manualmente em paginas A4; graficos ficam inteiros e compactos, e apenas tabela longa pode ser fatiada.

## Arquivos Mais Importantes

1. `scripts/config.js`
2. `scripts/main.js`
3. `scripts/firebase-service.js`
4. `scripts/data-utils.js`
5. `scripts/chart-utils.js`
6. `scripts/analytics.js`
7. `scripts/solar.js`
8. `index.html`
9. `style.css` e `styles/`
10. Views por aba

## Regras Importantes

- Nao mudar ordem dos scripts sem revisar dependencias globais.
- Nao renomear ids do HTML sem atualizar `scripts/config.js`.
- Nao renomear campos Firebase sem atualizar `scripts/config.js` e, para solar, `scripts/solar.js`.
- O Firebase e lido com `onValue` no path completo.
- Zênite solar usa campos `HoraZenite` e `MinuteZenite` quando presentes; se nao houver, calcula meio entre nascer e por do sol.
- Aliases solares ficam centralizados em `SOLAR_FIELD_ALIASES`.

## Resumo para IA

Este projeto e um frontend estatico, sem framework, que depende de dados Firebase e de ids DOM centralizados. Para alterar uma aba, leia primeiro `scripts/config.js`, depois a view da aba, depois `scripts/data-utils.js` e `scripts/chart-utils.js`/`scripts/analytics.js`. Para graficos solares, leia `scripts/solar.js`. Toda alteracao deve preservar os objetos globais esperados por `scripts/main.js`.
