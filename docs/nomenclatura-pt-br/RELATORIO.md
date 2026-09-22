# Relatório de adequação de nomenclatura interna para PT-BR

Data da revisão: 08/09/2026.

## Resultado

A rodada transversal renomeou 2.221 identificadores internos em 9.235 ocorrências, distribuídos por 53 arquivos. Foram alterados somente nomes de variáveis, parâmetros, funções privadas, estados internos e aliases locais necessários para preservar propriedades contratuais. A comparação da árvore sintática e dos vínculos léxicos confirmou que os 44 scripts de runtime mantiveram a mesma estrutura executável.

O inventário detalhado usado durante a revisão foi removido após a consolidação. Este relatório preserva os totais, os arquivos alterados, as exceções e os resultados da validação.

## Arquivos alterados

### Núcleo e autenticação

- `scripts/config.js`
- `scripts/runtime-loader.js`
- `scripts/main.js`
- `scripts/firebase-service.js`
- `scripts/chat.js`
- `scripts/auth/auth-service.js`

### Dados

- `scripts/data/analytics.js`
- `scripts/data/data-quality.js`
- `scripts/data/data-utils.js`
- `scripts/data/environmental-insights.js`

### Gráficos

- `scripts/charts/aqi.js`
- `scripts/charts/chart-utils.js`
- `scripts/charts/moon.js`
- `scripts/charts/season.js`
- `scripts/charts/solar.js`
- `scripts/charts/zoom.js`

### Serviços externos e views

- `scripts/external/browser-location-service.js`
- `scripts/external/external-weather-service.js`
- `scripts/views/aquario-view.js`
- `scripts/views/estacao-view.js`
- `scripts/views/public-weather-view.js`
- `scripts/views/quarto-view.js`
- `scripts/views/sala-view.js`
- `scripts/views/solar-view.js`

### Assistente

- `scripts/assistant/ai-service.js`
- `scripts/assistant/assistant-aqi.js`
- `scripts/assistant/assistant-config.js`
- `scripts/assistant/assistant-format.js`
- `scripts/assistant/assistant-intent.js`
- `scripts/assistant/assistant-metrics.js`
- `scripts/assistant/assistant-planner.js`
- `scripts/assistant/assistant-query.js`
- `scripts/assistant/assistant-solar.js`
- `scripts/assistant/assistant-ui.js`

### Relatórios e UI

- `scripts/reports/pdf-report.js`
- `scripts/reports/pdf-report-charts.js`
- `scripts/reports/pdf-report-config.js`
- `scripts/reports/pdf-report-data.js`
- `scripts/reports/pdf-report-dom.js`
- `scripts/reports/pdf-report-export.js`
- `scripts/reports/pdf-report-format.js`
- `scripts/reports/pdf-report-pdf.js`
- `scripts/ui/ui.js`

### Ferramentas e testes

- `tools/validate-project.mjs`
- `tools/testar-acessibilidade.mjs`
- `tools/testar-assistente.mjs`
- `tools/testar-axe.mjs`
- `tools/testar-exportacao.mjs`
- `tools/testar-modo-publico.mjs`
- `tools/testar-pdf-artifact.mjs`
- `tools/testar-qualidade-dados.mjs`
- `tools/testar-relatorio.mjs`
- `tools/testar-tabelas.mjs`

`scripts/schemas/contracts.js` foi inventariado e permaneceu sem alteração porque seus identificadores internos já estavam em PT-BR e suas chaves são contratos versionados.

## Exemplos de renomeações

| Antes | Depois | Aplicação |
| --- | --- | --- |
| `selectedDate` | `dataSelecionada` | variável ou parâmetro interno; a chave contratual `selectedDate` foi preservada |
| `result` | `resultado` | resultado local de cálculos e consultas |
| `records` | `registros` | coleções locais de leituras |
| `request` | `requisicao` | parâmetros internos dos servidores de teste |
| `response` | `resposta` | respostas locais de `fetch` e HTTP |
| `chartInstances` | `instanciasGraficos` | estado interno de gráficos; a chave pública foi preservada |
| `activeTab` | `abaAtiva` | variável interna; a chave do contexto foi preservada |
| `loading` | `carregando` | estado local de carregamento |
| `error` | `erro` | exceções e callbacks internos |
| `timeoutId` | `identificadorTimeout` | temporizadores internos |
| `createLineChart` | `criarGraficoLinha` | implementação privada exposta pelo alias público existente |
| `filterDataByDays` | `filtrarDadosPorDias` | implementação privada exposta pelo alias público existente |
| `buildReport` | `montarRelatorio` | implementação interna do exportador |
| `answerQuestion` | `responderPergunta` | implementação interna da assistente |

## Nomes preservados por contrato

| Categoria | Exemplos preservados | Justificativa |
| --- | --- | --- |
| Firebase | paths `historico/Temperatura`, `historico/NascePorDoSol`, `historico/Aquario`, `historico/AirQuality`; campos `Data`, `Hora`, `Temperatura`, `Sensacao termica`, `CO`, `CO2`, `Aceton`, `Alcohol`, `NH4`, `Toluen`, `PH`, `TDS`, `Turbidez` e aliases históricos solares | São nomes reais persistidos ou aceitos dos dispositivos. Alterá-los mudaria o contrato de dados. |
| DOM e CSS | IDs, classes, `data-*`, `activeTab` do `localStorage`, `selectedDate`, `exportFormat` | São consumidos por HTML, CSS, armazenamento ou testes de integração. |
| Globais públicos | `window.AppConfig`, `ClimateData`, `ClimateCharts`, `ClimateSolar`, `ClimateAssistant`, `ClimatePdfReportModules` e os membros públicos existentes | Scripts clássicos e módulos carregados sob demanda dependem desses contratos. As implementações internas receberam nomes em PT-BR e são expostas por aliases com o nome anterior. |
| Contextos e payloads internos compartilhados | `activeTab`, `selectedDate`, `latestData`, `chartInstances`, `result`, `records`, `status`, `aliases`, `numericValues`, `periodLabel` | São chaves estruturais trocadas entre módulos, testes, assistente e exportação. Foram mantidas; somente os vínculos locais foram traduzidos. |
| Exportação JSON | `resumo`, `tabela`, `tabelaResumida`, `tabelaDetalhada`, `dadosBrutos` e propriedades já publicadas | O formato exportado é um contrato de compatibilidade, inclusive o alias histórico `tabela`. |
| Open-Meteo, BrasilAPI e ViaCEP | `current`, `hourly`, `daily`, `temperature_2m`, `relative_humidity_2m`, `us_aqi`, `results`, `name`, `countryCode`, `past_days`, `forecast_days` | São propriedades e parâmetros definidos pelas APIs externas. |
| Bibliotecas e navegador | `response.ok`, `dataset`, `innerHTML`, `scrollWidth`, `clientWidth`, opções Chart.js como `borderColor`, `backgroundColor`, `plugins`, `scales` e `ariaLabel` | São APIs nativas ou opções exigidas pelas bibliotecas. |
| Testes e Node.js | propriedades Playwright, axe-core, pdfjs, `viewport`, `violations`, `impact`, `getDocument`, `OPS` | São contratos das ferramentas externas. |
| Termos técnicos duvidosos | `canvas`, `HTML`, `CSS`, `PDF`, `JSON`, `URL`, `Firebase`, `Chart.js`, `AQI`, `TDS`, `pH`, `email` | São termos técnicos consolidados, siglas ou palavras também usadas em PT-BR. Foram mantidos para clareza e compatibilidade. |

## Validação por grupos

Cada grupo foi validado com `npm run validate`, `npm run lint` e os testes específicos afetados:

- dados: qualidade dos dados, tabelas, assistente e relatório;
- gráficos: acessibilidade, modo público, axe, relatório e assistente;
- serviços externos e views: modo público, axe, tabelas e exportação;
- assistente: regressão completa da assistente;
- relatórios: relatório, artefato PDF e exportação;
- UI: acessibilidade, tabelas e axe;
- núcleo e ferramentas: assistente, exportação, modo público e acessibilidade.

## Regressão final

Todos os comandos obrigatórios passaram:

- `npm run validate`: PASS
- `npm run lint`: PASS
- `npm run test:assistant`: PASS
- `npm run test:report`: PASS
- `npm run test:pdf-artifact`: PASS
- `npm run test:export`: PASS
- `npm run test:accessibility`: PASS
- `npm run test:data-quality`: PASS
- `npm run test:public`: PASS
- `npm run test:axe`: PASS
- `npm run test:tables`: PASS

Também foi executada uma comparação estrutural automatizada entre a cópia anterior e os scripts atuais. Resultado: estrutura executável e resolução de vínculos preservadas nos 44 scripts de runtime.

## Validação visual

Foram validados o dashboard interno e seus elementos estruturais em:

- desktop: `1280 × 900`;
- mobile retrato: `390 × 844`;
- mobile paisagem: `720 × 360`.

Nos três cenários foram confirmados quatro botões de aba, uma única aba focável, ausência de overflow horizontal, nomes acessíveis em todos os canvases e ausência de erros de página. Em paisagem, abas e toolbar permaneceram em linhas separadas.

## Limites da alteração

Não houve alteração de lógica, arquitetura, interface, bibliotecas, contratos Firebase, consultas externas, comportamento do chat, gráficos, zoom, exportação, autenticação ou modo público. Os nomes de arquivos e a ordem dos scripts permaneceram iguais.
