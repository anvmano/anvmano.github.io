# AI_SYSTEM_PROMPT

Voce esta trabalhando no projeto Estacao Climática.

## Objetivo do sistema

Exibir em uma pagina web estatica dados de uma estacao climatica armazenados no Firebase Realtime Database. O sistema mostra abas para Sala, Quarto e Aquario, alem de graficos solares dentro da aba Quarto e indicador astronomico no header. A pagina permite selecionar data, navegar por abas com click ou swipe touch, ver graficos, estatisticas, heatmaps, tabelas, ampliar graficos e exportar dados em PDF ou JSON da aba ativa.

## Tecnologias

- HTML/CSS/JavaScript puro.
- Modulos globais em `window.*`.
- Chart.js via CDN.
- html2canvas e jsPDF via CDN.
- Firebase SDK modular via import dinamico.
- Firebase Realtime Database.
- Sem framework frontend, sem backend local, sem testes automatizados e sem build tooling.

## Arquivos importantes

- `index.html`: DOM, canvases, containers, scripts.
- `scripts/config.js`: Firebase, paths, ids, campos e cores.
- `scripts/main.js`: orquestracao, listeners Firebase e renderizacao das views.
- `scripts/firebase-service.js`: inicializacao Firebase e `onValue`.
- `scripts/data-utils.js`: datas, filtros, tabelas e extracao de series.
- `scripts/chart-utils.js`: graficos comuns e fallback.
- `scripts/analytics.js`: estatisticas e heatmaps.
- `scripts/solar.js`: eventos e graficos solares.
- `scripts/ui.js`: tabs, swipe touch entre abas, date picker, mensagens e colapsaveis.
- `scripts/zoom.js`: zoom dos graficos.
- `scripts/pdf-report.js`: exportacao PDF/JSON usando dados e graficos ja carregados.
- `pdf-report.css`: layout do relatorio PDF.
- `tools/validate-project.mjs`: validacao estrutural local, incluindo imports CSS.
- `package.json`: comando `npm run validate`.
- `scripts/views/quarto-view.js`, `scripts/views/sala-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`: views.
- `style.css`: manifesto de imports CSS.
- `styles/`: layout e visual por responsabilidade.

## Fluxos principais

1. Scripts carregam em ordem no final de `index.html`.
2. `scripts/main.js` valida todos os modulos globais.
3. `DOMContentLoaded` inicializa UI, zoom e Firebase.
   Tambem inicializa `ClimatePdfReport.setup` para o botao `#btnExportData` e controle `name="exportFormat"`.
4. Firebase escuta quatro paths:
   - `historico/Temperatura`
   - `historico/NascePorDoSol`
   - `historico/Aquario`
   - `historico/AirQuality`
5. Dados entram em `latestData`.
6. Views filtram por `selectedDate` e renderizam componentes.
7. Alterar data rerenderiza usando o cache em `latestData`.

## Regras criticas

- Formato de data Firebase: `DD-MM-AAAA`.
- Formato do input HTML: `YYYY-MM-DD`.
- Estrutura esperada: `historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>`.
- Tabelas sao limitadas a 24 linhas.
- Graficos comuns sem pontos numericos exibem fallback.
- Faixa de conforto: 20 a 26 em graficos de temperatura/sensacao com sufixo `°`.
- Zênite solar usa campos enviados pelo Firebase quando existem; caso contrario usa meio entre nascer e por do sol.
- Aba ativa e salva em `localStorage.activeTab`.
- Swipe touch entre abas segue `Sala ⇄ Quarto ⇄ Aquario`; esquerda avanca, direita volta, extremidades nao mudam, e gestos iniciados em tabelas/heatmaps/areas com rolagem horizontal nao trocam aba.
- Exportacao PDF/JSON deve reutilizar `latestData`, `selectedDate`, aba ativa e `chartInstances`; nao deve reconsultar Firebase.
- Exportacao PDF deve montar paginas A4 manualmente com html2canvas + jsPDF, evitando paginacao automatica que pode cortar conteudo.
- PDF deve manter tema escuro, usar resumo executivo na primeira pagina, juntar temperatura e sensacao quando possivel, e usar tabela resumida por horario.
- Aliases solares devem permanecer centralizados em `SOLAR_FIELD_ALIASES`.

## Nunca altere sem revisar

- Ordem dos scripts em `index.html`.
- Objetos globais esperados por `scripts/main.js`.
- IDs em `index.html` sem atualizar `scripts/config.js`.
- Paths Firebase em `scripts/config.js`.
- Nomes de campos em `scripts/config.js` e `scripts/solar.js`.
- Contrato de `ClimateCharts.createLineChart`.
- Conversoes de data em `scripts/data-utils.js`.
- Contrato de `ClimatePdfReport.setup` com `getContext`.

## Pontos de atencao

- O projeto nao usa bundler; cada arquivo depende do script anterior.
- Firebase e lido no cliente.
- `onValue` escuta paths completos.
- Nao existe camada de autenticacao no codigo.
- Nao existe teste automatizado.
- CSS e grande e controla muitos estados visuais.

## Estrategia recomendada para alteracoes

1. Identifique se a mudanca e de DOM, configuracao, dados, grafico, analytics, UI ou view.
2. Leia `scripts/config.js` primeiro.
3. Se mexer em uma aba, leia a view correspondente.
4. Se mexer em graficos comuns, leia `scripts/chart-utils.js`.
5. Se mexer em heatmaps/estatisticas, leia `scripts/analytics.js`.
6. Se mexer em solar, leia `scripts/solar.js` e `scripts/views/solar-view.js`.
7. Preserve objetos globais e ordem dos scripts.

## Checklist antes de modificar codigo

- Confirmar o id DOM no `index.html`.
- Confirmar o id ou campo em `scripts/config.js`.
- Confirmar o formato dos dados em `scripts/data-utils.js`.
- Confirmar quem chama a funcao no `scripts/main.js` ou view.
- Confirmar se existe fallback vazio ou erro.

## Checklist antes de finalizar alteracoes

- Verificar se scripts em `index.html` continuam na ordem correta.
- Buscar referencias antigas com `rg`.
- Validar sintaxe JavaScript.
- Simular carregamento dos modulos quando possivel.
- Verificar que `scripts/main.js` nao aponta para modulo inexistente.
- Verificar que ids DOM usados existem no HTML.
- Verificar cache bust dos scripts alterados se necessario.
