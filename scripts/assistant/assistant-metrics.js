'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { METRIC_ALIASES } = namespace.config;
    const {
        normalizeText,
        hasWord,
        normalizeHourFilter,
        formatDate,
        formatPeriodLabel,
        formatHourLabel,
        formatHourRangeLabel,
    } = namespace.format;

    function buildMetricResult(environment, metric, dailyStats, periodDates, intent, data, context) {
        if (metric.key === "cicloSolar") {
            return namespace.solar.buildSolarCycleResult(environment, context, periodDates, intent);
        }
        if (metric.key === "qualidadeAr") {
            return namespace.aqi.buildAirQualityResult(environment, metric, periodDates, intent, data);
        }
        if (intent.operation === "status_faixa") {
            return buildComfortBandResult(environment, metric, dailyStats, periodDates, intent);
        }

        const allValues = dailyStats.flatMap(day => day.values);
        const base = {
            ambiente: environment.label,
            metrica: metric.label,
            unidade: metric.unit,
            operacao: intent.operation,
            criterio: intent.criterion || defaultCriterionForOperation(intent.operation),
            periodo: intent.periodLabel || formatPeriodLabel(periodDates),
            hora_consultada: intent.hour ? formatHourLabel(intent.hour) : null,
            faixa_horaria_consultada: intent.hourRange ? formatHourRangeLabel(intent.hourRange) : null,
            datas_consultadas: periodDates.map(formatDate),
            dias_com_dados: dailyStats.map(day => day.dateLabel),
            ...(intent.hour ? {} : { amostras: allValues.length }),
        };

        if (!allValues.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: buildNoDataMessage(metric, environment, periodDates, intent),
            };
        }

        if (intent.operation === "horario_maior_valor" || intent.operation === "horario_menor_valor") {
            return buildHourlyExtremeResult(base, metric, dailyStats, intent);
        }
        if (intent.operation === "calendario_dia_maior_valor" || intent.operation === "calendario_dia_menor_valor") {
            return buildCalendarDayExtremeResult(base, dailyStats, intent);
        }
        if (intent.operation === "heatmap_hora_maior_valor" || intent.operation === "heatmap_hora_menor_valor") {
            return buildHourOfDayExtremeResult(base, dailyStats, intent);
        }
        if (intent.operation === "heatmap_semana_maior_valor" || intent.operation === "heatmap_semana_menor_valor") {
            return buildWeeklySlotExtremeResult(base, dailyStats, intent);
        }
        if (intent.operation === "ultima_medicao") {
            return montarResultadoUltimaMedicao(base, dailyStats);
        }
        if (intent.operation === "comparar_dias") {
            return montarResultadoComparacaoDias(base, dailyStats);
        }

        const overallStats = calculateStats(allValues);
        if (intent.hour) {
            return {
                ...base,
                tipo_resultado: "consulta_horaria",
                valor: round(overallStats.avg),
            };
        }

        const dailySummaries = dailyStats.map(day => ({
            data: day.dateLabel,
            media: round(day.stats.avg),
            minima: round(day.stats.min),
            maxima: round(day.stats.max),
            delta: round(day.stats.delta),
            amostras: day.values.length,
        }));

        return {
            ...base,
            media: round(overallStats.avg),
            minima: round(overallStats.min),
            maxima: round(overallStats.max),
            delta: round(overallStats.delta),
            tendencia: trendFromDelta(overallStats.delta),
            dia_mais_frio: pickDay(dailySummaries, "media", "min"),
            dia_mais_quente: pickDay(dailySummaries, "media", "max"),
            menor_registro: pickDay(dailySummaries, "minima", "min"),
            maior_registro: pickDay(dailySummaries, "maxima", "max"),
            comparacao: buildComparison(dailySummaries),
            por_dia: dailySummaries,
        };
    }

    function buildDailyStats(dayData, metric, date, hour, hourRange) {
        const records = extractMetricRecords(dayData, metric.key, hour, date, hourRange);
        const values = records.map(record => record.value);
        if (!values.length) return null;

        return {
            date,
            dateLabel: formatDate(date),
            values,
            records,
            stats: calculateStats(values),
        };
    }

    function extractMetricValues(dayData, key, hour) {
        return extractMetricRecords(dayData, key, hour).map(record => record.value);
    }

    function extractMetricRecords(dayData, key, hour, date = null, hourRange = null) {
        const values = [];
        for (const time of Object.keys(dayData || {}).sort()) {
            const normalizedTimeHour = normalizeHourFilter(time);
            if (hour && normalizedTimeHour !== hour) continue;
            if (hourRange && !isHourInRange(normalizedTimeHour, hourRange)) continue;

            const timeData = dayData[time];
            if (!timeData || typeof timeData !== "object") continue;

            for (const itemKey of Object.keys(timeData).sort()) {
                const item = timeData[itemKey];
                if (!item || typeof item !== "object") continue;

                const value = window.ClimateData.normalizeMeasurementValue(key, item[key]);
                if (value !== null) {
                    values.push({
                        value,
                        time: formatFirebaseTime(time),
                        date,
                    });
                }
            }
        }
        return values;
    }

    function montarResultadoUltimaMedicao(base, dailyStats) {
        const registros = dailyStats.flatMap(dia => (
            dia.records.map(registro => ({
                ...registro,
                date: dia.date,
                dateLabel: dia.dateLabel,
            }))
        ));
        const registroMaisRecente = selecionarRegistroMaisRecente(registros);

        if (!registroMaisRecente) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ${base.metrica} em ${base.ambiente} para ${base.periodo}.`,
            };
        }

        const { amostras, ...baseSemAmostras } = base;
        return {
            ...baseSemAmostras,
            tipo_resultado: "consulta_horaria",
            operacao: "ultima_medicao",
            valor: round(registroMaisRecente.value),
            hora_consultada: registroMaisRecente.time,
            datas_consultadas: [registroMaisRecente.dateLabel],
            periodo: registroMaisRecente.dateLabel,
        };
    }

    function selecionarRegistroMaisRecente(registros) {
        return [...registros].sort((a, b) => {
            const dateDiff = window.ClimateData.parseFirebaseDate(b.date) - window.ClimateData.parseFirebaseDate(a.date);
            if (dateDiff !== 0) return dateDiff;
            return converterHoraEmMinutos(b.time) - converterHoraEmMinutos(a.time);
        })[0] || null;
    }

    function converterHoraEmMinutos(hora) {
        const [horas, minutos] = String(hora || "00:00").split(":").map(Number);
        return (Number.isFinite(horas) ? horas : 0) * 60 + (Number.isFinite(minutos) ? minutos : 0);
    }

    function montarResultadoComparacaoDias(base, dailyStats) {
        const resumos = dailyStats.map(dia => ({
            data: dia.dateLabel,
            media: round(dia.stats.avg),
            minima: round(dia.stats.min),
            maxima: round(dia.stats.max),
            delta: round(dia.stats.delta),
        }));

        if (resumos.length < 2) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Preciso de pelo menos dois dias com dados de ${base.metrica} em ${base.ambiente} para comparar.`,
            };
        }

        const ordenados = [...resumos].sort((a, b) => b.media - a.media);
        const vencedor = ordenados[0];
        const referencia = ordenados[1];

        return {
            ...base,
            tipo_resultado: "comparacao_dias",
            criterio: "maior_media_diaria",
            vencedor,
            comparado_com: referencia,
            diferenca: round(vencedor.media - referencia.media),
            por_dia: ordenados,
        };
    }

    function buildHourlyExtremeResult(base, metric, dailyStats, intent) {
        const records = dailyStats.flatMap(day => (
            day.records.map(record => ({ ...record, date: day.date, dateLabel: day.dateLabel }))
        ));
        const grouped = groupRecordsByTimeSlot(records);
        const mode = intent.operation === "horario_menor_valor" ? "min" : "max";
        const best = pickHourlySlot(grouped, mode);

        if (!best) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ${base.metrica} em ${base.ambiente} para ${base.periodo}.`,
            };
        }

        return {
            ...base,
            tipo_resultado: "analise_horaria",
            criterio: mode === "max" ? "maior_media_horaria" : "menor_media_horaria",
            horario: best.time,
            data: best.dateLabel,
            valor: round(best.average),
            minima_no_horario: round(best.stats.min),
            maxima_no_horario: round(best.stats.max),
            registros_no_horario: best.values.length,
            por_horario: grouped.map(slot => ({
                data: slot.dateLabel,
                horario: slot.time,
                media: round(slot.average),
                minima: round(slot.stats.min),
                maxima: round(slot.stats.max),
            })).sort((a, b) => (
                mode === "max" ? b.media - a.media : a.media - b.media
            )).slice(0, 6),
        };
    }

    function buildCalendarDayExtremeResult(base, dailyStats, intent) {
        const mode = intent.operation === "calendario_dia_menor_valor" ? "min" : "max";
        const days = dailyStats.map(day => ({
            data: day.dateLabel,
            valor: day.stats.avg,
            minima: day.stats.min,
            maxima: day.stats.max,
            amostras: day.values.length,
        }));
        const best = pickSlot(days, "valor", mode);

        if (!best) return buildNoDataAnalyticResult(base, "calendário mensal");

        return {
            ...base,
            tipo_resultado: "analise_calendario_mensal",
            criterio: mode === "max" ? "maior_media_diaria" : "menor_media_diaria",
            data: best.data,
            valor: round(best.valor),
            minima_no_dia: round(best.minima),
            maxima_no_dia: round(best.maxima),
            ranking: days
                .map(day => ({ ...day, valor: round(day.valor), minima: round(day.minima), maxima: round(day.maxima) }))
                .sort((a, b) => mode === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function buildHourOfDayExtremeResult(base, dailyStats, intent) {
        const mode = intent.operation === "heatmap_hora_menor_valor" ? "min" : "max";
        const grouped = groupRecordsByHourOfDay(dailyStats);
        const best = pickSlot(grouped, "valor", mode);

        if (!best) return buildNoDataAnalyticResult(base, "heatmap por hora");

        return {
            ...base,
            tipo_resultado: "analise_heatmap_horario",
            criterio: mode === "max" ? "maior_media_por_hora" : "menor_media_por_hora",
            horario: best.horario,
            valor: round(best.valor),
            minima_no_horario: round(best.minima),
            maxima_no_horario: round(best.maxima),
            dias_com_dados_no_horario: best.diasComDados,
            ranking: grouped
                .map(slot => ({ ...slot, valor: round(slot.valor), minima: round(slot.minima), maxima: round(slot.maxima) }))
                .sort((a, b) => mode === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function buildWeeklySlotExtremeResult(base, dailyStats, intent) {
        const mode = intent.operation === "heatmap_semana_menor_valor" ? "min" : "max";
        const grouped = groupRecordsByWeekdayHour(dailyStats);
        const best = pickSlot(grouped, "valor", mode);

        if (!best) return buildNoDataAnalyticResult(base, "mapa semanal");

        return {
            ...base,
            tipo_resultado: "analise_heatmap_semanal",
            criterio: mode === "max" ? "maior_media_dia_hora" : "menor_media_dia_hora",
            dia_semana: best.diaSemana,
            horario: best.horario,
            valor: round(best.valor),
            minima_no_periodo: round(best.minima),
            maxima_no_periodo: round(best.maxima),
            datas: best.datas,
            ranking: grouped
                .map(slot => ({ ...slot, valor: round(slot.valor), minima: round(slot.minima), maxima: round(slot.maxima) }))
                .sort((a, b) => mode === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function groupRecordsByTimeSlot(records) {
        const groups = new Map();

        for (const record of records) {
            const key = `${record.dateLabel || formatDate(record.date)}|${record.time}`;
            if (!groups.has(key)) {
                groups.set(key, {
                    date: record.date,
                    dateLabel: record.dateLabel || formatDate(record.date),
                    time: record.time,
                    values: [],
                });
            }
            groups.get(key).values.push(record.value);
        }

        return [...groups.values()].map(group => ({
            ...group,
            stats: calculateStats(group.values),
            average: calculateStats(group.values).avg,
        }));
    }

    function pickHourlySlot(groupedSlots, mode) {
        if (!groupedSlots.length) return null;
        const sorted = [...groupedSlots].sort((a, b) => (
            mode === "max" ? b.average - a.average : a.average - b.average
        ));
        return sorted[0];
    }

    function groupRecordsByHourOfDay(dailyStats) {
        const groups = new Map();

        for (const day of dailyStats) {
            for (const record of day.records) {
                const hour = String(record.time || "").slice(0, 2);
                if (!groups.has(hour)) groups.set(hour, { hour, values: [], dates: new Set() });
                const group = groups.get(hour);
                group.values.push(record.value);
                group.dates.add(day.dateLabel);
            }
        }

        return [...groups.values()].map(group => {
            const stats = calculateStats(group.values);
            return {
                horario: `${group.hour}:00`,
                valor: stats.avg,
                minima: stats.min,
                maxima: stats.max,
                diasComDados: group.dates.size,
            };
        });
    }

    function groupRecordsByWeekdayHour(dailyStats) {
        const weekLabels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const groups = new Map();

        for (const day of dailyStats) {
            const date = window.ClimateData.parseFirebaseDate(day.date);
            const weekday = date.getDay();
            for (const record of day.records) {
                const hour = String(record.time || "").slice(0, 2);
                const key = `${weekday}-${hour}`;
                if (!groups.has(key)) {
                    groups.set(key, {
                        weekday,
                        hour,
                        values: [],
                        dates: new Set(),
                    });
                }
                const group = groups.get(key);
                group.values.push(record.value);
                group.dates.add(day.dateLabel);
            }
        }

        return [...groups.values()].map(group => {
            const stats = calculateStats(group.values);
            return {
                diaSemana: weekLabels[group.weekday],
                horario: `${group.hour}:00`,
                valor: stats.avg,
                minima: stats.min,
                maxima: stats.max,
                datas: [...group.dates],
            };
        });
    }

    function pickSlot(slots, field, mode) {
        if (!slots.length) return null;
        return [...slots].sort((a, b) => mode === "max" ? b[field] - a[field] : a[field] - b[field])[0];
    }

    function buildNoDataAnalyticResult(base, label) {
        return {
            ...base,
            sem_dados: true,
            mensagem: `Sem dados de ${base.metrica} em ${base.ambiente} para análise de ${label} no período ${base.periodo}.`,
        };
    }

    function isHourInRange(hour, hourRange) {
        const current = Number(hour);
        const start = Number(hourRange?.start);
        const end = Number(hourRange?.end);
        if (![current, start, end].every(Number.isFinite)) return true;
        if (start <= end) return current >= start && current <= end;
        return current >= start || current <= end;
    }

    function buildComfortBandResult(environment, metric, dailyStats, periodDates, intent) {
        const band = getComfortBandForMetric(environment, metric);
        const base = {
            ambiente: environment.label,
            metrica: metric.label,
            unidade: metric.unit,
            operacao: intent.operation,
            criterio: "faixa_de_conforto",
            periodo: intent.periodLabel || formatPeriodLabel(periodDates),
            hora_consultada: intent.hour ? formatHourLabel(intent.hour) : null,
            datas_consultadas: periodDates.map(formatDate),
            dias_com_dados: dailyStats.map(day => day.dateLabel),
        };

        if (!band) {
            return {
                ...base,
                sem_faixa: true,
                mensagem: `Não há faixa de conforto configurada para ${metric.label} em ${environment.label}.`,
            };
        }

        const records = dailyStats.flatMap(day => (
            day.records.map(record => ({ ...record, date: day.date, dateLabel: day.dateLabel }))
        ));

        if (!records.length) {
            return {
                ...base,
                sem_dados: true,
                faixa: formatBand(band, metric.unit),
                mensagem: buildNoDataMessage(metric, environment, periodDates, intent),
            };
        }

        const outside = records.filter(record => isOutsideBand(record.value, band));
        const inside = records.filter(record => !isOutsideBand(record.value, band));
        const worst = outside
            .map(record => ({ ...record, distance: distanceFromBand(record.value, band) }))
            .sort((a, b) => b.distance - a.distance)[0] || null;
        const hoursOutside = uniqueSlots(outside);

        return {
            ...base,
            tipo_resultado: "faixa_conforto",
            faixa: formatBand(band, metric.unit),
            limite_minimo: band.min,
            limite_maximo: band.max,
            status: outside.length ? "fora_da_faixa" : "dentro_da_faixa",
            total_registros: records.length,
            registros_dentro: inside.length,
            registros_fora: outside.length,
            percentual_dentro: round((inside.length / records.length) * 100),
            horas_fora: hoursOutside.length,
            horarios_fora: hoursOutside.slice(0, 12),
            pior_horario_fora: worst ? {
                data: worst.dateLabel,
                horario: worst.time,
                valor: round(worst.value),
                distancia: round(worst.distance),
                direcao: worst.value < band.min ? "abaixo" : "acima",
            } : null,
        };
    }

    function getComfortBandForMetric(environment, metric) {
        if (!window.AppConfig) return null;
        if (metric.key === "humidity" || metric.key === "Umidade" || metric.key === "umidade") {
            return window.AppConfig.humidityComfortBand;
        }
        if (metric.key === "temperature" || metric.key === "feelsLike" || metric.key === "Temperatura" || metric.key === "Sensacao termica" || metric.key === "temperatura" || metric.key === "sensacaoTermica") {
            return window.AppConfig.comfortBand;
        }
        if (environment.dataKey === "aquarium" && metric.key === "temperaturaDS18B20") {
            return window.AppConfig.aquariumComfortBand;
        }
        return null;
    }

    function isOutsideBand(value, band) {
        return value < band.min || value > band.max;
    }

    function distanceFromBand(value, band) {
        if (value < band.min) return band.min - value;
        if (value > band.max) return value - band.max;
        return 0;
    }

    function formatBand(band, unit) {
        return `${round(band.min)}${unit} a ${round(band.max)}${unit}`;
    }

    function buildNoDataMessage(metric, environment, periodDates, intent) {
        const period = intent.periodLabel || formatPeriodLabel(periodDates);
        if (intent.hour) {
            return `Sem dados de ${metric.label} em ${environment.label} para ${period} às ${formatHourLabel(intent.hour)}.`;
        }
        if (intent.hourRange) {
            return `Sem dados de ${metric.label} em ${environment.label} para ${period} entre ${formatHourRangeLabel(intent.hourRange)}.`;
        }
        return `Sem dados de ${metric.label} em ${environment.label} para ${period}.`;
    }

    function uniqueSlots(records) {
        const seen = new Set();
        return records
            .map(record => `${record.dateLabel || formatDate(record.date)} ${record.time}`)
            .filter(slot => {
                if (seen.has(slot)) return false;
                seen.add(slot);
                return true;
            });
    }

    function formatFirebaseTime(time) {
        const [hour, minute = "0"] = String(time || "").split("-");
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    function resolveMetricsForEnvironments(environments, requestedMetrics, question) {
        const normalizedQuestion = normalizeText(question);
        const requested = requestedMetrics.length ? requestedMetrics : inferMetricsFromQuestion(normalizedQuestion);
        const metrics = [];

        for (const environment of environments) {
            for (const metric of environment.metrics.map(toMetricObject)) {
                if (!requested.length || requested.some(value => metricMatches(metric, value))) {
                    metrics.push(metric);
                }
            }
        }

        return uniqueMetrics(metrics.length ? metrics : environments.map(getDefaultMetric));
    }

    function inferMetricsFromQuestion(normalizedQuestion) {
        if (hasAirQualityIntent(normalizedQuestion)) return ["qualidade_ar"];
        if (normalizedQuestion.includes("temperatura") || normalizedQuestion.includes("temp")) return ["temperatura"];
        if (normalizedQuestion.includes("sensacao") || normalizedQuestion.includes("termica")) return ["sensacao_termica"];
        if (normalizedQuestion.includes("fri") || normalizedQuestion.includes("quent") || normalizedQuestion.includes("calor")) return ["temperatura"];
        if (hasSolarIntent(normalizedQuestion)) return ["ciclo_solar"];
        if (normalizedQuestion.includes("umid") || normalizedQuestion.includes("humid")) return ["umidade"];
        if (normalizedQuestion.includes("press")) return ["pressao"];
        if (hasWord(normalizedQuestion, "co2")) return ["co2"];
        if (hasWord(normalizedQuestion, "co")) return ["co"];
        if (normalizedQuestion.includes("acetona") || normalizedQuestion.includes("aceton")) return ["acetona"];
        if (normalizedQuestion.includes("alcool") || normalizedQuestion.includes("alcohol")) return ["alcool"];
        if (normalizedQuestion.includes("amonia") || normalizedQuestion.includes("nh4")) return ["amonia"];
        if (normalizedQuestion.includes("toluen")) return ["tolueno"];
        if (normalizedQuestion.includes("ph")) return ["ph"];
        if (normalizedQuestion.includes("tds")) return ["tds"];
        if (normalizedQuestion.includes("turb")) return ["turbidez"];
        return [];
    }

    function hasAirQualityIntent(normalizedQuestion) {
        return ["aqi", "iaq", "qualidade do ar", "qualidade ar", "indice de qualidade do ar", "indice do ar", "ar da sala"]
            .some(term => normalizedQuestion.includes(term));
    }

    function hasSolarIntent(normalizedQuestion) {
        return ["solar", "sol", "nascer", "por do sol", "pôr do sol", "zenite", "zênite", "amanhecer", "anoitecer", "duracao do dia", "duração do dia", "duracao de luz", "duração de luz", "tempo de luz", "luz solar", "periodo de luz", "fotoperiodo", "dia mais longo", "dia mais curto", "dia com mais tempo de luz", "dia com menos tempo de luz"]
            .some(term => normalizedQuestion.includes(normalizeText(term)));
    }

    function metricMatches(metric, requestedMetric) {
        const requested = normalizeText(requestedMetric).replace(/_/g, " ");
        const aliases = [
            metric.label,
            metric.key,
            normalizeText(metric.key).replace(/([a-z])([A-Z])/g, "$1 $2"),
            ...(METRIC_ALIASES[metric.key] || []),
        ].map(value => normalizeText(value).replace(/_/g, " "));

        if (requested === "ciclo solar" && metric.key === "cicloSolar") return true;
        if (aliases.some(alias => alias === requested)) return true;

        return aliases.some(alias => (
            alias.length > 3
            && requested.length > 3
            && (alias.includes(requested) || requested.includes(alias))
        ));
    }

    function toMetricObject(metric) {
        return {
            label: metric[0],
            key: metric[1],
            unit: metric[2],
        };
    }

    function getDefaultMetric(environment) {
        return toMetricObject(environment.metrics[0]);
    }

    function uniqueMetrics(metrics) {
        const seen = new Set();
        return metrics.filter(metric => {
            const key = metric.key;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function calculateStats(values) {
        const first = values[0];
        const last = values[values.length - 1];
        return {
            avg: values.reduce((sum, value) => sum + value, 0) / values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            delta: last - first,
        };
    }

    function defaultCriterionForOperation(operation) {
        if (operation === "dia_mais_frio" || operation === "dia_mais_quente" || operation === "comparar_dias") return "media_diaria";
        if (operation === "maxima") return "maxima_registrada";
        if (operation === "minima") return "minima_registrada";
        return "valores_registrados";
    }

    function pickDay(dailySummaries, field, mode) {
        if (!dailySummaries.length) return null;
        const sorted = [...dailySummaries].sort((a, b) => mode === "min" ? a[field] - b[field] : b[field] - a[field]);
        return {
            data: sorted[0].data,
            valor: sorted[0][field],
            amostras: sorted[0].amostras,
        };
    }

    function buildComparison(dailySummaries) {
        if (dailySummaries.length < 2) return null;
        const byAverage = [...dailySummaries].sort((a, b) => b.media - a.media);
        const todayLabel = formatDate(window.ClimateData.dataAtual());
        const today = dailySummaries.find(day => day.data === todayLabel);

        return {
            mais_quente_por_media: {
                data: byAverage[0].data,
                media: byAverage[0].media,
            },
            mais_frio_por_media: {
                data: byAverage[byAverage.length - 1].data,
                media: byAverage[byAverage.length - 1].media,
            },
            hoje: today || null,
            dias_mais_quentes_que_hoje: today ? dailySummaries.filter(day => day.media > today.media).map(day => ({
                data: day.data,
                media: day.media,
                diferenca: round(day.media - today.media),
            })) : [],
        };
    }

    function trendFromDelta(delta) {
        if (Math.abs(delta) < 0.05) return "estável";
        return delta > 0 ? "subindo" : "caindo";
    }

    function round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    }

    namespace.metrics = {
        buildMetricResult,
        buildDailyStats,
        resolveMetricsForEnvironments,
        inferMetricsFromQuestion,
        hasAirQualityIntent,
        hasSolarIntent,
        metricMatches,
        toMetricObject,
        getDefaultMetric,
        calculateStats,
        buildComfortBandResult,
        trendFromDelta,
        round,
    };

    window.ClimateAssistant = namespace;
})();
