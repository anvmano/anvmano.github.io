# Migrar o mapa anual de temperatura para o C#

Referência funcional: [commit 14eeced do projeto original](https://github.com/anvmano/anvmano.github.io/commit/14eeced). Destino: solução EstacaoClimatica.sln. Implementar somente nas abas privadas Sala e Quarto, dentro de Visualizações Climáticas, após o mapa semanal. Não alterar a página pública, Estação, Aquário, PDF, JSON de exportação ou assistente.

## 1. Confirmar de onde vêm os dados

No destino, seguir o fluxo de EnvironmentDashboardBuilder.cs até MontadorMapaCalor em src/EstacaoClimatica.Application/Builders/HeatmapBuilder.cs. Identificar onde o repositório entrega a raiz do ambiente, onde o montador restringe o mês e onde o frontend detecta a expansão da seção. Não montar o ano concatenando respostas do dashboard mensal: as médias arredondadas não recuperam a cobertura horária.

## 2. Definir o contrato mínimo

Representar um dia por data civil, média anulável e número de horas distintas com temperatura válida. Exemplo de resposta: `{"data":"2024-02-29","media":24.0,"horariosValidos":2}`. Um dia ausente é representado por média null e cobertura zero. Usar o padrão de DTOs de src/EstacaoClimatica.Domain/DashboardModels.cs. Manter os contratos mensais existentes e nunca enviar o histórico bruto ao navegador.

## 3. Calcular as 365 médias no backend

- Usar como fim a data selecionada, não o relógio do servidor. Início inclusivo: `fim.AddDays(-364)`. Usar datas civis e o fuso já adotado pelo dashboard.
- Partir da fonte anterior ao filtro mensal. Reutilizar os campos de temperatura de Sala e Quarto, a normalização e a regra de validade do calendário mensal.
- Percorrer os registros válidos da janela uma vez. Agrupar por **data completa**, não pelo número do dia. Dividir a soma de todas as temperaturas válidas pela quantidade de medições válidas; não calcular média das médias horárias. Arredondar só na apresentação.
- Contar separadamente as horas distintas de cada dia (0 a 23). Duas leituras às 10h entram duas vezes na média, mas contam como um horário coberto.
- Enumerar os 365 dias em ordem cronológica e preencher as lacunas com null. Incluir 29/02 quando estiver na janela; não usar “mesmo dia do ano passado”.

## 4. Carregar somente quando necessário

Reutilizar um fluxo de consulta privada sob demanda, se ele existir. Caso o contrato atual só entregue o mês no carregamento inicial, adicionar uma consulta privada específica para ambiente e data final, sob a mesma autorização das APIs internas. Validar ambiente e data no servidor; não aceitar caminhos Firebase fornecidos pelo cliente.

Não adicionar o ano a toda resposta do dashboard nem disparar 365 leituras remotas por abertura. Preferir a raiz já carregada ou o cache do repositório; conferir o comportamento com cache frio antes de afirmar que não há acesso adicional ao Firebase. Se a fonte não comportar essa leitura, medir primeiro e tratar agregados persistidos como uma decisão separada.

Na primeira expansão, pedir o mapa do ambiente ativo. Reabrir o mesmo período deve reutilizar o resultado válido em memória. Ao trocar data ou ambiente, usar a chave correta e ignorar respostas antigas; no logout, cancelar a consulta e limpar dados privados. Invalidar pelo fluxo de atualização existente quando a temperatura mudar. Diferenciar falha de carregamento de um ano legitimamente sem dados.

## 5. Montar a grade no frontend

Em src/EstacaoClimatica.Web/wwwroot, usar index.html para os dois recipientes, scripts/heatmaps.js para o desenho e styles/advanced-views.css para o estilo. Registrar os IDs na configuração de cada ambiente e versionar os assets alterados conforme a convenção local. Não copiar os scripts inteiros nem adicionar Chart.js para esse mapa.

- Título: **Temperatura média diária · últimos 365 dias**. Um dia por célula, semanas em colunas e segunda a domingo em linhas. Mostrar os meses no topo; alinhamento no início e no fim não pode inventar datas.
- Usar a mesma escala fixa dos calendários mensal e anual do original. Referência revisada em 24/11/2026: `scripts/data/analytics.js`, `coresMediaDiaria` e `corMediaDiaria`. Calendário mensal e mapa anual compartilham `coresMediaDiaria` e `corMediaDiaria`: dez cores fixas. Faixas em °C: <15; 15 a <17,5; 17,5 a <20; 20 a <22,5; 22,5 a <25; 25 a <27,5; 27,5 a <30; 30 a <32,5; 32,5 a 35 (inclusive); >35. Dados ausentes têm cor própria. Os mapas horário e semanal usam escala relativa min/max dos valores exibidos, interpolada entre azul, verde e rosa; não compartilham os limites fixos de temperatura dos mapas diário e anual. O texto das células preenchidas usa `#000000`, preservando a paleta e contraste mínimo de 4,5:1.
- Ao passar o mouse, tocar ou focar uma célula, mostrar por exemplo **29/02/2024 · Média: 24,0 °C · 2 de 24 horários**. Sem leitura, mostrar a data e “Sem dados”.
- Uma única célula no percurso de Tab. Setas verticais avançam ou recuam um dia; horizontais, sete dias, sem sair da janela. Dar nome acessível completo a cada botão.
- No celular, rolar apenas a grade, sem trocar a aba ao arrastar. Começar no dia mais recente na abertura de um período; não reposicionar a grade durante uma atualização do mesmo período.

## 6. Validar antes de encerrar

1. **Teste de cálculo:** selecionar 01/03/2024. Esperar exatamente 365 datas, de 03/03/2023 a 01/03/2024. Em 29/02, inserir 20 e 24 °C às 10h e 28 °C às 11h: média 24,0 °C, cobertura 2/24. Comparar com o calendário mensal, incluindo paridade de cores nas dez faixas, extremos e limites. Incluir registro inválido, dia vazio e registro fora da janela.
2. **Teste de API e carga:** com seção fechada, zero pedidos anuais. Na primeira abertura, um pedido para o ambiente ativo; na reabertura sem mudança, nenhum novo pedido. Medir consultas ao Firebase, bytes da resposta e tempo em cache frio e quente. Confirmar que visitante e conta não autorizada não recebem dados privados.
3. **Teste de navegador:** adaptar tools/testar-mapa-anual.mjs do original para a suíte Playwright existente em tests/EstacaoClimatica.Tests. Conferir os dois ambientes com dados diferentes, mudança de data, logout com resposta pendente, teclado, toque, legenda, larguras de 320/390 px e desktop. O mapa não deve existir na página pública nem ocupar espaço quando recolhido.
4. **Executar na raiz:** `dotnet build EstacaoClimatica.sln` e `dotnet test EstacaoClimatica.sln`. Registrar resultados reais e falhas preexistentes. Não alterar o projeto original nem publicar sem autorização.

## Limite desta revisão

A revisão de 24/11/2026 conferiu apenas o projeto JavaScript de origem. Não revalidou a solução C#, serviços reais ou sensores. Este roteiro orienta uma migração futura e não comprova paridade implementada no destino.
