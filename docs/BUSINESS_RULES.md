# BUSINESS_RULES

Regras extraidas exclusivamente do codigo existente.

## Regra: nomenclatura interna em PT-BR

Novos metodos, funcoes e variaveis internas devem usar nomes em PT-BR para facilitar manutencao e leitura do dominio.

Excecoes permitidas:

- campos Firebase reais, como `Toluen`, `CO2`, `HourNascerDoSol` ou similares
- ids e classes DOM existentes
- contratos publicos em `window.*`
- propriedades exigidas por Chart.js, Firebase, html2canvas, jsPDF ou APIs externas
- chaves estruturais ja consumidas por outros modulos, como payloads da assistente e contratos de relatorio

Impacto: legibilidade e consistencia com o dominio do projeto.

Criticidade: Media.

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

## Regra: diagnostico de console

Arquivo: `scripts/config.js`

Objeto publico: `window.ClimateDiagnostics`

Objetivo: evitar poluicao do DevTools com fallbacks esperados e manter logs detalhados apenas quando o desenvolvedor pedir.

Entradas:

- parametro `?debug=1`
- `localStorage.climateDebug = "1"`
- chamadas `depurar`, `informar`, `avisar` e `erro`

Saidas:

- `depurar`, `informar` e `avisar` so escrevem no console quando debug esta ativo
- `erro` escreve no console sempre, para falhas realmente criticas

Impacto: mensagens de fallback de App Check, chat, PDF e visualizacoes avancadas.

Se alterada: DevTools pode voltar a mostrar varios avisos esperados como se fossem falhas reais.

Criticidade: Baixa.

## Regra: App Check sob demanda

Arquivo: `scripts/firebase-service.js`

Metodos: `ensureAppCheckInitialized`, `initializeAppCheckIfConfigured`

Objetivo: evitar carregar reCAPTCHA/App Check no carregamento inicial da pagina e inicializar App Check apenas quando um recurso protegido precisar, como a assistente com Firebase AI Logic.

Entradas: `window.location.hostname`.

Saidas:

- no carregamento inicial, apenas Firebase App e Realtime Database sao inicializados
- em producao/GitHub Pages, `ensureAppCheckInitialized()` tenta inicializar App Check antes da IA
- em `localhost`, `127.0.0.1` e `::1`, App Check e ignorado para evitar warning falso de credenciais App Check invalidas

Impacto: desenvolvimento local, limpeza do console, Lighthouse e custo de carregamento inicial.

Se alterada: a pagina pode voltar a carregar reCAPTCHA na abertura, emitir warnings/erros esperados ou deixar a IA sem token App Check em producao.

Criticidade: Media.

## Regra: modo publico sem login e modo interno autorizado

Arquivos: `index.html`, `scripts/config.js`, `scripts/auth/auth-service.js`, `scripts/main.js`, `scripts/views/public-weather-view.js`

Objetivo: permitir acesso publico ao site sem expor dados internos da estacao e liberar o dashboard completo somente para usuarios autorizados.

Entradas:

- estado do Firebase Auth
- email do usuario Google logado
- `AppConfig.auth.usuariosInternosAutorizados`

Saidas:

- sem login: exibe modo publico por CEP/localizacao
- login com `anvmano@gmail.com`: exibe dashboard interno completo
- login com `clarissamikado@gmail.com`: exibe dashboard interno completo
- login com qualquer outro usuario: mantem modo publico por CEP/localizacao

Regras:

- login Google e opcional; o usuario publico nao deve ser obrigado a autenticar
- o dominio publicado do GitHub Pages, como `anvmano.github.io`, deve estar cadastrado em Firebase Authentication > Configuracoes > Dominios autorizados; sem isso o login Google falha com `auth/unauthorized-domain`
- modo publico nao deve iniciar listeners internos do Realtime Database
- modo publico nao deve inicializar ou exibir a assistente IA
- modo interno inicializa abas, date picker, zoom, exportacao, chat e listeners Firebase internos
- modo interno deve exibir opcao de logout no header
- ao executar logout ou voltar para modo publico, listeners internos do Firebase devem ser cancelados e `latestData` deve ser limpo para nao manter dados privados em memoria
- a seguranca real dos dados internos deve ser reforcada por regras do Firebase Realtime Database; ocultar UI no frontend nao substitui regras de banco

Impacto: privacidade dos dados internos, custo de IA e separacao de experiencia publica/interna.

Dependencias: Firebase Auth, `FirebaseService.initialize`, `PublicWeatherView`, `ClimateChat`, `ClimatePdfReport`.

Se alterada: usuarios publicos podem ver recursos internos ou donos podem cair indevidamente no modo publico.

Criticidade: Alta.

## Regra: clima publico por CEP ou localizacao

Arquivos: `scripts/external/browser-location-service.js`, `scripts/external/external-weather-service.js`, `scripts/data/environmental-insights.js`, `scripts/views/public-weather-view.js`

Objetivo: mostrar informacoes climaticas publicas quando nao ha usuario interno autorizado.

Entradas:

- CEP informado pelo usuario
- localizacao opcional fornecida pelo navegador
- BrasilAPI ou ViaCEP
- Open-Meteo Geocoding
- Open-Meteo Forecast
- Open-Meteo Air Quality

Saidas:

- cards de temperatura, sensacao termica, umidade, pressao e AQI externo
- graficos de temperatura, sensacao termica, umidade, pressao e ciclo solar do dia
- contexto de estacao do ano e fase da lua
- recomendacao de ventilacao externa
- probabilidade e intensidade de chuva nas proximas 6h
- indice UV atual, maxima diaria e recomendacao solar
- ponto de orvalho e risco estimado de condensacao/mofo

Regras:

- o site deve abrir pedindo CEP ou permissao de localizacao, sem exigir login
- localizacao do navegador deve ficar somente em memoria e nao deve ser armazenada
- localizacao do navegador deve tentar primeiro posicao em cache, depois busca normal com timeout maior e por fim alta precisao antes de retornar erro
- CEP e resolvido para cidade/UF e depois para coordenadas via geocodificacao externa
- graficos publicos de temperatura, sensacao termica, umidade e pressao devem mostrar janela movel das ultimas 24h, terminando na data/hora retornada pela localizacao consultada
- a consulta Open-Meteo publica deve trazer dados horarios recentes suficientes para montar essa janela, sem exibir previsoes futuras nos graficos de serie temporal
- ciclo solar publico usa coordenadas da localizacao/CEP, nao `historico/NascePorDoSol`
- no modo publico, o chip/popover solar do header deve usar os eventos solares da localizacao/CEP consultado; antes da consulta, deve orientar CEP/localizacao em vez de apresentar fallback interno como se fosse dado real
- o card publico de fase da lua deve seguir o mesmo comportamento do card interno: fase, iluminacao, idade, proxima cheia e proxima nova; ele nao deve exibir horarios solares como nascer ou por do sol
- quando houver clima externo carregado, o card publico de fase da lua deve usar a data/hora da localizacao consultada; sem dados externos, usa a data atual do navegador como fallback visual
- AQI publico vem de API externa e deve ser separado do AQI estimado interno da Sala/MQ135
- no modo publico, o chip/popover AQI do header deve mostrar `AQI externo` da localizacao/CEP consultado e nao pode mencionar Sala ou MQ135
- se nenhuma localizacao foi escolhida, mostrar estado vazio claro orientando CEP ou localizacao
- chuva usa o maior percentual, acumulado e maior intensidade horaria dentro das proximas 6h; ausencia de previsao nao pode virar zero
- indice UV segue as faixas `baixo`, `moderado`, `alto`, `muito alto` e `extremo`, com recomendacao proporcional
- ponto de orvalho usa o valor da API quando disponivel e calculo de Magnus como fallback
- risco de mofo/condensacao e orientativo e deve considerar umidade e distancia entre temperatura e ponto de orvalho
- recomendacao de ventilacao externa considera AQI, chuva, rajadas, temperatura e umidade; nao deve recomendar abertura quando houver condicao externa limitante

Impacto: experiencia publica e separacao entre dados externos e dados internos da estacao.

Dependencias: APIs publicas externas e disponibilidade de rede.

Se alterada: modo publico pode parecer quebrado ou misturar dados externos com sensores internos.

Criticidade: Alta.

## Regra: insights ambientais da aba Estacao

Arquivos: `index.html`, `scripts/data/environmental-insights.js`, `scripts/views/estacao-view.js`, `scripts/external/browser-location-service.js`, `scripts/external/external-weather-service.js`, `styles/environment-insights.css`

Objetivo: transformar leituras atuais em recomendacoes praticas sem misturar dados internos e externos.

Entradas:

- ultima temperatura e umidade da Sala e do Quarto
- AQI estimado da Sala/MQ135
- localizacao opcional fornecida pelo navegador
- clima, AQI, chuva, UV e vento externos da Open-Meteo

Saidas:

- recomendacao de ventilacao da Sala
- ponto de orvalho e risco estimado de mofo para Sala e Quarto
- chuva nas proximas 6h e indice UV quando o usuario consultar a localizacao

Regras:

- sem localizacao, ventilacao usa somente sensores internos e informa essa limitacao
- chuva e UV ficam indisponiveis ate o usuario acionar a consulta externa; nao usar valores internos ou zeros como fallback
- a pagina nao deve solicitar permissao de localizacao automaticamente
- latitude e longitude existem apenas em memoria durante a sessao e nao sao gravadas no Firebase/localStorage
- com clima externo carregado, ventilacao combina necessidade interna e condicoes externas
- os insights representam condicoes atuais e nao seguem a data historica selecionada no calendario
- risco de mofo, ponto de orvalho e ventilacao sao estimativas orientativas, nao medicoes certificadas nem diagnosticos
- as grades de insights dos modos publico e interno nao exibem uma faixa de cabecalho propria; no modo interno, o controle de localizacao e seus estados ficam incorporados ao card de chuva

Impacto: leitura pratica da aba Estacao, privacidade da localizacao e separacao entre Firebase interno e APIs externas.

Dependencias: `ClimateInsightsAmbientais`, dados internos ja carregados, BrowserLocationService e Open-Meteo.

Se alterada: a aplicacao pode recomendar ventilacao em momento inadequado, converter ausencia de previsao em zero ou expor localizacao alem da consulta atual.

Criticidade: Alta.

## Regra: carregamento sob demanda de recursos pesados

Arquivos: `index.html`, `scripts/runtime-loader.js`, `scripts/main.js`, `scripts/chat.js`, `scripts/reports/pdf-report.js`

Objetivo: reduzir custo inicial de JavaScript/CSS sem introduzir build tooling.

Entradas: abertura da pagina, primeiro grafico com dados, clique no chat e clique de exportacao.

Saidas:

- Chart.js nao e carregado no HTML inicial; o primeiro grafico com dados chama `ClimateAssets.carregarChart()` e redesenha a data selecionada.
- `scripts/chat.js` fica como fachada leve; `scripts/assistant/*` e Firebase AI Logic so carregam no primeiro clique da assistente.
- `scripts/reports/pdf-report.js` fica como fachada leve; `scripts/reports/pdf-report-*` so carregam ao exportar.
- Exportacao JSON nao carrega Chart.js, CSS do PDF, html2canvas ou jsPDF.
- Exportacao PDF carrega CSS do relatorio, Chart.js, html2canvas e jsPDF sob demanda.
- `styles/zoom.css` nao bloqueia a primeira renderizacao; e carregado apos a inicializacao via `ClimateAssets`.

Impacto: Lighthouse mobile, TBT, LCP, tamanho de JS inicial e render-blocking CSS.

Se alterada: a pagina pode voltar a carregar IA/PDF/Chart.js na abertura ou quebrar chat/exportacao por ordem de modulos.

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
- heatmaps de Sala/Quarto so devem montar o DOM quando a secao de visualizacoes climaticas estiver expandida; abrir o colapsavel dispara novo render da data selecionada

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

## Regra: duracao do dia no grafico solar

Arquivos: `index.html`, `scripts/charts/solar.js`, `scripts/views/solar-view.js`, `scripts/views/public-weather-view.js`, `styles/charts.css`

Metodos: `formatarDuracaoDia`, `createSolarTodayChart`, `renderizarGraficoSolar`

Objetivo: exibir a duracao de luz diretamente no card do grafico Ciclo Solar do Dia, sem depender do popover do header.

Entradas:

- nascer do sol
- por do sol
- eventos solares internos de `historico/NascePorDoSol` ou eventos solares publicos da localizacao/CEP
- `daylight_duration` da Open-Meteo no modo publico, quando disponivel

Saidas: chip discreto no card com `Duracao do dia: <h>h<mm>`.

Regras:

- a duracao e calculada como por do sol menos nascer do sol; no modo publico, se `daylight_duration` existir, ele deve ser usado antes do fallback nascer/por
- o chip deve aparecer no grafico interno da aba Estacao e no grafico publico
- se os eventos solares forem invalidos ou ausentes, o chip deve ficar oculto para evitar dado enganoso
- o chip fica fora do canvas e nao pode interferir no tooltip do Chart.js nem no botao de zoom

Impacto: leitura rapida do tempo de luz solar no grafico principal do dia.

Dependencias: `ClimateSolar.formatarDuracaoDia`, dados solares carregados e renderizacao do card solar.

Se alterada: modo interno e modo publico podem divergir ou o grafico pode exibir duracao incorreta.

Criticidade: Media.

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

- desktop e mobile: chip compacto no mesmo formato visual dos demais chips do header, mostrando apenas um mini medidor colorido interno
- o mini medidor deve comunicar visualmente a faixa AQI, com ponteiro mais a esquerda para valores melhores e mais a direita para valores piores
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

## Regra: estacao do ano no header e na aba Estacao

Arquivos: `index.html`, `styles/header.css`, `styles/stats.css`, `styles/responsive.css`, `scripts/charts/season.js`, `scripts/views/estacao-view.js`, `scripts/main.js`

Objetivo: exibir a estacao do ano atual como contexto global da pagina.

Entradas:

- data atual do navegador em `ClimateData.dataAtual()`
- datas fixas de inicio: Verao 21/12, Outono 20/03, Inverno 21/06 e Primavera 22/09

Saidas:

- chip no header com a estacao atual e pequena animacao sazonal
- popover do header com inicio das estacoes do ciclo atual
- faixa horizontal na aba Estacao com Verao, Outono, Inverno e Primavera
- marcador vertical de progresso na faixa
- card da Estacao do ano no PDF com progresso dentro da estacao atual
- placeholders/altura reservada no resumo global da aba Estacao para reduzir deslocamento de layout durante o carregamento dos dados

Regras:

- o chip e a faixa usam a data atual do navegador, nao a data selecionada no calendario
- o marcador da faixa progride por segmento visual: Verao 0-25%, Outono 25-50%, Inverno 50-75%, Primavera 75-100%
- o percentual mostrado no card da Estacao do ano no PDF representa o quanto ja passou da estacao atual, portanto no inicio do inverno deve ficar perto de 0%, nao perto de 50%
- o header usa a ordem: Estacao do ano, AQI, ciclo solar, fase da lua e relogio
- o chip do header deve mostrar apenas a animacao/icone sazonal; o nome da estacao fica em `title`/`aria-label` e no popover
- em mobile, o relogio e a marca `Estacao Climatica` podem ser ocultados e os chips principais devem ocupar toda a largura util do header
- o popover de estacao do ano e mutuamente exclusivo com AQI, solar e lua
- os placeholders iniciais de `#statsEstacao` devem ter altura compativel com os 6 cards globais reais, especialmente no mobile, para evitar CLS alto no Lighthouse

Impacto: leitura rapida de contexto sazonal e consistencia visual da aba Estacao.

Dependencias: `ClimateData.dataAtual`, ids `seasonIndicator`, `seasonPopover` e `seasonTimeline`.

Se alterada: header, popovers ou progresso sazonal podem ficar inconsistentes.

Criticidade: Media.

## Regra: fase da lua no header e na aba Estacao

Arquivos: `index.html`, `styles/header.css`, `styles/stats.css`, `styles/responsive.css`, `scripts/charts/moon.js`, `scripts/views/estacao-view.js`, `scripts/main.js`

Objetivo: exibir a fase da lua como contexto astronomico complementar ao ciclo solar.

Entradas:

- data atual do navegador em `ClimateData.dataAtual()` para o chip do header
- data selecionada no calendario para o bloco lunar da aba Estacao
- calculo local baseado em ciclo lunar medio, sem API externa

Saidas:

- chip no header com fase lunar atual e pequena animacao visual
- popover do header com fase, iluminacao, idade lunar, proxima cheia e proxima nova
- bloco na aba Estacao com fase lunar da data selecionada

Regras:

- o chip do header representa a fase da lua atual
- o chip do header deve mostrar apenas o icone/animacao lunar; o texto da fase fica em `title`/`aria-label` e no popover
- o icone lunar deve respeitar visualmente a direcao da fase: crescente e minguante usam lados opostos de sombra
- o bloco lunar da aba Estacao representa a fase da lua da data selecionada
- o popover da lua e mutuamente exclusivo com Estacao do ano, AQI e solar
- o calculo lunar e aproximado e nao deve ser tratado como efemeride astronomica de alta precisao
- o `title` do chip lunar deve conter somente a descricao completa, como `Quarto crescente: 50% iluminado`
- o `aria-label` do chip lunar deve preservar a informacao textual da fase, mesmo sem texto visivel dentro do chip

Impacto: contexto visual astronomico no header e na visao global.

Dependencias: `ClimateData.parseFirebaseDate`, ids `moonIndicator`, `moonPopover` e `moonSummary`.

Se alterada: header, popovers ou resumo astronomico da aba Estacao podem ficar inconsistentes.

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

## Regra: tooltips de graficos da Estacao

Arquivos: `scripts/charts/solar.js`, `scripts/views/estacao-view.js`

Objetivo: manter a leitura dos graficos globais coerente com o ponto visual consultado.

Regras:

- no grafico Ciclo Solar do Dia, a tooltip dos eventos solares deve aparecer somente quando o cursor/toque estiver realmente sobre ou proximo do ponto solar ativo, sem ativacao por eixo X distante
- no grafico Temperatura por Ambiente e demais comparativos da aba Estacao, a tooltip deve ordenar as series pelo valor no horario consultado, do maior para o menor, acompanhando a ordem visual das linhas
- no grafico Nascer & Por do Sol, a tooltip deve ordenar as series pela posicao visual real no canvas, considerando que o grafico usa eixos Y distintos para eventos da manha e da tarde

Impacto: leitura de dados no hover/touch e paridade visual entre linhas e legenda flutuante.

Dependencias: Chart.js, `ClimateSolar.getSolarTodayOptions`, `EstacaoView.renderizarGraficoComparativo`.

Se alterada: a tooltip pode parecer deslocada ou listar ambientes fora da ordem visual.

Criticidade: Baixa.

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

## Regra: navegacao por teclado entre abas

Arquivo: `scripts/ui/ui.js`

Metodo: `setupTabs`, `openTab`, `navegarAbasPorTeclado`

Objetivo: seguir o padrao ARIA de tabs com foco movel e navegacao completa por teclado.

Saidas:

- somente a aba ativa usa `tabindex="0"`; as demais usam `tabindex="-1"`
- `ArrowLeft` abre e focaliza a aba anterior, circulando da primeira para a ultima
- `ArrowRight` abre e focaliza a proxima aba, circulando da ultima para a primeira
- `Home` abre e focaliza Estacao
- `End` abre e focaliza Aquario
- foco, `aria-selected`, classe ativa, painel visivel e aba persistida permanecem sincronizados

Impacto: acessibilidade e navegacao sem mouse.

Dependencias: DOM `.tablink[role="tab"]`, paineis `role="tabpanel"`, `localStorage`.

Se alterada: foco visual, painel exibido e estado ARIA podem divergir.

Criticidade: Media.

## Regra: navegacao touch entre abas

Arquivo: `scripts/ui/ui.js`

Metodo: `setupTabSwipe`

Objetivo: permitir troca de abas por gesto horizontal touch no fluxo Estacao ⇄ Sala ⇄ Quarto ⇄ Aquario.

Entradas:

- `tabOrder` configurado em `scripts/main.js` como `["Tab0", "Tab1", "Tab2", "Tab3"]`
- evento `touchstart`
- evento `touchend`

Saidas:

- swipe para esquerda em Estacao abre Sala
- swipe para esquerda em Sala abre Quarto
- swipe para esquerda em Quarto abre Aquario
- swipe para esquerda em Aquario nao faz nada
- swipe para direita em Aquario abre Quarto
- swipe para direita em Quarto abre Sala
- swipe para direita em Sala abre Estacao
- swipe para direita em Estacao nao faz nada
- gestos iniciados em tabelas, heatmaps ou areas com rolagem horizontal nao trocam de aba
- no mobile, as abas devem ocupar toda a largura horizontal em quatro colunas equivalentes e ter aparencia clara de abas/controle segmentado, distinguindo navegacao de conteudo da pagina
- a aba ativa deve se integrar visualmente ao conteudo abaixo com destaque e transicao suave, evitando aparencia de botao quadrado isolado

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

Interacao:

- duplo clique ou botao do card abre o zoom
- o overlay usa `role="dialog"`, `aria-modal="true"` e nome acessivel associado ao grafico
- o foco e movido para o botao Fechar ao abrir
- `Tab` e `Shift+Tab` devem permanecer contidos no dialogo enquanto ele estiver aberto
- ao fechar, o foco e devolvido ao botao que iniciou o zoom
- `Esc` fecha o zoom
- botao de fechar do overlay fecha o zoom
- clique/toque no fundo do overlay fecha o zoom
- clique/toque dentro do card/canvas ampliado nao fecha o zoom
- em dispositivos touch, `pointerdown`/`touchstart` dentro do canvas ampliado deve preservar a interacao do Chart.js para tooltip/leitura de dado

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
- botao `#btnExportData`
- controle `name="exportFormat"` com opcoes `pdf` e `json`

Saidas:

- arquivo PDF A4 retrato baixado automaticamente
- arquivo JSON baixado automaticamente com metadados, resumo, tabela resumida, tabela detalhada e dados brutos filtrados
- cabecalho com aba, data consultada e data/hora de geracao
- resumo executivo na primeira pagina com cards principais e alertas do dia
- graficos otimizados para PDF, juntando Temperatura e Sensacao termica quando possivel
- ciclo solar compacto quando a aba ativa inclui ciclo solar
- tabela resumida com uma linha por horario e status geral
- rodape com Estacao Climatica, pagina atual/total e data/hora

Fonte unica do relatorio:

- `scripts/reports/pdf-report-data.js` deve filtrar `latestData` exclusivamente por `selectedDate` e produzir uma fonte normalizada unica
- resumo, alertas, graficos, tabela resumida, tabela detalhada e JSON devem derivar dessa mesma fonte
- os graficos do PDF nao devem reutilizar `chartInstances` nem canvases ativos da interface, porque os graficos da tela podem representar a janela movel das ultimas 24h
- os graficos temporarios do PDF devem ser reconstruidos com os dados filtrados da data consultada
- minima, maxima e media do grafico devem usar exatamente os mesmos valores validos usados pelos cards e tabelas

Contrato por aba:

- Estacao: resumo com cards contextuais de Estacao do ano e Fase da lua usando rotulos proprios de detalhe, alem dos 6 cards globais exibidos na aba (AQI estimado, Temp. Sala, Temp. Quarto, Temp. Aquario, Umidade Sala e Umidade Quarto), graficos de Temperatura por Ambiente, Umidade por Ambiente e Ciclo solar; sem tabela.
- Sala: cards de temperatura, sensacao termica, umidade e pressao; graficos de Temperatura x Sensacao, Umidade e Pressao; tabela MQ135 com CO, CO2, Acetona, Alcool, Amonia e Tolueno.
- Quarto: cards de temperatura, sensacao termica e umidade; graficos de Temperatura x Sensacao e Umidade; tabela com Temperatura, Sensacao termica e Umidade.
- Aquario: cards, graficos e tabela de Temperatura, PH, TDS e Turbidez; nao deve incluir card ou grafico de ciclo solar.

Regras da tabela:

- PDF usa tabela resumida com uma linha por horario
- status geral e `Alerta` se qualquer indicador daquele horario estiver em alerta
- status geral e `Estavel` se todos os indicadores daquele horario estiverem estaveis
- JSON inclui `tabelaResumida` com uma linha por horario e `tabelaDetalhada` com `Horario`, `Indicador`, `Valor` e `Status`
- JSON mantem `tabela` como alias de compatibilidade da tabela detalhada antiga
- html2canvas e jsPDF devem ser carregados sob demanda somente quando o usuario exportar PDF
- exportacao JSON nao deve carregar html2canvas nem jsPDF

Regras de layout:

- relatorio deve usar largura menor que a pagina A4 util para evitar cortes laterais
- primeira pagina deve conter resumo executivo util, sem area vazia grande
- graficos e tabela devem iniciar em paginas proprias
- graficos devem ser renderizados em uma coluna compacta no PDF A4 retrato
- pagina de graficos deve respeitar o contrato da aba ativa
- html2canvas deve usar as dimensoes reais do relatorio renderizado
- jsPDF deve montar as paginas manualmente, adicionando cabecalho, resumo e graficos como blocos inteiros
- somente a tabela longa pode ser fatiada entre paginas

Impacto: relatorio/dados exportados para Estacao, Sala, Quarto e Aquario.

Dependencias: URLs de `html2canvas` e `jsPDF` em `AppConfig.firebase`, `ClimateData`, `ClimateSolar`, `AppConfig`, `window.ClimatePdfReportModules` e dados ja carregados pelo Firebase.

Se alterada: exportacao pode reconsultar dados indevidamente, perder graficos, gerar layout quebrado ou falhar no download.

Criticidade: Alta.

## Regra: dados ausentes na exportacao

Arquivos: `scripts/reports/pdf-report.js` e `scripts/reports/pdf-report-*.js`

Metodo: `construirFonteDadosRelatorio`, `construirLinhasNormalizadas`, `emptySummary` e `createTableSection`

Objetivo: manter a geracao da exportacao mesmo sem dados, sem sensor ou sem grafico.

Entradas: valores ausentes, canvas ausente ou data sem registros.

Saidas: texto `Sem dados de <tipo_grafico> em <data>` nos graficos e `Sem dados`/`Sem dados disponíveis` nos resumos e tabelas.

Regras de normalizacao:

- `null`, `undefined` e strings vazias representam dado ausente e nunca podem virar zero
- series de graficos preservam ausencias como `null`, produzindo lacunas
- media, minima e maxima ignoram valores ausentes
- se houver apenas uma medicao valida, o grafico deve conter apenas esse ponto e as estatisticas devem usar somente esse valor
- para a data atual sem eventos solares processados, o PDF pode exibir `Ciclo solar ainda nao processado para hoje.`; a ausencia antes do processamento diario nao e falha do ciclo solar

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
- enquanto o painel estiver aberto, a rolagem da pagina de fundo deve ficar travada e a rolagem deve acontecer somente dentro da area de mensagens do chat
- no primeiro clique, a fachada deve carregar os modulos, inicializar a UI e abrir o painel automaticamente; nao pode exigir segundo clique

Regra de contexto:

- o chat deve usar a IA primeiro para classificar a intencao em JSON e depois usar JavaScript para buscar e calcular os dados
- depois da classificacao, `assistant-planner.js` deve transformar a intencao bruta em plano de consulta confiavel antes de `assistant-query.js` executar a busca
- o chat deve manter memoria curta da ultima resposta valida, incluindo ambiente, metricas, operacao e periodo; perguntas de continuidade como `e no quarto?`, `e ontem?` ou `e a umidade?` podem herdar somente os campos ausentes da pergunta anterior
- a IA nao deve calcular media, maxima, minima, delta, tendencia, dia mais frio/quente ou comparacoes; esses valores devem ser calculados no codigo
- a resposta final da IA deve receber apenas o resultado estruturado calculado pelo JavaScript
- o chat deve enviar ao modelo apenas uma classificacao curta ou o resultado calculado, nunca o historico completo do Firebase
- nao enviar historicos completos, paths inteiros do Firebase, credenciais ou dados que nao sejam necessarios para responder
- quando nao houver dado suficiente, a resposta deve informar que nao ha dados carregados para a pergunta
- se a pergunta nao mencionar Sala, Quarto ou Aquario, usar a aba ativa como ambiente alvo
- se a pergunta nao mencionar ambiente, mas mencionar AQI, IAQ, qualidade do ar, CO, CO2, Acetona, Alcool, Amonia ou Tolueno, usar Sala/MQ135 como ambiente alvo
- se o ambiente classificado nao possuir a metrica pedida e essa metrica existir em apenas outro ambiente, usar o ambiente que possui a medicao em vez de cair na metrica padrao
- se a pergunta mencionar Sala, Quarto ou Aquario, usar o ambiente mencionado como alvo, mesmo que a aba ativa seja outra
- perguntas sobre `ultimas X horas` ou `ultimas Xh` devem usar janela movel real com `ClimateData.filterDataByRollingHours`, data selecionada e hora atual do navegador; o limite e 30 dias convertidos em horas
- periodos em horas nao devem ser tratados como `hoje`, nem como `ultimos dias`
- se a pergunta nao mencionar data, usar a data selecionada no calendario da pagina
- se a pergunta mencionar data em `DD/MM/AAAA`, `DD-MM-AAAA`, `hoje`, `ontem` ou `anteontem`, usar essa data como alvo sem alterar o calendario da pagina
- se a pergunta mencionar hora como `14h`, `14:00` ou `14`, o chat deve filtrar a hora correspondente e comparar corretamente com chaves Firebase no formato `14-00`
- se houver filtro por hora, a resposta deve ser direta e conter somente o valor da metrica, ambiente, data e hora; nao deve exibir resumo do dia nem numero de amostras
- media deve retornar somente a media e o periodo; maxima/minima devem retornar somente o extremo pedido com data/hora; delta deve retornar valor inicial, valor final e diferenca; tendencia deve retornar classificacao, valor inicial, valor final e diferenca
- se a pergunta pedir valor atual/agora/ultima medicao, ou perguntar de forma simples `qual o/a <metrica>` sem solicitar media, maxima, minima, tendencia, faixa ou periodo inteiro, o chat deve retornar a ultima medicao disponivel da metrica no recorte consultado; essa regra vale para qualquer metrica conhecida, incluindo temperatura, sensacao termica, umidade, pressao, pH, TDS, turbidez e gases da Sala
- se a pergunta mencionar faixa horaria como `entre 8h e 18h`, `das 8 as 18` ou `de 8h a 18h`, o chat deve considerar somente registros dentro da faixa, incluindo as horas inicial e final
- se a pergunta comparar dias mencionados, como `ontem ou hoje`, `ontem e anteontem`, `maior que hoje` ou `mais quente que hoje`, o planner deve usar operacao `comparar_dias` e a resposta deve informar o dia com maior media diaria, o valor do dia comparado e a diferenca
- se a pergunta pedir o horario/periodo de maior ou menor valor, como `qual horario foi mais quente?`, `qual horario teve maior umidade?` ou `qual periodo do dia teve menor pressao?`, o JavaScript deve calcular o maior/menor valor medio por horario e enviar apenas esse resultado estruturado para a redacao da IA
- se a pergunta pedir o dia do mes de maior/menor valor, o chat deve consultar o mes completo da data selecionada e calcular o maior/menor valor medio diario
- se a pergunta pedir a hora que costuma ter maior/menor valor, o chat deve agrupar os registros por hora do dia no periodo resolvido; quando a pergunta usar `costuma`, o periodo padrao e o mes da data selecionada
- se a pergunta pedir dia/hora da semana ou pico semanal, o chat deve usar a semana da data selecionada, de domingo ate a data selecionada, e calcular o maior/menor valor medio por celula dia da semana/hora
- `ultimos X dias` deve reconhecer quantidades em algarismos ou por extenso e terminar na data selecionada no calendario; sem quantidade explicita usa 7 dias por padrao
- periodos devem ser limitados a 30 dias; quando o usuario pedir mais, a resposta deve informar a quantidade solicitada e o limite aplicado
- na aba Estacao, os atalhos devem usar contexto global em vez da metrica solar padrao: Resumo consulta os ambientes disponiveis, Alertas verifica faixas dos ambientes fisicos e Maxima do dia usa temperatura explicitamente
- a classificacao de intencao pode retornar `ambientes`, `metricas`, `operacao`, `periodo`, `criterio`, `confianca`, `precisa_esclarecimento` e `solar`, mas nao deve receber historico completo nem responder a pergunta do usuario
- as regras de ambiente e data valem para media, maxima, minima, delta, tendencia e qualquer parametro carregado no ambiente alvo
- perguntas de ciclo solar devem usar `latestData.solar` e `ClimateSolar.getSolarEventsForSelectedDate`, sem duplicar leitura manual dos campos solares no chat
- perguntas de comparacao solar devem usar `assistant-solar.js` sobre os eventos ja parseados por `ClimateSolar.getSolarEventsForSelectedDate`; duracao do dia usa nascer ate por do sol, maior/menor duracao de luz usa o ano da data selecionada por padrao, usa o mes quando um mes for informado e usa o intervalo integral quando duas datas delimitarem explicitamente o periodo
- intervalo explicito em pergunta de maior/menor duracao solar tem prioridade sobre o ano ou mes padrao, aceita ate 367 datas inclusivas e nao pode ser reclassificado como `comparar_dias`
- resultados solares analiticos devem ser compactados antes da redacao pela IA, preservando periodo, melhor resultado e ranking sem enviar listas extensas de datas que possam ocultar o resultado por truncamento
- termos como `tempo de luz`, `luz solar`, `duracao de luz`, `duracao do dia`, `dia mais longo` e `dia mais curto` devem ser tratados como intencao solar de duracao do dia
- quando houver intencao solar, o chat deve forcar a metrica `ciclo_solar`, mesmo que a classificacao da IA retorne outra metrica por engano
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
- Ordem de scripts em `index.html`; os scripts externos podem usar `defer`, mas a sequencia relativa deve ser preservada.
- Contrato de fallback em `ClimateCharts.createLineChart`.
- Exportacao PDF/JSON deve reutilizar `latestData` sem reconsultar Firebase, mas deve reconstruir seus graficos a partir da fonte normalizada filtrada por `selectedDate`; nao deve reutilizar `chartInstances` da interface.
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

Nenhum codigo morto de runtime confirmado na varredura atual.

Observacao: existem copias legadas de alguns scripts diretamente em `scripts/` (`scripts/analytics.js`, `scripts/aqi.js`, `scripts/chart-utils.js`, `scripts/solar.js`, `scripts/ui.js`, `scripts/zoom.js`, `scripts/pdf-report.js`, `scripts/ai-service.js` e similares). A aplicacao atual, conforme `index.html`, carrega os modulos organizados em subpastas (`scripts/data/`, `scripts/charts/`, `scripts/ui/`, `scripts/reports/`, `scripts/assistant/`, etc.). Esses arquivos legados nao participam do runtime atual, mas ainda sao validados pelo `tools/validate-project.mjs`; antes de remover ou sincronizar, revisar historico/compatibilidade do projeto.

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
