'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { MAX_PROMPT_CHARS } = namespace.config;
    const {
        formatDate,
        formatNumber,
        formatMetricValue,
        formatPeriodLabel,
    } = namespace.format;

    async function answerQuestion(question, context) {
        const intent = await namespace.intent.resolveQuestionIntent(question, context);
        const result = executeQuery(context, intent, question);

        if (result.needsClarification) return result.message;

        const prompt = buildAnswerPrompt(question, result);

        try {
            return await window.ClimateAIService.generateText(prompt);
        } catch (error) {
            console.warn("Falha ao redigir resposta com IA. Usando resposta local.", error);
            return formatResultFallback(result);
        }
    }

    function executeQuery(context, intent, question) {
        if (intent.needsClarification) {
            return {
                needsClarification: true,
                message: intent.clarificationQuestion || "Preciso de mais detalhes para responder com segurança.",
            };
        }

        const environments = intent.environments;
        const metrics = namespace.metrics.resolveMetricsForEnvironments(environments, intent.metrics, question);
        const periodDates = namespace.intent.resolvePeriodDates(intent.period);
        const periodLabel = getPeriodLabel(intent.period, periodDates);

        if (!environments.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o ambiente. Você quer consultar Sala, Quarto ou Aquário?",
            };
        }

        if (!periodDates.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o período da consulta. Tente informar uma data ou período.",
            };
        }

        const environmentResults = environments.map(environment => executeEnvironmentQuery(context, environment, metrics, periodDates, intent, periodLabel));
        return {
            question,
            intent: {
                environments: environments.map(environment => environment.label),
                metrics: metrics.map(metric => metric.label),
                operation: intent.operation,
                criterion: intent.criterion,
                period: {
                    label: periodLabel,
                    dates: periodDates,
                },
                confidence: intent.confidence,
            },
            results: environmentResults,
            generatedAt: new Date().toLocaleString("pt-BR"),
        };
    }

    function executeEnvironmentQuery(context, environment, requestedMetrics, periodDates, intent, periodLabel) {
        const sourceData = context.latestData?.[environment.dataKey] || {};
        const data = getScopedDataForPeriod(sourceData, intent.period);
        const metrics = requestedMetrics.length ? requestedMetrics : [namespace.metrics.getDefaultMetric(environment)];
        const scopedDates = Object.keys(data || {}).sort((a, b) => window.ClimateData.parseFirebaseDate(a) - window.ClimateData.parseFirebaseDate(b));
        const queryDates = intent.period?.type === "rolling_hours" ? scopedDates : periodDates;
        const scopedIntent = { ...intent, periodLabel };

        const metricResults = metrics.map(metric => {
                const dailyStats = metric.key === "cicloSolar" || metric.key === "qualidadeAr"
                    ? []
                    : queryDates.map(date => namespace.metrics.buildDailyStats(data?.[date], metric, date, intent.hour, intent.hourRange)).filter(Boolean);

            return namespace.metrics.buildMetricResult(environment, metric, dailyStats, queryDates.length ? queryDates : periodDates, scopedIntent, data, context);
        });

        return {
            ambiente: environment.label,
            metricas: metricResults,
        };
    }

    function getScopedDataForPeriod(data, period) {
        if (period?.type !== "rolling_hours") return data;
        return window.ClimateData.filterDataByRollingHours(
            data,
            period.selectedDate || window.ClimateData.dataAtual(),
            period.hours || 24
        );
    }

    function getPeriodLabel(period, periodDates) {
        if (period?.type === "selected_month") return formatMonthPeriodLabel(period.selectedDate || periodDates[0]);
        if (period?.type === "selected_year") return formatYearPeriodLabel(period.selectedDate || periodDates[0]);
        if (period?.type === "selected_week") return `semana de ${formatPeriodLabel(periodDates)}`;
        if (period?.type !== "rolling_hours") return formatPeriodLabel(periodDates);
        return `últimas ${period.hours || 24} horas (${formatPeriodLabel(periodDates)})`;
    }

    function formatMonthPeriodLabel(firebaseDate) {
        const date = window.ClimateData.parseFirebaseDate(firebaseDate || window.ClimateData.dataAtual());
        return `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    }

    function formatYearPeriodLabel(firebaseDate) {
        const date = window.ClimateData.parseFirebaseDate(firebaseDate || window.ClimateData.dataAtual());
        return String(date.getFullYear());
    }

    function buildAnswerPrompt(question, result) {
        const payload = JSON.stringify(result, null, 2);
        const prompt = `
            Você é o assistente da página "Estação Climática".

            Responda em português do Brasil.
            Use linguagem natural, simples e objetiva.
            Use somente o resultado calculado pelo JavaScript abaixo.
            Não recalcule, não invente medições e não use conhecimento externo.

            Formato:
            - Responda primeiro a informação principal.
            - Pule linha entre blocos.
            - Use bullets curtos quando houver várias informações.
            - Se o resultado for de ciclo solar, informe amanhecer, nascer do sol, zênite, pôr do sol, anoitecer e duração do dia quando esses dados existirem.
            - Se o resultado for uma análise solar, responda a informação principal e cite o período, usando os campos calculados de duração, tendência, delta e comparação.
            - Se algum campo solar estiver ausente, simplesmente não mencione esse campo.
            - Se o resultado for de qualidade do ar, informe AQI estimado, classificação e poluente dominante quando existirem.
            - Se o resultado for de faixa de conforto, diga se ficou dentro ou fora da faixa, informe a faixa usada, quantas horas ficaram fora e o pior horário fora da faixa quando existir.
            - Se o resultado tiver "tipo_resultado": "consulta_horaria", responda somente o valor da métrica, ambiente, data e hora. Não mostre média, mínima, máxima, delta nem número de amostras.
            - Se o resultado tiver "tipo_resultado": "analise_horaria", responda o horário/período encontrado, o valor principal e a data. Se houver "faixa_horaria_consultada", diga que a análise ficou restrita a essa faixa.
            - Se o resultado tiver "tipo_resultado": "analise_calendario_mensal", responda o dia do mês encontrado, o valor principal e o período consultado.
            - Se o resultado tiver "tipo_resultado": "analise_heatmap_horario", responda a hora do dia encontrada, o valor principal e o período consultado.
            - Se o resultado tiver "tipo_resultado": "analise_heatmap_semanal", responda o dia da semana/hora encontrados, o valor principal e o período consultado.
            - Não mencione número de amostras, exceto se o usuário perguntar explicitamente.
            - Quando útil, informe o período consultado.
            - Se não houver dados, diga isso diretamente.

            Pergunta do usuário:
            ${question}

            Resultado calculado:
            ${payload}
        `.trim();

        return prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;
    }

    function formatResultFallback(result) {
        const firstMetric = result.results?.[0]?.metricas?.[0];
        if (!firstMetric) return "Não encontrei dados suficientes para responder.";
        if (firstMetric.sem_dados) return firstMetric.mensagem;

        if (firstMetric.tipo_resultado === "ciclo_solar") return formatSolarFallback(firstMetric);
        if (firstMetric.tipo_resultado?.startsWith?.("solar_")) return formatSolarAnalyticFallback(firstMetric);
        if (firstMetric.tipo_resultado === "faixa_conforto") return formatComfortBandFallback(firstMetric);
        if (firstMetric.sem_faixa) return firstMetric.mensagem;

        if (firstMetric.tipo_resultado === "consulta_horaria") {
            const dateLabel = firstMetric.datas_consultadas?.[0] || firstMetric.periodo;
            const value = formatMetricValue(firstMetric.valor, firstMetric.unidade);
            const classification = firstMetric.classificacao ? ` (${firstMetric.classificacao})` : "";
            const dominant = firstMetric.dominante ? ` Dominante: ${firstMetric.dominante}.` : "";
            return `${firstMetric.metrica} em ${firstMetric.ambiente} no dia ${dateLabel} às ${firstMetric.hora_consultada}: ${value}${classification}.${dominant}`;
        }

        if (firstMetric.tipo_resultado === "analise_horaria") {
            const value = formatMetricValue(firstMetric.valor, firstMetric.unidade);
            const descriptor = firstMetric.criterio === "menor_media_horaria" ? "menor valor médio" : "maior valor médio";
            const range = firstMetric.faixa_horaria_consultada
                ? `, considerando apenas ${firstMetric.faixa_horaria_consultada}`
                : "";
            return `O ${descriptor} de ${firstMetric.metrica} em ${firstMetric.ambiente}${range} foi em ${firstMetric.data} às ${firstMetric.horario}: ${value}.`;
        }

        if (firstMetric.tipo_resultado === "analise_calendario_mensal") {
            const value = formatMetricValue(firstMetric.valor, firstMetric.unidade);
            const descriptor = firstMetric.criterio === "menor_media_diaria" ? "menor média diária" : "maior média diária";
            return `No calendário mensal de ${firstMetric.periodo}, o dia com ${descriptor} de ${firstMetric.metrica} em ${firstMetric.ambiente} foi ${firstMetric.data}: ${value}.`;
        }

        if (firstMetric.tipo_resultado === "analise_heatmap_horario") {
            const value = formatMetricValue(firstMetric.valor, firstMetric.unidade);
            const descriptor = firstMetric.criterio === "menor_media_por_hora" ? "menor média por hora" : "maior média por hora";
            return `No período ${firstMetric.periodo}, a hora com ${descriptor} de ${firstMetric.metrica} em ${firstMetric.ambiente} foi ${firstMetric.horario}: ${value}.`;
        }

        if (firstMetric.tipo_resultado === "analise_heatmap_semanal") {
            const value = formatMetricValue(firstMetric.valor, firstMetric.unidade);
            const descriptor = firstMetric.criterio === "menor_media_dia_hora" ? "menor média por dia/hora" : "maior média por dia/hora";
            return `No mapa semanal (${firstMetric.periodo}), o ponto com ${descriptor} de ${firstMetric.metrica} em ${firstMetric.ambiente} foi ${firstMetric.dia_semana} às ${firstMetric.horario}: ${value}.`;
        }

        if (firstMetric.tipo_resultado === "qualidade_ar") {
            return [
                `AQI estimado em ${firstMetric.ambiente}: ${firstMetric.media} (${firstMetric.classificacao_atual || "sem classificação"}).`,
                firstMetric.dominante_atual ? `Dominante: ${firstMetric.dominante_atual}.` : null,
                "",
                `Mínimo: ${firstMetric.minima}`,
                `Máximo: ${firstMetric.maxima}`,
                `Período: ${firstMetric.periodo}`
            ].filter(Boolean).join("\n");
        }

        if (firstMetric.operacao === "dia_mais_frio") {
            return `No período ${firstMetric.periodo}, o dia mais frio em ${firstMetric.ambiente} foi ${firstMetric.dia_mais_frio.data}, com média de ${formatNumber(firstMetric.dia_mais_frio.valor)}${firstMetric.unidade}.`;
        }

        if (firstMetric.operacao === "dia_mais_quente") {
            return `No período ${firstMetric.periodo}, o dia mais quente em ${firstMetric.ambiente} foi ${firstMetric.dia_mais_quente.data}, com média de ${formatNumber(firstMetric.dia_mais_quente.valor)}${firstMetric.unidade}.`;
        }

        return [
            `${firstMetric.metrica} em ${firstMetric.ambiente}:`,
            "",
            `Média: ${formatNumber(firstMetric.media)}${firstMetric.unidade}`,
            `Mínima: ${formatNumber(firstMetric.minima)}${firstMetric.unidade}`,
            `Máxima: ${formatNumber(firstMetric.maxima)}${firstMetric.unidade}`,
            firstMetric.faixa_horaria_consultada ? `Faixa horária: ${firstMetric.faixa_horaria_consultada}` : null,
            "",
            `Período: ${firstMetric.periodo}`
        ].filter(line => line !== null).join("\n");
    }

    function formatSolarFallback(firstMetric) {
        const firstDay = firstMetric.por_dia?.[0];
        if (!firstDay) return firstMetric.mensagem || "Não encontrei dados de ciclo solar para o período consultado.";

        const lines = [
            `Ciclo solar em ${firstMetric.ambiente} no dia ${firstDay.data}:`,
            "",
        ];

        if (firstDay.amanhecer) lines.push(`Amanhecer: ${firstDay.amanhecer}`);
        if (firstDay.nascer_do_sol) lines.push(`Nascer do sol: ${firstDay.nascer_do_sol}`);
        if (firstDay.zenite) lines.push(`Zênite: ${firstDay.zenite}`);
        if (firstDay.por_do_sol) lines.push(`Pôr do sol: ${firstDay.por_do_sol}`);
        if (firstDay.anoitecer) lines.push(`Anoitecer: ${firstDay.anoitecer}`);
        if (firstDay.duracao_dia) lines.push(`Duração do dia: ${firstDay.duracao_dia}`);
        if (firstDay.periodo_luz_total) lines.push(`Período total de luz: ${firstDay.periodo_luz_total}`);

        lines.push("");
        lines.push(`Período consultado: ${firstMetric.periodo}`);

        return lines.join("\n");
    }

    function formatSolarAnalyticFallback(firstMetric) {
        if (firstMetric.tipo_resultado === "solar_duracao_dia") {
            return `A duração do dia em ${firstMetric.data} foi ${firstMetric.duracao_dia}, de ${firstMetric.nascer_do_sol} até ${firstMetric.por_do_sol}.`;
        }

        if (firstMetric.tipo_resultado === "solar_extremo_duracao_luz") {
            const descriptor = firstMetric.criterio === "menor_duracao_luz" ? "menor duração de luz" : "maior duração de luz";
            return `No período ${firstMetric.periodo}, o dia com ${descriptor} foi ${firstMetric.data}: ${firstMetric.duracao_dia} de luz (${firstMetric.nascer_do_sol} às ${firstMetric.por_do_sol}).`;
        }

        if (firstMetric.tipo_resultado === "solar_tendencia_evento") {
            const trendLabel = {
                mais_cedo: "ficando mais cedo",
                mais_tarde: "ficando mais tarde",
                estavel: "praticamente estável",
            }[firstMetric.tendencia] || firstMetric.tendencia;
            const delta = formatMinuteDelta(firstMetric.delta_minutos);
            return `No período (${firstMetric.periodo}), o ${firstMetric.evento} está ${trendLabel}: foi de ${firstMetric.primeiro.horario} em ${firstMetric.primeiro.data} para ${firstMetric.ultimo.horario} em ${firstMetric.ultimo.data} (${delta}).`;
        }

        if (firstMetric.tipo_resultado === "solar_comparacao_evento") {
            const rows = firstMetric.por_dia
                .map(day => `${day.data}: ${day.horario}${day.diferenca_minutos ? ` (${formatMinuteDelta(day.diferenca_minutos)})` : ""}`)
                .join("\n");
            return `Comparação de ${firstMetric.evento} no período (${firstMetric.periodo}):\n\n${rows}`;
        }

        return firstMetric.mensagem || "Não encontrei dados solares suficientes para responder.";
    }

    function formatMinuteDelta(minutes) {
        if (!Number.isFinite(minutes) || minutes === 0) return "sem variação";
        const sign = minutes > 0 ? "+" : "-";
        const abs = Math.abs(minutes);
        return `${sign}${abs} min`;
    }

    function formatComfortBandFallback(firstMetric) {
        const status = firstMetric.status === "dentro_da_faixa"
            ? "ficou dentro da faixa"
            : "ficou fora da faixa";
        const lines = [
            `${firstMetric.metrica} em ${firstMetric.ambiente} ${status} no período ${firstMetric.periodo}.`,
            "",
            `Faixa usada: ${firstMetric.faixa}`,
            `Horas fora da faixa: ${firstMetric.horas_fora}`,
            `Dentro da faixa: ${formatNumber(firstMetric.percentual_dentro)}%`,
        ];

        if (firstMetric.pior_horario_fora) {
            const value = formatMetricValue(firstMetric.pior_horario_fora.valor, firstMetric.unidade);
            lines.push(`Pior horário fora da faixa: ${firstMetric.pior_horario_fora.data} às ${firstMetric.pior_horario_fora.horario}, com ${value} (${firstMetric.pior_horario_fora.direcao} da faixa).`);
        }

        return lines.join("\n");
    }

    namespace.query = { answerQuestion };
    window.ClimateAssistant = namespace;
})();
