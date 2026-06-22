# Estacao Climática Web

Dashboard web estático para acompanhamento de dados climáticos da Estação, Sala, Quarto, Aquário e eventos solares. A aplicação lê dados do Firebase Realtime Database diretamente no navegador, filtra pela data selecionada e renderiza gráficos, estatísticas, tabelas, visualizações avançadas, contexto astronômico, chat com IA e exportação de dados.

## Requisitos

- Navegador moderno.
- Acesso à internet para carregar CDNs e consultar o Firebase Realtime Database.
- Node.js apenas para executar a validação local do projeto.

Bibliotecas carregadas via CDN:

- Chart.js `4.5.1`
- html2canvas `1.4.1`
- jsPDF `2.5.2`
- Firebase SDK modular `12.13.0`
- Firebase App Check
- Firebase AI Logic

## Estrutura

```text
.
├── index.html                  Estrutura DOM, abas, canvases e ordem dos scripts
├── style.css                   Manifesto de imports CSS
├── package.json                Comando de validação local
├── scripts/
│   ├── config.js               Firebase, paths, ids, campos, cores e limites
│   ├── main.js                 Orquestração geral da aplicação
│   ├── firebase-service.js     Inicialização Firebase e listeners
│   ├── chat.js                 Fachada pública do chat com IA
│   ├── assistant/
│   │   ├── ai-service.js       Firebase AI Logic
│   │   ├── assistant-config.js Constantes, ambientes e aliases
│   │   ├── assistant-format.js Formatação e normalização
│   │   ├── assistant-ui.js     Painel e mensagens do chat
│   │   ├── assistant-intent.js Classificação de intenção
│   │   ├── assistant-planner.js Normalização do plano de consulta
│   │   ├── assistant-query.js  Execução das consultas
│   │   ├── assistant-metrics.js Estatísticas e métricas
│   │   ├── assistant-solar.js  Consultas solares do chat
│   │   └── assistant-aqi.js    Consultas AQI/qualidade do ar
│   ├── data/
│   │   ├── data-utils.js       Datas, filtros, tabelas e séries
│   │   └── analytics.js        Estatísticas e heatmaps
│   ├── charts/
│   │   ├── chart-utils.js      Gráficos comuns e faixa de conforto
│   │   ├── aqi.js              AQI estimado da Sala no header
│   │   ├── season.js           Estação do ano no header e aba Estação
│   │   ├── moon.js             Fase da lua no header e aba Estação
│   │   ├── solar.js            Eventos e gráficos solares
│   │   └── zoom.js             Zoom dos gráficos
│   ├── ui/
│   │   └── ui.js               Abas, swipe, data picker, mensagens e colapsáveis
│   ├── reports/
│   │   ├── pdf-report.js       Fachada pública da exportação
│   │   ├── pdf-report-config.js Configuração das abas do relatório
│   │   ├── pdf-report-format.js Formatação e status
│   │   ├── pdf-report-data.js  Coleta e resumo dos dados
│   │   ├── pdf-report-dom.js   HTML do relatório
│   │   ├── pdf-report-charts.js Imagens e gráficos do PDF
│   │   ├── pdf-report-pdf.js   Paginação A4 e jsPDF
│   │   └── pdf-report-export.js Orquestração PDF/JSON
│   └── views/
│       ├── estacao-view.js     Renderização da aba Estação
│       ├── quarto-view.js      Renderização da aba Quarto
│       ├── sala-view.js        Renderização da aba Sala
│       ├── aquario-view.js     Renderização da aba Aquário
│       └── solar-view.js       Renderização dos gráficos solares
├── styles/
│   ├── tokens.css              Variáveis visuais
│   ├── base.css                Base e reset
│   ├── header.css              Cabeçalho, AQI, estação, lua, relógio e indicador astronômico
│   ├── layout.css              Layout principal
│   ├── tabs-toolbar.css        Abas, seletor de data e exportação
│   ├── feedback.css            Loading, mensagens e transições
│   ├── stats.css               Cards, faixa de estações e resumo lunar
│   ├── charts.css              Cards e canvases dos gráficos
│   ├── advanced-views.css      Heatmaps e visualizações climáticas
│   ├── zoom.css                Overlay de zoom
│   ├── tables.css              Tabelas
│   ├── chat.css                Chat com IA
│   ├── responsive.css          Ajustes mobile
│   └── reports/
│       └── pdf-report.css      Estilo usado na exportação PDF
├── tools/
│   └── validate-project.mjs    Validação estrutural local
└── docs/
    ├── README.md
    ├── AI_QUICK_CONTEXT.md
    ├── AI_SYSTEM_PROMPT.md
    ├── ARCHITECTURE_AI.md
    ├── BUSINESS_RULES.md
    └── DEPENDENCY_MAP.md
```

## Configuração

As configurações principais ficam em:

```text
scripts/config.js
```

Pontos configuráveis:

- `firebase`: configuração do Firebase.
- `firebase.appCheckUrl`, `firebase.aiUrl`, `firebase.recaptchaEnterpriseSiteKey` e `firebase.aiModel`: App Check e Firebase AI Logic.
- `firebasePaths`: caminhos do Realtime Database.
- `ids`: ids DOM usados por gráficos, tabelas, estados e controles.
- `fields`: nomes dos campos esperados nos sensores.
- `measurementUnits`: unidades exibidas nos valores das tabelas.
- Sala/MQ135: `CO`, `CO2`, `Aceton`, `Alcohol`, `NH4` e `Toluen`; `Toluen` aparece como Tolueno.
- AQI estimado: usa dados da Sala/MQ135 para exibir um chip no header. As categorias visuais seguem as faixas AQI, mas o cálculo é estimado e local.
- `colors`: cores usadas pelos gráficos.
- `comfortBand`: faixa de conforto térmico geral.
- `humidityComfortBand`: faixa de conforto da umidade.
- `aquariumComfortBand`: faixa de conforto do Aquário.

Caminhos Firebase usados:

- `historico/Temperatura`
- `historico/NascePorDoSol`
- `historico/Aquario`
- `historico/AirQuality`

Formato esperado dos dados:

```text
historico/<tipo>/<DD-MM-AAAA>/<HH-MM>/<id>/<campos>
```

O input de data usa `YYYY-MM-DD`, mas os dados no Firebase usam `DD-MM-AAAA`.

## Como Rodar

Por ser um projeto estático, a aplicação pode ser aberta pelo arquivo:

```text
index.html
```

Se o navegador ou alguma política local bloquear carregamentos, rode com um servidor estático simples na raiz do projeto:

```powershell
python -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Como Validar

Execute:

```powershell
npm run validate
```

A validação verifica:

- Sintaxe dos arquivos JavaScript de forma recursiva.
- Referências locais em `index.html`.
- Imports CSS em `style.css`.
- IDs duplicados no HTML.
- Contratos entre `index.html` e `scripts/config.js`.

## Funcionalidades

- Aba global Estação e abas por dispositivo: Sala, Quarto e Aquário.
- Navegação por clique e swipe touch horizontal, sem capturar a rolagem lateral de tabelas e heatmaps.
- Seletor global de data.
- Persistência da aba ativa em `localStorage`.
- Gráficos globais de temperatura/umidade por ambiente na aba Estação.
- Gráficos de temperatura, sensação térmica, umidade, pressão, qualidade do ar e aquário.
- Cards com média, mínima, máxima, delta e tendência.
- Faixa de conforto térmico nos gráficos de temperatura e sensação.
- Faixa de conforto do Aquário entre 25°C e 27°C.
- Heatmaps e visualizações climáticas avançadas para Sala e Quarto.
- Destaque temporal nos heatmaps: dia selecionado no calendário, hora atual no heatmap horário de hoje e dia/hora atual no mapa semanal do mês atual.
- Ciclo solar do dia com amanhecer, nascer do sol, zênite, pôr do sol e anoitecer na aba Estação.
- Histórico de nascer e pôr do sol na aba Estação.
- Estação do ano atual no header e faixa visual na aba Estação.
- Fase da lua atual no header e fase lunar da data selecionada na aba Estação.
- Zoom dos gráficos.
- Tabelas colapsáveis.
- Tabelas com unidades nos valores, sem espaco antes da unidade, como `26.40°C`, `57.50%`, `8.66ppm`, `1.20NTU` e `930.60hPa`.
- Leituras do Aquário normalizadas antes da exibição: TDS dividido por 10 e Turbidez dividido por 1000.
- Indicador astronômico no cabeçalho, alinhado ao tamanho do relógio, com estado de dia/noite e tooltip/popover com horários solares.
- Chips do header para estação do ano, AQI, ciclo solar e fase da lua, com popovers mutuamente exclusivos.
- Chat com Firebase AI Logic para perguntas sobre os dados carregados, incluindo ambiente, periodo, hora, faixa horaria, ciclo solar, comparacoes solares, AQI/IAQ/qualidade do ar, gases do MQ135 e consultas equivalentes aos heatmaps, com atalhos para resumo, media, maxima e alertas.
- Exportação da aba ativa em PDF ou JSON.

## Exportação

A exportação usa os dados já carregados na tela. Ela não reconsulta o Firebase.

PDF:

- Usa resumo executivo na primeira página, com metadados, cards principais e alertas do dia.
- Monta páginas A4 manualmente para evitar cortes.
- Junta temperatura e sensação térmica no mesmo gráfico quando a aba possui as duas métricas.
- Estação inclui cards contextuais de Estação do ano e Fase da lua, 6 cards globais, gráficos comparativos e ciclo solar; não possui tabela.
- Sala não inclui ciclo solar no PDF e usa tabela MQ135 com CO, CO2, Acetona, Álcool, Amônia e Tolueno.
- Quarto não inclui ciclo solar no PDF e usa tabela ambiental.
- Aquário não inclui ciclo solar no PDF.
- Aquário usa cards, gráficos e tabela de Temperatura, pH, TDS e Turbidez.
- Usa tabela resumida com uma linha por horário e status geral.
- Mantém tema escuro com cards, bordas azuladas e destaques ciano.

JSON:

- Inclui metadados.
- Inclui resumo.
- Inclui tabela processada.
- Inclui dados brutos filtrados da aba ativa.

## Decisões Técnicas

- O projeto não usa framework frontend.
- Os módulos são scripts clássicos e expõem objetos em `window.*`.
- A ordem dos scripts em `index.html` é parte do contrato da aplicação.
- O Firebase é lido no cliente com listeners `onValue`.
- O App Check usa reCAPTCHA Enterprise e deve ser validado antes de ativar enforcement.
- O chat envia ao Gemini apenas resumo compacto de dados carregados, nunca o histórico inteiro.
- Atalhos do chat usam `data-chat-question` e reutilizam o mesmo fluxo de envio da pergunta digitada.
- O chat usa duas etapas: Gemini classifica a intenção em JSON; JavaScript calcula os dados; Gemini apenas redige a resposta final.
- Perguntas sobre ciclo solar no chat reutilizam o parser solar central do app, evitando leitura duplicada dos campos solares.
- Perguntas de comparacao solar no chat calculam localmente duracao do dia, maior/menor duracao de luz no ano da data selecionada por padrao, maior/menor duracao de luz no mes quando um mes for informado, tendencia de nascer/por do sol e comparacao semanal.
- Perguntas sobre AQI/IAQ/qualidade do ar no chat reutilizam `ClimateAqi.calculate`; CO, CO2, Acetona, Álcool, Amônia e Tolueno são tratados como métricas da Sala/MQ135 quando nenhum ambiente é citado ou quando a aba/ambiente atual não possui essa medição.
- Perguntas equivalentes aos heatmaps no chat calculam localmente calendário mensal por dia, hora típica do período e mapa semanal por dia/hora antes da redação da IA.
- Estação do ano e fase da lua são calculadas localmente para contexto visual. A fase lunar é aproximada e não deve ser tratada como efeméride astronômica de alta precisão.
- Quando ambiente, data, periodo ou operação aparecem de forma informal, a classificação em JSON ajuda a entender erros de digitação e fala natural.
- Consultas de período usam limite de 30 dias; `últimos dias` usa 7 dias por padrão. O calendário mensal pode consultar o mês completo.
- O CSS foi dividido em arquivos por responsabilidade dentro de `styles/`.
- Os renderizadores por aba ficam separados em `scripts/views/`.
- A documentação técnica fica centralizada em `docs/`.
- O validador local reduz risco de quebrar ids, imports e caminhos ao reorganizar arquivos.

## Pontos de Atenção

- Não altere ids do HTML sem atualizar `scripts/config.js`.
- Não altere caminhos Firebase sem revisar `scripts/config.js` e os dados reais.
- Não altere nomes de campos dos sensores sem revisar `fields` em `scripts/config.js`.
- Não altere campos solares sem revisar `scripts/charts/solar.js`.
- Não mude a ordem dos scripts sem revisar dependências globais.
- Ao criar ou refatorar código interno, use nomes em PT-BR para métodos, funções e variáveis. Preserve nomes externos obrigatórios: campos Firebase, ids/classes DOM, contratos `window.*`, payloads já consumidos e opções exigidas por bibliotecas.
- O projeto não tem backend local, autenticação ou build tooling completo.

## Documentação Técnica

Arquivos de apoio para manutenção:

- `docs/AI_QUICK_CONTEXT.md`: resumo rápido para retomada de contexto.
- `docs/DEPENDENCY_MAP.md`: mapa de dependências e impacto.
- `docs/ARCHITECTURE_AI.md`: arquitetura detalhada.
- `docs/BUSINESS_RULES.md`: regras funcionais, decisões e dívida técnica.
- `docs/AI_SYSTEM_PROMPT.md`: guia de comportamento para manutenção assistida por IA.
