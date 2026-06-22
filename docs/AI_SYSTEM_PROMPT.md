# AI_SYSTEM_PROMPT

Voce esta trabalhando no projeto Estacao Climática.

## Objetivo do sistema

Exibir em uma pagina web estatica dados de uma estacao climatica armazenados no Firebase Realtime Database. O sistema mostra uma aba global Estacao, alem das abas Sala, Quarto e Aquario. A aba Estacao concentra contexto astronomico, estacao do ano, fase da lua, AQI resumido, comparativos por ambiente e graficos solares. A pagina permite selecionar data, navegar por abas com click ou swipe touch, ver graficos, estatisticas, heatmaps, tabelas, ampliar graficos, perguntar sobre dados carregados e exportar dados em PDF ou JSON da aba ativa.

## Tecnologias

- HTML/CSS/JavaScript puro.
- Modulos globais em `window.*`.
- Chart.js via CDN.
- html2canvas e jsPDF via CDN.
- Firebase SDK modular via import dinamico.
- Firebase Realtime Database.
- Firebase App Check com reCAPTCHA Enterprise.
- Firebase AI Logic com Gemini Developer API.
- Sem framework frontend, sem backend local, sem testes automatizados e sem build tooling.

## Arquivos importantes

- `index.html`: DOM, canvases, containers, scripts.
- `scripts/config.js`: Firebase, paths, ids, campos e cores.
- `scripts/main.js`: orquestracao, listeners Firebase e renderizacao das views.
- `scripts/firebase-service.js`: inicializacao Firebase e `onValue`.
- `scripts/chat.js`: fachada publica do chat, mantendo `window.ClimateChat`.
- `scripts/assistant/ai-service.js`: Firebase AI Logic.
- `scripts/assistant/*.js`: UI do chat, classificacao de intencao, calculos de consulta, metricas, ciclo solar, AQI e redacao final com IA.
- `scripts/data/data-utils.js`: datas, filtros, tabelas e extracao de series.
- `scripts/charts/chart-utils.js`: graficos comuns e fallback.
- `scripts/data/analytics.js`: estatisticas e heatmaps.
- `scripts/charts/solar.js`: eventos e graficos solares.
- `scripts/charts/aqi.js`: AQI estimado no header e calculo compartilhado com a assistente.
- `scripts/charts/season.js`: estacao do ano, chip, popover e estado da faixa anual.
- `scripts/charts/moon.js`: fase da lua, chip, popover e estado lunar por data.
- `scripts/ui/ui.js`: tabs, swipe touch entre abas, date picker, mensagens e colapsaveis.
- `scripts/charts/zoom.js`: zoom dos graficos.
- `scripts/reports/pdf-report.js`: fachada publica da exportacao PDF/JSON.
- `scripts/reports/pdf-report-*.js`: modulos internos de configuracao, formatacao, dados, DOM, graficos, PDF e exportacao.
- `styles/reports/pdf-report.css`: layout do relatorio PDF.
- `tools/validate-project.mjs`: validacao estrutural local, incluindo imports CSS.
- `package.json`: comando `npm run validate`.
- `scripts/views/estacao-view.js`, `scripts/views/quarto-view.js`, `scripts/views/sala-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`: views.
- `style.css`: manifesto de imports CSS.
- `styles/`: layout e visual por responsabilidade.

## Fluxos principais

1. Scripts carregam em ordem no final de `index.html`.
2. `scripts/main.js` valida todos os modulos globais.
3. `DOMContentLoaded` inicializa UI, zoom, chat e Firebase.
   Tambem inicializa `ClimatePdfReport.setup` para o botao `#btnExportData` e controle `name="exportFormat"`.
4. Firebase escuta quatro paths:
   - `historico/Temperatura`
   - `historico/NascePorDoSol`
   - `historico/Aquario`
   - `historico/AirQuality`
5. Dados entram em `latestData`.
6. Views filtram por `selectedDate` e renderizam componentes.
7. Alterar data rerenderiza usando o cache em `latestData`.
8. Indicadores globais do header sao inicializados por `ClimateAqi`, `ClimateSeason`, `ClimateMoon` e `setupAstroIndicator`.

## Regras criticas

- Formato de data Firebase: `DD-MM-AAAA`.
- Formato do input HTML: `YYYY-MM-DD`.
- Estrutura esperada: `historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>`.
- Tabelas sao limitadas a 24 linhas.
- Graficos comuns sem pontos numericos exibem fallback.
- Faixa de conforto: 20 a 26 em graficos de temperatura/sensacao com sufixo `°`.
- A assistente responde perguntas de faixa/status/conforto usando resultado local `faixa_conforto`: faixa usada, dentro/fora, horarios fora e pior horario fora da faixa.
- A assistente interpreta `ultimas 24 horas`/`ultimas 24h` como janela movel real via `ClimateData.filterDataByRollingHours`, nao como dia atual.
- A assistente interpreta faixas horarias como `entre 8h e 18h` e perguntas de maior/menor horario, calculando localmente os registros filtrados e o maior/menor valor medio por horario antes de redigir a resposta.
- A assistente responde consultas equivalentes aos heatmaps: calendario mensal por dia, heatmap por hora do dia e mapa semanal por dia/hora, sempre calculando localmente antes da redacao da IA.
- Zênite solar usa campos enviados pelo Firebase quando existem; caso contrario usa meio entre nascer e por do sol.
- Aba ativa e salva em `localStorage.activeTab`.
- Swipe touch entre abas segue `Estacao ⇄ Sala ⇄ Quarto ⇄ Aquario`; esquerda avanca, direita volta, extremidades nao mudam, e gestos iniciados em tabelas/heatmaps/areas com rolagem horizontal nao trocam aba.
- Header usa chips na ordem Estacao do ano, AQI, ciclo solar, fase da lua e relogio; em mobile, relogio e marca Estacao Climatica podem ser ocultados para preservar espaco.
- Popovers do header sao mutuamente exclusivos: Estacao do ano, AQI, ciclo solar e Lua.
- Estacao do ano usa data atual do navegador; fase da lua do header usa data atual e bloco lunar da aba Estacao usa data selecionada.
- Exportacao PDF/JSON deve reutilizar `latestData`, `selectedDate`, aba ativa e `chartInstances`; nao deve reconsultar Firebase.
- Chat com IA deve reutilizar `latestData`, `selectedDate` e aba ativa; nao deve enviar historicos completos ao modelo.
- Chat deve usar Gemini para classificar a pergunta em JSON, JavaScript para validar/calcular resultados e Gemini apenas para redigir a resposta final.
- Perguntas de ciclo solar no chat devem reutilizar `ClimateSolar.getSolarEventsForSelectedDate` sobre `latestData.solar`.
- Perguntas de comparacao solar no chat devem ser calculadas localmente em `assistant-solar.js`: duracao do dia, maior/menor duracao de luz no ano da data selecionada por padrao, maior/menor duracao de luz no mes quando um mes for informado, tendencia de nascer/por do sol e comparacao semanal.
- Perguntas de AQI/IAQ/qualidade do ar no chat devem reutilizar `ClimateAqi.calculate` sobre dados da Sala/MQ135; CO, CO2, Acetona, Alcool, Amonia e Tolueno sao metricas exclusivas da Sala quando nenhum ambiente e citado.
- Consultas de periodo no chat devem limitar no maximo 30 dias; `ultimos dias` usa 7 dias por padrao.
- Exportacao PDF deve montar paginas A4 manualmente com html2canvas + jsPDF, evitando paginacao automatica que pode cortar conteudo.
- PDF deve manter tema escuro, usar resumo executivo na primeira pagina, juntar temperatura e sensacao quando possivel, usar tabela resumida por horario e respeitar o contrato por aba: Estacao com cards contextuais de Estacao do ano e Fase da lua, 6 cards globais, graficos comparativos e ciclo solar, sem tabela; Sala com tabela MQ135 e sem solar; Quarto sem solar; Aquario sem solar.
- Aliases solares devem permanecer centralizados em `SOLAR_FIELD_ALIASES`.

## Nunca altere sem revisar

- Ordem dos scripts em `index.html`.
- Objetos globais esperados por `scripts/main.js`.
- IDs em `index.html` sem atualizar `scripts/config.js`.
- Paths Firebase em `scripts/config.js`.
- Nomes de campos em `scripts/config.js` e `scripts/charts/solar.js`.
- Contrato de `ClimateCharts.createLineChart`.
- Conversoes de data em `scripts/data/data-utils.js`.
- Contrato de `ClimatePdfReport.setup` com `getContext`.
- Contrato de `ClimateChat.setup` com `getContext`.

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
4. Se mexer em graficos comuns, leia `scripts/charts/chart-utils.js`.
5. Se mexer em heatmaps/estatisticas, leia `scripts/data/analytics.js`.
6. Se mexer em solar, leia `scripts/charts/solar.js` e `scripts/views/solar-view.js`.
7. Se mexer em estacao do ano ou fase da lua, leia `scripts/charts/season.js`, `scripts/charts/moon.js` e `scripts/views/estacao-view.js`.
8. Preserve objetos globais e ordem dos scripts.
9. Use nomenclatura PT-BR para novos metodos, funcoes e variaveis internas; preserve nomes externos obrigatorios, campos Firebase, ids/classes DOM, contratos publicos e opcoes exigidas por bibliotecas.

## Checklist antes de modificar codigo

- Confirmar o id DOM no `index.html`.
- Confirmar o id ou campo em `scripts/config.js`.
- Confirmar o formato dos dados em `scripts/data/data-utils.js`.
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
