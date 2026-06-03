# BUSINESS_RULES

Regras extraidas exclusivamente do codigo existente.

## Regra: formato da data atual Firebase

Arquivo: `scripts/data-utils.js`

Metodo: `dataAtual()`

Objetivo: gerar data no formato usado pelo Firebase.

Entradas: data atual do navegador.

Saidas: string `DD-MM-AAAA`.

Impacto: usada como data inicial em `scripts/main.js`.

Dependencias: `Date`.

Se alterada: filtro inicial e botao Hoje podem buscar path inexistente.

Criticidade: Alta.

## Regra: conversao input HTML para Firebase

Arquivo: `scripts/data-utils.js`

Metodo: `convertInputDateToFirebase(dateString)`

Objetivo: converter `YYYY-MM-DD` para `DD-MM-AAAA`.

Entradas: valor do input `type=date`.

Saidas: data Firebase.

Impacto: toda selecao de data.

Dependencias: `scripts/ui.js`.

Se alterada: listeners continuam recebendo dados, mas filtros podem retornar vazio.

Criticidade: Critica.

## Regra: filtro por data selecionada

Arquivo: `scripts/data-utils.js`

Metodo: `filterDataByDays(data, days, selectedDate, useSelectedDate = true)`

Objetivo: quando `useSelectedDate` e verdadeiro e ha `selectedDate`, retorna somente aquela data.

Entradas: dados Firebase, dias, data selecionada.

Saidas: objeto contendo apenas a data selecionada ou `{}`.

Impacto: graficos/tabelas de Sala, Quarto e Aquario.

Dependencias: formato `DD-MM-AAAA`.

Se alterada: graficos podem voltar a mostrar multiplos dias ou nao mostrar nada.

Criticidade: Alta.

## Regra: filtro solar historico

Arquivo: `scripts/views/solar-view.js`

Metodo: `render(...)`

Objetivo: usar `ClimateData.filterDataByDays(data, 365, selectedDate, false)` para historico solar.

Entradas: dados solares.

Saidas: dados filtrados por ultimos 365 dias pelo cutoff atual, nao pela data selecionada.

Impacto: grafico Nascer & Por do Sol.

Dependencias: `ClimateData.filterDataByDays`.

Se alterada: historico solar pode mudar escopo.

Criticidade: Media.

## Regra: tabela limitada a 24 linhas

Arquivo: `scripts/data-utils.js`

Metodo: `createTables(headers, data)`

Objetivo: criar tabela com no maximo 24 registros.

Entradas: headers e dados.

Saidas: elemento `table`.

Impacto: tabelas de Sala, Quarto e Aquario.

Dependencias: estrutura de dados por data/hora/id.

Se alterada: tabelas podem crescer muito ou mostrar menos registros.

Criticidade: Media.

## Regra: headers traduzidos

Arquivo: `scripts/data-utils.js`

Metodo: `createTables`

Objetivo: traduzir alguns headers por `HEADER_LABELS`.

Entradas: nomes de campo.

Saidas: cabecalhos como Temperatura, Acetona, Alcool, Amonia.

Impacto: exibicao de tabelas.

Dependencias: `HEADER_LABELS`.

Se alterada: nomes podem ficar tecnicos ou inconsistentes.

Criticidade: Baixa.

## Regra: estatisticas por metrica

Arquivo: `scripts/analytics.js`

Metodo: `renderStats`, `calculateStats`

Objetivo: calcular media, minima, maxima, delta e tendencia.

Entradas: dados filtrados e chave da metrica.

Saidas: cards de estatisticas.

Impacto: resumos das abas.

Dependencias: `STATS_CONFIG`.

Se alterada: cards podem mostrar valores incorretos.

Criticidade: Alta.

## Regra: tendencia

Arquivo: `scripts/analytics.js`

Metodo: `getTrend(delta)`

Objetivo: classificar delta.

Entradas: delta numerico.

Saidas:

- `Estavel` se `abs(delta) < 0.05`
- `Subindo` se delta > 0
- `Caindo` se delta < 0

Impacto: card de tendencia.

Dependencias: nenhuma externa.

Se alterada: interpretacao visual muda.

Criticidade: Media.

## Regra: heatmaps climaticos

Arquivo: `scripts/analytics.js`

Metodo: `renderAdvancedClimateViews`

Objetivo: gerar calendario mensal, heatmap por hora e mapa semanal.

Entradas: dados, data selecionada, `metricKey`, containers.

Saidas: celulas DOM nos containers.

Impacto: visualizacoes climaticas de Quarto e Sala.

Dependencias: ids de `scripts/config.js`.

Se alterada: heatmaps podem parar ou usar metrica errada.

Criticidade: Alta.

## Regra: escala de cor do heatmap

Arquivo: `scripts/analytics.js`

Metodo: `getHeatColor(value, scale)`

Objetivo: mapear valor para cor interpolada.

Entradas: valor e escala min/max.

Saidas:

- sem dado: `rgba(71, 85, 105, 0.18)`
- baixo a medio: azul para verde
- medio a alto: verde para rose

Impacto: leitura visual dos heatmaps.

Dependencias: `getValueScale`.

Se alterada: cores deixam de representar a mesma escala.

Criticidade: Media.

## Regra: fallback de grafico vazio

Arquivo: `scripts/chart-utils.js`

Metodo: `createLineChart`

Objetivo: nao criar Chart.js quando nao ha pontos numericos.

Entradas: dados extraidos e `containerId` do card do grafico.

Saidas: `null` e chamada de `onEmpty`.

Contrato DOM:

- cada id em `AppConfig.ids.chartContainers` deve existir em `index.html`
- ids de containers comuns devem ficar no `.chart-card` individual, nao no grid que agrupa varios graficos

Impacto: graficos comuns mostram mensagem em vez de canvas vazio.

Dependencias: `scripts/main.js` callback `onEmpty`.

Se alterada: usuario pode voltar a ver graficos vazios.

Criticidade: Media.

## Regra: faixa de conforto

Arquivo: `scripts/chart-utils.js`

Metodo: `shouldShowComfortBand`, `comfortBandPlugin`

Objetivo: desenhar faixa de 20 a 26 em graficos de temperatura/sensacao.

Entradas: chave da metrica, sufixo.

Saidas: `chart.$comfortBand` e desenho no canvas.

Impacto: graficos de temperatura e sensacao.

Dependencias: `AppConfig.comfortBand`.

Se alterada: referencia visual de conforto muda ou some.

Criticidade: Media.

## Regra: eventos solares obrigatorios

Arquivo: `scripts/solar.js`

Metodo: `readSolarEventSeconds`

Objetivo: validar que amanhecer, nascer, por do sol e anoitecer existem.

Entradas: item solar.

Saidas: objeto de segundos ou `null`.

Impacto: graficos solares.

Dependencias: nomes de campos solares.

Se alterada: grafico solar pode aparecer com dados incompletos.

Criticidade: Alta.

## Regra: indicador astronomico do header

Arquivos: `index.html`, `style.css`, `scripts/main.js`, `scripts/solar.js`

Metodos: `setupAstroIndicator`, `updateAstroIndicator`, `getSolarEventsForSelectedDate`

Objetivo: mostrar ao lado do relogio se o periodo atual e dia, noite ou transicao solar, com posicao animada do sol ou da lua.

Entradas:

- horario atual do navegador
- eventos solares de hoje em `historico/NascePorDoSol`
- fallback 06:00-18:00 quando dados solares ainda nao carregaram

Saidas: estado visual em `#astroIndicator` com classes `astro-indicator--day`, `astro-indicator--twilight` ou `astro-indicator--night`.

Impacto: leitura rapida do ciclo atual no topo da pagina.

Dependencias: `ClimateSolar.getSolarEventsForSelectedDate`, dados solares carregados pelo Firebase.

Se alterada: indicador pode mostrar dia/noite incorreto ou perder fallback antes do Firebase carregar.

Criticidade: Media.

## Regra: zenite solar

Arquivo: `scripts/solar.js`

Metodo: `readSolarEventSeconds`

Objetivo: usar zênite do Firebase quando presente; caso contrario calcular meio entre nascer e por do sol.

Entradas:

- `HoraZenite` ou aliases
- `MinuteZenite` ou aliases
- nascer do sol
- por do sol

Saidas: `zenith` em segundos.

Impacto: ponto de zênite no grafico Ciclo Solar do Dia.

Dependencias: campos do Arduino/Firebase.

Se alterada: zênite pode ficar incorreto.

Criticidade: Alta.

## Regra: aba ativa persistida

Arquivo: `scripts/ui.js`

Metodo: `storeActiveTab`, `getStoredTab`, `setupTabs`

Objetivo: lembrar aba ativa em `localStorage.activeTab`.

Entradas: nome da aba.

Saidas: estado visual e persistencia.

Impacto: navegacao.

Dependencias: `localStorage`.

Se alterada: aba inicial pode sempre voltar para Sala.

Criticidade: Baixa.

## Regra: navegacao touch entre abas

Arquivo: `scripts/ui.js`

Metodo: `setupTabSwipe`

Objetivo: permitir troca de abas por gesto horizontal touch no fluxo Sala ⇄ Quarto ⇄ Aquario.

Entradas:

- `tabOrder` configurado em `scripts/main.js` como `["Tab1", "Tab2", "Tab3"]`
- evento `touchstart`
- evento `touchend`

Saidas:

- swipe para esquerda em Sala abre Quarto
- swipe para esquerda em Quarto abre Aquario
- swipe para esquerda em Aquario nao faz nada
- swipe para direita em Aquario abre Quarto
- swipe para direita em Quarto abre Sala
- swipe para direita em Sala nao faz nada

Impacto: navegacao mobile por touch.

Dependencias: DOM `.container`, `.tablink.active[data-tab-target]`, `.tabcontent`, funcao interna `openTab`.

Se alterada: fluxo mobile de abas pode inverter, pular abas ou trocar aba durante rolagem vertical.

Criticidade: Media.

## Regra: zoom de grafico

Arquivo: `scripts/zoom.js`

Metodo: `setup`, `handleZoom`, `createZoomChart`

Objetivo: ampliar grafico por botao ou duplo clique.

Entradas: instancia Chart.js original.

Saidas: overlay com novo Chart.js.

Impacto: interacao de graficos.

Dependencias: Chart.js, `chartInstances`, opcoes de zoom em `scripts/main.js`.

Se alterada: zoom pode perder tooltip, dados solares ou faixa de conforto.

Criticidade: Media.

## Regra: exportacao de dados da aba ativa

Arquivo: `scripts/pdf-report.js`

Metodo: `setup`, `exportActiveTab`, `buildReport`

Objetivo: gerar download automatico em PDF ou JSON para a aba ativa usando a data selecionada.

Entradas:

- `activeTab`
- `selectedDate`
- `latestData`
- `chartInstances`
- botao `#btnExportData`
- controle `name="exportFormat"` com opcoes `pdf` e `json`

Saidas:

- arquivo PDF A4 retrato baixado automaticamente
- arquivo JSON baixado automaticamente com metadados, resumo, tabela e dados brutos filtrados
- cabecalho com aba, data consultada e data/hora de geracao
- indice logo apos o cabecalho com `Resumo geral`, `Graficos` e `Tabela`
- cards de resumo
- graficos capturados dos canvases existentes
- tabela detalhada com colunas `Horario`, `Indicador`, `Valor` e `Status`
- rodape com Estacao Climatica, pagina atual/total e data/hora

Regras da tabela:

- unidade fica junto ao valor, por exemplo `26.08°C` ou `45.06%`
- quando ha mais de um indicador para o mesmo registro, o horario aparece apenas na primeira linha do grupo

Regras de layout:

- relatorio deve usar largura menor que a pagina A4 util para evitar cortes laterais
- primeira pagina deve conter apenas cabecalho e indice
- resumo, graficos e tabela devem iniciar em paginas proprias
- graficos devem ser renderizados em uma coluna compacta no PDF A4 retrato
- pagina de graficos deve comportar pelo menos 3 graficos comuns por pagina
- html2canvas deve usar as dimensoes reais do relatorio renderizado
- jsPDF deve montar as paginas manualmente, adicionando cabecalho, resumo e graficos como blocos inteiros
- somente a tabela longa pode ser fatiada entre paginas

Impacto: relatorio/dados exportados para Sala, Quarto e Aquario.

Dependencias: `html2canvas`, `jsPDF`, `ClimateData`, `AppConfig`, canvases existentes, dados ja carregados pelo Firebase.

Se alterada: exportacao pode reconsultar dados indevidamente, perder graficos, gerar layout quebrado ou falhar no download.

Criticidade: Alta.

## Regra: dados ausentes na exportacao

Arquivo: `scripts/pdf-report.js`

Metodo: `emptySummary`, `captureChartImage`, `createTableSection`

Objetivo: manter a geracao da exportacao mesmo sem dados, sem sensor ou sem grafico.

Entradas: valores ausentes, canvas ausente ou data sem registros.

Saidas: texto `Sem dados disponíveis` ou `Sem dados` nos cards/tabelas/graficos.

Impacto: robustez do relatorio.

Dependencias: montagem do relatorio PDF/JSON.

Se alterada: exportacao pode quebrar quando houver sensor offline ou grafico vazio.

Criticidade: Alta.

# REGRAS QUE NAO DEVEM SER ALTERADAS

- Conversao de data HTML/Firebase sem revisar todos os filtros.
- Paths Firebase em `scripts/config.js` sem revisar `scripts/main.js` e banco.
- Campos de sensores em `scripts/config.js` sem revisar Firebase.
- Leitura de zênite em `scripts/solar.js` sem revisar dados enviados pelo Arduino.
- Ordem de scripts em `index.html`.
- Contrato de fallback em `ClimateCharts.createLineChart`.
- Exportacao PDF/JSON deve reutilizar `latestData` e `chartInstances`, sem reconsultar Firebase.

# MAPA DE IMPACTO

## `index.html`

Responsabilidade: DOM e scripts.

O que pode quebrar: ids, graficos, tabelas, heatmaps, carregamento dos modulos.

Dependencias afetadas: todas.

Nivel de risco: Critico.

## `scripts/config.js`

Responsabilidade: contratos de ids, paths e campos.

O que pode quebrar: Firebase, views, renderizacao.

Dependencias afetadas: main, views, ui, zoom, firebase-service.

Nivel de risco: Critico.

## `scripts/data-utils.js`

Responsabilidade: estrutura de dados.

O que pode quebrar: tabelas, graficos, filtros.

Dependencias afetadas: views, analytics, charts, solar.

Nivel de risco: Alto.

## `scripts/analytics.js`

Responsabilidade: estatisticas e heatmaps.

O que pode quebrar: cards e visualizacoes climaticas.

Dependencias afetadas: Quarto e Sala principalmente.

Nivel de risco: Alto.

## `scripts/solar.js`

Responsabilidade: graficos solares.

O que pode quebrar: Ciclo Solar do Dia, Nascer & Por do Sol, zênite.

Dependencias afetadas: solar-view, zoom.

Nivel de risco: Alto.

# CALL GRAPH

```text
Interface DOM
↓
scripts/main.js DOMContentLoaded
↓
ClimateUI / ClimateZoom / FirebaseService
↓
Firebase Realtime Database
↓
scripts/main.js latestData
↓
Views
↓
ClimateData / ClimateAnalytics / ClimateCharts / ClimateSolar
↓
DOM + Chart.js
```

# GLOSSARIO

- Firebase: servico usado como banco Realtime Database.
- Realtime Database: banco lido com `onValue`.
- Chart.js: biblioteca de graficos.
- Heatmap: grade colorida por media de temperatura.
- Calendario climatico: heatmap mensal por dia.
- Mapa semanal: grade dia da semana por hora.
- Zênite: ponto solar exibido no ciclo solar do dia.
- Amanhecer: evento solar anterior ao nascer do sol.
- Anoitecer: evento solar posterior ao por do sol.
- TDS: metrica do aquario.
- PH: metrica do aquario.
- Turbidez: metrica do aquario.
- CO, CO2, Aceton, Alcohol, NH4: metricas da sala.
- Sensacao termica: metrica de conforto termico.
- Faixa de conforto: banda de 20 a 26 usada em graficos de temperatura/sensacao.

# CODIGO MORTO

Nenhum codigo morto confirmado na varredura atual.

Arquivos sem uso: nenhum arquivo local pode ser confirmado como sem uso; todos os `.js` principais sao carregados pelo HTML.

# DIVIDA TECNICA

- Dependencia de globais e ordem de scripts.
- Ausencia de build/lint completo.
- Leitura completa dos paths Firebase com `onValue`.
- Estrutura de dados Firebase e nomes de campos heterogeneos.

Mitigacoes existentes:

- `style.css` importa arquivos menores em `styles/`, separados por responsabilidade visual.
- `tools/validate-project.mjs` valida sintaxe JS, referencias locais, imports CSS, ids duplicados e ids esperados por `AppConfig`.
- Aliases solares ficam centralizados em `SOLAR_FIELD_ALIASES` dentro de `scripts/solar.js`.

# TAREFAS COMUNS

## Alterar graficos comuns

Leia:

- `scripts/chart-utils.js`
- `scripts/main.js`
- view da aba afetada
- `scripts/config.js`

## Alterar Firebase

Leia:

- `scripts/config.js`
- `scripts/firebase-service.js`
- `scripts/main.js`
- `scripts/data-utils.js`

## Alterar campos dos sensores

Leia:

- `scripts/config.js`
- view da aba
- `scripts/analytics.js`
- `scripts/data-utils.js`

## Alterar heatmaps

Leia:

- `scripts/analytics.js`
- `scripts/config.js`
- `scripts/views/quarto-view.js`
- `scripts/views/sala-view.js`
- `index.html`

## Alterar solar

Leia:

- `scripts/solar.js`
- `scripts/views/solar-view.js`
- `scripts/config.js`
- `scripts/main.js`

## Alterar tabelas

Leia:

- `scripts/data-utils.js`
- view da aba
- `index.html`
- `scripts/ui.js`

## Alterar navegacao/abas/data picker

Leia:

- `scripts/ui.js`
- `scripts/main.js`
- `index.html`

## Alterar exportacao PDF/JSON

Leia:

- `scripts/pdf-report.js`
- `pdf-report.css`
- `scripts/main.js`
- `index.html`
- `scripts/config.js`
- `scripts/data-utils.js`
