# AI_QUICK_CONTEXT

## O que e o sistema

Dashboard web estatico de estacao climatica. Exibe dados de Sala, Quarto, Aquario e eventos solares. A interface tem abas, navegacao por swipe touch entre abas, seletor global de data, graficos, estatisticas, heatmaps, tabelas colapsaveis, zoom de graficos, indicador AQI estimado da Sala, indicador astronomico no header, chat com Firebase AI Logic e atalhos de perguntas, alem de exportacao PDF/JSON da aba ativa.

O codigo nao define usuarios, autenticacao, permissoes ou backend local.

## Tecnologias

- HTML, CSS e JavaScript puro.
- Scripts classicos com modulos globais em `window.*`.
- Chart.js `4.5.1` via CDN.
- html2canvas `1.4.1` e jsPDF `2.5.2` via CDN para exportacao PDF.
- Exportacao JSON usa Blob nativo do navegador, sem biblioteca externa.
- Firebase SDK modular `12.13.0` carregado dinamicamente.
- Firebase Realtime Database.
- Firebase App Check com reCAPTCHA Enterprise.
- Firebase AI Logic com Gemini Developer API.
- Google Fonts.
- Sem React, Vue, Angular, .NET, SQL ou Arduino no projeto analisado.
- `npm run validate` executa uma checagem estrutural local sem dependencias externas.

## Arquitetura Resumida

Arquivos principais:

- `index.html`: estrutura DOM e ordem dos scripts.
- `scripts/config.js`: Firebase, paths, ids, cores, campos e unidades.
- `scripts/main.js`: orquestrador da aplicacao.
- `scripts/firebase-service.js`: conexao e listeners Firebase.
- `scripts/chat.js`: fachada publica do chat, mantendo `window.ClimateChat`.
- `scripts/assistant/`: modulos da assistente e IA.
- `scripts/assistant/ai-service.js`: inicializacao do Firebase AI Logic.
- `scripts/assistant/assistant-ui.js`: UI do chat.
- `scripts/assistant/assistant-intent.js`: classificacao de intencao, datas, horas e ambiente.
- `scripts/assistant/assistant-query.js`: execucao das consultas e redacao/fallback.
- `scripts/assistant/assistant-metrics.js`: metricas numericas, estatisticas, comparacoes e faixa de conforto.
- `scripts/assistant/assistant-solar.js`: consultas solares do chat.
- `scripts/assistant/assistant-aqi.js`: consultas de AQI/qualidade do ar do chat.
- `scripts/assistant/assistant-config.js`: constantes, ambientes, metricas e aliases.
- `scripts/assistant/assistant-format.js`: formatacao e normalizacao compartilhada.
- `scripts/data/data-utils.js`: datas, filtros, tabelas e series.
- `scripts/charts/chart-utils.js`: Chart.js comum e faixa de conforto.
- `scripts/charts/aqi.js`: AQI estimado da Sala/MQ135, chip do header e popover.
- `scripts/data/analytics.js`: estatisticas e heatmaps.
- `scripts/charts/solar.js`: regras e graficos solares.
- `scripts/ui/ui.js`: tabs, swipe touch entre abas, date picker, mensagens, colapsaveis.
- `scripts/charts/zoom.js`: zoom dos graficos.
- `scripts/reports/pdf-report.js`: fachada publica da exportacao PDF/JSON.
- `scripts/reports/pdf-report-*.js`: modulos internos de configuracao, formatacao, dados, DOM, graficos, PDF e exportacao.
- `styles/reports/pdf-report.css`: visual do relatorio PDF.
- `scripts/views/quarto-view.js`, `scripts/views/sala-view.js`, `scripts/views/aquario-view.js`, `scripts/views/solar-view.js`: renderizacao por dominio.
- `tools/validate-project.mjs`: valida sintaxe JS, referencias locais, imports CSS e contratos HTML/config.

## Fluxo Principal

1. HTML carrega scripts em ordem.
2. `scripts/main.js` valida todos os objetos globais.
3. No `DOMContentLoaded`, inicializa tabs, date picker, colapsaveis, zoom, chat, exportacao PDF/JSON e listeners Firebase.
4. `FirebaseService.initialize()` importa SDK Firebase, cria database e tenta inicializar App Check.
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
- Zoom: `scripts/charts/zoom.js`.
- PDF: `scripts/reports/pdf-report.js`, `scripts/reports/pdf-report-*.js` e `styles/reports/pdf-report.css`.
- Abas e date picker: `scripts/ui/ui.js`.
- Estilo visual: `style.css` importa os arquivos em `styles/`.

## Fluxos Criticos

- Data do input: `YYYY-MM-DD`.
- Data Firebase: `DD-MM-AAAA`.
- Dados por data/hora: `historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>`.
- Graficos comuns usam `ClimateData.extractData`.
- Graficos comuns de Sala, Quarto e Aquario usam janela movel das ultimas 24h pela hora atual do navegador. Se a data selecionada for `DD-MM-AAAA` e agora for 15h, a janela vai de 15h do dia anterior ate 15h da data selecionada.
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
- Mensagens de graficos vazios devem seguir `Sem dados de <tipo_grafico> em <DD/MM/AAAA>`.
- Aba ativa e persistida em `localStorage.activeTab`.
- Swipe touch segue o fluxo Sala ⇄ Quarto ⇄ Aquario. Arrastar para esquerda avanca; arrastar para direita volta; extremidades nao mudam de aba. Gestos iniciados em tabelas, heatmaps ou qualquer area com rolagem horizontal nao trocam de aba.
- Indicador astronomico do header e um chip visual no tamanho aproximado do relogio, sem texto interno; o tooltip/`aria-label` mostra nascer e por do sol. Clique/toque abre popover com amanhecer, nascer do sol, zenite, por do sol, anoitecer, estado atual e duracao do dia.
- Indicador AQI do header usa dados mais recentes da Sala/MQ135 em `historico/AirQuality` e mostra apenas `AQI <valor>` no chip. A classificacao completa fica no tooltip/`aria-label` e no popover aberto por clique/toque.
- Popovers do header sao mutuamente exclusivos: abrir AQI fecha o solar, abrir solar fecha o AQI.
- AQI do header e uma estimativa local: usa categorias oficiais AQI (`0-50`, `51-100`, `101-150`, `151-200`, `201-300`, `301+`), mas o calculo vem dos gases disponiveis no MQ135 e deve ser exibido como `AQI estimado da Sala`.
- Solar usa data selecionada para ciclo do dia e filtro de 365 dias para historico.
- Exportacao PDF/JSON usa automaticamente aba ativa, data selecionada, `latestData` e `chartInstances`; nao reconsulta Firebase.
- Controle `PDF/JSON` em `name="exportFormat"` altera a label do botao `#btnExportData`.
- PDF usa primeira pagina como resumo executivo, com metadados, cards principais e alertas do dia.
- PDF junta Temperatura e Sensacao termica no mesmo grafico quando a aba possui as duas metricas.
- PDF usa contrato por aba: Sala mostra cards/graficos de temperatura, sensacao, umidade, pressao e ciclo solar, mas tabela MQ135; Quarto mostra temperatura, sensacao, umidade e ciclo solar; Aquario mostra apenas temperatura, PH, TDS e Turbidez, sem ciclo solar.
- PDF renderiza o ciclo solar compacto em um Chart.js offscreen a partir de `$solarDayTimes`, usando `ClimateSolar.getSolarTodayOptions` e `solarDayBackgroundPlugin` para manter o visual da pagina sem depender de canvas oculto ou vazio da aba Quarto.
- PDF usa tabela resumida por horario, com status geral por linha; JSON preserva a tabela detalhada antiga.
- PDF e montado manualmente em paginas A4; resumo, graficos e tabela iniciam em paginas proprias, com rodape em todas as paginas.
- Chat usa `latestData`, aba ativa, data selecionada e intenção classificada para selecionar dados. Nao envia o Firebase inteiro ao modelo.
- Chat tem atalhos em `data-chat-question`; eles reutilizam o mesmo fluxo de envio da pergunta digitada.
- Chat abre e fecha com transicao gradual em `styles/chat.css`; `scripts/assistant/assistant-ui.js` so aplica `hidden` depois da animacao de fechamento. Quando aberto, clique/toque fora de `#aiChat` fecha o painel, preservando cliques dentro do chat.
- Chat resolve intencao antes de responder: ambiente mencionado vence a aba ativa; data/periodo mencionado vence o calendario sem alterar a pagina; se ambiente/data nao forem mencionados, usa aba ativa e calendario.
- Chat reconhece metricas exclusivas de ambiente: perguntas sobre AQI/IAQ/qualidade do ar, CO, CO2, Acetona, Alcool, Amonia ou Tolueno consultam a Sala/MQ135 quando nenhum ambiente e informado, mesmo se a aba ativa for Quarto ou Aquario. Se um ambiente classificado nao tiver a metrica pedida e a metrica existir em apenas outro ambiente, o chat usa o ambiente que possui a medicao.
- Chat calcula AQI estimado reutilizando `ClimateAqi.calculate` sobre o recorte de data/hora consultado; a resposta pode incluir AQI, classificacao, impacto, dominante e subindices principais.
- Chat aceita filtro por hora em perguntas como `14h`, `14:00`, `14` e tambem compara corretamente com chaves Firebase no formato `14-00`.
- Quando a pergunta filtra uma hora especifica, o chat deve responder somente o dado necessario daquela hora, sem resumo de media/minima/maxima/delta do dia e sem numero de amostras.
- Chat aceita faixa horaria em perguntas como `entre 8h e 18h`, `das 8 as 18` ou `de 8h a 18h`; os calculos de media/maxima/minima/delta/tendencia devem considerar somente registros dentro dessa faixa, inclusive as horas inicial e final.
- Chat responde analise por horario para perguntas como `qual horario foi mais quente?`, `qual horario teve maior umidade?` ou `qual periodo do dia teve menor pressao?`, calculando localmente o maior/menor valor medio por horario antes da redacao da IA.
- Chat responde consultas equivalentes aos heatmaps: `qual dia do mes foi mais quente?` usa o calendario mensal da data selecionada; `qual hora costuma ser mais fria?` agrega por hora do dia no mes selecionado; `qual dia/hora da semana teve pico?` usa a semana da data selecionada, de domingo ate a data selecionada.
- Chat responde perguntas de faixa/status/conforto para metricas com faixa configurada: temperatura/sensacao usam 20°C a 26°C, umidade usa 40% a 60%, e temperatura do Aquario usa 25°C a 27°C. A resposta calculada deve informar se ficou dentro/fora da faixa, faixa usada, quantidade de horarios fora e pior horario fora da faixa.
- Chat entende `ultimas 24 horas`/`ultimas 24h` como janela movel real, reutilizando `ClimateData.filterDataByRollingHours` com a data selecionada e a hora atual do navegador; nao deve tratar isso como `hoje` nem como `ultimos dias`.
- Chat usa arquitetura em duas etapas: Gemini classifica a pergunta em JSON com schema fixo; JavaScript valida, limita periodo, seleciona dados e calcula media/maxima/minima/delta/tendencia/comparacoes; Gemini redige a resposta usando apenas o resultado calculado.
- Chat responde perguntas de ciclo solar usando `ClimateSolar.getSolarEventsForSelectedDate` sobre `latestData.solar`, reutilizando aliases solares e fallback de zenite do modulo solar.
- Chat responde comparacoes solares: duracao do dia, maior/menor duracao de luz no ano da data selecionada por padrao, maior/menor duracao de luz no mes quando um mes for informado, tendencia de nascer do sol/por do sol na semana selecionada e comparacao de nascer/por do sol por dia no periodo.
- Termos como `tempo de luz`, `luz solar`, `duracao de luz`, `duracao do dia`, `dia mais longo` e `dia mais curto` devem ser tratados como consulta solar de duracao do dia.
- Quando a pergunta tiver intencao solar, o chat deve forcar metrica `ciclo_solar`, mesmo se a classificacao da IA sugerir outra metrica por engano.
- Periodos suportados incluem data unica, hoje, ontem, anteontem, datas relativas, intervalo, ultimas 24h reais, ultimos dias, mes selecionado, semana selecionada e ano selecionado para consultas solares anuais. `Ultimos dias` usa 7 dias por padrao e consultas de periodo sao limitadas a 30 dias, exceto calendario mensal que pode consultar o mes completo e comparacoes solares anuais que podem consultar o ano inteiro.
- Heatmaps destacam contexto temporal com `.is-selected`: calendario mensal destaca o dia selecionado, heatmap horario destaca a hora atual quando a data selecionada e hoje, e mapa semanal destaca dia da semana/hora atual quando a data selecionada e hoje.
- O mapa semanal reinicia no domingo e considera apenas registros da semana da data selecionada, do domingo ate a data selecionada. Ele nao agrega semanas anteriores do mes.
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
9. `scripts/data/analytics.js`
10. `scripts/charts/solar.js`
11. `index.html`
12. `style.css` e `styles/`
13. Views por aba

## Regras Importantes

- Nao mudar ordem dos scripts sem revisar dependencias globais.
- Nao renomear ids do HTML sem atualizar `scripts/config.js`.
- Nao renomear campos Firebase sem atualizar `scripts/config.js` e, para solar, `scripts/charts/solar.js`.
- Novos metodos, funcoes e variaveis internas devem seguir nomenclatura PT-BR. Excecoes: campos Firebase, ids/classes DOM, nomes exigidos por APIs externas, contratos publicos em `window.*`, opcoes de bibliotecas e propriedades estruturais ja consumidas por outros modulos.
- O Firebase e lido com `onValue` no path completo.
- Firebase AI Logic depende de App Check configurado no app web correto; enforcement deve ser ativado apenas depois de validar o token em producao.
- Zênite solar usa campos `HoraZenite` e `MinuteZenite` quando presentes; se nao houver, calcula meio entre nascer e por do sol.
- Aliases solares ficam centralizados em `SOLAR_FIELD_ALIASES`.

## Resumo para IA

Este projeto e um frontend estatico, sem framework, que depende de dados Firebase e de ids DOM centralizados. Para alterar uma aba, leia primeiro `scripts/config.js`, depois a view da aba, depois `scripts/data/data-utils.js` e `scripts/charts/chart-utils.js`/`scripts/data/analytics.js`. Para graficos solares, leia `scripts/charts/solar.js`. Toda alteracao deve preservar os objetos globais esperados por `scripts/main.js`. Ao criar ou refatorar codigo interno, prefira nomes em PT-BR e preserve apenas contratos externos ou nomes tecnicos obrigatorios.
