'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { DEFAULT_RECENT_DAYS, MAX_PERIOD_DAYS, ENVIRONMENTS } = namespace.config;
    const MAX_DIAS_INTERVALO_SOLAR = 367;
    const {
        normalizeText,
        hasWord,
        normalizeHourFilter,
        formatDate,
        formatFirebaseDate,
        getTabLabel,
        uniqueDates,
    } = namespace.format;
    const {
        inferMetricsFromQuestion,
        hasSolarIntent,
        metricMatches,
        toMetricObject,
    } = namespace.metrics;

    async function resolveQuestionIntent(question, context) {
        const normalizedQuestion = normalizeText(question);
        const mentionedEnvironments = findMentionedEnvironments(normalizedQuestion);
        const fallbackEnvironment = getEnvironmentByActiveTab(context.activeTab);
        const classifiedIntent = await classifyQuestionIntent(question, context);
        const classifiedEnvironments = getEnvironmentsFromIntent(classifiedIntent);
        const operation = normalizeOperation(classifiedIntent?.operacao, normalizedQuestion);
        const hourRange = normalizeHourRange(classifiedIntent?.periodo) || extractQuestionHourRange(normalizedQuestion);
        const hour = hourRange
            ? null
            : normalizeHourFilter(classifiedIntent?.periodo?.hora || classifiedIntent?.hora || extractQuestionHour(normalizedQuestion));
        const period = normalizePeriod(classifiedIntent?.periodo, normalizedQuestion, context.selectedDate, operation);
        const classifiedMetrics = normalizeMetrics(classifiedIntent?.metricas || classifiedIntent?.metrica);
        const metrics = classifiedMetrics.length ? classifiedMetrics : inferMetricsFromQuestion(normalizedQuestion);
        const solarIntent = hasSolarIntent(normalizedQuestion) || operation.startsWith("solar_") || Boolean(classifiedIntent?.solar);
        const finalMetrics = solarIntent ? ["ciclo_solar"] : metrics;
        const environments = resolveTargetEnvironments({
            mentionedEnvironments,
            classifiedEnvironments,
            requestedMetrics: finalMetrics,
            fallbackEnvironment,
        });

        return {
            environments,
            metrics: finalMetrics,
            operation,
            period,
            hour,
            hourRange,
            criterion: normalizeText(classifiedIntent?.criterio),
            confidence: Number(classifiedIntent?.confianca) || null,
            needsClarification: Boolean(classifiedIntent?.precisa_esclarecimento),
            clarificationQuestion: classifiedIntent?.pergunta_esclarecimento || null,
        };
    }

    async function classifyQuestionIntent(question, context) {
        const prompt = `
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
            - "últimos dias", "esses últimos dias" ou frase parecida significa últimos ${DEFAULT_RECENT_DAYS} dias.
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

            Data selecionada na página: ${formatDate(context.selectedDate)}
            Aba ativa: ${getTabLabel(context.activeTab)}
            Pergunta: ${question}
        `.trim();

        try {
            const answer = await window.ClimateAIService.generateText(prompt);
            return parseIntentJson(answer);
        } catch (error) {
            window.ClimateDiagnostics?.depurar("Falha ao classificar intenção do chat. Usando fallback local.", error);
            return null;
        }
    }

    function parseIntentJson(answer) {
        const text = String(answer || "").trim();
        const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;

        try {
            const parsed = JSON.parse(jsonText);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
            window.ClimateDiagnostics?.depurar("Intenção do chat não veio em JSON válido.", answer);
            return null;
        }
    }

    function getEnvironmentsFromIntent(intent) {
        const rawEnvironments = Array.isArray(intent?.ambientes)
            ? intent.ambientes
            : [intent?.ambiente].filter(Boolean);

        return rawEnvironments
            .map(getEnvironmentByKey)
            .filter(Boolean);
    }

    function resolveTargetEnvironments({ mentionedEnvironments, classifiedEnvironments, requestedMetrics, fallbackEnvironment }) {
        if (mentionedEnvironments.length) return resolveCompatibleEnvironments(mentionedEnvironments, requestedMetrics) || mentionedEnvironments;
        if (classifiedEnvironments.length) return resolveCompatibleEnvironments(classifiedEnvironments, requestedMetrics) || classifiedEnvironments;

        const metricEnvironment = findExclusiveMetricEnvironment(requestedMetrics);
        if (metricEnvironment) return [metricEnvironment];

        const generalEnvironments = fallbackEnvironment?.dataKey === "solar"
            ? findCompatibleMetricEnvironments(requestedMetrics)
            : [];
        if (generalEnvironments.length) return generalEnvironments;

        return [fallbackEnvironment];
    }

    function resolveCompatibleEnvironments(candidateEnvironments, requestedMetrics) {
        if (!requestedMetrics?.length) return candidateEnvironments;

        const compatible = candidateEnvironments.filter(environment => (
            requestedMetrics.some(requestedMetric => (
                environment.metrics
                    .map(toMetricObject)
                    .some(metric => metricMatches(metric, requestedMetric))
            ))
        ));
        if (compatible.length) return compatible;

        const metricEnvironment = findExclusiveMetricEnvironment(requestedMetrics);
        return metricEnvironment ? [metricEnvironment] : null;
    }

    function findExclusiveMetricEnvironment(requestedMetrics) {
        const matches = findCompatibleMetricEnvironments(requestedMetrics);
        return matches.length === 1 ? matches[0] : null;
    }

    function findCompatibleMetricEnvironments(requestedMetrics) {
        const ambientes = [];
        for (const requestedMetric of requestedMetrics || []) {
            const matches = Object.values(ENVIRONMENTS).filter(environment => (
                environment.dataKey !== "solar" &&
                environment.metrics
                    .map(toMetricObject)
                    .some(metric => metricMatches(metric, requestedMetric))
            ));

            for (const environment of matches) {
                if (!ambientes.includes(environment)) ambientes.push(environment);
            }
        }

        return ambientes;
    }

    function normalizeMetrics(value) {
        const values = Array.isArray(value) ? value : [value].filter(Boolean);
        return values.map(normalizeText).filter(Boolean);
    }

    function normalizeOperation(value, normalizedQuestion) {
        const operation = normalizeText(value);
        const solarOperation = inferSolarOperation(normalizedQuestion);
        if (solarOperation) return solarOperation;
        const heatmapOperation = inferHeatmapOperation(normalizedQuestion);
        if (heatmapOperation) return heatmapOperation;
        const hourlyOperation = inferHourlyOperation(normalizedQuestion);
        if (hourlyOperation) return hourlyOperation;
        if (hasComfortBandIntent(normalizedQuestion)) return "status_faixa";
        if (normalizedQuestion.includes("dia mais fri")) return "dia_mais_frio";
        if (normalizedQuestion.includes("dia mais quent")) return "dia_mais_quente";
        if (normalizedQuestion.includes("tendencia") || normalizedQuestion.includes("subindo") || normalizedQuestion.includes("caindo")) return "tendencia";
        if (normalizedQuestion.includes("variou") || normalizedQuestion.includes("variacao") || normalizedQuestion.includes("delta")) return "delta";
        if (normalizedQuestion.includes("maxim") || normalizedQuestion.includes("mais alta") || normalizedQuestion.includes("maior valor")) return "maxima";
        if (normalizedQuestion.includes("minim") || normalizedQuestion.includes("mais baixa") || normalizedQuestion.includes("menor valor")) return "minima";
        if (normalizedQuestion.includes("media")) return "media";
        if (normalizedQuestion.includes("diferenca") || normalizedQuestion.includes("diferença")) {
            return hasExplicitDayComparison(normalizedQuestion) ? "comparar_dias" : "delta";
        }
        if (temIntencaoUltimaMedicao(normalizedQuestion) || operation === "valor") return "ultima_medicao";
        if (operation && operation !== "resumo") return operation;
        if (operation) return operation;
        return "resumo";
    }

    function temIntencaoUltimaMedicao(normalizedQuestion) {
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
        ].some(term => normalizedQuestion.includes(normalizeText(term)));
        if (pedeValorAtual) return true;

        const pedeValorSimples = [
            "qual o",
            "qual a",
            "quanto esta",
            "quanto está",
            "quanto ta",
            "quanto tá",
        ].some(term => normalizedQuestion.includes(normalizeText(term)));
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
        ].some(term => normalizedQuestion.includes(normalizeText(term)));
    }

    function inferSolarOperation(normalizedQuestion) {
        if (!hasSolarQuestionIntent(normalizedQuestion)) return null;

        const isSunrise = normalizedQuestion.includes("nascer");
        const isSunset = normalizedQuestion.includes("por do sol") || normalizedQuestion.includes("por-do-sol");
        const asksTrend = normalizedQuestion.includes("ficando") || normalizedQuestion.includes("esta ficando") || normalizedQuestion.includes("tendencia");
        const asksCompare = normalizedQuestion.includes("compar") || normalizedQuestion.includes("compare");

        if (normalizedQuestion.includes("dia mais long") || normalizedQuestion.includes("dia com mais tempo de luz")) return "solar_maior_duracao_luz";
        if (normalizedQuestion.includes("dia mais curt") || normalizedQuestion.includes("dia com menos tempo de luz")) return "solar_menor_duracao_luz";

        if (
            normalizedQuestion.includes("duracao")
            || normalizedQuestion.includes("duração")
            || normalizedQuestion.includes("tempo de luz")
            || normalizedQuestion.includes("luz solar")
            || normalizedQuestion.includes("periodo de luz")
            || normalizedQuestion.includes("luz")
        ) {
            if (normalizedQuestion.includes("maior") || normalizedQuestion.includes("mais long")) return "solar_maior_duracao_luz";
            if (normalizedQuestion.includes("menor") || normalizedQuestion.includes("mais curt")) return "solar_menor_duracao_luz";
            return "solar_duracao_dia";
        }

        if (asksCompare && isSunrise) return "solar_comparar_nascer";
        if (asksCompare && isSunset) return "solar_comparar_por";
        if (asksTrend && isSunrise) return "solar_tendencia_nascer";
        if (asksTrend && isSunset) return "solar_tendencia_por";

        return null;
    }

    function hasSolarQuestionIntent(normalizedQuestion) {
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
        ].some(term => normalizedQuestion.includes(normalizeText(term)));
    }

    function inferHeatmapOperation(normalizedQuestion) {
        const mode = inferExtremeMode(normalizedQuestion);
        if (!mode) return null;

        if (
            normalizedQuestion.includes("dia do mes")
            || normalizedQuestion.includes("dia no mes")
            || normalizedQuestion.includes("calendario")
            || normalizedQuestion.includes("calendario climatico")
        ) {
            return mode === "min" ? "calendario_dia_menor_valor" : "calendario_dia_maior_valor";
        }

        if (
            normalizedQuestion.includes("dia/hora")
            || normalizedQuestion.includes("dia hora")
            || normalizedQuestion.includes("dia e hora")
            || normalizedQuestion.includes("mapa semanal")
            || normalizedQuestion.includes("heatmap semanal")
            || normalizedQuestion.includes("semana")
        ) {
            return mode === "min" ? "heatmap_semana_menor_valor" : "heatmap_semana_maior_valor";
        }

        if (
            normalizedQuestion.includes("hora costuma")
            || normalizedQuestion.includes("horario costuma")
            || normalizedQuestion.includes("costuma ser")
            || normalizedQuestion.includes("heatmap por hora")
            || normalizedQuestion.includes("por hora do dia")
        ) {
            return mode === "min" ? "heatmap_hora_menor_valor" : "heatmap_hora_maior_valor";
        }

        return null;
    }

    function inferHourlyOperation(normalizedQuestion) {
        const asksTime = [
            "qual horario",
            "qual foi o horario",
            "que horario",
            "em qual horario",
            "qual hora",
            "qual foi a hora",
            "que hora",
            "periodo do dia",
            "faixa do dia",
        ].some(term => normalizedQuestion.includes(term));
        if (!asksTime) return null;

        const asksHigh = [
            "mais quent",
            "maior",
            "maxim",
            "mais alto",
            "pico",
        ].some(term => normalizedQuestion.includes(term));
        if (asksHigh) return "horario_maior_valor";

        const asksLow = [
            "mais fri",
            "menor",
            "minim",
            "mais baixo",
        ].some(term => normalizedQuestion.includes(term));
        if (asksLow) return "horario_menor_valor";

        return null;
    }

    function inferExtremeMode(normalizedQuestion) {
        const asksHigh = [
            "mais quent",
            "maior",
            "maxim",
            "mais alto",
            "pico",
        ].some(term => normalizedQuestion.includes(term));
        if (asksHigh) return "max";

        const asksLow = [
            "mais fri",
            "menor",
            "minim",
            "mais baixo",
        ].some(term => normalizedQuestion.includes(term));
        if (asksLow) return "min";

        return null;
    }


    function hasComfortBandIntent(normalizedQuestion) {
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
        ].some(term => normalizedQuestion.includes(normalizeText(term)));
    }

    function normalizePeriod(period, normalizedQuestion, selectedDate, operation) {
        const explicitDates = extractQuestionDates(normalizedQuestion);
        const normalizedType = normalizeText(period?.tipo);
        const monthPeriodDate = extractMonthPeriodDate(normalizedQuestion, selectedDate);
        const yearPeriodDate = extractYearPeriodDate(normalizedQuestion, selectedDate);
        const quantidadeHorasPergunta = extractRollingHours(normalizedQuestion);
        if (normalizedType === "ultimas_24h" || quantidadeHorasPergunta !== null) {
            const horasSolicitadas = quantidadeHorasPergunta || Number(period?.quantidade) || 24;
            const horas = clampHours(horasSolicitadas);
            return {
                type: "rolling_hours",
                hours: horas,
                requestedHours: horasSolicitadas,
                limited: horas !== horasSolicitadas,
                selectedDate: explicitDates[0] || selectedDate || window.ClimateData.dataAtual(),
            };
        }

        const intervaloExplicito = extrairIntervaloExplicito(period, normalizedType, normalizedQuestion, explicitDates);
        if (intervaloExplicito) {
            const consultaSolarExtrema = operation === "solar_maior_duracao_luz"
                || operation === "solar_menor_duracao_luz";
            return {
                type: consultaSolarExtrema ? "solar_range" : "range",
                start: intervaloExplicito.inicio,
                end: intervaloExplicito.fim,
            };
        }

        if (normalizedType === "mes_selecionado" || operation?.startsWith("calendario_dia_") || ((operation === "solar_maior_duracao_luz" || operation === "solar_menor_duracao_luz") && monthPeriodDate)) {
            return { type: "selected_month", selectedDate: monthPeriodDate || explicitDates[0] || selectedDate || window.ClimateData.dataAtual() };
        }

        if (normalizedType === "ano_selecionado" || operation === "solar_maior_duracao_luz" || operation === "solar_menor_duracao_luz") {
            return { type: "selected_year", selectedDate: explicitDates[0] || yearPeriodDate || selectedDate || window.ClimateData.dataAtual() };
        }

        if (normalizedType === "semana_selecionada" || operation?.startsWith("heatmap_semana_") || operation === "solar_tendencia_nascer" || operation === "solar_tendencia_por" || operation === "solar_comparar_nascer" || operation === "solar_comparar_por" || normalizedQuestion.includes("semana")) {
            return { type: "selected_week", selectedDate: explicitDates[0] || selectedDate || window.ClimateData.dataAtual() };
        }

        if (operation?.startsWith("heatmap_hora_") && (normalizedQuestion.includes("costuma") || normalizedQuestion.includes("tipic"))) {
            return { type: "selected_month", selectedDate: explicitDates[0] || selectedDate || window.ClimateData.dataAtual() };
        }

        if (normalizedType === "ultimos_dias" || normalizedQuestion.includes("ultim") || normalizedQuestion.includes("urtim")) {
            const quantidadePergunta = extractLastDaysQuantity(normalizedQuestion);
            const diasSolicitados = quantidadePergunta || Number(period?.quantidade) || DEFAULT_RECENT_DAYS;
            const dias = clampDays(diasSolicitados);
            return {
                type: "last_days",
                days: dias,
                requestedDays: diasSolicitados,
                limited: dias !== diasSolicitados,
                selectedDate: explicitDates[0] || selectedDate || window.ClimateData.dataAtual(),
            };
        }

        if (explicitDates.length > 1) return { type: "datas", dates: explicitDates };
        if (explicitDates.length === 1) return { type: "datas", dates: explicitDates };

        const rawDates = Array.isArray(period?.datas) ? period.datas : [];
        const classifiedDates = rawDates.map(normalizeRelativeOrExplicitDate).filter(Boolean);
        if (classifiedDates.length) return { type: "datas", dates: classifiedDates };

        const singleDate = normalizeRelativeOrExplicitDate(period?.data);
        if (singleDate) return { type: "datas", dates: [singleDate] };

        if (normalizedType === "intervalo" && period?.inicio && period?.fim) {
            return {
                type: "range",
                start: normalizeRelativeOrExplicitDate(period.inicio),
                end: normalizeRelativeOrExplicitDate(period.fim),
            };
        }

        if (hasWord(normalizedQuestion, "hoje") || hasWord(normalizedQuestion, "hj")) return { type: "datas", dates: [window.ClimateData.dataAtual()] };
        if (hasWord(normalizedQuestion, "ontem")) return { type: "datas", dates: [offsetFromToday(-1)] };
        if (hasWord(normalizedQuestion, "anteontem") || hasWord(normalizedQuestion, "antiontem")) return { type: "datas", dates: [offsetFromToday(-2)] };

        return { type: "datas", dates: [selectedDate || window.ClimateData.dataAtual()] };
    }

    function resolvePeriodDates(period) {
        if (period.type === "rolling_hours") return resolveRollingHourDates(period);
        if (period.type === "selected_month") return buildMonthDates(period.selectedDate);
        if (period.type === "selected_year") return buildYearDates(period.selectedDate);
        if (period.type === "selected_week") return buildWeekDates(period.selectedDate);
        if (period.type === "datas") return uniqueDates(period.dates).slice(0, MAX_PERIOD_DAYS);
        if (period.type === "last_days") return buildLastDays(period.days, period.selectedDate);
        if (period.type === "solar_range" && period.start && period.end) {
            return buildDateRange(period.start, period.end, MAX_DIAS_INTERVALO_SOLAR);
        }
        if (period.type === "range" && period.start && period.end) return buildDateRange(period.start, period.end, MAX_PERIOD_DAYS);
        return [window.ClimateData.dataAtual()];
    }

    function buildMonthDates(selectedDate) {
        const date = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, index) => (
            formatFirebaseDate(new Date(date.getFullYear(), date.getMonth(), index + 1))
        ));
    }

    function buildYearDates(selectedDate) {
        const date = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        const dates = [];

        for (
            const cursor = new Date(date.getFullYear(), 0, 1);
            cursor.getFullYear() === date.getFullYear();
            cursor.setDate(cursor.getDate() + 1)
        ) {
            dates.push(formatFirebaseDate(cursor));
        }

        return dates;
    }

    function buildWeekDates(selectedDate) {
        const date = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        const start = new Date(date);
        start.setDate(start.getDate() - start.getDay());
        const dates = [];

        for (const cursor = new Date(start); cursor <= date && dates.length < 7; cursor.setDate(cursor.getDate() + 1)) {
            dates.push(formatFirebaseDate(cursor));
        }

        return dates;
    }

    function resolveRollingHourDates(period) {
        const selectedDate = period.selectedDate || window.ClimateData.dataAtual();
        const end = getRollingWindowEnd(selectedDate);
        const start = new Date(end);
        start.setHours(start.getHours() - (period.hours || 24));
        return uniqueDates([formatFirebaseDate(start), formatFirebaseDate(end)]);
    }

    function buildLastDays(days, selectedDate) {
        const quantidade = clampDays(days);
        const dataFinal = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        return Array.from({ length: quantidade }, (_, index) => {
            const data = new Date(dataFinal);
            data.setDate(data.getDate() - (quantidade - 1 - index));
            return formatFirebaseDate(data);
        });
    }

    function buildDateRange(start, end, limiteDias = MAX_PERIOD_DAYS) {
        const startDate = window.ClimateData.parseFirebaseDate(start);
        const endDate = window.ClimateData.parseFirebaseDate(end);
        const dates = [];
        const direction = startDate <= endDate ? 1 : -1;
        const cursor = new Date(startDate);

        while (dates.length < limiteDias) {
            dates.push(formatFirebaseDate(cursor));
            if (formatFirebaseDate(cursor) === formatFirebaseDate(endDate)) break;
            cursor.setDate(cursor.getDate() + direction);
        }

        return dates;
    }

    function extrairIntervaloExplicito(periodo, tipoNormalizado, perguntaNormalizada, datasExplicitas) {
        const inicioClassificado = normalizeRelativeOrExplicitDate(periodo?.inicio);
        const fimClassificado = normalizeRelativeOrExplicitDate(periodo?.fim);
        if (inicioClassificado && fimClassificado) {
            return { inicio: inicioClassificado, fim: fimClassificado };
        }

        const mencionaIntervalo = tipoNormalizado === "intervalo"
            || hasWord(perguntaNormalizada, "entre")
            || hasWord(perguntaNormalizada, "ate")
            || hasWord(perguntaNormalizada, "intervalo");
        if (!mencionaIntervalo || datasExplicitas.length < 2) return null;

        return {
            inicio: datasExplicitas[0],
            fim: datasExplicitas[1],
        };
    }

    function extractQuestionDates(normalizedQuestion) {
        const dates = [];
        const matches = normalizedQuestion.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g);
        for (const match of matches) {
            const [, day, month, year] = match;
            dates.push(`${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`);
        }

        if (hasWord(normalizedQuestion, "anteontem") || hasWord(normalizedQuestion, "antiontem")) dates.push(offsetFromToday(-2));
        if (hasWord(normalizedQuestion, "ontem")) dates.push(offsetFromToday(-1));
        if (hasWord(normalizedQuestion, "hoje") || hasWord(normalizedQuestion, "hj")) dates.push(window.ClimateData.dataAtual());

        return uniqueDates(dates);
    }

    function extractMonthPeriodDate(normalizedQuestion, selectedDate) {
        const monthIndex = getMentionedMonthIndex(normalizedQuestion);
        if (monthIndex === null) {
            return normalizedQuestion.includes("mes") || normalizedQuestion.includes("mês")
                ? selectedDate || window.ClimateData.dataAtual()
                : null;
        }

        const selected = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        const year = extractQuestionYear(normalizedQuestion) || selected.getFullYear();
        return formatFirebaseDate(new Date(year, monthIndex, 1));
    }

    function extractYearPeriodDate(normalizedQuestion, selectedDate) {
        const selected = window.ClimateData.parseFirebaseDate(selectedDate || window.ClimateData.dataAtual());
        const year = extractQuestionYear(normalizedQuestion) || selected.getFullYear();
        return formatFirebaseDate(new Date(year, selected.getMonth(), selected.getDate()));
    }

    function extractQuestionYear(normalizedQuestion) {
        const match = normalizedQuestion.match(/\b(20\d{2})\b/);
        return match ? Number(match[1]) : null;
    }

    function getMentionedMonthIndex(normalizedQuestion) {
        const months = [
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

        const index = months.findIndex(aliases => aliases.some(alias => hasWord(normalizedQuestion, normalizeText(alias))));
        return index >= 0 ? index : null;
    }

    function extractQuestionHour(normalizedQuestion) {
        const match = normalizedQuestion.match(/\b(?:as|às)\s*(\d{1,2})(?:h|:00)?\b|\b(\d{1,2})(?:h|:00)\b/);
        if (!match) return null;
        const hour = Number(match[1] || match[2]);
        if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
        return String(hour).padStart(2, "0");
    }

    function normalizeHourRange(period) {
        if (!period || typeof period !== "object") return null;

        const start = normalizeHourFilter(
            period.hora_inicio
            || period.inicio_hora
            || period.horaInicial
            || period.inicioHorario
        );
        const end = normalizeHourFilter(
            period.hora_fim
            || period.fim_hora
            || period.horaFinal
            || period.fimHorario
        );

        return start && end ? { start, end } : null;
    }

    function extractQuestionHourRange(normalizedQuestion) {
        const match = normalizedQuestion.match(/\b(?:entre|das|de)\s*(\d{1,2})(?:h|:00)?\s*(?:e|a|as|-)\s*(\d{1,2})(?:h|:00)?\b/);
        if (!match) return null;

        const start = normalizeHourFilter(match[1]);
        const end = normalizeHourFilter(match[2]);
        return start && end ? { start, end } : null;
    }

    function extractRollingHours(normalizedQuestion) {
        const match = normalizedQuestion.match(/\b(?:ultim|urtim)[a-z]*\s+(.+?)\s*(?:h|hora|horas)\b/);
        if (!match) return null;
        return parseQuantity(match[1]);
    }

    function extractLastDaysQuantity(normalizedQuestion) {
        const match = normalizedQuestion.match(/\b(?:ultim|urtim)[a-z]*\s+(.+?)\s+dias?\b/);
        if (!match) return null;
        return parseQuantity(match[1]);
    }

    function parseQuantity(value) {
        const text = normalizeText(value).trim();
        if (/^\d+$/.test(text)) return Number(text);

        const units = {
            um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
            seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
            doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15,
            dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19,
        };
        if (units[text]) return units[text];

        const tens = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60 };
        const compound = text.match(/^(vinte|trinta|quarenta|cinquenta|sessenta)(?:\s+e\s+(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove))?$/);
        if (!compound) return null;
        return tens[compound[1]] + (compound[2] ? units[compound[2]] : 0);
    }

    function hasExplicitDayComparison(normalizedQuestion) {
        const mentions = ["hoje", "hj", "ontem", "anteontem", "antiontem"]
            .filter(term => hasWord(normalizedQuestion, term));
        const explicitDates = [...normalizedQuestion.matchAll(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g)];
        return new Set(mentions).size + explicitDates.length >= 2 || normalizedQuestion.includes("compar");
    }

    function getRollingWindowEnd(selectedDate) {
        const parts = window.ClimateData.parseFirebaseDate(selectedDate);
        const now = new Date();
        return new Date(
            parts.getFullYear(),
            parts.getMonth(),
            parts.getDate(),
            now.getHours(),
            now.getMinutes(),
            now.getSeconds(),
            now.getMilliseconds()
        );
    }

    function normalizeRelativeOrExplicitDate(value) {
        const normalizedValue = normalizeText(value).trim();
        if (!normalizedValue) return null;

        const explicitDate = normalizedValue.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
        if (explicitDate) {
            const [, day, month, year] = explicitDate;
            return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
        }

        if (normalizedValue === "hoje") return window.ClimateData.dataAtual();
        if (normalizedValue === "ontem") return offsetFromToday(-1);
        if (normalizedValue === "anteontem" || normalizedValue === "antiontem") return offsetFromToday(-2);

        return null;
    }

    function findMentionedEnvironments(normalizedQuestion) {
        return Object.values(ENVIRONMENTS).filter(environment => (
            environment.aliases.some(alias => hasWord(normalizedQuestion, normalizeText(alias)))
        ));
    }

    function getEnvironmentByKey(key) {
        const normalizedKey = normalizeText(key);
        if (!normalizedKey) return null;
        return ENVIRONMENTS[normalizedKey] || null;
    }

    function getEnvironmentByActiveTab(activeTab) {
        return Object.values(ENVIRONMENTS).find(environment => environment.activeTab === activeTab) || ENVIRONMENTS.sala;
    }

    function offsetFromToday(dayOffset) {
        const date = window.ClimateData.parseFirebaseDate(window.ClimateData.dataAtual());
        date.setDate(date.getDate() + dayOffset);
        return formatFirebaseDate(date);
    }

    function clampDays(days) {
        if (!Number.isFinite(days) || days <= 0) return DEFAULT_RECENT_DAYS;
        return Math.min(Math.max(Math.round(days), 1), MAX_PERIOD_DAYS);
    }

    function clampHours(hours) {
        if (!Number.isFinite(hours) || hours <= 0) return 24;
        return Math.min(Math.max(Math.round(hours), 1), MAX_PERIOD_DAYS * 24);
    }

    namespace.intent = {
        resolveQuestionIntent,
        resolvePeriodDates,
    };

    window.ClimateAssistant = namespace;
})();
