# Plano de aplicação das correções da auditoria no C#

Data: **24/11/2026**. Situação: **planejamento concluído; implementação C# pendente**.

Origem validada: projeto JavaScript em `D:/Documentos/03_Projetos/estacao climatica web/atualizacao claude`, com COR-01 a COR-08 e DOC-01 concluídos e `npm test` aprovado em 25/25 comandos. Consulte [o plano original e suas evidências](PLANO_CORRECOES_AUDITORIA_2026-11-24.md).

Destino inspecionado em leitura: `D:/Documentos/03_Projetos/Estacao climatica C#`, solução `EstacaoClimatica.sln`, commit local `ebe70c7` (`feat(heatmaps): adicionar mapa anual e unificar a escala diária`). Existem alterações locais e divergência entre a branch local e a referência remota. Este plano não autoriza descartá-las, sincronizar branches ou publicá-las.

A inspeção confirmou nomes de arquivos e caminhos existentes, mas não executou build, testes ou reprodução dos defeitos no C#. Os estados abaixo distinguem observações estáticas de verificações ainda necessárias. Não considerar a aprovação do JavaScript como aprovação do destino.

## 1. Escopo e arquitetura a preservar

- Aplicar os contratos corrigidos nos serviços C# e no frontend próprio de `wwwroot`, aproveitando implementações existentes.
- Preservar Controllers, autorização no servidor, consultas REST Firebase, cache por consulta, SSE e `CancellationToken`/`AbortController`. Não transportar listeners Firebase do navegador do original.
- Não substituir arquivos inteiros pela versão JavaScript original: os modelos, nomes de ambientes e organização dos módulos são diferentes.
- Preservar contratos JSON existentes; acrescentar somente os campos necessários, com atualização conjunta dos construtores, consumidores, fixtures e testes. Não expor histórico bruto nem ampliar a coleta de localização.
- Usar a suíte xUnit/Microsoft.Playwright já instalada em `tests/EstacaoClimatica.Tests`; não adicionar outro framework.
- O mapa anual e a escala fixa de dez cores **já existem no C#**. O [roteiro anual anterior](ROTEIRO_CSHARP_HEATMAP_365_DIAS.md) é referência funcional; não executar novamente sua implantação.

## 2. Diagnóstico e sequência sugerida

| ID | Prioridade | Observação no C# inspecionado | Próxima ação |
| --- | --- | --- | --- |
| CS-01 / COR-01 | P1 | `montarClimaExternoJson` já seleciona origem textual; `baixarJson` serializa objetos aninhados sem filtro adicional | Preservar a seleção existente e testar/garantir ausência de coordenadas em qualquer nível |
| CS-02 / COR-02 | P1 | Já cancela dashboard, SSE e mapa anual e destrói gráficos na volta ao público; encerramento completo de chat, zoom, localização e exportação não está centralizado | Completar o encerramento e invalidar operações pendentes |
| CS-03 / COR-03 | P1 | API diferencia `RamosComFalha` e frontend preserva dados dos ramos com falha; fluxo de vazio possui contratos próprios | Reproduzir válido → vazio → recuperação e corrigir apenas os pontos que preservarem apresentação antiga |
| CS-04 / COR-04 | P2 | Probabilidade/volume já são anuláveis, mas `ResumirChuva` pode classificar janela sem métricas como favorável; não há sinalização de cobertura parcial no modelo | Corrigir classificação, cobertura e consumidores |
| CS-05 / COR-05 | P2 | Fallback de CEP pede `count=1` e aceita o primeiro resultado sem validar cidade/UF/país | Validar a correspondência antes de aceitar coordenadas |
| CS-06 / COR-06 | P2 | `PublicWeatherData` não preserva o fuso consultado; normalização usa texto sem offset e indicador compara horas do navegador | Definir referência temporal explícita no backend e atualizar consumidores |
| CS-07 / COR-07 | P2 | Carregador já remove script/CSS e cache ao falhar; abertura do chat permite nova tentativa | Preservar o mecanismo e testar também dependências do PDF e operações após logout |
| CS-08 / COR-08 | P2 | Mensal/anual já usam `coresMediaDiaria`; células mensais herdam `--text-primary` e não recebem classe de preenchimento | Ajustar texto/fundo e medir contraste mantendo a paleta |
| CS-DOC / DOC-01 | P2 | Documentação e testes anteriores descrevem a versão C# anterior à presente migração | Registrar somente comportamento implementado e resultados executados no destino |

Implementar nessa ordem, ou agrupar contratos temporais de CS-04/CS-06 quando necessário. Manter mudanças pequenas e verificáveis; não refazer recursos já atendidos.

## 3. CS-01 — Privacidade da exportação

**Arquivos:** `src/EstacaoClimatica.Web/wwwroot/scripts/pdf-report.js`; testes de exportação em `FrontendBrowserTests.cs` e contratos em `FrontendParityTests.cs`.

1. Rastrear `montarRelatorioPdf`, `exportarRelatorioJson`, `montarClimaExternoJson`, dados brutos e `baixarJson`. Conferir exportações de Estação, Sala, Quarto e Aquário.
2. Manter a origem com `tipo` e `rotulo`, já existentes. Exportar apenas os campos climáticos necessários, inclusive chuva e insights.
3. Bloquear `latitude`, `longitude` e `precisao` também em estruturas aninhadas serializadas. Se houver suporte a variantes legadas de nomes, cobri-las explicitamente nos testes. Não depender apenas de ocultar campos na interface.
4. Não chamar geolocalização nem `/api/public-weather/*` durante exportação; usar o snapshot já disponível.
5. Não remover coordenadas dos DTOs usados para efetuar consultas por cidade/localização apenas para corrigir o arquivo exportado.

**Aceite:** capturar o download JSON real e percorrer recursivamente todas as propriedades com coordenadas sintéticas na entrada; verificar origem textual, métricas e nulos preservados. Confirmar ausência de chamadas adicionais de localização/clima. A saída deve respeitar o contrato de cada aba, sem acrescentar dados externos a uma aba que não os exportava.

## 4. CS-02 — Encerramento da sessão privada

**Arquivos:** `wwwroot/app.js` (`pararPainelInterno`, gerações e SSE); `scripts/public-weather.js` (`mostrarPublico`); `scripts/chat.js`; `scripts/zoom.js`; `scripts/runtime-loader.js`; `scripts/pdf-report.js`; `scripts/views/station-view.js`; `scripts/heatmaps.js`. Todos sob `src/EstacaoClimatica.Web/`.

1. Fechar zoom e chat **antes** de ocultar o privado. Restaurar rolagem, estados `inert` anteriores quando utilizados e interatividade; impedir foco imediato ou agendado em controles privados ocultos.
2. Reutilizar a geração de sessão ou o mecanismo de cancelamento existente. Invalidar todas as conclusões tardias: carregamento inicial do chat/zoom, resposta de `/api/chat`, consulta de localização/clima, preparação de exportação e captura/geração de PDF.
3. Cancelar requisições HTTP com `AbortController` quando disponível, além de conferir a sessão após cada `await`. Geolocalização pode concluir sem cancelamento nativo; sua resposta deve ser descartada.
4. Limpar conversa e memória do chat, cache externo privado, dados de apresentação, referências a gráficos e tentativas de exportação. Remover raízes temporárias de PDF e impedir download depois da saída, inclusive se a captura já começou.
5. Preservar os cancelamentos atuais de dashboard, SSE, timers e mapa anual. Não registrar novamente listeners de UI a cada login.
6. Conservar a autorização real dos endpoints e a propagação de `CancellationToken` no backend. O fechamento de UI complementa a autorização existente.

**Aceite:** simular mudança do estado de autenticação, inclusive sem clicar em Sair. Exercitar logout com zoom aberto, chat carregando, resposta pendente, localização pendente e exportação pendente. O público deve receber foco/clique/rolagem; nenhuma operação antiga deve reabrir UI, escrever conversa ou baixar arquivo após sair ou entrar novamente. Novo login restaura as funcionalidades sem duplicar requisições/listeners/SSE. Reutilizar e ampliar `FrontendBrowserTests.cs` e os testes existentes de cancelamento do mapa anual.

## 5. CS-03 — Vazio legítimo versus falha de conexão

**Arquivos:** `Infrastructure/Firebase/FirebaseDataSource.cs`, `Infrastructure/Firebase/FirebaseUpdatesObserver.cs`, `Infrastructure/Repositories/FirebaseClimateDataRepository.cs`, `Application/Services/FirebaseDashboardData.cs`, `Application/Services/ClimateDashboardService.cs`, builders de ambiente/estatísticas/heatmaps, `wwwroot/app.js`, `scripts/views/dashboard-view.js`, `scripts/views/station-view.js` e `scripts/heatmaps.js`.

1. Rastrear o retorno JSON `null` desde a fonte/cache até `DadosDashboardFirebase` e `DashboardResponse`. Não classificar sucesso vazio como `RamosComFalha`/`failedBranches`.
2. Usar os DTOs vazios já produzidos pelos builders para atualizar cards, gráficos, tabelas, AQI e resumos globais. Não introduzir um segundo formato de dashboard vazio.
3. Conferir invalidação por SSE e cache: após remoção legítima do ramo, a próxima consulta não pode recuperar o snapshot anterior como se fosse sucesso atual.
4. Atualizar ou apagar apresentações inativas já montadas, inclusive mapas recolhidos. Ao abrir a aba/seção ou trocar a data, renderizar o cache atual vazio. Preservar o carregamento sob demanda do mapa anual.
5. Preservar a política atual de dados antigos **somente nos ramos com falha**, com aviso explícito; uma nova resposta válida remove o aviso e substitui os dados.

**Aceite:** para Sala, Quarto e Aquário, executar válido → null → mudança de aba/data → válido. Conferir cards, linhas de tabela, destruição/esvaziamento dos gráficos, mapas aplicáveis e resumo de Estação. Separadamente, erro HTTP deve preservar as últimas leituras e apresentar aviso. Ampliar `FirebaseDataSourceTests.cs`, `FirebaseClimateDataRepositoryTests.cs`, `ClimateDashboardServiceTests.cs`, `FirebaseUpdatesTests.cs` e testes de navegador conforme o trecho alterado.

## 6. CS-04 — Chuva ausente e cobertura parcial

**Arquivos:** `Application/Services/EnvironmentalInsightsService.cs` (classe `ServicoAnalisesAmbientais`), `Domain/PublicWeatherModels.cs` (`RainForecastInsight`), `Infrastructure/External/PublicWeatherService.cs`; consumidores em `wwwroot/scripts/public-weather.js`, `views/station-view.js`, `chuva.js` e `pdf-report.js`.

1. Preservar `double?` para probabilidade, intensidade e acumulado. Valores zero efetivamente informados continuam válidos.
2. Quando nenhuma métrica válida existir, retornar indisponibilidade, com os valores ausentes nulos. Uma lista de horários não comprova disponibilidade das métricas.
3. Identificar lacunas temporais, janela insuficiente e disponibilidade incompleta de cada métrica. Acrescentar ao contrato o indicador mínimo necessário de cobertura parcial, atualizando construtores/fixtures sem apagar propriedades existentes.
4. Calcular acumulado apenas com volumes válidos e sinalizar que é parcial quando aplicável. Não concluir ausência de chuva a partir de uma janela incompleta.
5. Recomendações de ventilação devem incluir ressalva quando a previsão estiver ausente ou parcial. Revisar também a combinação interna/externa no frontend da Estação.
6. Formatar valores nulos como `--` nos cards, PDF e JSON; evitar interpolação de null como zero e chamadas `.toFixed` sobre valores ausentes. Alinhar o horário do pico a CS-06.

**Aceite:** em `EnvironmentalInsightsServiceTests.cs`, cobrir lista vazia, todos os valores nulos, somente probabilidade, somente volume, zeros válidos, lacuna intermediária e janela truncada. Testar consumidores reais e relatório com os mesmos cenários. O volume parcial deve ter ressalva visível e o JSON deve preservar null.

## 7. CS-05 — Cidade/UF corretas no fallback de CEP

**Arquivos:** `Infrastructure/External/PublicWeatherService.cs`, principalmente `BuscarCoordenadasPorEnderecoAsync`; `tests/EstacaoClimatica.Tests/PublicWeatherServiceTests.cs`. Revisar tratamento de erro no `PublicWeatherController.cs`.

1. Continuar reutilizando coordenadas válidas fornecidas pelo serviço de CEP.
2. No fallback, consultar candidatos suficientes e aceitar somente país BR, cidade e estado correspondentes. Normalizar acentos, caixa e equivalência entre siglas e nomes dos 27 estados/DF.
3. Colocar a UF no termo de busca ajuda, mas não substitui validar a resposta. Não aceitar o primeiro candidato apenas porque suas coordenadas são numéricas.
4. Sem correspondência segura, retornar erro esperado e acionável, compatível com o padrão do controller e da UI. Não apresentar um estado na tela e coordenadas de outro.

**Aceite:** São Carlos/SC rejeita São Carlos/SP; selecionar a correspondência correta quando vier depois da incorreta; rejeitar país/cidade diferentes e ausência de correspondência. O caminho com coordenadas diretas não deve fazer geocodificação. Usar `HttpMessageHandler`/fixtures já existentes, sem depender de API ao vivo.

## 8. CS-06 — Instantes e fuso do local público

**Arquivos:** `Infrastructure/External/PublicWeatherService.cs`, `Domain/PublicWeatherModels.cs`, `Application/Services/EnvironmentalInsightsService.cs`; `wwwroot/scripts/ui.js`, `public-weather.js`, `views/station-view.js`, `chuva.js` e `pdf-report.js`. Revisar cache público em sessionStorage e fixtures de `PublicWeatherServiceTests.cs`/navegador.

1. Pedir `timeformat=unixtime` em Forecast e Air Quality e preservar o identificador IANA `timezone`. Converter instantes Unix para uma representação com offset explícito, preferencialmente `DateTimeOffset` no processamento C# e ISO UTC no JSON consumido pelo JavaScript.
2. Manter datas diárias como datas civis do local consultado. Não obter o dia da previsão cortando uma string UTC nem usar `DateTime.Now` do servidor para substituir silenciosamente o horário externo.
3. Acrescentar `fusoHorario`, referência de data local e eventos solares por data, ou contrato equivalente mínimo. O indicador deve escolher os eventos da data local atual e comparar com o relógio desse mesmo fuso.
4. Interpretar e apresentar atualização, séries horárias, pico de chuva, tooltips, AQI e PDF nessa referência. Evitar dupla conversão e deslocamento global fixo. No frontend, usar `Intl.DateTimeFormat` com o fuso retornado.
5. Atualizar o contexto público a cada minuto, inclusive na passagem da meia-noite. Sem eventos para a data local, mostrar indisponibilidade; não reutilizar indevidamente os eventos de ontem.
6. Preservar o relógio dos sensores e as regras existentes de `RelogioClimatico` no privado. Fazer a conversão pública separadamente. Definir o comportamento para cache público anterior sem fuso, por exemplo invalidando a versão antiga.
7. Se o backend precisar converter para hora civil, validar a resolução dos identificadores IANA no sistema operacional de implantação. Não alterar todo o sistema de datas para resolver apenas o contrato público.

**Aceite:** fixtures equivalentes para São Paulo e Rio Branco, navegador em outro fuso, passagem da meia-noite UTC e local, antes/no instante/depois do nascer e pôr do sol, horário de pico e atualização. Incluir uma transição de horário de verão se o contrato aceitar localidades que a utilizem. Confirmar que a mesma previsão conserva o instante e exibe o horário local esperado. Executar regressões privadas de datas e janela móvel.

Referência da API: [Open-Meteo — timeformat e timezone](https://open-meteo.com/en/docs). A implementação deve manter a semântica de instantes Unix e a referência civil do fuso retornado.

## 9. CS-07 — Nova tentativa de dependências

**Arquivos:** `wwwroot/scripts/runtime-loader.js`, `zoom.js`, `chat.js`, `pdf-report.js` e chamadores em `app.js`.

O carregador C# inspecionado **já** remove script/CSS e entrada do cache em `onerror`; o botão inicial da assistente não usa listener descartado após uma tentativa com falha. Preservar isso.

1. Testar primeiro o mecanismo existente antes de alterar produção.
2. Revisar promessas superiores e carregamento interno de html2canvas/jsPDF para não manter rejeição ou elemento quebrado. Reaproveitar o carregador existente quando aplicável.
3. Garantir falha → tentar novamente → sucesso para Chart, chat, módulos/bibliotecas do PDF e CSS do zoom; incluir o botão de nova tentativa da exportação.
4. Deduplicar chamadas simultâneas e manter os recursos bem-sucedidos em cache. Não reinicializar UI/eventos após sucesso e não reabrir sessão encerrada ao concluir um retry.

**Aceite:** interceptar requisições no Playwright, falhar somente a primeira, liberar a seguinte e contar recursos/eventos. Sucesso sem recarregar a página. Se um caminho já passar integralmente, entregar o teste e registrar que não precisou de alteração funcional.

## 10. CS-08 — Paleta compartilhada e contraste dos heatmaps

**Arquivos:** `wwwroot/scripts/heatmaps.js`, `wwwroot/styles/advanced-views.css`; `tests/EstacaoClimatica.Tests/AnnualHeatmapBrowserTests.cs` e cenários visuais de `FrontendBrowserTests.cs`.

A paleta e `corMediaDiaria` já estão presentes no destino. Preservar as dez cores, nesta ordem:

`#6366F1`, `#4385DC`, `#38B4ED`, `#24C6B7`, `#A3D65C`, `#F2D450`, `#FFAA42`, `#F77A39`, `#EF5350`, `#DC3976`.

Faixas em °C: <15; 15 a <17,5; 17,5 a <20; 20 a <22,5; 22,5 a <25; 25 a <27,5; 27,5 a <30; 30 a <32,5; 32,5 a 35 inclusive; >35. Ausência tem cor própria.

1. Em `criarCelulaCalor`, marcar os valores numéricos válidos e aplicar texto preto `#000000` às células preenchidas com conteúdo, preservando o texto sobre fundos de ausência.
2. Manter `corMediaDiaria` compartilhada por calendário mensal e mapa anual. Não alterar as escalas relativas min/max dos mapas horário/semanal.
3. Medir texto/fundo nas células mensais: todas as combinações devem atingir pelo menos **4,5:1**, incluindo seleção e extremos. Não enfraquecer asserções nem trocar a paleta sem necessidade.
4. No anual, as células não têm texto interno: testar paridade de cores, foco/seleção, legenda e detalhe externo. Não declarar contraste de texto dentro de células que não o possuem. Se o destino passar a mostrar texto nelas, medir esse par também.

**Aceite:** ampliar o teste existente de paridade anual/mensal com limites 14,9; 15; 17,5; 20; 22,5; 25; 27,5; 30; 32,5; 35; 35,1, além de dia ausente e selecionado. Conferir 320, 390 e 1440 px, navegação por teclado/toque e capturas visuais. Preservar os testes atuais de carregamento anual, cache, cancelamento e período de 365 dias.

## 11. Documentação e versionamento dos assets

No destino, revisar `docs/README.md`, `BUSINESS_RULES.md`, `DEPENDENCY_MAP.md`, `CONTRATO_MODO_PUBLICO.md` e `API_CONSULTAS.md` apenas nos contratos impactados. Registrar a paridade desta entrega em documento datado, por exemplo `docs/PARIDADE_CORRECOES_AUDITORIA_2026-11-24.md`, quando a implementação for executada.

- Identificar itens implementados, já atendidos e pendentes, com arquivos e resultados reais.
- Descrever privacidade da exportação, sessão, vazio versus erro, chuva parcial, fuso público e diferença entre contraste textual e paridade da paleta.
- Atualizar referências de versão somente dos assets alterados, inclusive módulos carregados sob demanda, manifesto CSS e HTML conforme a convenção do C#.
- Preservar registros de paridade anteriores como históricos. Este plano e o roteiro de 30/10 não certificam o estado final futuro.

## 12. Execução e validação futura

Antes de editar no C#, ler as instruções vigentes, conferir `git status` e registrar os arquivos já alterados. Executar a baseline e registrar falhas anteriores. Não fazer reset, sincronização integral de pastas ou alteração das branches para aplicar este plano.

Na raiz do destino:

```powershell
dotnet build EstacaoClimatica.sln
dotnet test EstacaoClimatica.sln
```

Durante a implementação, executar os testes focados nos serviços/builders alterados e na classe de navegador existente. Confirmar que os testes de navegador realmente executaram; ausência do navegador, testes ignorados ou falha ao iniciar o servidor não contam como aprovação. A paridade ao vivo usa `RUN_LIVE_PARITY=1` e configuração própria: registrar separadamente se não for executada.

Para conferência manual, usar o perfil existente após verificar a porta:

```powershell
dotnet run --project src/EstacaoClimatica.Web/EstacaoClimatica.Web.csproj --launch-profile http
```

## 13. Checklist de encerramento da migração

- [ ] Baseline e alterações locais do destino registradas e preservadas.
- [ ] JSON das quatro abas inspecionado recursivamente quanto à privacidade e aos nulos.
- [ ] Logout por mudança de autenticação, operações pendentes e novo login exercitados.
- [ ] Vazio, falha temporária e recuperação conferidos nas três abas e no resumo global.
- [ ] Chuva sem métricas, zeros válidos, métricas independentes e cobertura parcial testados em serviço/UI/relatório.
- [ ] CEP homônimo com UF incorreta rejeitado e coordenadas diretas preservadas.
- [ ] Fusos distintos, meia-noite e transições solares testados sem alterar a referência dos sensores privados.
- [ ] Retentativas de dependências, concorrência e reaproveitamento após sucesso verificados.
- [ ] Paleta mensal/anual idêntica e contraste textual mensal ≥4,5:1, com capturas inspecionadas.
- [ ] PDFs gerados abertos/renderizados e conferidos; testes de download não são a única validação.
- [ ] Build e suíte final executados, com contagem, falhas e testes ignorados registrados.
- [ ] Documentação e versões de assets alinhadas ao comportamento final.

**Limites desta entrega de planejamento:** nenhum arquivo do C# foi alterado, nenhum build/teste C# foi executado e não foram certificados login Google real, regras remotas Firebase, sensores, Gemini, APIs ao vivo, Safari/iOS, leitores de tela ou aparelhos físicos. A publicação solicitada nesta conversa refere-se ao projeto JavaScript.
