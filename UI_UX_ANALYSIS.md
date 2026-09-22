# Análise total de UI/UX

Data da análise: 22/09/2026

## Escopo

Esta análise cobre o modo público, as abas Estação, Sala, Quarto e Aquário, o cabeçalho, a navegação, a seleção de data, a exportação, os gráficos, as visualizações avançadas, as tabelas, a assistente e o PDF.

Nenhuma mudança foi feita no HTML, CSS ou JavaScript da aplicação nesta rodada. Este documento é apenas um diagnóstico para revisão e autorização.

## Como a avaliação foi feita

- Leitura da documentação funcional e técnica em `docs/`.
- Inspeção de `index.html`, dos estilos e dos módulos de interface e gráficos.
- Validação visual em `1440x1000`, `768x1024`, `390x844` e `720x360`.
- Simulação do modo público preenchido e da aba Estação com dados representativos.
- Medição de estouro horizontal, altura da página, dimensões de gráficos e alvos de toque.
- Execução de validação, lint e toda a suíte relevante de testes.

Todos os testes existentes passaram. Isso confirma a estabilidade dos contratos atuais, mas não elimina os problemas de composição e legibilidade descritos abaixo.

## Conclusão executiva

O projeto evoluiu bastante: a identidade visual está consistente, o desktop está organizado, os estados têm boa coerência e a base de acessibilidade é melhor do que a média. A interface já não parece uma coleção desconectada de componentes.

O principal problema atual é responsivo, não estético. No celular, a mesma quantidade de informação do desktop é empilhada em uma coluna estreita. Isso torna gráficos densos, textos pequenos e páginas muito longas. No tablet existe ainda uma faixa de largura sem tratamento adequado, causando corte real nas abas.

As quatro melhorias mais importantes são:

1. Criar uma apresentação móvel específica para o gráfico de chuva.
2. Corrigir o intervalo entre `641px` e aproximadamente `960px`.
3. Impedir que a assistente flutuante cubra conteúdo.
4. Reduzir a extensão vertical dos resumos e gráficos no celular.

## Diagnóstico priorizado

| Prioridade | Problema | Impacto | Recomendação |
| --- | --- | --- | --- |
| P0 | Gráfico de chuva comprimido no celular | Leitura difícil e comparação imprecisa | Usar composição móvel própria, sem duas escalas e três séries disputando o mesmo espaço |
| P0 | Abas cortadas no tablet | Navegação parcialmente escondida em `768px` | Adicionar breakpoint intermediário e empilhar abas e toolbar |
| P0 | Assistente cobre cards e gráficos | Oculta informação e atrapalha toque | No mobile, usar botão compacto e painel em formato de bottom sheet |
| P1 | Páginas móveis excessivamente longas | Aumenta esforço e dificulta encontrar dados | Compactar cards e mostrar menos gráficos simultaneamente |
| P1 | Hierarquia do modo público após a busca | O formulário continua dominando mesmo com resultados | Recolher a busca para uma barra compacta depois da consulta |
| P1 | Tipografia auxiliar pequena | Detalhes importantes exigem esforço visual | Elevar o piso tipográfico e reduzir excesso de caixa alta |
| P1 | Alvos de toque menores que `44px` | Interação menos confortável | Padronizar altura mínima móvel em `44px` |
| P1 | Estrutura semântica do modo público | Axe aponta ausência de `main` e de `h1` visível no mobile | Transformar a área pública em landmark principal e corrigir a hierarquia de títulos |
| P2 | Excesso de caixas e bordas aninhadas | A tela fica visualmente pesada | Substituir parte das bordas por espaçamento e divisores |
| P2 | Tabelas e heatmaps dependem de rolagem lateral pouco evidente | Descoberta e comparação piores | Fixar colunas de contexto e reforçar a indicação de rolagem |

## 1. Gráfico de chuva no mobile

### Problema observado

O relato está correto. Em `390px`, o card tem cerca de `365px`, mas o canvas útil fica com aproximadamente `333x220px`.

Nesse espaço o gráfico tenta representar:

- 24 horas observadas e 12 horas previstas, totalizando 37 pontos com a hora atual;
- precipitação observada;
- precipitação prevista;
- chance de chuva;
- duas escalas Y, em milímetros e porcentagem;
- legenda com três itens;
- até sete marcações no eixo X;
- marcador vertical de “Agora”.

O resultado não é um simples problema de altura. As duas escalas laterais, a legenda e os rótulos consomem grande parte da área útil, deixando as barras muito estreitas e a linha de probabilidade difícil de interpretar.

### Solução recomendada

Manter o gráfico combinado no desktop e criar uma composição específica abaixo de `640px`:

- primeiro gráfico: precipitação observada e prevista, com escala em milímetros;
- segundo gráfico: chance de chuva, alinhado ao mesmo eixo temporal;
- exibir o eixo X apenas no gráfico inferior;
- substituir a legenda longa por títulos diretos em cada bloco;
- limitar o eixo X a cinco rótulos no celular;
- manter o marcador “Agora” nos dois gráficos;
- manter o zoom como recurso complementar, não como única forma de leitura.

Essa solução preserva a regra de 24h observadas + 12h previstas e elimina a principal fonte de compressão: a disputa entre duas escalas Y.

Como correção intermediária de menor custo, seria possível aumentar o gráfico para cerca de `300px`, ocultar os títulos laterais `mm` e `%` no mobile e compactar a legenda. Isso melhora, mas não resolve tão bem quanto separar as escalas.

Arquivos envolvidos: `scripts/charts/rain.js`, `scripts/views/estacao-view.js`, `scripts/views/public-weather-view.js`, `styles/charts.css` e `styles/responsive.css`.

## 2. Faixa de tablet quebrada

O layout móvel só entra em `640px`. Em `768px`, a navegação e a toolbar continuam lado a lado. Na medição, a barra de abas recebeu `288px`, mas precisava de `408px`; por isso, parte das abas fica cortada e a toolbar parece deslocada acima delas.

Recomendação:

- criar um breakpoint intermediário entre aproximadamente `900px` e `960px`;
- manter as quatro abas em uma grade de largura total;
- mover a toolbar para a linha seguinte;
- preservar duas colunas para cards e gráficos quando houver espaço;
- usar o layout totalmente móvel apenas em larguras menores.

Isso corrige tablet retrato sem desperdiçar o espaço disponível com uma única coluna.

Arquivos envolvidos: `styles/tabs-toolbar.css` e `styles/responsive.css`.

## 3. Assistente flutuante

O botão da assistente usa posição fixa e cobre conteúdo em retrato, tablet e paisagem. Na captura de tablet ele ficou sobre o gráfico; em paisagem ficou sobre um card de resumo.

Recomendação:

- desktop: manter o comportamento atual;
- mobile: usar botão circular de `48x48px`, apenas com ícone e nome acessível;
- abrir a conversa como bottom sheet, ocupando a largura útil e respeitando `safe-area-inset-bottom`;
- reduzir ou ocultar o botão durante rolagem ativa;
- reservar espaço inferior no final da página para que o último conteúdo nunca fique sob o botão.

Arquivo principal: `styles/chat.css`, com possível ajuste pequeno em `scripts/assistant/assistant-ui.js`.

## 4. Densidade vertical no mobile

Na simulação da aba Estação, a página chegou a aproximadamente `2.927px`. No modo público preenchido, chegou a aproximadamente `4.347px` em uma tela de `390px`.

As causas principais são:

- todos os cards de resumo viram uma coluna;
- todos os insights viram uma coluna;
- cada métrica pública mantém um gráfico próprio;
- o formulário público completo continua aberto após a consulta;
- os gráficos usam alturas semelhantes, independentemente da complexidade.

### Aba Estação

Recomendação:

- usar duas colunas para os seis cards de resumo em `360px` ou mais;
- remover o `min-height` fixo de `520px` de `#statsEstacao` no mobile;
- manter os dois insights principais em cards compactos;
- permitir recolher os gráficos solares e históricos após o resumo;
- preservar chuva e comparativos como conteúdo principal.

### Sala, Quarto e Aquário

Recomendação:

- usar cards de resumo em duas colunas;
- manter os gráficos em uma coluna, mas com seletor de métrica ou seções recolhíveis;
- no Aquário, apresentar Temperatura, pH, TDS e Turbidez como grade `2x2` antes dos gráficos;
- continuar deixando visualizações avançadas e tabelas recolhidas por padrão, pois essa decisão atual é boa.

Arquivos envolvidos: `styles/stats.css`, `styles/responsive.css`, `styles/advanced-views.css` e as views de cada aba.

## 5. Modo público

### Pontos positivos

- O desktop tem boa separação entre proposta, busca e resultados.
- O resumo da localização e da atualização é claro.
- Os cards de recomendação usam cores sem depender apenas delas.
- Os gráficos observados e previstos são visualmente coerentes.

### Melhorias recomendadas

Após uma consulta bem-sucedida, o grande bloco “Clima por localização” deveria se transformar em uma barra compacta contendo localização atual, ação “Alterar local” e estado de atualização. Hoje o usuário precisa atravessar novamente toda a área de busca antes de chegar aos dados.

No mobile:

- usar grade de duas colunas para Temperatura, Sensação, Umidade e Pressão;
- deixar AQI em largura total ou integrado ao resumo da localização;
- mostrar um insight principal e três itens compactos, em vez de quatro cards altos;
- oferecer um seletor de métrica para Temperatura, Sensação, Umidade e Pressão, exibindo um gráfico por vez;
- manter Chuva e Ciclo Solar como gráficos independentes;
- remover a repetição de “Modo público” no eyebrow e dentro do painel de login.

Isso reduz muito a rolagem sem esconder informação.

Arquivos envolvidos: `index.html`, `styles/public-weather.css` e `scripts/views/public-weather-view.js`.

## 6. Cabeçalho e indicadores

O cabeçalho desktop está equilibrado. No celular, porém, os quatro indicadores mostram quase somente ilustrações. Estação, AQI, ciclo solar e lua têm aparência semelhante e dependem de o usuário já conhecer o significado de cada posição.

Recomendação:

- preservar os quatro indicadores, mas exibir valor curto onde ele agrega informação, como o número do AQI;
- manter rótulos completos nos popovers;
- fornecer estado pressionado/aberto mais evidente;
- aumentar a altura de `36px` para pelo menos `44px` em telas touch;
- não adicionar novos indicadores ao cabeçalho.

## 7. Tipografia e legibilidade

Há vários textos entre `0.62rem` e `0.74rem`, equivalentes a aproximadamente 10 a 12 pixels. Eles aparecem em detalhes de cards, qualidade, contexto lunar, tabelas e insights. Em capturas reduzidas e celulares reais, parte dessas informações fica pequena demais.

Recomendação:

- usar `0.75rem` como mínimo para texto auxiliar e `0.8125rem` para informações operacionais;
- reservar `0.68rem` apenas para conteúdo não essencial;
- reduzir o uso de caixa alta com espaçamento amplo em rótulos longos;
- aumentar o contraste dos textos secundários mais importantes;
- usar números tabulares em medições, datas e horários, mantendo o alinhamento atual.

## 8. Alvos de toque

Foram medidos controles com alturas entre `34px` e `42px`: indicadores do cabeçalho, abas, login, seletor CEP/Cidade, busca e botões de zoom.

Recomendação:

- altura mínima de `44px` para controles mobile;
- botão de zoom de `44x44px` no mobile;
- manter separação mínima de `4px` entre abas e segmentos;
- ampliar a área clicável dos indicadores sem necessariamente ampliar muito o desenho interno.

## 9. Semântica e acessibilidade

Os testes atuais não encontraram violações graves ou críticas. A navegação por teclado das abas, o foco do zoom, os nomes dos canvases e o contraste básico estão protegidos.

Na tela preenchida, a análise encontrou problemas moderados:

- o modo público não possui um landmark `main` visível;
- no mobile, o `h1` fica dentro da marca ocultada e o título público é `h2`, deixando a página sem `h1` visível;
- conteúdo dinâmico público fica fora de landmarks semânticos.

Recomendação:

- transformar o contêiner público em `main` ou fornecer um `main` próprio para cada modo;
- tornar “Clima por localização” o `h1` do modo público;
- manter um título semanticamente acessível no modo interno quando a marca for escondida;
- executar Axe também após renderizar resultados públicos e dados internos, não apenas no estado inicial.

## 10. Cards, bordas e linguagem visual

A identidade escura com ciano está consistente, mas quase todo conteúdo usa fundo elevado, borda e outro contêiner ao redor. No modo público, há painel dentro do hero, grupo dentro do painel e formulário novamente contornado. Essa repetição reforça a sensação de “caixas dentro de caixas”.

Recomendação:

- usar borda apenas no nível principal do componente;
- separar grupos internos com espaço, alinhamento e divisores;
- manter cards para métricas, alertas e gráficos;
- evitar transformar barras de ferramentas e seções inteiras em novos cards quando já estão dentro de uma superfície;
- usar cores semânticas com moderação para chuva, qualidade do ar, conforto e alertas, reduzindo a aparência monocromática.

## 11. Tabelas e visualizações avançadas

As seções recolhíveis, contador, ordenação e CSV são boas decisões. A rolagem lateral com máscara também ajuda, mas ainda exige descoberta.

Recomendação:

- fixar Data e Hora nas tabelas móveis;
- fixar o nome do dia no mapa semanal;
- mostrar uma indicação curta de rolagem apenas na primeira abertura;
- manter células com largura estável;
- oferecer visão compacta em lista para o Aquário, onde há poucas métricas.

## 12. Exportação PDF/JSON

A exportação está em bom estado funcional:

- o botão mantém largura estável entre PDF e JSON;
- progresso, erro, timeout e nova tentativa estão cobertos;
- o PDF passou na validação de quatro páginas e sete blocos visuais;
- o gráfico de chuva do relatório passou no teste específico;
- a proporção dos gráficos exportados está preservada.

Melhoria secundária: no mobile, “Exportar” pode ficar em uma ação secundária ou seção expansível caso seja pouco usado. Não é necessário alterar enquanto a prioridade for corrigir chuva, tablet e densidade.

## O que deve ser preservado

- Tema escuro e identidade geral atual.
- Organização por Estação, Sala, Quarto e Aquário.
- Data global e persistência da aba ativa.
- Zoom dos gráficos.
- Separação visual entre dados medidos e previstos.
- Estados de qualidade, tendência e alertas.
- Seções avançadas e tabelas recolhidas por padrão.
- Carregamento sob demanda de gráficos, assistente e exportação.
- Contratos de IDs, classes, Firebase e objetos `window.*` documentados no projeto.

## Ordem recomendada de implementação

### Etapa 1 — Correções de uso

1. Gráfico de chuva mobile.
2. Breakpoint de tablet.
3. Assistente sem sobreposição.
4. Landmark `main`, `h1` e alvos de toque.

### Etapa 2 — Densidade móvel

1. Cards `2x2` ou duas colunas onde couber.
2. Modo público compacto após a busca.
3. Seletor de métrica para gráficos públicos.
4. Tipografia auxiliar maior.

### Etapa 3 — Polimento

1. Redução de bordas aninhadas.
2. Cabeçalho móvel mais informativo.
3. Tabelas e heatmaps com contexto fixo.
4. Testes visuais automatizados em estados preenchidos.

## Critérios de aceite sugeridos

- Nenhuma aba cortada ou rolando internamente entre `320px` e `1024px`.
- Gráfico de chuva legível em `390px`, sem sobreposição de legenda, eixos ou rótulos.
- Assistente não cobre conteúdo acionável em retrato ou paisagem.
- Todos os controles touch principais com pelo menos `44px` de altura ou área clicável equivalente.
- Modo público com `main` e `h1` válidos em desktop e mobile.
- Nenhum estouro horizontal global nos viewports testados.
- Resultados essenciais públicos aparecem antes da sequência completa de gráficos.
- Testes atuais continuam passando e Axe é executado também nos estados preenchidos.

## Validações executadas

- `npm run validate`
- `npm run lint`
- `npm run test:assistant`
- `npm run test:report`
- `npm run test:pdf-artifact`
- `npm run test:pdf-rain`
- `npm run test:export`
- `npm run test:accessibility`
- `npm run test:axe`
- `npm run test:data-quality`
- `npm run test:public`
- `npm run test:chart-sync`
- `npm run test:rain`
- `npm run test:tables`

Todos foram concluídos com sucesso.
