'use strict';

(function () {
    const espacoNomes = window.ClimateAssistant || {};
    const { DEFAULT_RECENT_DAYS: DIAS_RECENTES_PADRAO, MAX_PERIOD_DAYS: MAX_DIAS_PERIODO, ENVIRONMENTS: AMBIENTES } = espacoNomes.config;
    const MAX_DIAS_INTERVALO_SOLAR = 367;
    const {
        normalizeText: normalizarTextoConsulta,
        hasWord: temPalavraConsulta,
        normalizeHourFilter: normalizarFiltroHoraConsulta,
        formatDate: formatarDataConsulta,
        formatFirebaseDate: formatarDataFirebaseRelatorio,
        getTabLabel: obterRotuloAbaRelatorio,
        uniqueDates: datasUnicas,
    } = espacoNomes.format;
    const {
        inferMetricsFromQuestion: inferirMetricasPergunta,
        hasSolarIntent: temIntencaoSolar,
        metricMatches: correspondenciasMetricas,
        toMetricObject: converterParaObjetoMetrica,
    } = espacoNomes.metrics;

    async function resolverIntencaoPergunta(pergunta, contexto) {
        const perguntaNormalizada = normalizarTextoConsulta(pergunta);
        const ambientesMencionados = encontrarAmbientesMencionados(perguntaNormalizada);
        const ambientePadrao = obterAmbientePorAbaAtiva(contexto.activeTab);
        const intencaoClassificada = await classificarIntencaoPergunta(pergunta, contexto);
        const ambientesClassificados = obterAmbientesDaIntencao(intencaoClassificada);
        const operacao = normalizarOperacao(intencaoClassificada?.operacao, perguntaNormalizada);
        const faixaHoraria = normalizarFaixaHoraria(intencaoClassificada?.periodo) || extrairFaixaHorariaPergunta(perguntaNormalizada);
        const hora = faixaHoraria
            ? null
            : normalizarFiltroHoraConsulta(intencaoClassificada?.periodo?.hora || intencaoClassificada?.hora || extrairHoraPergunta(perguntaNormalizada));
        const periodo = normalizarPeriodo(intencaoClassificada?.periodo, perguntaNormalizada, contexto.selectedDate, operacao);
        const metricasClassificadas = normalizarMetricas(intencaoClassificada?.metricas || intencaoClassificada?.metrica);
        const metricas = metricasClassificadas.length ? metricasClassificadas : inferirMetricasPergunta(perguntaNormalizada);
        const intencaoSolar = temIntencaoSolar(perguntaNormalizada) || operacao.startsWith("solar_") || Boolean(intencaoClassificada?.solar);
        const metricasFinais = intencaoSolar ? ["ciclo_solar"] : metricas;
        const ambientes = resolverAmbientesAlvo({
            mentionedEnvironments: ambientesMencionados,
            classifiedEnvironments: ambientesClassificados,
            requestedMetrics: metricasFinais,
            fallbackEnvironment: ambientePadrao,
        });

        return {
            environments: ambientes,
            metrics: metricasFinais,
            operation: operacao,
            period: periodo,
            hour: hora,
            hourRange: faixaHoraria,
            criterion: normalizarTextoConsulta(intencaoClassificada?.criterio),
            confidence: Number(intencaoClassificada?.confianca) || null,
            needsClarification: Boolean(intencaoClassificada?.precisa_esclarecimento),
            clarificationQuestion: intencaoClassificada?.pergunta_esclarecimento || null,
        };
    }

    async function classificarIntencaoPergunta(pergunta, contexto) {
        const instrucaoModelo = `
            Interprete a pergunta abaixo para um dashboard de estação climática. Ela pode conter erros de digitação, gírias, fala informal e português não padrão.
            Responda somente JSON válido, sem markdown.

            Schema obrigatório:
            {
            "ambientes": ["estacao" | "sala" | "quarto" | "aquario"] ou [],
            "metricas": ["temperatura" | "sensacao_termica" | "umidade" | "pressao" | "ciclo_solar" | "aqi" | "iaq" | "qualidade_ar" | "ph" | "tds" | "turbidez" | "co" | "co2" | "acetona" | "alcool" | "amonia" | "tolueno"] ou [],
            "operacao": "media" | "maxima" | "minima" | "delta" | "tendencia" | "resumo" | "valor" | "ultima_medicao" | "comparar_dias" | "dia_mais_frio" | "dia_mais_quente" | "status_faixa" | "horario_maior_valor" | "horario_menor_valor" | "calendario_dia_maior_valor" | "calendario_dia_menor_valor" | "heatmap_hora_maior_valor" | "heatmap_hora_menor_valor" | "heatmap_semana_maior_valor" | "heatmap_semana_menor_valor" | "solar_maior_duracao_luz" | "solar_menor_duracao_luz" | "solar_tendencia_nascer" | "solar_tendencia_por" | "solar_comparar_nascer" | "solar_comparar_por" | "solar_duracao_dia" ou null,
            "periodo": {
                "tipo": "data_especifica" | "datas_relativas" | "ultimos_dias" | "ultimas_24h" | "intervalo" | "calendario" | "mes_selecionado" | "semana_selecionada" | "ano_selecionado" ou null,
                "data": "DD-MM-AAAA" | "hoje" | "ontem" | "anteontem" ou null,
                "datas": ["DD-MM-AAAA" | "hoje" | "ontem" | "anteontem"] ou [],
                "hora": "HH:mm" | "HH" | null,
                "hora_inicio": "HH:mm" | "HH" | null,
                "hora_fim": "HH:mm" | "HH" | null,
                "quantidade": número ou null,
                "inicio": "DD-MM-AAAA" ou null,
                "fim": "DD-MM-AAAA" ou null
            },
            "criterio": "media_diaria" | "maxima_registrada" | "minima_registrada" | "mais_quente" | "mais_frio" ou null,
            "confianca": número de 0 a 1,
            "precisa_esclarecimento": true ou false,
            "pergunta_esclarecimento": string ou null,
            "solar": true ou false
            }

            Regras:
            - "últimos dias", "esses últimos dias" ou frase parecida significa últimos ${DIAS_RECENTES_PADRAO} dias.
            - "últimas 24 horas", "últimas 24h" ou frase parecida deve usar periodo.tipo "ultimas_24h".
            - "dia mais frio" usa menor média diária, exceto se pedir explicitamente menor registro.
            - "dia mais quente" usa maior média diária, exceto se pedir explicitamente maior registro.
            - "ontem ou anteontem foi mais quente que hoje" deve usar operação "comparar_dias" e datas ["ontem", "anteontem", "hoje"].
            - Se ambiente não aparecer, deixe "ambientes" vazio. O código usará a aba ativa.
            - Se a pergunta for sobre ciclo solar, luz do dia, nascer do sol, pôr do sol, zênite, amanhecer ou anoitecer, use ambiente "estacao".
            - Se a pergunta mencionar AQI, IAQ, qualidade do ar, índice de qualidade do ar ou ar da sala, use métrica "qualidade_ar".
            - Se a pergunta mencionar faixa, conforto, ideal, normal, dentro da faixa, fora da faixa, fora do ideal, pior horário fora da faixa ou quantas horas fora, use operação "status_faixa".
            - Se métrica não aparecer mas a pergunta falar frio/quente, use "temperatura".
            - Se a pergunta pedir o valor atual/agora ou apenas perguntar "qual o valor" de uma métrica sem pedir média, máxima, mínima, tendência ou período inteiro, use operação "ultima_medicao".
            - Se a pergunta tiver "às 14h", "14:00", "as 14", preencha "hora": "14".
            - Se a pergunta tiver faixa horária como "entre 8h e 18h", "das 8 às 18" ou "de 8h a 18h", preencha "hora_inicio" e "hora_fim".
            - Se a pergunta pedir "qual horário foi mais quente", "qual horário teve maior umidade" ou equivalente, use operação "horario_maior_valor".
            - Se a pergunta pedir "qual horário foi mais frio", "qual horário teve menor pressão" ou equivalente, use operação "horario_menor_valor".
            - Se a pergunta pedir "qual dia do mês" ou "calendário climático", use operação "calendario_dia_maior_valor" ou "calendario_dia_menor_valor" e periodo.tipo "mes_selecionado".
            - Se a pergunta pedir "qual hora costuma" ou "heatmap por hora", use operação "heatmap_hora_maior_valor" ou "heatmap_hora_menor_valor".
            - Se a pergunta pedir "qual dia/hora da semana", "mapa semanal" ou "pico semanal", use operação "heatmap_semana_maior_valor" ou "heatmap_semana_menor_valor" e periodo.tipo "semana_selecionada".
            - Se a pergunta pedir maior/menor duração de luz, duração do dia, tempo de luz, luz solar, dia mais longo ou dia mais curto, use métrica "ciclo_solar", solar true e operação solar correspondente.
            - Para "dia mais longo" ou "dia com mais tempo de luz solar", use periodo.tipo "ano_selecionado" quando nenhum mês/período for informado. Se houver mês informado, use "mes_selecionado".
            - Se a pergunta perguntar se nascer do sol ou pôr do sol está ficando mais cedo/tarde, use operação "solar_tendencia_nascer" ou "solar_tendencia_por".
            - Se a pergunta pedir comparar nascer do sol ou pôr do sol da semana, use "solar_comparar_nascer" ou "solar_comparar_por" e periodo.tipo "semana_selecionada".
            - Se a pergunta mencionar nascer do sol, pôr do sol, zênite, amanhecer, anoitecer, sol ou ciclo solar, use métrica "ciclo_solar" e solar true.
            - Não responda a pergunta do usuário, apenas classifique.

            Data selecionada na página: ${formatarDataConsulta(contexto.selectedDate)}
            Aba ativa: ${obterRotuloAbaRelatorio(contexto.activeTab)}
            Pergunta: ${pergunta}
        `.trim();

        try {
            const respostaFinal = await window.ClimateAIService.generateText(instrucaoModelo);
            return interpretarJsonIntencao(respostaFinal);
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Falha ao classificar intenção do chat. Usando fallback local.", erro);
            return null;
        }
    }

    function interpretarJsonIntencao(respostaFinal) {
        const texto = String(respostaFinal || "").trim();
        const textoJson = texto.match(/\{[\s\S]*\}/)?.[0] || texto;

        try {
            const interpretado = JSON.parse(textoJson);
            return interpretado && typeof interpretado === "object" ? interpretado : null;
        } catch {
            window.ClimateDiagnostics?.depurar("Intenção do chat não veio em JSON válido.", respostaFinal);
            return null;
        }
    }

    function obterAmbientesDaIntencao(intencao) {
        const ambientesBrutos = Array.isArray(intencao?.ambientes)
            ? intencao.ambientes
            : [intencao?.ambiente].filter(Boolean);

        return ambientesBrutos
            .map(obterAmbientePorChave)
            .filter(Boolean);
    }

    function resolverAmbientesAlvo({ mentionedEnvironments: ambientesMencionados, classifiedEnvironments: ambientesClassificados, requestedMetrics: metricasSolicitadas, fallbackEnvironment: ambientePadrao }) {
        if (ambientesMencionados.length) return resolverAmbientesCompativeis(ambientesMencionados, metricasSolicitadas) || ambientesMencionados;
        if (ambientesClassificados.length) return resolverAmbientesCompativeis(ambientesClassificados, metricasSolicitadas) || ambientesClassificados;

        const ambienteMetrica = encontrarAmbienteExclusivoMetrica(metricasSolicitadas);
        if (ambienteMetrica) return [ambienteMetrica];

        const ambientesGerais = ambientePadrao?.dataKey === "solar"
            ? encontrarAmbientesCompativeisMetrica(metricasSolicitadas)
            : [];
        if (ambientesGerais.length) return ambientesGerais;

        return [ambientePadrao];
    }

    function resolverAmbientesCompativeis(ambientesCandidatos, metricasSolicitadas) {
        if (!metricasSolicitadas?.length) return ambientesCandidatos;

        const compativel = ambientesCandidatos.filter(ambiente => (
            metricasSolicitadas.some(metricaSolicitada => (
                ambiente.metrics
                    .map(converterParaObjetoMetrica)
                    .some(metrica => correspondenciasMetricas(metrica, metricaSolicitada))
            ))
        ));
        if (compativel.length) return compativel;

        const ambienteMetrica = encontrarAmbienteExclusivoMetrica(metricasSolicitadas);
        return ambienteMetrica ? [ambienteMetrica] : null;
    }

    function encontrarAmbienteExclusivoMetrica(metricasSolicitadas) {
        const correspondencias = encontrarAmbientesCompativeisMetrica(metricasSolicitadas);
        return correspondencias.length === 1 ? correspondencias[0] : null;
    }

    function encontrarAmbientesCompativeisMetrica(metricasSolicitadas) {
        const ambientes = [];
        for (const metricaSolicitada of metricasSolicitadas || []) {
            const correspondencias = Object.values(AMBIENTES).filter(ambiente => (
                ambiente.dataKey !== "solar" &&
                ambiente.metrics
                    .map(converterParaObjetoMetrica)
                    .some(metrica => correspondenciasMetricas(metrica, metricaSolicitada))
            ));

            for (const ambiente of correspondencias) {
                if (!ambientes.includes(ambiente)) ambientes.push(ambiente);
            }
        }

        return ambientes;
    }

    function normalizarMetricas(valor) {
        const valores = Array.isArray(valor) ? valor : [valor].filter(Boolean);
        return valores.map(normalizarTextoConsulta).filter(Boolean);
    }

    function normalizarOperacao(valor, perguntaNormalizada) {
        const operacao = normalizarTextoConsulta(valor);
        const operacaoSolar = inferirOperacaoSolar(perguntaNormalizada);
        if (operacaoSolar) return operacaoSolar;
        const operacaoMapaCalor = inferirOperacaoMapaCalor(perguntaNormalizada);
        if (operacaoMapaCalor) return operacaoMapaCalor;
        const operacaoHoraria = inferirOperacaoHoraria(perguntaNormalizada);
        if (operacaoHoraria) return operacaoHoraria;
        if (temIntencaoConforto(perguntaNormalizada)) return "status_faixa";
        if (perguntaNormalizada.includes("dia mais fri")) return "dia_mais_frio";
        if (perguntaNormalizada.includes("dia mais quent")) return "dia_mais_quente";
        if (perguntaNormalizada.includes("tendencia") || perguntaNormalizada.includes("subindo") || perguntaNormalizada.includes("caindo")) return "tendencia";
        if (perguntaNormalizada.includes("variou") || perguntaNormalizada.includes("variacao") || perguntaNormalizada.includes("delta")) return "delta";
        if (perguntaNormalizada.includes("maxim") || perguntaNormalizada.includes("mais alta") || perguntaNormalizada.includes("maior valor")) return "maxima";
        if (perguntaNormalizada.includes("minim") || perguntaNormalizada.includes("mais baixa") || perguntaNormalizada.includes("menor valor")) return "minima";
        if (perguntaNormalizada.includes("media")) return "media";
        if (perguntaNormalizada.includes("diferenca") || perguntaNormalizada.includes("diferença")) {
            return temComparacaoDiasExplicita(perguntaNormalizada) ? "comparar_dias" : "delta";
        }
        if (temIntencaoUltimaMedicao(perguntaNormalizada) || operacao === "valor") return "ultima_medicao";
        if (operacao && operacao !== "resumo") return operacao;
        if (operacao) return operacao;
        return "resumo";
    }

    function temIntencaoUltimaMedicao(perguntaNormalizada) {
        const pedeValorAtual = [
            "agora",
            "atual",
            "atualmente",
            "nesse momento",
            "neste momento",
            "ultima medicao",
            "ultima medição",
            "ultimo valor",
            "último valor",
            "valor atual",
        ].some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
        if (pedeValorAtual) return true;

        const pedeValorSimples = [
            "qual o",
            "qual a",
            "quanto esta",
            "quanto está",
            "quanto ta",
            "quanto tá",
        ].some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
        if (!pedeValorSimples) return false;

        return ![
            "media",
            "média",
            "maxim",
            "minim",
            "tendencia",
            "tendência",
            "delta",
            "diferenca",
            "diferença",
            "faixa",
            "conforto",
            "horario",
            "horário",
            "dia mais",
            "ultimas",
            "últimas",
            "ultimos",
            "últimos",
        ].some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
    }

    function inferirOperacaoSolar(perguntaNormalizada) {
        if (!temPerguntaSolar(perguntaNormalizada)) return null;

        const ehNascerSol = perguntaNormalizada.includes("nascer");
        const ehPorSol = perguntaNormalizada.includes("por do sol") || perguntaNormalizada.includes("por-do-sol");
        const pedeTendencia = perguntaNormalizada.includes("ficando") || perguntaNormalizada.includes("esta ficando") || perguntaNormalizada.includes("tendencia");
        const pedeComparacao = perguntaNormalizada.includes("compar") || perguntaNormalizada.includes("compare");

        if (perguntaNormalizada.includes("dia mais long") || perguntaNormalizada.includes("dia com mais tempo de luz")) return "solar_maior_duracao_luz";
        if (perguntaNormalizada.includes("dia mais curt") || perguntaNormalizada.includes("dia com menos tempo de luz")) return "solar_menor_duracao_luz";

        if (
            perguntaNormalizada.includes("duracao")
            || perguntaNormalizada.includes("duração")
            || perguntaNormalizada.includes("tempo de luz")
            || perguntaNormalizada.includes("luz solar")
            || perguntaNormalizada.includes("periodo de luz")
            || perguntaNormalizada.includes("luz")
        ) {
            if (perguntaNormalizada.includes("maior") || perguntaNormalizada.includes("mais long")) return "solar_maior_duracao_luz";
            if (perguntaNormalizada.includes("menor") || perguntaNormalizada.includes("mais curt")) return "solar_menor_duracao_luz";
            return "solar_duracao_dia";
        }

        if (pedeComparacao && ehNascerSol) return "solar_comparar_nascer";
        if (pedeComparacao && ehPorSol) return "solar_comparar_por";
        if (pedeTendencia && ehNascerSol) return "solar_tendencia_nascer";
        if (pedeTendencia && ehPorSol) return "solar_tendencia_por";

        return null;
    }

    function temPerguntaSolar(perguntaNormalizada) {
        return [
            "solar",
            "sol",
            "nascer",
            "por do sol",
            "por-do-sol",
            "zenite",
            "amanhecer",
            "anoitecer",
            "duracao do dia",
            "duracao de luz",
            "duração do dia",
            "duração de luz",
            "tempo de luz",
            "luz solar",
            "periodo de luz",
            "fotoperiodo",
            "dia mais longo",
            "dia mais curto",
        ].some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
    }

    function inferirOperacaoMapaCalor(perguntaNormalizada) {
        const modo = inferirModoExtremo(perguntaNormalizada);
        if (!modo) return null;

        if (
            perguntaNormalizada.includes("dia do mes")
            || perguntaNormalizada.includes("dia no mes")
            || perguntaNormalizada.includes("calendario")
            || perguntaNormalizada.includes("calendario climatico")
        ) {
            return modo === "min" ? "calendario_dia_menor_valor" : "calendario_dia_maior_valor";
        }

        if (
            perguntaNormalizada.includes("dia/hora")
            || perguntaNormalizada.includes("dia hora")
            || perguntaNormalizada.includes("dia e hora")
            || perguntaNormalizada.includes("mapa semanal")
            || perguntaNormalizada.includes("heatmap semanal")
            || perguntaNormalizada.includes("semana")
        ) {
            return modo === "min" ? "heatmap_semana_menor_valor" : "heatmap_semana_maior_valor";
        }

        if (
            perguntaNormalizada.includes("hora costuma")
            || perguntaNormalizada.includes("horario costuma")
            || perguntaNormalizada.includes("costuma ser")
            || perguntaNormalizada.includes("heatmap por hora")
            || perguntaNormalizada.includes("por hora do dia")
        ) {
            return modo === "min" ? "heatmap_hora_menor_valor" : "heatmap_hora_maior_valor";
        }

        return null;
    }

    function inferirOperacaoHoraria(perguntaNormalizada) {
        const pedeHorario = [
            "qual horario",
            "qual foi o horario",
            "que horario",
            "em qual horario",
            "qual hora",
            "qual foi a hora",
            "que hora",
            "periodo do dia",
            "faixa do dia",
        ].some(termo => perguntaNormalizada.includes(termo));
        if (!pedeHorario) return null;

        const pedeMaior = [
            "mais quent",
            "maior",
            "maxim",
            "mais alto",
            "pico",
        ].some(termo => perguntaNormalizada.includes(termo));
        if (pedeMaior) return "horario_maior_valor";

        const pedeMenor = [
            "mais fri",
            "menor",
            "minim",
            "mais baixo",
        ].some(termo => perguntaNormalizada.includes(termo));
        if (pedeMenor) return "horario_menor_valor";

        return null;
    }

    function inferirModoExtremo(perguntaNormalizada) {
        const pedeMaior = [
            "mais quent",
            "maior",
            "maxim",
            "mais alto",
            "pico",
        ].some(termo => perguntaNormalizada.includes(termo));
        if (pedeMaior) return "max";

        const pedeMenor = [
            "mais fri",
            "menor",
            "minim",
            "mais baixo",
        ].some(termo => perguntaNormalizada.includes(termo));
        if (pedeMenor) return "min";

        return null;
    }


    function temIntencaoConforto(perguntaNormalizada) {
        return [
            "faixa",
            "conforto",
            "ideal",
            "normal",
            "fora da faixa",
            "dentro da faixa",
            "fora do ideal",
            "dentro do ideal",
            "pior horario",
            "pior horário",
            "quantas horas fora",
        ].some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
    }

    function normalizarPeriodo(periodo, perguntaNormalizada, dataSelecionada, operacao) {
        const datasExplicitas = extrairDatasPergunta(perguntaNormalizada);
        const tipoNormalizado = normalizarTextoConsulta(periodo?.tipo);
        const dataPeriodoMensal = extrairDataPeriodoMensal(perguntaNormalizada, dataSelecionada);
        const dataPeriodoAnual = extrairDataPeriodoAnual(perguntaNormalizada, dataSelecionada);
        const quantidadeHorasPergunta = extrairJanelaHoras(perguntaNormalizada);
        if (tipoNormalizado === "ultimas_24h" || quantidadeHorasPergunta !== null) {
            const horasSolicitadas = quantidadeHorasPergunta || Number(periodo?.quantidade) || 24;
            const horas = limitarHoras(horasSolicitadas);
            return {
                type: "rolling_hours",
                hours: horas,
                requestedHours: horasSolicitadas,
                limited: horas !== horasSolicitadas,
                selectedDate: datasExplicitas[0] || dataSelecionada || window.ClimateData.dataAtual(),
            };
        }

        const intervaloExplicito = extrairIntervaloExplicito(periodo, tipoNormalizado, perguntaNormalizada, datasExplicitas);
        if (intervaloExplicito) {
            const consultaSolarExtrema = operacao === "solar_maior_duracao_luz"
                || operacao === "solar_menor_duracao_luz";
            return {
                type: consultaSolarExtrema ? "solar_range" : "range",
                start: intervaloExplicito.inicio,
                end: intervaloExplicito.fim,
            };
        }

        if (tipoNormalizado === "mes_selecionado" || operacao?.startsWith("calendario_dia_") || ((operacao === "solar_maior_duracao_luz" || operacao === "solar_menor_duracao_luz") && dataPeriodoMensal)) {
            return { type: "selected_month", selectedDate: dataPeriodoMensal || datasExplicitas[0] || dataSelecionada || window.ClimateData.dataAtual() };
        }

        if (tipoNormalizado === "ano_selecionado" || operacao === "solar_maior_duracao_luz" || operacao === "solar_menor_duracao_luz") {
            return { type: "selected_year", selectedDate: datasExplicitas[0] || dataPeriodoAnual || dataSelecionada || window.ClimateData.dataAtual() };
        }

        if (tipoNormalizado === "semana_selecionada" || operacao?.startsWith("heatmap_semana_") || operacao === "solar_tendencia_nascer" || operacao === "solar_tendencia_por" || operacao === "solar_comparar_nascer" || operacao === "solar_comparar_por" || perguntaNormalizada.includes("semana")) {
            return { type: "selected_week", selectedDate: datasExplicitas[0] || dataSelecionada || window.ClimateData.dataAtual() };
        }

        if (operacao?.startsWith("heatmap_hora_") && (perguntaNormalizada.includes("costuma") || perguntaNormalizada.includes("tipic"))) {
            return { type: "selected_month", selectedDate: datasExplicitas[0] || dataSelecionada || window.ClimateData.dataAtual() };
        }

        if (tipoNormalizado === "ultimos_dias" || perguntaNormalizada.includes("ultim") || perguntaNormalizada.includes("urtim")) {
            const quantidadePergunta = extrairQuantidadeUltimosDias(perguntaNormalizada);
            const diasSolicitados = quantidadePergunta || Number(periodo?.quantidade) || DIAS_RECENTES_PADRAO;
            const dias = limitarDias(diasSolicitados);
            return {
                type: "last_days",
                days: dias,
                requestedDays: diasSolicitados,
                limited: dias !== diasSolicitados,
                selectedDate: datasExplicitas[0] || dataSelecionada || window.ClimateData.dataAtual(),
            };
        }

        if (datasExplicitas.length > 1) return { type: "datas", dates: datasExplicitas };
        if (datasExplicitas.length === 1) return { type: "datas", dates: datasExplicitas };

        const datasBrutas = Array.isArray(periodo?.datas) ? periodo.datas : [];
        const datasClassificadas = datasBrutas.map(normalizarDataRelativaOuExplicita).filter(Boolean);
        if (datasClassificadas.length) return { type: "datas", dates: datasClassificadas };

        const dataUnica = normalizarDataRelativaOuExplicita(periodo?.data);
        if (dataUnica) return { type: "datas", dates: [dataUnica] };

        if (tipoNormalizado === "intervalo" && periodo?.inicio && periodo?.fim) {
            return {
                type: "range",
                start: normalizarDataRelativaOuExplicita(periodo.inicio),
                end: normalizarDataRelativaOuExplicita(periodo.fim),
            };
        }

        if (temPalavraConsulta(perguntaNormalizada, "hoje") || temPalavraConsulta(perguntaNormalizada, "hj")) return { type: "datas", dates: [window.ClimateData.dataAtual()] };
        if (temPalavraConsulta(perguntaNormalizada, "ontem")) return { type: "datas", dates: [deslocamentoHoje(-1)] };
        if (temPalavraConsulta(perguntaNormalizada, "anteontem") || temPalavraConsulta(perguntaNormalizada, "antiontem")) return { type: "datas", dates: [deslocamentoHoje(-2)] };

        return { type: "datas", dates: [dataSelecionada || window.ClimateData.dataAtual()] };
    }

    function resolverDatasPeriodo(periodo) {
        if (periodo.type === "rolling_hours") return resolverDatasJanelaHoras(periodo);
        if (periodo.type === "selected_month") return montarDatasMes(periodo.selectedDate);
        if (periodo.type === "selected_year") return montarDatasAno(periodo.selectedDate);
        if (periodo.type === "selected_week") return montarDatasSemana(periodo.selectedDate);
        if (periodo.type === "datas") return datasUnicas(periodo.dates).slice(0, MAX_DIAS_PERIODO);
        if (periodo.type === "last_days") return montarUltimosDias(periodo.days, periodo.selectedDate);
        if (periodo.type === "solar_range" && periodo.start && periodo.end) {
            return montarIntervaloDatas(periodo.start, periodo.end, MAX_DIAS_INTERVALO_SOLAR);
        }
        if (periodo.type === "range" && periodo.start && periodo.end) return montarIntervaloDatas(periodo.start, periodo.end, MAX_DIAS_PERIODO);
        return [window.ClimateData.dataAtual()];
    }

    function montarDatasMes(dataSelecionada) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const diasNoMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0).getDate();
        return Array.from({ length: diasNoMes }, (_, indice) => (
            formatarDataFirebaseRelatorio(new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), indice + 1))
        ));
    }

    function montarDatasAno(dataSelecionada) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const datas = [];

        for (
            const cursor = new Date(dataReferencia.getFullYear(), 0, 1);
            cursor.getFullYear() === dataReferencia.getFullYear();
            cursor.setDate(cursor.getDate() + 1)
        ) {
            datas.push(formatarDataFirebaseRelatorio(cursor));
        }

        return datas;
    }

    function montarDatasSemana(dataSelecionada) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const inicio = new Date(dataReferencia);
        inicio.setDate(inicio.getDate() - inicio.getDay());
        const datas = [];

        for (const cursor = new Date(inicio); cursor <= dataReferencia && datas.length < 7; cursor.setDate(cursor.getDate() + 1)) {
            datas.push(formatarDataFirebaseRelatorio(cursor));
        }

        return datas;
    }

    function resolverDatasJanelaHoras(periodo) {
        const dataSelecionada = periodo.selectedDate || window.ClimateData.dataAtual();
        const fim = obterFimJanelaMovel(dataSelecionada);
        const inicio = new Date(fim);
        inicio.setHours(inicio.getHours() - (periodo.hours || 24));
        return datasUnicas([formatarDataFirebaseRelatorio(inicio), formatarDataFirebaseRelatorio(fim)]);
    }

    function montarUltimosDias(dias, dataSelecionada) {
        const quantidade = limitarDias(dias);
        const dataFinal = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        return Array.from({ length: quantidade }, (_, indice) => {
            const dados = new Date(dataFinal);
            dados.setDate(dados.getDate() - (quantidade - 1 - indice));
            return formatarDataFirebaseRelatorio(dados);
        });
    }

    function montarIntervaloDatas(inicio, fim, limiteDias = MAX_DIAS_PERIODO) {
        const dataInicial = window.ClimateData.parseFirebaseDate(inicio);
        const dataFinal = window.ClimateData.parseFirebaseDate(fim);
        const datas = [];
        const direcao = dataInicial <= dataFinal ? 1 : -1;
        const cursor = new Date(dataInicial);

        while (datas.length < limiteDias) {
            datas.push(formatarDataFirebaseRelatorio(cursor));
            if (formatarDataFirebaseRelatorio(cursor) === formatarDataFirebaseRelatorio(dataFinal)) break;
            cursor.setDate(cursor.getDate() + direcao);
        }

        return datas;
    }

    function extrairIntervaloExplicito(periodo, tipoNormalizado, perguntaNormalizada, datasExplicitas) {
        const inicioClassificado = normalizarDataRelativaOuExplicita(periodo?.inicio);
        const fimClassificado = normalizarDataRelativaOuExplicita(periodo?.fim);
        if (inicioClassificado && fimClassificado) {
            return { inicio: inicioClassificado, fim: fimClassificado };
        }

        const mencionaIntervalo = tipoNormalizado === "intervalo"
            || temPalavraConsulta(perguntaNormalizada, "entre")
            || temPalavraConsulta(perguntaNormalizada, "ate")
            || temPalavraConsulta(perguntaNormalizada, "intervalo");
        if (!mencionaIntervalo || datasExplicitas.length < 2) return null;

        return {
            inicio: datasExplicitas[0],
            fim: datasExplicitas[1],
        };
    }

    function extrairDatasPergunta(perguntaNormalizada) {
        const datas = [];
        const correspondencias = perguntaNormalizada.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g);
        for (const correspondencia of correspondencias) {
            const [, dia, mes, ano] = correspondencia;
            datas.push(`${dia.padStart(2, "0")}-${mes.padStart(2, "0")}-${ano}`);
        }

        if (temPalavraConsulta(perguntaNormalizada, "anteontem") || temPalavraConsulta(perguntaNormalizada, "antiontem")) datas.push(deslocamentoHoje(-2));
        if (temPalavraConsulta(perguntaNormalizada, "ontem")) datas.push(deslocamentoHoje(-1));
        if (temPalavraConsulta(perguntaNormalizada, "hoje") || temPalavraConsulta(perguntaNormalizada, "hj")) datas.push(window.ClimateData.dataAtual());

        return datasUnicas(datas);
    }

    function extrairDataPeriodoMensal(perguntaNormalizada, dataSelecionada) {
        const indiceMes = obterIndiceMesMencionadoPergunta(perguntaNormalizada);
        if (indiceMes === null) {
            return perguntaNormalizada.includes("mes") || perguntaNormalizada.includes("mês")
                ? dataSelecionada || window.ClimateData.dataAtual()
                : null;
        }

        const selecionado = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const ano = extrairAnoPergunta(perguntaNormalizada) || selecionado.getFullYear();
        return formatarDataFirebaseRelatorio(new Date(ano, indiceMes, 1));
    }

    function extrairDataPeriodoAnual(perguntaNormalizada, dataSelecionada) {
        const selecionado = window.ClimateData.parseFirebaseDate(dataSelecionada || window.ClimateData.dataAtual());
        const ano = extrairAnoPergunta(perguntaNormalizada) || selecionado.getFullYear();
        return formatarDataFirebaseRelatorio(new Date(ano, selecionado.getMonth(), selecionado.getDate()));
    }

    function extrairAnoPergunta(perguntaNormalizada) {
        const correspondencia = perguntaNormalizada.match(/\b(20\d{2})\b/);
        return correspondencia ? Number(correspondencia[1]) : null;
    }

    function obterIndiceMesMencionadoPergunta(perguntaNormalizada) {
        const meses = [
            ["janeiro", "jan"],
            ["fevereiro", "fev"],
            ["marco", "março", "mar"],
            ["abril", "abr"],
            ["maio", "mai"],
            ["junho", "jun"],
            ["julho", "jul"],
            ["agosto", "ago"],
            ["setembro", "set"],
            ["outubro", "out"],
            ["novembro", "nov"],
            ["dezembro", "dez"],
        ];

        const indice = meses.findIndex(apelidos => apelidos.some(apelido => temPalavraConsulta(perguntaNormalizada, normalizarTextoConsulta(apelido))));
        return indice >= 0 ? indice : null;
    }

    function extrairHoraPergunta(perguntaNormalizada) {
        const correspondencia = perguntaNormalizada.match(/\b(?:as|às)\s*(\d{1,2})(?:h|:00)?\b|\b(\d{1,2})(?:h|:00)\b/);
        if (!correspondencia) return null;
        const hora = Number(correspondencia[1] || correspondencia[2]);
        if (!Number.isFinite(hora) || hora < 0 || hora > 23) return null;
        return String(hora).padStart(2, "0");
    }

    function normalizarFaixaHoraria(periodo) {
        if (!periodo || typeof periodo !== "object") return null;

        const inicio = normalizarFiltroHoraConsulta(
            periodo.hora_inicio
            || periodo.inicio_hora
            || periodo.horaInicial
            || periodo.inicioHorario
        );
        const fim = normalizarFiltroHoraConsulta(
            periodo.hora_fim
            || periodo.fim_hora
            || periodo.horaFinal
            || periodo.fimHorario
        );

        return inicio && fim ? { start: inicio, end: fim } : null;
    }

    function extrairFaixaHorariaPergunta(perguntaNormalizada) {
        const correspondencia = perguntaNormalizada.match(/\b(?:entre|das|de)\s*(\d{1,2})(?:h|:00)?\s*(?:e|a|as|-)\s*(\d{1,2})(?:h|:00)?\b/);
        if (!correspondencia) return null;

        const inicio = normalizarFiltroHoraConsulta(correspondencia[1]);
        const fim = normalizarFiltroHoraConsulta(correspondencia[2]);
        return inicio && fim ? { start: inicio, end: fim } : null;
    }

    function extrairJanelaHoras(perguntaNormalizada) {
        const correspondencia = perguntaNormalizada.match(/\b(?:ultim|urtim)[a-z]*\s+(.+?)\s*(?:h|hora|horas)\b/);
        if (!correspondencia) return null;
        return interpretarQuantidade(correspondencia[1]);
    }

    function extrairQuantidadeUltimosDias(perguntaNormalizada) {
        const correspondencia = perguntaNormalizada.match(/\b(?:ultim|urtim)[a-z]*\s+(.+?)\s+dias?\b/);
        if (!correspondencia) return null;
        return interpretarQuantidade(correspondencia[1]);
    }

    function interpretarQuantidade(valor) {
        const texto = normalizarTextoConsulta(valor).trim();
        if (/^\d+$/.test(texto)) return Number(texto);

        const unidades = {
            um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
            seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
            doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
            dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19,
        };
        if (unidades[texto]) return unidades[texto];

        const dezenas = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60 };
        const composto = texto.match(/^(vinte|trinta|quarenta|cinquenta|sessenta)(?:\s+e\s+(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?$/);
        if (!composto) return null;
        return dezenas[composto[1]] + (composto[2] ? unidades[composto[2]] : 0);
    }

    function temComparacaoDiasExplicita(perguntaNormalizada) {
        const mencoes = ["hoje", "hj", "ontem", "anteontem", "antiontem"]
            .filter(termo => temPalavraConsulta(perguntaNormalizada, termo));
        const datasExplicitas = [...perguntaNormalizada.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g)];
        return new Set(mencoes).size + datasExplicitas.length >= 2 || perguntaNormalizada.includes("compar");
    }

    function obterFimJanelaMovel(dataSelecionada) {
        const partes = window.ClimateData.parseFirebaseDate(dataSelecionada);
        const agora = new Date();
        return new Date(
            partes.getFullYear(),
            partes.getMonth(),
            partes.getDate(),
            agora.getHours(),
            agora.getMinutes(),
            agora.getSeconds(),
            agora.getMilliseconds()
        );
    }

    function normalizarDataRelativaOuExplicita(valor) {
        const valorNormalizado = normalizarTextoConsulta(valor).trim();
        if (!valorNormalizado) return null;

        const dataExplicita = valorNormalizado.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (dataExplicita) {
            const [, dia, mes, ano] = dataExplicita;
            return `${dia.padStart(2, "0")}-${mes.padStart(2, "0")}-${ano}`;
        }

        if (valorNormalizado === "hoje") return window.ClimateData.dataAtual();
        if (valorNormalizado === "ontem") return deslocamentoHoje(-1);
        if (valorNormalizado === "anteontem" || valorNormalizado === "antiontem") return deslocamentoHoje(-2);

        return null;
    }

    function encontrarAmbientesMencionados(perguntaNormalizada) {
        return Object.values(AMBIENTES).filter(ambiente => (
            ambiente.aliases.some(apelido => temPalavraConsulta(perguntaNormalizada, normalizarTextoConsulta(apelido)))
        ));
    }

    function obterAmbientePorChave(chave) {
        const chaveNormalizada = normalizarTextoConsulta(chave);
        if (!chaveNormalizada) return null;
        return AMBIENTES[chaveNormalizada] || null;
    }

    function obterAmbientePorAbaAtiva(abaAtiva) {
        return Object.values(AMBIENTES).find(ambiente => ambiente.activeTab === abaAtiva) || AMBIENTES.sala;
    }

    function deslocamentoHoje(deslocamentoDia) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(window.ClimateData.dataAtual());
        dataReferencia.setDate(dataReferencia.getDate() + deslocamentoDia);
        return formatarDataFirebaseRelatorio(dataReferencia);
    }

    function limitarDias(dias) {
        if (!Number.isFinite(dias) || dias <= 0) return DIAS_RECENTES_PADRAO;
        return Math.min(Math.max(Math.round(dias), 1), MAX_DIAS_PERIODO);
    }

    function limitarHoras(horas) {
        if (!Number.isFinite(horas) || horas <= 0) return 24;
        return Math.min(Math.max(Math.round(horas), 1), MAX_DIAS_PERIODO * 24);
    }

    espacoNomes.intent = {
        resolveQuestionIntent: resolverIntencaoPergunta,
        resolvePeriodDates: resolverDatasPeriodo,
    };

    window.ClimateAssistant = espacoNomes;
})();
