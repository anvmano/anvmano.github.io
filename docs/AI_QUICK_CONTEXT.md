# AI_QUICK_CONTEXT

## O que e o sistema

Dashboard web estatico de estacao climatica. Exibe uma aba global Estacao, alem de Sala, Quarto, Aquario e eventos solares. A interface tem abas, navegacao por swipe touch entre abas, seletor global de data, graficos, estatisticas, heatmaps, tabelas colapsaveis, zoom de graficos, indicador de estacao do ano, indicador AQI estimado da Sala, indicador astronomico no header, indicador de fase da lua, chat com Firebase AI Logic e atalhos de perguntas, alem de exportacao PDF/JSON da aba ativa.

O site possui modo publico sem login e modo interno com Google Firebase Auth. Sem login, ou com usuario nao autorizado, a pagina mostra clima por CEP/localizacao do navegador usando APIs externas. Somente `anvmano@gmail.com` e `clarissamikado@gmail.com` acessam o dashboard interno completo, listeners Firebase internos, exportacao interna e assistente IA.

## Tecnologias

- HTML, CSS e JavaScript puro.
- Scripts classicos com modulos globais em `window.*`.
- Chart.js `4.5.1` via CDN, carregado sob demanda antes do primeiro grafico real.
- html2canvas `1.4.1` e jsPDF `2.5.2` via CDN para exportacao PDF, carregados sob demanda somente ao exportar PDF.
- Exportacao JSON usa Blob nativo do navegador, sem biblioteca externa.
- Firebase SDK modular `12.13.0` carregado dinamicamente.
- Firebase Auth com login Google opcional.
- Firebase Realtime Database.
- Firebase App Check com reCAPTCHA Enterprise.
- Firebase AI Logic com Gemini Developer API.
- Google Fonts.
- APIs publicas externas: BrasilAPI/ViaCEP para CEP, Open-Meteo Forecast, Open-Meteo Air Quality e Open-Meteo Geocoding.
- Sem React, Vue, Angular, .NET, SQL ou Arduino no projeto analisado.
- `npm run validate` executa uma checagem estrutural local sem dependencias externas.

## Arquitetura Resumida

Arquivos principais:

- `index.html`: estrutura DOM, ordem dos scripts e carregamento `defer` dos scripts externos.
- `scripts/config.js`: Firebase, paths, ids, cores, campos, unidades e diagnostico leve de console.
- `scripts/runtime-loader.js`: carregador leve para recursos sob demanda, como Chart.js, CSS de zoom/relatorio, modulos de PDF e modulos da assistente.
- `scripts/main.js`: orquestrador da aplicacao.
- `scripts/firebase-service.js`: conexao e listeners Firebase.
- `scripts/auth/auth-service.js`: Firebase Auth, login/logout Google e verificacao de usuarios internos autorizados.
- `scripts/external/browser-location-service.js`: leitura opcional de localizacao do navegador, somente em memoria.
- `scripts/external/external-weather-service.js`: CEP, geocodificacao e clima/AQI externos via APIs publicas.
- `scripts/chat.js`: fachada publica leve do chat, mantendo `window.ClimateChat` e carregando `scripts/assistant/*` somente ao abrir a assistente.
- `scripts/assistant/`: modulos da assistente e IA.
- `scripts/assistant/ai-service.js`: inicializacao do Firebase AI Logic.
- `scripts/assistant/assistant-ui.js`: UI do chat.
- `scripts/assistant/assistant-intent.js`: classificacao de intencao, datas, horas e ambiente.
- `scripts/assistant/assistant-planner.js`: normalizacao final da intencao em plano de consulta antes da execucao.
- `scripts/assistant/assistant-query.js`: execucao das consultas e redacao/fallback.
- `scripts/assistant/assistant-metrics.js`: metricas numericas, estatisticas, comparacoes e faixa de conforto.
- `scripts/assistant/assistant-solar.js`: consultas solares do chat.
- `scripts/assistant/assistant-aqi.js`: consultas de AQI/qualidade do ar do chat.
- `scripts/assistant/assistant-config.js`: constantes, ambientes, metricas e aliases.
- `scripts/assistant/assistant-format.js`: formatacao e normalizacao compartilhada.
- `scripts/data/data-utils.js`: datas, filtros, tabelas e series.
- `scripts/charts/chart-utils.js`: Chart.js comum e faixa de conforto.
- `scripts/charts/aqi.js`: AQI estimado da Sala/MQ135, chip do header e popover.
- `scripts/charts/season.js`: estacao do ano atual, chip do header, popover, posicao na faixa anual e progresso dentro da estacao atual.
- `scripts/charts/moon.js`: fase da lua, chip do header, popover e estado lunar por data.
- `scripts/data/analytics.js`: estatisticas e heatmaps.
- `scripts/charts/solar.js`: regras e graficos solares.
- `scripts/ui/ui.js`: tabs, swipe touch entre abas, date picker, mensagens, colapsaveis.
- `scripts/charts/zoom.js`: zoom dos graficos.
- `scripts/reports/pdf-report.js`: fachada publica leve da exportacao PDF/JSON; carrega os modulos internos somente ao exportar.
- `scripts/reports/pdf-report-*.js`: modulos internos de configuracao, formatacao, dados, DOM, graficos, PDF e exportacao.
- `styles/reports/pdf-report.css`: visual do relatorio PDF.
- `scripts/views/estacao-view.js`, `scripts/views/quarto-view.js`, `scripts/views/sala-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`: renderizacao por dominio.
- `scripts/views/public-weather-view.js`: modo publico por CEP/localizacao, com cards e graficos externos.
- `tools/validate-project.mjs`: valida sintaxe JS, referencias locais, imports CSS e contratos HTML/config.

## Fluxo Principal

1. HTML carrega scripts essenciais em ordem e mantem fachadas leves para chat e exportacao.
2. `scripts/main.js` valida todos os objetos globais.
3. No `DOMContentLoaded`, inicializa chips globais do header, view publica e Firebase Auth.
4. Se nao houver usuario interno autorizado, mostra `#publicApp`, oculta `#privateApp` e nao inicia listeners internos nem assistente IA.
5. Se o usuario for `anvmano@gmail.com` ou `clarissamikado@gmail.com`, mostra o dashboard interno, inicializa abas/date picker/zoom/exportacao/chat e agenda Firebase.
6. `FirebaseService.initialize()` importa SDK Firebase e cria app/database; App Check/reCAPTCHA fica sob demanda para recursos protegidos, como a IA.
7. `FirebaseService.listenToPath()` escuta no modo interno:
   - `historico/Temperatura`
   - `historico/NascePorDoSol`
   - `historico/Aquario`
   - `historico/AirQuality`
8. Dados internos sao armazenados em `latestData`.
9. Views filtram pela data selecionada e renderizam estatisticas/tabelas imediatamente; graficos carregam Chart.js antes do primeiro desenho real.
10. No modo publico, CEP/localizacao consulta APIs externas e renderiza temperatura, sensacao termica, umidade, pressao, AQI externo, estacao do ano, fase da lua e graficos de temperatura, sensacao, umidade, pressao e ciclo solar. Os graficos publicos de temperatura, sensacao, umidade e pressao usam janela movel das ultimas 24h, terminando na data/hora retornada pela localizacao consultada. O card publico da fase da lua segue o mesmo contrato visual do card interno: fase, iluminacao, idade, proxima cheia e proxima nova, usando a data/hora retornada para a localizacao consultada quando disponivel.

## Componentes Criticos

- `scripts/config.js`: se ids ou paths mudarem aqui, as views e listeners mudam.
- `scripts/main.js`: controla listeners e rerender por data.
- `scripts/data/data-utils.js`: define formato esperado de datas e estrutura dos dados.
- `scripts/charts/chart-utils.js`: cria graficos comuns e fallback de grafico vazio.
- `scripts/data/analytics.js`: calcula media/min/max/delta/tendencia e heatmaps.
- `scripts/charts/solar.js`: le campos solares e calcula zenite se ausente.

## Onde Estao as Coisas

- Firebase config e paths: `scripts/config.js`.
- Campos dos sensores: `scripts/config.js` em `fields`.
- Unidades das tabelas: `scripts/config.js` em `measurementUnits`.
- Sala/MQ135 usa `CO`, `CO2`, `Aceton`, `Alcohol`, `NH4` e `Toluen`; `Toluen` e exibido como Tolueno.
- Sala: `scripts/views/sala-view.js`.
- Quarto: `scripts/views/quarto-view.js`.
- Aquario: `scripts/views/aquario-view.js`.
- Solar: `scripts/charts/solar.js` e `scripts/views/solar-view.js`.
- Tabelas: `scripts/data/data-utils.js` + views.
- Heatmaps: `scripts/data/analytics.js`; containers em `index.html`; ids em `scripts/config.js`.
- Zoom: `scripts/charts/zoom.js`; em dispositivos touch, toque dentro do canvas ampliado interage com o tooltip e nao fecha o overlay.
- PDF: `scripts/reports/pdf-report.js`, `scripts/reports/pdf-report-*.js` e `styles/reports/pdf-report.css`.
- Abas e date picker: `scripts/ui/ui.js`.
- Login Google e fluxo publico/interno: `scripts/auth/auth-service.js`, `scripts/views/public-weather-view.js`, `scripts/external/*` e `scripts/main.js`.
- Estilo visual: `style.css` importa os arquivos em `styles/`.

## Fluxos Criticos

- Data do input: `YYYY-MM-DD`.
- Data Firebase: `DD-MM-AAAA`.
- Dados por data/hora: `historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>`.
- Graficos comuns usam `ClimateData.extractData`.
- Graficos comuns de Sala, Quarto e Aquario usam janela movel das ultimas 24h pela hora atual do navegador. Se a data selecionada for `DD-MM-AAAA` e agora for 15h, a janela vai de 15h do dia anterior ate 15h da data selecionada.
- Chart.js nao e carregado no HTML inicial. Quando uma view encontra dados para grafico e `window.Chart` ainda nao existe, mostra `Carregando grafico...`, carrega Chart.js por `ClimateAssets.carregarChart()` e redesenha a data selecionada.
- Se grafico comum nao tem pontos numericos, `ClimateCharts.createLineChart` limpa o canvas, retorna `null` e o caller mostra mensagem no card.
- Cada id em `AppConfig.ids.chartContainers` deve existir no `.chart-card` individual correspondente.
- Tabelas mostram ate 24 linhas.
- Cards e tabelas continuam filtrados pela data selecionada, mesmo quando os graficos usam a janela movel de 24h.
- Valores das tabelas exibem unidades sem espaco antes da unidade, como `26.40°C`, `57.50%`, `8.66ppm`, `1.20NTU` e `930.60hPa`.
- Leituras do Aquario sao normalizadas em `ClimateData.normalizeMeasurementValue`: TDS divide por 10 e Turbidez divide por 1000 antes de tabelas, cards, graficos e PDF.
- Faixa de conforto geral: 20°C a 26°C; umidade usa 40% a 60%; Aquario usa faixa propria de 25°C a 27°C.
- Graficos com faixa de conforto devem priorizar a variacao medida na escala Y com `min/max` derivados dos dados validos; `null`/vazio nao pode virar zero na escala.
- Horarios exibidos em graficos comuns, tabelas e tooltips seguem formato digital com dois digitos (`HH:mm`).
- O eixo X do grafico Ciclo Solar do Dia usa formato abreviado em horas (`0h`, `2h`, `4h`, `24h`) para manter paridade com o projeto C#/.NET.
- Eixo Y dos graficos deve exibir a unidade da metrica quando houver: `°C`, `%`, `hPa`, `ppm`, `NTU`.
- Graficos comuns de series temporais usam horarios no eixo X em diagonal; graficos solares e heatmaps preservam seu layout especifico.
- Zoom de graficos: duplo clique ou botao amplia; `Esc`, botao de fechar ou clique/toque no fundo do overlay fecha. Em mobile/touch, `pointerdown`/`touchstart` dentro do canvas ampliado nao fecha o overlay para preservar tooltip e leitura do dado.
- Mensagens de graficos vazios devem seguir `Sem dados de <tipo_grafico> em <DD/MM/AAAA>`.
- Aba ativa e persistida em `localStorage.activeTab`.
- Swipe touch segue o fluxo Estacao ⇄ Sala ⇄ Quarto ⇄ Aquario. Arrastar para esquerda avanca; arrastar para direita volta; extremidades nao mudam de aba. Gestos iniciados em tabelas, heatmaps ou qualquer area com rolagem horizontal nao trocam de aba.
- A aba Estacao e a visao global do sistema: mostra faixa das estacoes do ano, fase da lua da data selecionada, cards globais, graficos comparativos de temperatura/umidade por ambiente e graficos solares. A faixa das estacoes usa a data atual do navegador, nao a data selecionada no calendario, e o marcador progride por segmento visual de estacao: Verao 0-25%, Outono 25-50%, Inverno 50-75%, Primavera 75-100%. No PDF, o card de Estacao do ano mostra o progresso dentro da estacao atual, nao a posicao anual da barra. O resumo global da Estacao nasce com placeholders/altura reservada para reduzir CLS enquanto os dados Firebase chegam.
- O header exibe os chips na ordem Estacao do ano, AQI, ciclo solar, fase da lua e relogio. Os chips de Estacao do ano, AQI, ciclo solar e fase da lua devem manter apenas o icone/estado visual dentro do pill; descricoes, valores e classificacoes ficam no `title`/`aria-label` e popover. Em mobile, o relogio e a marca `Estacao Climatica` podem ser ocultados e os chips principais devem ocupar toda a largura util do header.
- Indicador astronomico do header e um chip visual no tamanho aproximado do relogio, sem texto interno; o tooltip/`aria-label` mostra nascer e por do sol. Clique/toque abre popover com amanhecer, nascer do sol, zenite, por do sol, anoitecer, estado atual e duracao do dia. No modo interno usa `historico/NascePorDoSol`; no modo publico usa os eventos solares da localizacao/CEP consultado pela Open-Meteo. Antes de uma localizacao publica ser consultada, deve ficar em estado aguardando e orientar CEP/localizacao, sem usar fallback interno como se fosse dado real.
- Indicador AQI do header tem dois modos. No dashboard interno usa dados mais recentes da Sala/MQ135 em `historico/AirQuality` e deve aparecer como `AQI estimado da Sala`. No modo publico usa o AQI externo da localizacao/CEP consultado e deve aparecer como `AQI externo`, sem mencionar Sala ou MQ135. O valor nao fica visivel dentro do chip, mas permanece no tooltip/`aria-label` e no popover aberto por clique/toque. O chip usa um mini medidor visual colorido, com posicao do ponteiro derivada da classificacao AQI.
- Indicador de estacao do ano usa `scripts/charts/season.js`, mostra apenas a animacao sazonal dentro do chip e usa tooltip/popover com inicio das estacoes do ciclo atual.
- Indicador de fase da lua usa `scripts/charts/moon.js`, calcula localmente a fase sem API externa, mostra apenas a animacao lunar dentro do chip e abre popover com iluminacao, idade lunar, proxima cheia e proxima nova. O icone lunar deve diferenciar crescente e minguante pelo lado sombreado. O `title` deve ficar limpo com a descricao completa, enquanto o `aria-label` preserva a informacao textual necessaria. Na aba Estacao, o bloco lunar usa a data selecionada no calendario.
- Popovers do header sao mutuamente exclusivos: abrir Estacao do ano, AQI, Solar ou Lua fecha os demais.
- AQI interno do header e uma estimativa local: usa categorias oficiais AQI (`0-50`, `51-100`, `101-150`, `151-200`, `201-300`, `301+`), mas o calculo vem dos gases disponiveis no MQ135 e deve ser exibido como `AQI estimado da Sala`. AQI publico vem da Open-Meteo Air Quality e deve ser exibido como `AQI externo`.
- Solar usa data selecionada para ciclo do dia e filtro de 365 dias para historico.
- Exportacao PDF/JSON usa automaticamente aba ativa, data selecionada, `latestData` e `chartInstances`; nao reconsulta Firebase.
- Exportacao PDF/JSON interna so e inicializada para usuarios internos autorizados.
- Controle `PDF/JSON` em `name="exportFormat"` altera a label do botao `#btnExportData`.
- A fachada `ClimatePdfReport` fica carregada no inicio, mas os modulos `scripts/reports/pdf-report-*` so entram no clique de exportacao. Exportacao JSON carrega somente os modulos de relatorio; PDF tambem carrega CSS do relatorio, Chart.js, html2canvas e jsPDF sob demanda.
- Bibliotecas de PDF (`html2canvas` e `jsPDF`) sao carregadas sob demanda apenas quando o formato PDF e executado; exportacao JSON nao deve carregar essas dependencias.
- PDF usa primeira pagina como resumo executivo, com metadados, cards principais e alertas do dia.
- PDF junta Temperatura e Sensacao termica no mesmo grafico quando a aba possui as duas metricas.
- PDF usa contrato por aba: Estacao mostra no resumo os cards contextuais de Estacao do ano e Fase da lua com rotulos proprios de detalhe, alem dos 6 cards globais da propria aba (AQI estimado, Temp. Sala, Temp. Quarto, Temp. Aquario, Umidade Sala e Umidade Quarto), graficos comparativos de temperatura/umidade por ambiente e ciclo solar, sem tabela; Sala mostra temperatura, sensacao, umidade e pressao, mas tabela MQ135; Quarto mostra temperatura, sensacao e umidade; Aquario mostra apenas temperatura, PH, TDS e Turbidez, sem ciclo solar.
- PDF renderiza o ciclo solar compacto em um Chart.js offscreen a partir de `$solarDayTimes`, usando `ClimateSolar.getSolarTodayOptions` e `solarDayBackgroundPlugin` para manter o visual da pagina sem depender de canvas oculto ou vazio da interface.
- PDF usa tabela resumida por horario, com status geral por linha. JSON exporta `resumo` com `detalhes`, `tabelaResumida`, `tabelaDetalhada`, `dadosBrutos` e mantem `tabela` como alias de compatibilidade para a tabela detalhada antiga.
- PDF e montado manualmente em paginas A4; resumo, graficos e tabela iniciam em paginas proprias, com rodape em todas as paginas.
- Chat usa `latestData`, aba ativa, data selecionada e intenção classificada para selecionar dados. Nao envia o Firebase inteiro ao modelo.
- Chat/assistente IA e exclusivo para usuarios internos autorizados. No modo publico, `#aiChat` fica oculto e `ClimateChat.setup` nao e chamado.
- `scripts/chat.js` carrega a assistente real sob demanda no primeiro clique do botao. Antes disso, os modulos `scripts/assistant/*` e o Firebase AI Logic nao entram na carga inicial.
- Chat tem atalhos em `data-chat-question`; eles reutilizam o mesmo fluxo de envio da pergunta digitada.
- Chat abre e fecha com transicao gradual em `styles/chat.css`; `scripts/assistant/assistant-ui.js` so aplica `hidden` depois da animacao de fechamento. Quando aberto, clique/toque fora de `#aiChat` fecha o painel, preservando cliques dentro do chat. A rolagem da pagina de fundo fica travada enquanto o chat esta aberto; apenas a area `#aiChatMessages` deve rolar.
- Chat resolve intencao antes de responder: ambiente mencionado vence a aba ativa; data/periodo mencionado vence o calendario sem alterar a pagina; se ambiente/data nao forem mencionados, usa aba ativa e calendario.
- Chat usa `assistant-planner.js` entre classificacao e consulta para corrigir/normalizar a intencao em um plano confiavel. Essa camada deve concentrar defesas de interpretacao, como forcar ciclo solar em perguntas de dia mais longo/curto e transformar perguntas simples de valor em `ultima_medicao`.
- Chat possui memoria curta em `assistant-ui.js`: apos uma resposta valida, guarda ambiente, metricas, operacao e periodo resolvidos. Perguntas de continuidade como `e no quarto?`, `e ontem?` ou `e a umidade?` podem herdar partes faltantes da pergunta anterior via `assistant-planner.js`.
- Chat reconhece metricas exclusivas de ambiente: perguntas sobre AQI/IAQ/qualidade do ar, CO, CO2, Acetona, Alcool, Amonia ou Tolueno consultam a Sala/MQ135 quando nenhum ambiente e informado, mesmo se a aba ativa for Quarto ou Aquario. Se um ambiente classificado nao tiver a metrica pedida e a metrica existir em apenas outro ambiente, o chat usa o ambiente que possui a medicao.
- Chat calcula AQI estimado reutilizando `ClimateAqi.calculate` sobre o recorte de data/hora consultado; a resposta pode incluir AQI, classificacao, impacto, dominante e subindices principais.
- Chat aceita filtro por hora em perguntas como `14h`, `14:00`, `14` e tambem compara corretamente com chaves Firebase no formato `14-00`.
- Quando a pergunta filtra uma hora especifica, o chat deve responder somente o dado necessario daquela hora, sem resumo de media/minima/maxima/delta do dia e sem numero de amostras.
- Quando a pergunta pedir valor atual/agora/ultima medicao, ou perguntar de forma simples `qual o/a <metrica>` sem pedir media, maxima, minima, tendencia, faixa ou periodo inteiro, o chat deve retornar a ultima medicao disponivel da metrica no recorte consultado. Isso vale para qualquer metrica conhecida, como temperatura, sensacao termica, umidade, pressao, pH, TDS, turbidez e gases da Sala.
- Chat aceita faixa horaria em perguntas como `entre 8h e 18h`, `das 8 as 18` ou `de 8h a 18h`; os calculos de media/maxima/minima/delta/tendencia devem considerar somente registros dentro dessa faixa, inclusive as horas inicial e final.
- Chat entende comparacoes simples entre dias mencionados, como `ontem ou hoje`, `ontem e anteontem`, `maior que hoje` ou `mais quente que hoje`, e deve retornar o dia com maior media diaria, o valor do dia comparado e a diferenca.
- Chat responde analise por horario para perguntas como `qual horario foi mais quente?`, `qual horario teve maior umidade?` ou `qual periodo do dia teve menor pressao?`, calculando localmente o maior/menor valor medio por horario antes da redacao da IA.
- Chat responde consultas equivalentes aos heatmaps: `qual dia do mes foi mais quente?` usa o calendario mensal da data selecionada; `qual hora costuma ser mais fria?` agrega por hora do dia no mes selecionado; `qual dia/hora da semana teve pico?` usa a semana da data selecionada, de domingo ate a data selecionada.
- Chat responde perguntas de faixa/status/conforto para metricas com faixa configurada: temperatura/sensacao usam 20°C a 26°C, umidade usa 40% a 60%, e temperatura do Aquario usa 25°C a 27°C. A resposta calculada deve informar se ficou dentro/fora da faixa, faixa usada, quantidade de horarios fora e pior horario fora da faixa.
- Chat entende `ultimas 24 horas`/`ultimas 24h` como janela movel real, reutilizando `ClimateData.filterDataByRollingHours` com a data selecionada e a hora atual do navegador; nao deve tratar isso como `hoje` nem como `ultimos dias`.
- Chat usa arquitetura em etapas: Gemini classifica a pergunta em JSON com schema fixo; JavaScript transforma a intencao em plano de consulta, valida, limita periodo, seleciona dados e calcula media/maxima/minima/delta/tendencia/comparacoes; Gemini redige a resposta usando apenas o resultado calculado.
- Chat responde perguntas de ciclo solar usando `ClimateSolar.getSolarEventsForSelectedDate` sobre `latestData.solar`, reutilizando aliases solares e fallback de zenite do modulo solar.
- Chat responde comparacoes solares: duracao do dia, maior/menor duracao de luz no ano da data selecionada por padrao, maior/menor duracao de luz no mes quando um mes for informado, tendencia de nascer do sol/por do sol na semana selecionada e comparacao de nascer/por do sol por dia no periodo.
- Termos como `tempo de luz`, `luz solar`, `duracao de luz`, `duracao do dia`, `dia mais longo` e `dia mais curto` devem ser tratados como consulta solar de duracao do dia.
- Quando a pergunta tiver intencao solar, o chat deve forcar metrica `ciclo_solar`, mesmo se a classificacao da IA sugerir outra metrica por engano.
- Periodos suportados incluem data unica, hoje, ontem, anteontem, datas relativas, intervalo, ultimas 24h reais, ultimos dias, mes selecionado, semana selecionada e ano selecionado para consultas solares anuais. `Ultimos dias` usa 7 dias por padrao e consultas de periodo sao limitadas a 30 dias, exceto calendario mensal que pode consultar o mes completo e comparacoes solares anuais que podem consultar o ano inteiro.
- Heatmaps destacam contexto temporal com `.is-selected`: calendario mensal destaca o dia selecionado, heatmap horario destaca a hora atual quando a data selecionada e hoje, e mapa semanal destaca dia da semana/hora atual quando a data selecionada e hoje.
- O mapa semanal reinicia no domingo e considera apenas registros da semana da data selecionada, do domingo ate a data selecionada. Ele nao agrega semanas anteriores do mes.
- Heatmaps de Sala/Quarto so montam o DOM quando a secao `Visualizacoes Climaticas` esta expandida; a abertura do colapsavel dispara novo render da data selecionada.
- Heatmaps normalizam a data recebida para `DD-MM-AAAA` antes de filtrar registros. Falhas nas visualizacoes climaticas avancadas nao devem bloquear os graficos principais da aba.

## Arquivos Mais Importantes

1. `scripts/config.js`
2. `scripts/main.js`
3. `scripts/firebase-service.js`
4. `scripts/assistant/ai-service.js`
5. `scripts/chat.js` e `scripts/assistant/*`
6. `scripts/data/data-utils.js`
7. `scripts/charts/chart-utils.js`
8. `scripts/charts/aqi.js`
9. `scripts/charts/moon.js`
10. `scripts/data/analytics.js`
11. `scripts/charts/solar.js`
12. `index.html`
13. `style.css` e `styles/`
14. Views por aba

## Regras Importantes

- Nao mudar ordem dos scripts sem revisar dependencias globais. Os scripts externos do fim do `body` usam `defer`, preservando a mesma ordem para reduzir bloqueio de renderizacao.
- O modo publico deve funcionar sem login. Login Google e opcional; se o usuario logado nao for autorizado, continua no modo publico.
- O dashboard interno completo so deve iniciar para `AppConfig.auth.usuariosInternosAutorizados`.
- APIs externas nao substituem Firebase interno; elas servem apenas para o modo publico por CEP/localizacao.
- Localizacao do navegador nao deve ser persistida; usar apenas em memoria para a consulta atual.
- Nao renomear ids do HTML sem atualizar `scripts/config.js`.
- Nao renomear campos Firebase sem atualizar `scripts/config.js` e, para solar, `scripts/charts/solar.js`.
- Novos metodos, funcoes e variaveis internas devem seguir nomenclatura PT-BR. Excecoes: campos Firebase, ids/classes DOM, nomes exigidos por APIs externas, contratos publicos em `window.*`, opcoes de bibliotecas e propriedades estruturais ja consumidas por outros modulos.
- O Firebase e lido com `onValue` no path completo.
- App Check nao e inicializado no carregamento inicial nem em `localhost`, `127.0.0.1` ou `::1`; em producao, deve ser iniciado sob demanda antes de recursos protegidos como Firebase AI Logic.
- Logs de fallback esperado usam `window.ClimateDiagnostics` e ficam ocultos por padrao. Para depurar, use `?debug=1` na URL ou `localStorage.climateDebug = "1"`.
- Firebase AI Logic depende de App Check configurado no app web correto; enforcement deve ser ativado apenas depois de validar o token em producao.
- Zênite solar usa campos `HoraZenite` e `MinuteZenite` quando presentes; se nao houver, calcula meio entre nascer e por do sol.
- Aliases solares ficam centralizados em `SOLAR_FIELD_ALIASES`.

## Resumo para IA

Este projeto e um frontend estatico, sem framework, que depende de dados Firebase e de ids DOM centralizados. Para alterar uma aba, leia primeiro `scripts/config.js`, depois a view da aba, depois `scripts/data/data-utils.js` e `scripts/charts/chart-utils.js`/`scripts/data/analytics.js`. Para graficos solares, leia `scripts/charts/solar.js`. Toda alteracao deve preservar os objetos globais esperados por `scripts/main.js`. Ao criar ou refatorar codigo interno, prefira nomes em PT-BR e preserve apenas contratos externos ou nomes tecnicos obrigatorios.
