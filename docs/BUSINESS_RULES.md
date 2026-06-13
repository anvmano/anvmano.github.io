# BUSINESS_RULES

Regras extraidas exclusivamente do codigo existente.

## Regra: formato da data atual Firebase

Arquivo: `scripts/data/data-utils.js`

Metodo: `dataAtual()`

Objetivo: gerar data no formato usado pelo Firebase.

Entradas: data atual do navegador.

Saidas: string `DD-MM-AAAA`.

Impacto: usada como data inicial em `scripts/main.js`.

Dependencias: `Date`.

Se alterada: filtro inicial e botao Hoje podem buscar path inexistente.

Criticidade: Alta.

## Regra: conversao input HTML para Firebase

Arquivo: `scripts/data/data-utils.js`

Metodo: `convertInputDateToFirebase(dateString)`

Objetivo: converter `YYYY-MM-DD` para `DD-MM-AAAA`.

Entradas: valor do input `type=date`.

Saidas: data Firebase.

Impacto: toda selecao de data.

Dependencias: `scripts/ui/ui.js`.

Se alterada: listeners continuam recebendo dados, mas filtros podem retornar vazio.

Criticidade: Critica.

## Regra: filtro por data selecionada

Arquivo: `scripts/data/data-utils.js`

Metodo: `filterDataByDays(data, days, selectedDate, useSelectedDate = true)`

Objetivo: quando `useSelectedDate` e verdadeiro e ha `selectedDate`, retorna somente aquela data.

Entradas: dados Firebase, dias, data selecionada.

Saidas: objeto contendo apenas a data selecionada ou `{}`.

Impacto: cards e tabelas de Sala, Quarto e Aquario.

Dependencias: formato `DD-MM-AAAA`.

Se alterada: cards e tabelas podem voltar a mostrar multiplos dias ou nao mostrar nada.

Criticidade: Alta.

## Regra: janela movel de 24h para graficos comuns

Arquivo: `scripts/data/data-utils.js`

Metodo: `filterDataByRollingHours(data, selectedDate, hours = 24, referenceDate = new Date())`

Objetivo: filtrar os dados dos graficos comuns em uma janela movel de 24h, sem zerar na meia-noite.

Entradas: dados Firebase, data selecionada, quantidade de horas e hora atual do navegador.

Saidas: objeto contendo registros entre o mesmo horario do dia anterior e o horario atual da data selecionada. Exemplo: se agora sao 15h e a data selecionada e `11-06-2026`, a janela vai de 15h de `10-06-2026` ate 15h de `11-06-2026`.

Impacto: graficos comuns de Sala, Quarto e Aquario.

Dependencias: formato `DD-MM-AAAA` para data e `HH-MM` para horario.

Se alterada: graficos podem voltar a zerar na meia-noite ou misturar periodos incorretos.

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

Arquivo: `scripts/data/data-utils.js`

Metodo: `createTables(headers, data)`

Objetivo: criar tabela com no maximo 24 registros.

Entradas: headers e dados.

Saidas: elemento `table`.

Impacto: tabelas de Sala, Quarto e Aquario.

Dependencias: estrutura de dados por data/hora/id.

Se alterada: tabelas podem crescer muito ou mostrar menos registros.

Criticidade: Media.

## Regra: headers traduzidos

Arquivo: `scripts/data/data-utils.js`

Metodo: `createTables`

Objetivo: traduzir alguns headers por `HEADER_LABELS`.

Entradas: nomes de campo.

Saidas: cabecalhos como Temperatura, Acetona, Alcool, Amonia, Tolueno.

Impacto: exibicao de tabelas.

Dependencias: `HEADER_LABELS`.

Se alterada: nomes podem ficar tecnicos ou inconsistentes.

Criticidade: Baixa.

## Regra: unidades nas tabelas

Arquivo: `scripts/data/data-utils.js`

Metodo: `createTables`

Objetivo: exibir valores numericos das tabelas com a unidade configurada para cada campo.

Entradas: campos da tabela e `AppConfig.measurementUnits`.

Saidas: valores como `26.10°C`, `45.80%`, `400.00ppm`, `1.20NTU` ou `1013.00hPa`.

Impacto: tabelas de Sala, Quarto e Aquario.

Dependencias: nomes de campos em `scripts/config.js`.

Se alterada: tabelas podem voltar a mostrar numeros sem unidade ou unidade incorreta.

Criticidade: Media.

## Regra: normalizacao de leitura do Aquario

Arquivo: `scripts/data/data-utils.js`

Metodo: `normalizeMeasurementValue`

Objetivo: converter leituras brutas do Firebase para o valor exibido ao usuario.

Entradas: campo e valor bruto.

Saidas:

- `TDS`: valor bruto dividido por 10, exibido em `ppm`.
- `Turbidez`: valor bruto dividido por 1000, exibido em `NTU`.
- Demais campos: valor numerico sem divisor.

Impacto: tabelas, cards de estatisticas, graficos e exportacao PDF.

Dependencias: nomes dos campos em `scripts/config.js`.

Se alterada: TDS e Turbidez podem aparecer com escala incorreta.

Criticidade: Alta.

## Regra: estatisticas por metrica

Arquivo: `scripts/data/analytics.js`

Metodo: `renderStats`, `calculateStats`

Objetivo: calcular media, minima, maxima, delta e tendencia.

Entradas: dados filtrados e chave da metrica.

Saidas: cards de estatisticas.

Impacto: resumos das abas.

Dependencias: `STATS_CONFIG`.

Se alterada: cards podem mostrar valores incorretos.

Criticidade: Alta.

## Regra: tendencia

Arquivo: `scripts/data/analytics.js`

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

Arquivo: `scripts/data/analytics.js`

Metodo: `renderAdvancedClimateViews`

Objetivo: gerar calendario mensal, heatmap por hora e mapa semanal.

Entradas: dados, data selecionada, `metricKey`, containers.

Saidas: celulas DOM nos containers.

Regra de data:

- aceitar a data selecionada e normalizar para `DD-MM-AAAA` antes de filtrar registros
- mapa semanal reinicia no domingo e usa apenas registros da semana da data selecionada, do domingo ate a data selecionada
- uma falha nas visualizacoes climaticas avancadas nao pode interromper os graficos principais da aba

Regra de destaque:

- calendario mensal destaca o dia selecionado
- heatmap por hora destaca a hora atual apenas quando a data selecionada e hoje
- mapa semanal destaca a celula do dia da semana atual e hora atual apenas quando a data selecionada e hoje

Impacto: visualizacoes climaticas de Quarto e Sala.

Dependencias: ids de `scripts/config.js`.

Se alterada: heatmaps podem parar ou usar metrica errada.

Criticidade: Alta.

## Regra: escala de cor do heatmap

Arquivo: `scripts/data/analytics.js`

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

Arquivo: `scripts/charts/chart-utils.js`

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

Arquivo: `scripts/charts/chart-utils.js`

Metodo: `shouldShowComfortBand`, `comfortBandPlugin`

Objetivo: desenhar faixa de conforto em graficos de temperatura/sensacao/umidade sem perder foco na variacao medida.

Entradas: chave da metrica, sufixo.

Saidas: `chart.$comfortBand` e desenho no canvas.

Impacto: graficos de temperatura, sensacao e umidade; PDF tambem usa faixas para status e desenho do grafico.

Regra de escala: graficos comuns usam `min/max` derivados somente dos dados medidos validos. `null`, `undefined` e string vazia nao podem virar zero. A faixa de conforto nao participa da escala e so desenha o trecho que cruza a area visivel.

Dependencias: `AppConfig.comfortBand`, `AppConfig.humidityComfortBand` e, para Aquario, `AppConfig.aquariumComfortBand`.

Faixas:

- Ambientes: 20°C a 26°C.
- Umidade: 40% a 60%.
- Aquario: 25°C a 27°C.

Se alterada: referencia visual de conforto muda ou some.

Criticidade: Media.

## Regra: eventos solares obrigatorios

Arquivo: `scripts/charts/solar.js`

Metodo: `readSolarEventSeconds`

Objetivo: validar que amanhecer, nascer, por do sol e anoitecer existem.

Entradas: item solar.

Saidas: objeto de segundos ou `null`.

Impacto: graficos solares.

Dependencias: nomes de campos solares.

Se alterada: grafico solar pode aparecer com dados incompletos.

Criticidade: Alta.

## Regra: indicador astronomico do header

Arquivos: `index.html`, `style.css`, `scripts/main.js`, `scripts/charts/solar.js`

Metodos: `setupAstroIndicator`, `updateAstroIndicator`, `getSolarEventsForSelectedDate`

Objetivo: mostrar ao lado do relogio se o periodo atual e dia, noite ou transicao solar, com posicao animada do sol ou da lua.

Entradas:

- horario atual do navegador
- eventos solares de hoje em `historico/NascePorDoSol`
- fallback 06:00-18:00 quando dados solares ainda nao carregaram

Saidas: estado visual em `#astroIndicator` com classes `astro-indicator--day`, `astro-indicator--twilight` ou `astro-indicator--night`.

Rotulo visivel: nenhum texto interno; o pill fica apenas visual, com tamanho aproximado do relogio.

Tooltip: mostra apenas os horarios solares principais, por exemplo `Nascer do sol: 06:40 · Pôr do sol: 17:50`.

Popover: clique/toque no indicador abre um popover compacto com amanhecer, nascer do sol, zênite, pôr do sol, anoitecer, estado atual e duração do dia. Clique fora ou `Esc` fecha.

Exclusividade: ao abrir este popover, outros popovers do header devem fechar.

Impacto: leitura rapida do ciclo atual no topo da pagina.

Dependencias: `ClimateSolar.getSolarEventsForSelectedDate`, dados solares carregados pelo Firebase, ids `astroIndicator` e `astroPopover`.

Se alterada: indicador pode mostrar dia/noite incorreto, perder fallback antes do Firebase carregar ou quebrar o popover solar.

Criticidade: Media.

## Regra: AQI estimado no header

Arquivos: `index.html`, `styles/header.css`, `styles/responsive.css`, `scripts/charts/aqi.js`, `scripts/main.js`

Metodos: `ClimateAqi.setup`, `ClimateAqi.update`, `ClimateAqi.calculate`

Objetivo: mostrar no header um chip de AQI estimado da Sala usando os dados mais recentes do MQ135.

Entradas:

- dados de `historico/AirQuality`
- campos `CO`, `CO2`, `Toluen`, `NH4`, `Aceton` e `Alcohol`
- faixas de classificacao AQI

Saidas:

- desktop e mobile: chip compacto com `AQI` e valor
- tooltip/`aria-label`: valor, classificacao e dominante
- clique/toque: popover com valor, classificacao, impacto, dominante, horario e principais subindices
- exclusividade: ao abrir este popover, outros popovers do header devem fechar

Regra de classificacao:

- `0-50`: Boa
- `51-100`: Moderado
- `101-150`: Insalubre para grupos sensiveis
- `151-200`: Insalubre
- `201-300`: Muito insalubre
- `301+`: Perigoso

Observacao: o valor e uma estimativa local calculada pelos gases disponiveis do MQ135. A classificacao visual segue as faixas AQI, mas o projeto nao deve apresentar isso como AQI oficial certificado.

Impacto: leitura rapida da qualidade do ar estimada da Sala em todas as abas.

Dependencias: dados de Sala carregados pelo Firebase, ids `aqiIndicator` e `aqiPopover`.

Se alterada: o header pode mostrar AQI indisponivel, classificacao incorreta ou popover quebrado.

Criticidade: Media.

## Regra: zenite solar

Arquivo: `scripts/charts/solar.js`

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

## Regra: faixa de conforto na assistente

Arquivos:

- `scripts/assistant/assistant-intent.js`
- `scripts/assistant/assistant-metrics.js`
- `scripts/assistant/assistant-query.js`

Objetivo: responder perguntas sobre faixa, conforto, ideal, normal, dentro/fora da faixa e pior horario fora da faixa usando calculo local antes da redacao da IA.

Entradas:

- ambiente resolvido pela pergunta ou pela aba ativa
- metrica resolvida pela pergunta
- periodo/data/hora resolvidos pela pergunta ou calendario
- `AppConfig.comfortBand`
- `AppConfig.humidityComfortBand`
- `AppConfig.aquariumComfortBand`

Saidas:

- tipo de resultado `faixa_conforto`
- faixa usada
- status `dentro_da_faixa` ou `fora_da_faixa`
- total dentro/fora da faixa
- quantidade de horarios fora da faixa
- lista curta de horarios fora
- pior horario fora da faixa, com data, hora, valor, distancia e direcao

Faixas:

- Temperatura e sensacao de Sala/Quarto: 20°C a 26°C.
- Umidade: 40% a 60%.
- Temperatura do Aquario: 25°C a 27°C.

Regras:

- Metricas sem faixa configurada devem responder que nao ha faixa de conforto configurada.
- Quando houver filtro por hora, o calculo deve considerar somente aquela hora.
- A IA deve redigir usando apenas o resultado calculado, sem recalcular faixas.

Impacto: perguntas como `ficou dentro da faixa?`, `quantas horas ficou fora?` e `qual pior horario fora da faixa?`.

Dependencias: `AppConfig`, `ClimateData.normalizeMeasurementValue`, `assistant-intent`, `assistant-metrics` e `assistant-query`.

Se alterada: a assistente pode responder status de conforto incorreto ou usar faixa diferente dos graficos.

Criticidade: Alta.

## Regra: aba ativa persistida

Arquivo: `scripts/ui/ui.js`

Metodo: `storeActiveTab`, `getStoredTab`, `setupTabs`

Objetivo: lembrar aba ativa em `localStorage.activeTab`.

Entradas: nome da aba.

Saidas: estado visual e persistencia.

Impacto: navegacao.

Dependencias: `localStorage`.

Se alterada: aba inicial pode sempre voltar para Sala.

Criticidade: Baixa.

## Regra: navegacao touch entre abas

Arquivo: `scripts/ui/ui.js`

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
- gestos iniciados em tabelas, heatmaps ou areas com rolagem horizontal nao trocam de aba

Impacto: navegacao mobile por touch.

Dependencias: DOM `.container`, `.tablink.active[data-tab-target]`, `.tabcontent`, funcao interna `openTab`.

Se alterada: fluxo mobile de abas pode inverter, pular abas ou trocar aba durante rolagem vertical.

Criticidade: Media.

## Regra: zoom de grafico

Arquivo: `scripts/charts/zoom.js`

Metodo: `setup`, `handleZoom`, `createZoomChart`

Objetivo: ampliar grafico por botao ou duplo clique.

Entradas: instancia Chart.js original.

Saidas: overlay com novo Chart.js.

Impacto: interacao de graficos.

Dependencias: Chart.js, `chartInstances`, opcoes de zoom em `scripts/main.js`.

Se alterada: zoom pode perder tooltip, dados solares ou faixa de conforto.

Criticidade: Media.

## Regra: exportacao de dados da aba ativa

Arquivos: `scripts/reports/pdf-report.js` e `scripts/reports/pdf-report-*.js`

Metodo: `setup`, `exportActiveTab`, `buildReport` e modulos internos de dados, DOM, graficos e PDF

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
- resumo executivo na primeira pagina com cards principais e alertas do dia
- graficos otimizados para PDF, juntando Temperatura e Sensacao termica quando possivel
- ciclo solar compacto apenas para Sala e Quarto
- tabela resumida com uma linha por horario e status geral
- rodape com Estacao Climatica, pagina atual/total e data/hora

Contrato por aba:

- Sala: cards de temperatura, sensacao termica, umidade, pressao e ciclo solar; graficos de Temperatura x Sensacao, Umidade, Pressao e Ciclo solar; tabela MQ135 com CO, CO2, Acetona, Alcool, Amonia e Tolueno.
- Quarto: cards de temperatura, sensacao termica, umidade e ciclo solar; graficos de Temperatura x Sensacao, Umidade e Ciclo solar; tabela com Temperatura, Sensacao termica e Umidade.
- Aquario: cards, graficos e tabela de Temperatura, PH, TDS e Turbidez; nao deve incluir card ou grafico de ciclo solar.

Regras da tabela:

- PDF usa tabela resumida com uma linha por horario
- status geral e `Alerta` se qualquer indicador daquele horario estiver em alerta
- status geral e `Estavel` se todos os indicadores daquele horario estiverem estaveis
- JSON preserva a tabela detalhada com `Horario`, `Indicador`, `Valor` e `Status`

Regras de layout:

- relatorio deve usar largura menor que a pagina A4 util para evitar cortes laterais
- primeira pagina deve conter resumo executivo util, sem area vazia grande
- graficos e tabela devem iniciar em paginas proprias
- graficos devem ser renderizados em uma coluna compacta no PDF A4 retrato
- pagina de graficos deve respeitar o contrato da aba ativa
- html2canvas deve usar as dimensoes reais do relatorio renderizado
- jsPDF deve montar as paginas manualmente, adicionando cabecalho, resumo e graficos como blocos inteiros
- somente a tabela longa pode ser fatiada entre paginas

Impacto: relatorio/dados exportados para Sala, Quarto e Aquario.

Dependencias: `html2canvas`, `jsPDF`, `ClimateData`, `AppConfig`, `window.ClimatePdfReportModules`, canvases existentes, dados ja carregados pelo Firebase.

Se alterada: exportacao pode reconsultar dados indevidamente, perder graficos, gerar layout quebrado ou falhar no download.

Criticidade: Alta.

## Regra: dados ausentes na exportacao

Arquivos: `scripts/reports/pdf-report.js` e `scripts/reports/pdf-report-*.js`

Metodo: `emptySummary`, `captureChartImage`, `createTableSection`

Objetivo: manter a geracao da exportacao mesmo sem dados, sem sensor ou sem grafico.

Entradas: valores ausentes, canvas ausente ou data sem registros.

Saidas: texto `Sem dados de <tipo_grafico> em <data>` nos graficos e `Sem dados`/`Sem dados disponíveis` nos resumos e tabelas.

Impacto: robustez do relatorio.

Dependencias: montagem do relatorio PDF/JSON.

Se alterada: exportacao pode quebrar quando houver sensor offline ou grafico vazio.

Criticidade: Alta.

## Regra: chat com Firebase AI Logic

Arquivos: `index.html`, `scripts/config.js`, `scripts/firebase-service.js`, `scripts/chat.js`, `scripts/assistant/*.js`, `scripts/main.js`, `styles/chat.css`.

Objetivo: permitir perguntas em linguagem natural sobre os dados ja carregados da estacao.

Entradas:

- pergunta digitada pelo usuario
- atalho de pergunta em `data-chat-question`
- aba ativa
- data selecionada
- intencao classificada em JSON pelo Gemini
- `latestData`
- eventos solares da data selecionada
- dados de Sala/MQ135 para AQI estimado

Saidas:

- resposta textual do Gemini no painel de chat baseada em resultado ja calculado
- resposta sobre AQI/IAQ/qualidade do ar com classificacao, impacto, dominante e subindices quando existirem
- mensagem de erro visivel quando Firebase AI Logic, App Check ou o modelo configurado nao estiverem disponiveis
- envio da pergunta predefinida quando o usuario aciona um atalho

Regra de contexto:

- o chat deve usar a IA primeiro para classificar a intencao em JSON e depois usar JavaScript para buscar e calcular os dados
- a IA nao deve calcular media, maxima, minima, delta, tendencia, dia mais frio/quente ou comparacoes; esses valores devem ser calculados no codigo
- a resposta final da IA deve receber apenas o resultado estruturado calculado pelo JavaScript
- o chat deve enviar ao modelo apenas uma classificacao curta ou o resultado calculado, nunca o historico completo do Firebase
- nao enviar historicos completos, paths inteiros do Firebase, credenciais ou dados que nao sejam necessarios para responder
- quando nao houver dado suficiente, a resposta deve informar que nao ha dados carregados para a pergunta
- se a pergunta nao mencionar Sala, Quarto ou Aquario, usar a aba ativa como ambiente alvo
- se a pergunta nao mencionar ambiente, mas mencionar AQI, IAQ, qualidade do ar, CO, CO2, Acetona, Alcool, Amonia ou Tolueno, usar Sala/MQ135 como ambiente alvo
- se o ambiente classificado nao possuir a metrica pedida e essa metrica existir em apenas outro ambiente, usar o ambiente que possui a medicao em vez de cair na metrica padrao
- se a pergunta mencionar Sala, Quarto ou Aquario, usar o ambiente mencionado como alvo, mesmo que a aba ativa seja outra
- perguntas sobre `ultimas 24 horas` ou `ultimas 24h` devem usar janela movel real com `ClimateData.filterDataByRollingHours`, data selecionada e hora atual do navegador
- `ultimas 24h` nao deve ser tratado como `hoje`, nem como `ultimos dias`
- se a pergunta nao mencionar data, usar a data selecionada no calendario da pagina
- se a pergunta mencionar data em `DD/MM/AAAA`, `DD-MM-AAAA`, `hoje`, `ontem` ou `anteontem`, usar essa data como alvo sem alterar o calendario da pagina
- se a pergunta mencionar hora como `14h`, `14:00` ou `14`, o chat deve filtrar a hora correspondente e comparar corretamente com chaves Firebase no formato `14-00`
- se houver filtro por hora, a resposta deve ser direta e conter somente o valor da metrica, ambiente, data e hora; nao deve exibir resumo do dia nem numero de amostras
- se a pergunta mencionar faixa horaria como `entre 8h e 18h`, `das 8 as 18` ou `de 8h a 18h`, o chat deve considerar somente registros dentro da faixa, incluindo as horas inicial e final
- se a pergunta pedir o horario/periodo de maior ou menor valor, como `qual horario foi mais quente?`, `qual horario teve maior umidade?` ou `qual periodo do dia teve menor pressao?`, o JavaScript deve calcular o maior/menor valor medio por horario e enviar apenas esse resultado estruturado para a redacao da IA
- se a pergunta pedir o dia do mes de maior/menor valor, o chat deve consultar o mes completo da data selecionada e calcular o maior/menor valor medio diario
- se a pergunta pedir a hora que costuma ter maior/menor valor, o chat deve agrupar os registros por hora do dia no periodo resolvido; quando a pergunta usar `costuma`, o periodo padrao e o mes da data selecionada
- se a pergunta pedir dia/hora da semana ou pico semanal, o chat deve usar a semana da data selecionada, de domingo ate a data selecionada, e calcular o maior/menor valor medio por celula dia da semana/hora
- periodos como `ultimos dias` devem usar 7 dias por padrao; periodos devem ser limitados a 30 dias
- a classificacao de intencao pode retornar `ambientes`, `metricas`, `operacao`, `periodo`, `criterio`, `confianca`, `precisa_esclarecimento` e `solar`, mas nao deve receber historico completo nem responder a pergunta do usuario
- as regras de ambiente e data valem para media, maxima, minima, delta, tendencia e qualquer parametro carregado no ambiente alvo
- perguntas de ciclo solar devem usar `latestData.solar` e `ClimateSolar.getSolarEventsForSelectedDate`, sem duplicar leitura manual dos campos solares no chat
- perguntas de comparacao solar devem usar `assistant-solar.js` sobre os eventos ja parseados por `ClimateSolar.getSolarEventsForSelectedDate`; duracao do dia usa nascer ate por do sol, maior/menor duracao de luz usa o mes selecionado por padrao, e tendencias/comparacoes de nascer ou por do sol usam a semana selecionada por padrao
- perguntas de AQI/IAQ/qualidade do ar devem reutilizar `ClimateAqi.calculate` sobre o recorte de data/hora consultado, sem duplicar o calculo de faixas no chat

Impacto: perguntas sobre media, maxima, minima, tendencia, eventos solares e qualidade do ar.

Dependencias: Firebase App Check com reCAPTCHA Enterprise, Firebase AI Logic, `ClimateAIService`, `ClimateData`, `ClimateSolar`, `ClimateAqi`, `latestData`.

Se alterada: chat pode consumir tokens demais, expor dados desnecessarios, responder sem base nos dados carregados ou falhar quando o App Check estiver com enforcement ativo.

Criticidade: Alta.

# REGRAS QUE NAO DEVEM SER ALTERADAS

- Conversao de data HTML/Firebase sem revisar todos os filtros.
- Paths Firebase em `scripts/config.js` sem revisar `scripts/main.js` e banco.
- Campos de sensores em `scripts/config.js` sem revisar Firebase.
- Leitura de zênite em `scripts/charts/solar.js` sem revisar dados enviados pelo Arduino.
- Ordem de scripts em `index.html`.
- Contrato de fallback em `ClimateCharts.createLineChart`.
- Exportacao PDF/JSON deve reutilizar `latestData` e `chartInstances`, sem reconsultar Firebase.
- Chat com IA deve reutilizar `latestData`, aba ativa e data selecionada, sem reconsultar Firebase nem enviar historico completo ao modelo.

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

## `scripts/data/data-utils.js`

Responsabilidade: estrutura de dados.

O que pode quebrar: tabelas, graficos, filtros.

Dependencias afetadas: views, analytics, charts, solar.

Nivel de risco: Alto.

## `scripts/data/analytics.js`

Responsabilidade: estatisticas e heatmaps.

O que pode quebrar: cards e visualizacoes climaticas.

Dependencias afetadas: Quarto e Sala principalmente.

Nivel de risco: Alto.

## `scripts/charts/solar.js`

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
- CO, CO2, Aceton, Alcohol, NH4, Toluen: metricas da sala/MQ135.
- Toluen: campo Firebase exibido como Tolueno.
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
- Aliases solares ficam centralizados em `SOLAR_FIELD_ALIASES` dentro de `scripts/charts/solar.js`.

# TAREFAS COMUNS

## Alterar graficos comuns

Leia:

- `scripts/charts/chart-utils.js`
- `scripts/main.js`
- view da aba afetada
- `scripts/config.js`

## Alterar Firebase

Leia:

- `scripts/config.js`
- `scripts/firebase-service.js`
- `scripts/main.js`
- `scripts/data/data-utils.js`

## Alterar chat com IA

Leia:

- `scripts/chat.js`
- `scripts/assistant/*.js`
- `scripts/firebase-service.js`
- `scripts/config.js`
- `scripts/main.js`
- `index.html`
- `styles/chat.css`

## Alterar campos dos sensores

Leia:

- `scripts/config.js`
- view da aba
- `scripts/data/analytics.js`
- `scripts/data/data-utils.js`

## Alterar heatmaps

Leia:

- `scripts/data/analytics.js`
- `scripts/config.js`
- `scripts/views/quarto-view.js`
- `scripts/views/sala-view.js`
- `index.html`

## Alterar solar

Leia:

- `scripts/charts/solar.js`
- `scripts/views/solar-view.js`
- `scripts/config.js`
- `scripts/main.js`

## Alterar tabelas

Leia:

- `scripts/data/data-utils.js`
- view da aba
- `index.html`
- `scripts/ui/ui.js`

## Alterar navegacao/abas/data picker

Leia:

- `scripts/ui/ui.js`
- `scripts/main.js`
- `index.html`

## Alterar exportacao PDF/JSON

Leia:

- `scripts/reports/pdf-report.js`
- `scripts/reports/pdf-report-*.js`
- `styles/reports/pdf-report.css`
- `scripts/main.js`
- `index.html`
- `scripts/config.js`
- `scripts/data/data-utils.js`
