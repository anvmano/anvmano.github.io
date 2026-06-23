# Plano: Login Google, Modo Interno E Modo Publico

## Objetivo

Adicionar autenticacao opcional pelo Google usando Firebase Auth e separar a experiencia em dois fluxos:

- **Usuarios internos autorizados:** acessam o dashboard completo atual, com Firebase interno, assistente IA, exportacao, graficos, tabelas, AQI estimado interno e dados dos dispositivos.
- **Usuario publico:** acessa sem login uma tela publica por localizacao, sem dados internos da estacao, sem assistente IA e sem acesso aos historicos privados. Alem das informacoes meteorologicas publicas, essa tela deve apresentar graficos de temperatura, sensacao termica, umidade, pressao e ciclo solar, alem de contexto de estacao do ano e fase da lua.

Usuarios internos autorizados:

- `anvmano@gmail.com`
- `clarissamikado@gmail.com`

O usuario publico podera escolher entre:

- permitir o uso da localizacao fornecida pelo navegador;
- informar um CEP manualmente.

Login nao deve ser obrigatorio para uso publico. Ao abrir o site, a primeira experiencia deve ser a consulta publica por localizacao/CEP, com uma opcao discreta de login para liberar o painel completo quando o usuario for interno autorizado.

## Premissas

- O dashboard atual deve continuar funcionando sem mudanca de comportamento para os usuarios internos autorizados.
- A assistente IA deve ser exclusiva dos usuarios internos autorizados.
- O login deve ser opcional para visitantes.
- Ao acessar o site sem login, o usuario deve poder consultar clima por localizacao do navegador ou CEP.
- Usuarios publicos nao devem carregar listeners internos do Realtime Database.
- Dados publicos devem vir de APIs externas gratuitas quando possivel.
- A localizacao do navegador deve ser usada apenas para consulta atual, sem armazenamento, salvo decisao futura explicita.
- A implementacao deve respeitar o carregamento sob demanda atual do projeto.
- Novos nomes internos devem seguir PT-BR, exceto contratos externos, Firebase, APIs e IDs ja existentes.

## Arquivos Previstos

### Configuracao

- `scripts/config.js`
  - adicionar configuracao do Firebase Auth;
  - adicionar lista de usuarios internos autorizados, preferencialmente por UID;
  - manter os e-mails `anvmano@gmail.com` e `clarissamikado@gmail.com` como referencia humana/documental;
  - adicionar URLs/configs de BrasilAPI, ViaCEP, Open-Meteo Forecast e Open-Meteo Air Quality.

### Autenticacao

- `scripts/auth/auth-service.js`
  - inicializar Firebase Auth usando o app ja criado;
  - login com Google;
  - logout;
  - observar estado com `onAuthStateChanged`;
  - expor usuario atual;
  - expor regra `ehUsuarioInterno`.

### Login Opcional

- `index.html`
  - adicionar acao discreta de login, como "Entrar";
  - nao bloquear a tela publica atras do login;
  - botao "Entrar com Google" em modal, painel ou area secundaria;
  - estado de carregamento;
  - mensagem de erro amigavel.

- `styles/auth.css`
  - estilos do login opcional;
  - estados de carregamento e erro.

### Tela Publica

- `index.html`
  - adicionar container publico;
  - botao para usar localizacao do navegador;
  - campo de CEP;
  - botao para buscar por CEP;
  - area de resultado.
  - area de contexto astronomico/sazonal publico.

- `styles/public-weather.css`
  - layout visual usando o mesmo tema do dashboard;
  - cards para clima, AQI externo, estacao do ano e fase da lua;
  - cards/paineis de graficos para temperatura, sensacao termica, umidade, pressao e ciclo solar;
  - estados vazios, erro, permissao negada e carregamento.

### Servicos Externos

- `scripts/external/external-weather-service.js`
  - buscar endereco por BrasilAPI;
  - usar ViaCEP como fallback;
  - resolver latitude/longitude quando necessario;
  - buscar clima atual no Open-Meteo Forecast;
  - buscar AQI externo no Open-Meteo Air Quality;
  - calcular ciclo solar do dia a partir da latitude/longitude;
  - tratar falha de rede, CEP invalido, localizacao indisponivel e dados ausentes.

- `scripts/external/browser-location-service.js`
  - solicitar `navigator.geolocation`;
  - tratar permissao negada;
  - tratar timeout;
  - tratar navegador sem suporte;
  - retornar latitude/longitude e precisao quando disponivel.

### Renderizacao Publica

- `scripts/views/public-weather-view.js`
  - renderizar cards de temperatura, sensacao termica, umidade e pressao;
  - renderizar graficos de temperatura, sensacao termica, umidade e pressao;
  - renderizar estacao do ano;
  - renderizar fase da lua;
  - renderizar grafico de ciclo solar do dia;
  - renderizar AQI externo;
  - exibir origem da consulta: "Localizacao do navegador" ou "CEP";
  - mostrar mensagens claras para dados indisponiveis.

## Fluxo Geral

1. A pagina carrega a estrutura inicial.
2. A tela publica por localizacao/CEP fica disponivel sem login.
3. O sistema pode inicializar autenticacao em paralelo, sem bloquear a experiencia publica.
4. Se nao houver usuario logado, permanece na tela publica.
5. Se o usuario acionar login:
   - se for usuario interno autorizado, troca para o dashboard privado atual;
   - se nao for usuario interno autorizado, permanece na tela publica.
6. Se ja houver sessao ativa de usuario interno autorizado, o site pode abrir diretamente no dashboard completo.

## Fluxo Dos Usuarios Internos Autorizados

Quando o usuario logado for `anvmano@gmail.com` ou `clarissamikado@gmail.com`:

- iniciar listeners internos do Firebase;
- montar `latestData` e demais caches internos;
- renderizar abas Estacao, Sala, Quarto e Aquario;
- manter AQI interno da Sala;
- manter popovers do header;
- manter exportacao PDF/JSON;
- permitir assistente IA;
- manter comportamento atual de graficos, heatmaps, tabelas, zoom e swipe.

## Fluxo Do Usuario Publico

Quando nao houver usuario logado, ou quando o usuario logado nao estiver na lista de usuarios internos autorizados:

- nao iniciar listeners internos de `historico/*`;
- nao montar contexto interno da estacao;
- nao exibir assistente IA;
- nao permitir exportacao dos dados internos;
- mostrar tela publica com duas opcoes:
  - usar localizacao do navegador;
  - buscar por CEP.
- mostrar contexto publico:
  - estacao do ano atual;
  - fase da lua atual;
  - grafico de ciclo solar do dia para a localizacao escolhida.

## Opcao: Usar Localizacao Do Navegador

### Comportamento Esperado

O usuario publico pode clicar em "Usar minha localizacao".

Se aceitar:

1. O navegador fornece latitude e longitude.
2. O sistema busca clima atual no Open-Meteo.
3. O sistema busca qualidade do ar externa no Open-Meteo Air Quality.
4. O sistema calcula ciclo solar do dia para a coordenada.
5. O sistema calcula/exibe estacao do ano e fase da lua.
6. A tela mostra os cards publicos.
7. A tela renderiza os graficos publicos de temperatura, sensacao termica, umidade, pressao e ciclo solar.
8. A origem da consulta aparece como "Localizacao do navegador".

Se negar permissao:

- exibir mensagem amigavel;
- manter campo de CEP disponivel como alternativa.

Se o navegador nao suportar geolocalizacao:

- informar que a localizacao automatica nao esta disponivel;
- orientar o uso do CEP.

Se houver timeout:

- exibir mensagem de tentativa sem sucesso;
- permitir tentar novamente ou usar CEP.

### Regras De Privacidade

- A latitude e longitude nao devem ser gravadas no Firebase.
- A localizacao nao deve ser enviada para a assistente IA.
- A localizacao deve existir apenas em memoria durante a consulta.
- Se futuramente houver historico publico, isso deve ser planejado separadamente.

### Requisitos Tecnicos

- `navigator.geolocation` exige HTTPS em producao.
- GitHub Pages atende HTTPS.
- Localhost tambem funciona para desenvolvimento.
- O usuario sempre precisa conceder permissao pelo navegador.

## Opcao: Buscar Por CEP

### Comportamento Esperado

O usuario publico pode informar um CEP.

Fluxo:

1. Validar formato do CEP.
2. Buscar dados do CEP na BrasilAPI.
3. Se falhar, tentar ViaCEP.
4. Resolver latitude/longitude.
5. Buscar clima atual no Open-Meteo.
6. Buscar AQI externo no Open-Meteo Air Quality.
7. Calcular ciclo solar do dia.
8. Calcular/exibir estacao do ano e fase da lua.
9. Renderizar os cards publicos.
10. Renderizar os graficos publicos de temperatura, sensacao termica, umidade, pressao e ciclo solar.
11. Exibir origem da consulta como "CEP".

### Dados Publicos Exibidos

Dados meteorologicos principais:

- Temperatura atual.
- Sensacao termica.
- Umidade.
- Pressao.
- AQI externo.

Contexto adicional:

- Grafico de ciclo solar do dia.
- Estacao do ano.
- Fase da lua.

### Graficos Publicos Exibidos

A tela publica deve apresentar os seguintes graficos:

- Temperatura.
- Sensacao termica.
- Umidade.
- Pressao.
- Ciclo solar do dia.

Regras:

- Os graficos meteorologicos devem usar os dados externos retornados para a localizacao escolhida.
- Quando a API externa fornecer serie horaria do dia, os graficos devem usar essa serie.
- Quando houver apenas valor atual disponivel para uma metrica, o grafico deve exibir estado apropriado ou um ponto unico sem sugerir historico inexistente.
- O grafico de ciclo solar deve ser renderizado para a latitude/longitude escolhida.
- Estacao do ano e fase da lua sao contexto visual adicional, nao graficos meteorologicos.

## Contexto Sazonal E Astronomico Publico

A tela publica deve reaproveitar, quando possivel, as mesmas regras visuais ja existentes no dashboard interno:

- **Estacao do ano:** usar a data atual do navegador, nao a data consultada por CEP/localizacao.
- **Fase da lua:** usar calculo local aproximado, sem API externa, preferencialmente reaproveitando a logica de `scripts/charts/moon.js`.
- **Grafico de ciclo solar:** calcular para a latitude/longitude escolhida pelo usuario, seja por navegador ou CEP, e renderizar visualmente em formato equivalente ao grafico Ciclo Solar do Dia do dashboard interno.

Regras:

- Esses blocos publicos complementam os dados meteorologicos principais e nao devem substituir temperatura, sensacao termica, umidade, pressao, AQI externo ou seus graficos.
- Esses blocos publicos nao devem depender de `historico/NascePorDoSol`.
- O grafico de ciclo solar publico deve usar a localizacao externa escolhida, nao a localizacao da estacao interna.
- Se a localizacao ainda nao foi escolhida, o grafico de ciclo solar deve mostrar estado vazio orientando o usuario a permitir localizacao ou informar CEP.
- O grafico deve mostrar a curva do dia, periodos de luz/transicao/noite e eventos principais quando os dados calculados estiverem disponiveis.
- O grafico pode reutilizar o visual e os utilitarios de `scripts/charts/solar.js`, mas sem depender de dados Firebase internos.
- Estacao do ano e fase da lua podem aparecer antes da busca por CEP/localizacao, pois dependem apenas da data atual.
- A interface deve deixar claro que AQI externo e clima externo sao dados publicos de API, diferentes dos dados internos dos sensores.

## AQI Interno Vs AQI Externo

O projeto tera dois conceitos diferentes:

- **AQI estimado interno:** calculado com dados do MQ135 da Sala, exclusivo dos usuarios internos autorizados.
- **AQI externo:** obtido por API externa para usuarios publicos.

A interface e a documentacao devem deixar claro quando o valor for estimado ou externo.

## Bloqueio Da Assistente IA

Para usuarios publicos:

- esconder botao do chat;
- nao inicializar `ClimateChat`;
- nao carregar Firebase AI Logic;
- nao enviar contexto para a IA;
- nao permitir perguntas sobre dados internos.

Para usuarios internos autorizados:

- comportamento atual permanece.

## Seguranca Firebase

Antes de ativar regras restritivas:

1. Confirmar como ESP32/Arduino escreve no Realtime Database.
2. Mapear paths usados pelos dispositivos.
3. Garantir que leitura de `historico/*` seja permitida apenas aos usuarios internos autorizados.
4. Garantir que regras novas nao quebrem escrita dos dispositivos.
5. Testar em ambiente real antes de fechar enforcement total.

## Carregamento Sob Demanda

A implementacao deve respeitar a arquitetura atual sem Vite:

- carregar Auth de forma leve e sem bloquear a tela publica;
- carregar Firebase Database interno apenas para usuarios internos autorizados;
- carregar assistente IA apenas quando um usuario interno autorizado abrir o chat;
- carregar servicos externos apenas no modo publico;
- buscar clima externo apenas apos acao do usuario ou escolha de localizacao;
- renderizar estacao do ano e fase da lua publicas sem esperar CEP/localizacao;
- renderizar graficos meteorologicos publicos somente depois de obter dados externos;
- renderizar grafico de ciclo solar publico somente depois de obter latitude/longitude;
- carregar Chart.js sob demanda quando o primeiro grafico publico precisar ser renderizado;
- evitar inicializar graficos e heatmaps internos para usuario publico.

## Etapas Recomendadas

### Etapa 1: Auth Minimo

- Configurar Firebase Auth.
- Criar `auth-service.js`.
- Adicionar login opcional, sem bloquear a tela publica.
- Detectar usuario interno autorizado por UID ou lista equivalente.
- Garantir acesso completo para `anvmano@gmail.com` e `clarissamikado@gmail.com`.
- Validar login e logout.

### Etapa 2: Separacao De Fluxos

- Usuarios internos autorizados veem dashboard atual.
- Usuario sem login ve tela publica por localizacao/CEP.
- Usuario logado que nao seja interno autorizado ve a mesma tela publica por localizacao/CEP.
- Assistente IA fica bloqueada para usuarios publicos.
- Listeners internos nao iniciam para usuarios publicos.

### Etapa 3: Localizacao Publica

- Adicionar botao "Usar minha localizacao".
- Implementar `browser-location-service.js`.
- Tratar permissao negada, timeout e falta de suporte.
- Buscar clima externo por latitude/longitude.
- Renderizar graficos de temperatura, sensacao termica, umidade e pressao com os dados externos disponiveis.
- Renderizar grafico de ciclo solar para a coordenada obtida.
- Renderizar estacao do ano e fase da lua na tela publica.

### Etapa 4: CEP E Clima Externo

- Implementar busca por CEP.
- Integrar BrasilAPI e ViaCEP.
- Resolver coordenadas.
- Buscar clima e AQI externo; calcular ciclo solar pela coordenada.
- Renderizar cards publicos.
- Renderizar graficos publicos de temperatura, sensacao termica, umidade e pressao.
- Garantir que os dados meteorologicos principais continuem presentes no resultado publico.
- Garantir que estacao do ano, fase da lua e grafico de ciclo solar estejam presentes como contexto adicional.

### Etapa 5: Seguranca Firebase

- Revisar regras do Realtime Database.
- Proteger historico interno.
- Validar escrita dos dispositivos.
- Ativar regras com cautela.

### Etapa 6: Polimento E Documentacao

- Ajustar visual da tela publica.
- Atualizar documentacao tecnica.
- Documentar fluxo interno/publico.
- Documentar uso de localizacao do navegador.
- Documentar contexto publico: estacao do ano, fase da lua e grafico de ciclo solar.
- Documentar assistente exclusiva dos usuarios internos autorizados.

## Validacao Obrigatoria

- Rodar `npm run validate`.
- Testar acesso sem login usando localizacao do navegador.
- Testar acesso sem login usando CEP.
- Testar login como `anvmano@gmail.com`.
- Testar login como `clarissamikado@gmail.com`.
- Testar login como usuario publico.
- Testar logout.
- Testar localizacao aceita.
- Testar localizacao negada.
- Testar navegador sem geolocalizacao, quando possivel.
- Testar CEP valido.
- Testar CEP invalido.
- Confirmar estacao do ano na tela publica.
- Confirmar fase da lua na tela publica.
- Confirmar graficos publicos de temperatura, sensacao termica, umidade e pressao.
- Confirmar grafico de ciclo solar publico apos obter localizacao.
- Confirmar que usuario publico nao ve assistente IA.
- Confirmar que usuario publico nao carrega dados internos.
- Confirmar que login nao e obrigatorio para consulta publica.
- Confirmar que usuarios internos autorizados continuam com dashboard completo.
- Confirmar que exportacao PDF/JSON continua funcionando para usuarios internos autorizados.

## Riscos

- Regras do Firebase podem quebrar escrita dos dispositivos se aplicadas sem mapear o fluxo do ESP32.
- APIs externas podem ter limites, indisponibilidade ou campos ausentes.
- Geolocalizacao depende de permissao do usuario e pode ser bloqueada pelo navegador.
- Resolver coordenadas a partir de CEP pode exigir fallback adicional se BrasilAPI/ViaCEP nao retornarem latitude/longitude.
- Separar fluxo publico e privado mexe na inicializacao principal e deve ser feito em etapas pequenas.
- Se Auth bloquear a renderizacao inicial por engano, a experiencia publica pode parecer uma tela de login obrigatoria. Isso deve ser evitado.

## Criterio De Aceite

A alteracao estara pronta quando:

- `anvmano@gmail.com` acessar o dashboard completo sem regressao;
- `clarissamikado@gmail.com` acessar o dashboard completo sem regressao;
- visitante sem login conseguir usar a tela publica;
- usuario publico autenticado nao acessar dados internos;
- usuario publico conseguir consultar clima por localizacao do navegador;
- usuario publico conseguir consultar clima por CEP;
- tela publica apresentar temperatura, sensacao termica, umidade, pressao e AQI externo;
- tela publica apresentar graficos de temperatura, sensacao termica, umidade e pressao;
- tela publica apresentar tambem estacao do ano, fase da lua e grafico de ciclo solar;
- assistente IA existir apenas para usuarios internos autorizados;
- regras/documentacao deixarem clara a separacao entre dado interno e dado publico;
- validacoes e testes manuais principais passarem sem erros no console.
