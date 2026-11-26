# Plano de correções da auditoria funcional e documental

Data da auditoria: **24/11/2026**.

Aplicação: dashboard estático de estação climática, com consulta pública e área privada autenticada pelo Firebase.

Este documento registra as correções identificadas na auditoria, os arquivos envolvidos e os critérios para verificar cada entrega. **COR-01 a COR-08 e DOC-01 foram implementados e validados em 24/11/2026.** A suíte final aprovou 25/25 comandos. O resultado original da auditoria abaixo foi preservado como referência histórica; as evidências da entrega estão na seção 7.

## 1. Resultado de referência

- Foram confrontados os 13 arquivos Markdown de autoria do projeto com o código ativo e os testes disponíveis.
- A execução completa de `npm test`, com acesso às CDNs, terminou com **23 de 24 comandos aprovados**.
- A falha persistente foi `test:ui-ux`, por contraste insuficiente no calendário mensal.
- Os cenários posteriores à falha foram executados separadamente: contexto das tabelas, layout público responsivo e composição da Estação passaram.
- As falhas iniciais de download do Chart.js deixaram de ocorrer na repetição com rede liberada. Elas não devem ser confundidas com a falha funcional de contraste.
- As reproduções adicionais abaixo usaram código real com dados sintéticos ou serviços simulados. Não foram adicionados testes permanentes durante a auditoria.

Os resultados são a referência da auditoria dessa data, não uma garantia sobre versões posteriores.

## 2. Prioridades e sequência

| ID | Prioridade | Correção | Situação |
| --- | --- | --- | --- |
| COR-01 | P1 | Remover coordenadas precisas do JSON exportado | Concluída em 24/11/2026 |
| COR-02 | P1 | Encerrar diálogos e estados privados ao voltar ao modo público | Concluída em 24/11/2026 |
| COR-03 | P1 | Limpar cards e gráficos quando o Firebase retornar `null` | Concluída em 24/11/2026 |
| COR-04 | P2 | Preservar ausência de dados na previsão de chuva | Concluída em 24/11/2026 |
| COR-05 | P2 | Validar a UF no fallback de localização por CEP | Concluída em 24/11/2026 |
| COR-06 | P2 | Usar o fuso do local consultado no contexto solar público | Concluída em 24/11/2026 |
| COR-07 | P2 | Permitir nova tentativa após falha de carregamento | Concluída em 24/11/2026 |
| COR-08 | P2 | Corrigir o contraste do calendário mensal | Concluída em 24/11/2026 |
| DOC-01 | P2 | Atualizar os documentos afetados pelo comportamento atual | Concluída em 24/11/2026 |

P1 indica exposição de informação privada ou apresentação de medições antigas como se ainda fossem válidas. P2 indica falha funcional, de acessibilidade ou de documentação que deve ser corrigida na sequência.

Implementar os itens em mudanças pequenas. Atualizar a documentação correspondente junto de cada correção; concluir DOC-01 com uma revisão transversal após as alterações funcionais.

## 3. Correções funcionais

### COR-01 — Remover coordenadas precisas do JSON exportado

**Problema confirmado:** após consultar a localização no modo privado, o JSON inclui `latitude`, `longitude` e `precisao` em `climaExterno.origem`. O exportador repassa o snapshot externo completo. Isso contraria a afirmação de que coordenadas não são persistidas durante a exportação.

**Reprodução:** consultar a localização na Estação e exportar JSON. Na reprodução sintética, os três campos permaneceram no conteúdo serializado.

**Arquivos envolvidos:**

- [pdf-report-export.js](../scripts/reports/pdf-report-export.js): `exportarRelatorioJson` e `montarRelatorio`.
- [main.js](../scripts/main.js): contexto fornecido ao relatório.
- [external-weather-service.js](../scripts/external/external-weather-service.js): formato de `origem`.
- [README.md](README.md) e [BUSINESS_RULES.md](BUSINESS_RULES.md): contrato de privacidade.

**Correção necessária:** montar o objeto externo exportável apenas com os campos necessários ao relatório, sem copiar coordenadas ou precisão. Conferir todas as abas, pois o contexto de exportação pode conter o snapshot externo mesmo fora da Estação. Preservar os dados climáticos, a identificação textual permitida do local e a ausência de novas consultas durante a exportação.

**Critérios de aceite:**

- [x] Nenhum JSON exportado contém latitude, longitude ou precisão, inclusive em objetos aninhados.
- [x] Chuva e demais informações externas previstas no contrato continuam disponíveis no relatório.
- [x] A exportação não solicita geolocalização nem reconsulta as APIs.
- [x] Um teste permanente inspeciona o JSON serializado com coordenadas sintéticas na entrada.

### COR-02 — Encerrar estados privados ao voltar ao modo público

**Problema confirmado:** a transição interno → público não fecha os diálogos existentes. O zoom preserva dados privados na sobreposição. Com a assistente aberta, a página pública fica visível, porém inerte e com a rolagem travada.

**Reprodução:** abrir um gráfico privado no zoom e executar a transição para o público. Repetir com a assistente aberta. A mudança de autenticação pode ocorrer em outra aba; não depender apenas do clique no botão Sair da tela atual.

**Arquivos envolvidos:**

- [main.js](../scripts/main.js): `inicializarModoPublico` e `pararFirebaseInterno`.
- [public-weather-view.js](../scripts/views/public-weather-view.js): `mostrar`.
- [zoom.js](../scripts/charts/zoom.js): `closeZoom`.
- [assistant-ui.js](../scripts/assistant/assistant-ui.js): fechamento, foco, elementos inertes e trava de rolagem.
- [chat.js](../scripts/chat.js), [estacao-view.js](../scripts/views/estacao-view.js) e exportação: revisar operações pendentes e estados associados à sessão.

**Correção necessária:** fechar os diálogos antes de ocultar a área privada, restaurar a interatividade da página e limpar os dados de apresentação privados mantidos pela sessão. Impedir que uma operação iniciada na sessão anterior reabra diálogos ou apresente dados privados depois da saída. A falha dos diálogos foi reproduzida; a revisão das operações pendentes é uma verificação complementar necessária à correção.

**Critérios de aceite:**

- [x] Não há zoom privado visível ou contendo dados da sessão encerrada após a transição.
- [x] O público recebe foco, clique e rolagem normalmente; estados `inert` anteriores são respeitados.
- [x] O foco não retorna a um controle privado oculto.
- [x] Listeners Firebase continuam sendo cancelados e `latestData` continua sendo limpo.
- [x] Carregamento da assistente, respostas e exportações pendentes não retomam a experiência privada após a saída.
- [x] Um novo login autorizado inicializa os recursos corretamente, sem duplicar eventos ou listeners.
- [x] Há regressão de navegador para transição com zoom e assistente abertos e com operação pendente.

### COR-03 — Limpar a apresentação ao receber snapshot nulo

**Problema confirmado:** após dados válidos, um callback Firebase com `null` limpa o cache e altera a tabela, mas não renderiza o estado vazio dos cards e gráficos do ambiente. A troca de data também não resolve o caso, porque a renderização é condicionada à existência de dados.

**Arquivos envolvidos:**

- [main.js](../scripts/main.js): callbacks de `configurarEscutasFirebase` e `renderizarPainelDaDataSelecionada`.
- Views de [Sala](../scripts/views/sala-view.js), [Quarto](../scripts/views/quarto-view.js) e [Aquário](../scripts/views/aquario-view.js).
- [analytics.js](../scripts/data/analytics.js) e [chart-utils.js](../scripts/charts/chart-utils.js): estados vazios existentes.

**Correção necessária:** usar os caminhos existentes de renderização vazia para atualizar toda a apresentação, incluindo visualizações avançadas já abertas. Diferenciar um snapshot legitimamente vazio de uma falha temporária de conexão; a política de preservar leituras antigas com aviso em caso de erro deve permanecer explícita.

**Critérios de aceite:**

- [x] A sequência dados válidos → `null` remove as medições anteriores de cards, gráficos, tabelas e heatmaps aplicáveis.
- [x] A aba vazia apresenta mensagem coerente ao abrir ou trocar a data.
- [x] A recuperação com dados válidos volta a renderizar normalmente.
- [x] Os cenários são cobertos para Sala, Quarto e Aquário, com conferência dos resumos globais dependentes.

### COR-04 — Não converter previsão ausente em ausência de chuva

**Problema confirmado:** `resumirChuva` verifica se há horários, mas transforma métricas nulas em zero. Um horário com precipitação e probabilidade nulas retornou `Sem chuva relevante`, estado `favoravel`, probabilidade zero e acumulado zero.

**Arquivo principal:** [environmental-insights.js](../scripts/data/environmental-insights.js), função `resumirChuva`. Consumidores: páginas pública e privada e recomendações de ventilação.

**Correção necessária:** verificar a disponibilidade das métricas antes de classificar a chuva. Preservar valores ausentes; se a cobertura for parcial, identificar o limite da informação. Não apresentar um acumulado completo a partir de uma janela incompleta sem sinalização.

**Critérios de aceite:**

- [x] Janela sem métricas válidas retorna indisponibilidade, não zero ou condição favorável.
- [x] Precipitação zero e probabilidade zero realmente informadas continuam válidas.
- [x] Probabilidade e volume podem ficar indisponíveis de forma independente.
- [x] Dados parciais não produzem uma conclusão de ausência de chuva sem ressalva.
- [x] Recomendações dependentes não tratam indisponibilidade como confirmação de condição favorável.
- [x] Testes cobrem lista vazia, horários com métricas nulas, cobertura parcial e zeros válidos.

### COR-05 — Validar cidade e UF no fallback de CEP

**Problema confirmado:** quando a origem não fornece coordenadas, o fallback pesquisa primeiro somente o nome da cidade e aceita o primeiro resultado. Uma resposta de São Carlos/SP foi aceita para um endereço de São Carlos/SC, mantendo o rótulo de Santa Catarina na tela.

**Arquivo principal:** [external-weather-service.js](../scripts/external/external-weather-service.js), funções `buscarCoordenadasPorEndereco` e `buscarCoordenadaOpenMeteo`.

**Correção necessária:** conferir cidade, estado e país antes de aceitar o resultado. Normalizar a comparação entre siglas e nomes de estados quando necessário. Incluir a UF no texto pesquisado não substitui validar a resposta. Se não houver correspondência segura, apresentar erro acionável.

**Critérios de aceite:**

- [x] Um resultado de outra UF é rejeitado mesmo quando o nome da cidade coincide.
- [x] As coordenadas aceitas correspondem ao local identificado na interface.
- [x] Coordenadas válidas já fornecidas pela origem continuam sendo reutilizadas.
- [x] Testes cobrem cidades homônimas, ausência de correspondência e o caminho direto com coordenadas.

### COR-06 — Respeitar o fuso do local consultado

**Problema confirmado:** os eventos solares públicos pertencem ao local consultado, mas a classificação de dia/noite compara esses eventos com a hora do navegador. Além disso, a normalização interpreta horários externos sem preservar explicitamente o fuso retornado pela API.

**Reprodução:** navegador às 06h30 e local consultado às 04h30, com nascer do sol local às 06h. O indicador classificou o estado como dia.

**Arquivos envolvidos:**

- [external-weather-service.js](../scripts/external/external-weather-service.js): `normalizarRespostaPublica` e eventos solares.
- [main.js](../scripts/main.js): `obterEstadoAstronomico` e contexto público.
- [public-weather-view.js](../scripts/views/public-weather-view.js): interpretação e apresentação dos horários públicos.

**Correção necessária:** preservar a referência temporal do local consultado e comparar eventos e instante atual na mesma base. Revisar também os consumidores de atualização, chuva e contexto astronômico para não manter interpretações divergentes. Não corrigir o caso com um deslocamento fixo global.

**Critérios de aceite:**

- [x] Dia, noite e transição correspondem ao local consultado, mesmo quando seu fuso difere do navegador.
- [x] Horários apresentados têm referência coerente e não sofrem dupla conversão.
- [x] Testes incluem dois fusos distintos, passagem da meia-noite e transições próximas ao nascer/pôr do sol.
- [x] O modo privado conserva a referência temporal prevista para os sensores.

### COR-07 — Recuperar o carregamento após falha

**Problema confirmado:** o carregador mantém a promessa rejeitada nos caches. Na reprodução, duas tentativas de carregar Chart.js criaram somente um script; a segunda retornou o erro anterior sem realizar nova tentativa.

**Arquivos envolvidos:**

- [runtime-loader.js](../scripts/runtime-loader.js): caches de scripts e CSS.
- [main.js](../scripts/main.js): `carregamentoChart`.
- [chat.js](../scripts/chat.js): promessa de carregamento e evento inicial com `once`.
- [pdf-report.js](../scripts/reports/pdf-report.js): promessa dos módulos de relatório e ação de tentar novamente.
- [zoom.js](../scripts/charts/zoom.js): integração com o carregamento de CSS.

**Correção necessária:** invalidar entradas que falharam, tratar os elementos de recurso associados à falha e liberar as promessas superiores para uma nova tentativa. Preservar a deduplicação de carregamentos simultâneos e o reaproveitamento de recursos que carregaram com sucesso.

**Critérios de aceite:**

- [x] A sequência falha → nova tentativa → sucesso funciona sem recarregar a página.
- [x] O botão da assistente permite tentar novamente após erro na primeira abertura.
- [x] A nova tentativa de exportação recupera falhas de dependências.
- [x] Falha de CSS do zoom também pode ser recuperada.
- [x] Chamadas simultâneas não duplicam carregamentos; sucesso não provoca reinicialização desnecessária.
- [x] Testes simulam falha inicial e sucesso posterior nos recursos compartilhados.

### COR-08 — Corrigir o contraste do calendário mensal

**Problema confirmado:** texto `#0b1220` sobre as cores extremas da paleta não alcança o contraste esperado. Foram observadas relações de 4,19:1 sobre `#6366F1` e 4,35:1 sobre `#DC3976`, inferiores aos 4,5:1 exigidos pelo teste. A falha se repetiu em 320, 390 e 1440 px.

**Arquivos envolvidos:**

- [analytics.js](../scripts/data/analytics.js): `coresMediaDiaria`, `corMediaDiaria` e calendário mensal.
- [advanced-views.css](../styles/advanced-views.css): texto das células preenchidas.
- [testar-ui-ux.mjs](../tools/testar-ui-ux.mjs): verificação de contraste dos heatmaps.

**Correção necessária:** ajustar a combinação entre texto e fundo, mantendo o significado das faixas e a distinção de dados ausentes. Não remover ou enfraquecer a asserção para aprovar a suíte.

**Critérios de aceite:**

- [x] Todas as combinações de texto/fundo usadas nas células atendem ao mínimo de 4,5:1 verificado pela suíte.
- [x] A conferência inclui valores extremos, limites das faixas, seleção e ausência de dados.
- [x] `npm run test:ui-ux` passa integralmente nas larguras existentes.
- [x] A verificação de paridade de cores entre calendário mensal e mapa anual continua coerente.
- [x] Capturas móveis e desktop são inspecionadas após o ajuste.

## 4. DOC-01 — Correções da documentação

Atualizar afirmações vigentes com base no comportamento final testado. Preservar resultados históricos datados; uma aprovação anterior não deve ser reescrita como se o teste tivesse falhado naquela data. Acrescentar uma revisão atual quando necessário.

| Documento | Correção ou tratamento necessário |
| --- | --- |
| [README.md](README.md) | Alinhar privacidade da exportação após COR-01; incluir o mapa anual e seus limites na descrição funcional; conferir os comandos de validação disponíveis. |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Documentar as escalas distintas dos mapas mensal/anual e horário/semanal; acrescentar o contrato do mapa anual; alinhar estados vazios, chuva ausente, fuso público e encerramento de sessão às correções. |
| [ARCHITECTURE_AI.md](ARCHITECTURE_AI.md) | Remover a afirmação de ausência de testes funcionais automatizados; explicar reutilização de gráficos, destruição no estado vazio e renderização condicionada à aba ativa; conferir a lista e a ordem reais dos scripts. |
| [DEPENDENCY_MAP.md](DEPENDENCY_MAP.md) | Atualizar os comandos de `package.json`, as ferramentas de teste e as dependências efetivas dos módulos; registrar os fluxos corrigidos quando mudarem relações entre módulos. |
| [AI_QUICK_CONTEXT.md](AI_QUICK_CONTEXT.md) | Acrescentar o mapa anual e resumir os contratos corrigidos que sejam necessários para manutenção futura. |
| [AI_SYSTEM_PROMPT.md](AI_SYSTEM_PROMPT.md) | Atualizar os resumos de consulta pública por cidade, mapa anual e comandos de manutenção; conferir o fechamento do bloco de código ao final do arquivo. |
| [PLANO_LOGIN_GOOGLE_MODO_PUBLICO.md](PLANO_LOGIN_GOOGLE_MODO_PUBLICO.md) | Atualizar a seção “Status Atual” para incluir busca por cidade e recursos públicos posteriores; manter o desenho original identificado como histórico. |
| [ROTEIRO_CSHARP_AJUSTES_RECENTES_2026-10-30.md](ROTEIRO_CSHARP_AJUSTES_RECENTES_2026-10-30.md) | Preservar como referência datada. Qualquer atualização de paridade exige inspecionar novamente o projeto C#; esta auditoria não o revalidou. |
| [UI_UX_ANALYSIS.md](../UI_UX_ANALYSIS.md) | Acrescentar o resultado atual de contraste e sua correção; alinhar o contrato final sobre rótulos de período dos gráficos ao código vigente; distinguir comandos históricos dos atuais. |
| [PROMPT_UI_UX_REDESIGN.md](../PROMPT_UI_UX_REDESIGN.md) | Nenhuma correção funcional obrigatória identificada. Preservar como guia de análise, sem tratá-lo como prova de comportamento implementado. |
| [RELATORIO.md — nomenclatura](nomenclatura-pt-br/RELATORIO.md) | Preservar o registro histórico. Não apresentar seus testes anteriores como validação da versão atual. |

**Critérios de aceite documental:**

- [x] Os documentos vigentes descrevem o mesmo contrato para privacidade, ausência de dados e sessão.
- [x] Nomes de funções, constantes, arquivos e comandos citados correspondem ao código atual.
- [x] O mapa anual está documentado com período, agregação, cobertura, interação, carregamento e escala efetivos.
- [x] Referências históricas estão claramente datadas e separadas do estado atual.
- [x] Nenhum documento declara validação real de serviços ou dispositivos que tenha sido apenas simulada.

## 5. Validação e encerramento

Para cada correção funcional, acrescentar uma regressão de comportamento nas ferramentas existentes, usando Node/VM ou Playwright conforme o caso. As reproduções temporárias da auditoria devem ser convertidas em testes permanentes quando protegerem o contrato corrigido. Não adicionar outro framework de testes para esses itens.

Executar os testes do fluxo alterado durante a implementação. Ao concluir o conjunto, executar na raiz:

```powershell
npm test
```

O comando consolidado já executa `validate`, `lint` e todos os scripts `test:*` registrados em `package.json`. Alguns cenários exigem acesso às CDNs e Chrome ou Edge instalado nos caminhos previstos pelos testes.

Antes de marcar a entrega como concluída:

- [x] Todos os itens implementados têm seus critérios de aceite verificados.
- [x] A suíte consolidada termina sem falhas; registrar a contagem efetiva da versão final.
- [x] JSON exportado foi inspecionado quanto à ausência de coordenadas e à preservação dos dados esperados.
- [x] PDFs afetados foram abertos e conferidos, além das asserções automatizadas.
- [x] Transição de sessão, recuperação de rede, estados vazios e fusos distintos foram exercitados.
- [x] A documentação impactada foi revisada junto do comportamento final.
- [x] Este plano distingue itens concluídos, pendentes e verificações que não puderam ser realizadas, com evidência e data.

## 6. Limites da auditoria

Não foram certificados login Google real, regras remotas do Firebase, sensores físicos, Gemini real, disponibilidade das APIs externas, Safari/iOS, leitores de tela ou aparelhos físicos. Testes com dados sintéticos e emulação de viewport não substituem essas verificações.

A solução C# não faz parte da implementação deste plano. Roteiros de migração são referências documentais; sua execução e validação dependem da inspeção do projeto de destino.

## 7. Encerramento da implementação — 24/11/2026

Entrega concluída no projeto JavaScript. A execução final de `npm test` terminou com **25/25 comandos aprovados**: validação estrutural, ESLint e 23 comandos funcionais `test:*`. A validação estrutural conferiu 46 arquivos JavaScript ativos e os contratos HTML/config/CSS. Nenhum framework de testes foi adicionado.

| Item | Implementação e evidência permanente |
| --- | --- |
| COR-01 | Objeto externo exportável selecionado em `montarClimaExternoExportavel`; serialização bloqueia latitude, longitude e precisão em qualquer nível. `test:audit-fixes` inspeciona Blobs JSON reais das quatro abas, preservando clima, chuva e origem textual. |
| COR-02 | Encerramento centralizado no fluxo de autenticação, diálogos fechados sem devolver foco ao privado, limpeza de caches/apresentação, invalidação por geração de sessão. `test:audit-fixes` cobre zoom, carregamento da assistente, resposta, localização e exportação pendentes, interatividade pública e novo login. `test:firebase-cycle` verifica cancelamento/reinicialização sem listeners duplicados; `test:ui-ux` cobre restauração de inert e rolagem. |
| COR-03 | Filtro por data aceita `null`; callbacks vazios renderizam as três views e mapas recolhidos já montados são apagados. `test:audit-fixes` exercita dados válidos → erro → null → recuperação em Sala, Quarto e Aquário e confere o resumo global. `test:mapa-anual` verifica limpeza e reconstrução da grade recolhida. |
| COR-04 | Métricas independentes anuláveis, indisponibilidade sem métricas, aviso de cobertura e acumulado parcial, ventilação com ressalva. UI e relatório formatam ausência sem falhar. `test:audit-fixes` e `test:report` cobrem ausência, zeros, cobertura parcial, lacunas e consumidores. |
| COR-05 | Fallback confere cidade, UF normalizada e país; preserva coordenadas diretas da origem. `test:audit-fixes` rejeita São Carlos/SP para um CEP de SC, aceita a correspondência correta e verifica o caminho direto sem geocodificação. |
| COR-06 | APIs pedem instantes Unix; normalização preserva fuso IANA, data local, séries UTC e eventos por dia. Indicador compara relógio local e eventos da mesma data; views, chuva e PDF formatam o horário consultado. `test:audit-fixes` cobre Rio Branco e São Paulo, meia-noite e transições solares; os testes de janela e relatório preservam o contrato privado. |
| COR-07 | Falhas removem recursos e promessas do cache; fachadas liberam nova tentativa e mantêm deduplicação/sucessos. `test:audit-fixes` simula falha/sucesso de Chart.js e CSS do zoom e recuperação da assistente; `test:export` simula falha/sucesso dos módulos do relatório e timeout. |
| COR-08 | Texto das células preenchidas alterado para #000000, sem mudar a paleta. `test:mapa-anual` confere todas as faixas, limites, extremos e contraste ≥4,5:1; `test:ui-ux` passa nas larguras 320/390/1440 e mantém seleção/ausência. Capturas móveis e desktop inspecionadas visualmente. |
| DOC-01 | README, regras, arquitetura, dependências, contextos de IA, status de login, roteiro anual e análise UI/UX revisados. Blocos Markdown e comandos atuais conferidos. Roteiros C# datados, nomenclatura histórica e documentos sem divergência obrigatória foram preservados. |

Evidências locais:

- [Log da suíte final — 25/25](../ui-ux-evidence/2026-11-24-auditoria/validacao-final.log).
- [Regressão permanente da auditoria](../tools/testar-correcoes-auditoria.mjs), registrada como `npm run test:audit-fixes`.
- [Heatmaps em 320 px](../ui-ux-evidence/2026-11-24-auditoria/heatmaps-320.png) e [1440 px](../ui-ux-evidence/2026-11-24-auditoria/heatmaps-1440.png).
- [PDF sintético móvel](../ui-ux-evidence/2026-11-24-auditoria/relatorio-390.pdf) e [desktop](../ui-ux-evidence/2026-11-24-auditoria/relatorio-1440.pdf), ambos com quatro páginas. Páginas renderizadas por Poppler e conferidas quanto a cards, dados ausentes, paginação, gráfico de chuva, eixos e legenda; PNGs na mesma pasta.

A primeira execução consolidada desta implementação ficou em 24/25: a autenticação real iniciada em segundo plano interferiu no artefato PDF sintético depois que o encerramento de sessão passou a limpar o DOM. O teste `testar-pdf-chuva.mjs` passou a isolar `main.js`, como os demais testes visuais de artefatos; o ciclo real de apresentação/autenticação da aplicação permanece coberto com serviços simulados em `test:audit-fixes`. A execução consolidada posterior foi integralmente aprovada. [Log da primeira execução](../ui-ux-evidence/2026-11-24-auditoria/primeira-execucao.log).

Permanecem fora desta validação: login Google real, regras remotas Firebase, sensores físicos, Gemini real, disponibilidade das APIs externas, Safari/iOS, leitores de tela e aparelhos físicos. O projeto C# não foi alterado nem revalidado. Nenhuma dessas verificações é apresentada como concluída por testes sintéticos.
