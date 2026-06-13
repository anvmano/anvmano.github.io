'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { formatDate, formatPeriodLabel } = namespace.format;

    function buildSolarCycleResult(environment, context, periodDates, intent) {
        const solarSource =
            context.latestData?.solar ||
            context.latestData?.historico?.NascerPorDoSol ||
            context.historico?.NascerPorDoSol ||
            context.latestData?.NascerPorDoSol ||
            {};

        const dailySolarData = periodDates
            .map(date => buildDailySolarCycleFromEvents(solarSource, date))
            .filter(Boolean);

        const base = {
            ambiente: environment.label,
            metrica: "Ciclo solar",
            unidade: "",
            operacao: intent.operation,
            criterio: "dados_solares_registrados",
            periodo: intent.periodLabel || formatPeriodLabel(periodDates),
            datas_consultadas: periodDates.map(formatDate),
            dias_com_dados: dailySolarData.map(day => day.data),
            amostras: dailySolarData.length,
        };

        if (!dailySolarData.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ciclo solar para ${formatPeriodLabel(periodDates)}.`,
            };
        }

        const analyticResult = buildSolarAnalyticResult(base, dailySolarData, intent);
        if (analyticResult) return analyticResult;

        return {
            ...base,
            tipo_resultado: "ciclo_solar",
            por_dia: dailySolarData,
        };
    }

    function buildSolarAnalyticResult(base, dailySolarData, intent) {
        if (intent.operation === "solar_duracao_dia") {
            const day = dailySolarData[0];
            return {
                ...base,
                tipo_resultado: "solar_duracao_dia",
                data: day.data,
                duracao_dia: day.duracao_dia,
                duracao_minutos: day.duracao_minutos,
                nascer_do_sol: day.nascer_do_sol,
                por_do_sol: day.por_do_sol,
            };
        }

        if (intent.operation === "solar_maior_duracao_luz" || intent.operation === "solar_menor_duracao_luz") {
            const mode = intent.operation === "solar_menor_duracao_luz" ? "min" : "max";
            const ranked = dailySolarData
                .filter(day => Number.isFinite(day.duracao_minutos))
                .sort((a, b) => mode === "max" ? b.duracao_minutos - a.duracao_minutos : a.duracao_minutos - b.duracao_minutos);
            const best = ranked[0];
            if (!best) return null;

            return {
                ...base,
                tipo_resultado: "solar_extremo_duracao_luz",
                criterio: mode === "max" ? "maior_duracao_luz" : "menor_duracao_luz",
                data: best.data,
                duracao_dia: best.duracao_dia,
                duracao_minutos: best.duracao_minutos,
                nascer_do_sol: best.nascer_do_sol,
                por_do_sol: best.por_do_sol,
                ranking: ranked.slice(0, 6).map(day => ({
                    data: day.data,
                    duracao_dia: day.duracao_dia,
                    nascer_do_sol: day.nascer_do_sol,
                    por_do_sol: day.por_do_sol,
                })),
            };
        }

        if (intent.operation === "solar_tendencia_nascer" || intent.operation === "solar_tendencia_por") {
            const eventKey = intent.operation === "solar_tendencia_nascer" ? "nascer" : "por";
            return buildSolarTrendResult(base, dailySolarData, eventKey);
        }

        if (intent.operation === "solar_comparar_nascer" || intent.operation === "solar_comparar_por") {
            const eventKey = intent.operation === "solar_comparar_nascer" ? "nascer" : "por";
            return buildSolarComparisonResult(base, dailySolarData, eventKey);
        }

        return null;
    }

    function buildSolarTrendResult(base, dailySolarData, eventKey) {
        const field = eventKey === "nascer" ? "nascer_minutos" : "por_minutos";
        const label = eventKey === "nascer" ? "nascer do sol" : "pôr do sol";
        const series = dailySolarData
            .filter(day => Number.isFinite(day[field]))
            .map(day => ({
                data: day.data,
                horario: eventKey === "nascer" ? day.nascer_do_sol : day.por_do_sol,
                minutos: day[field],
            }));

        if (!series.length) return null;

        const first = series[0];
        const last = series[series.length - 1];
        const delta = last.minutos - first.minutos;

        return {
            ...base,
            tipo_resultado: "solar_tendencia_evento",
            evento: label,
            tendencia: trendFromMinuteDelta(delta),
            delta_minutos: delta,
            primeiro: first,
            ultimo: last,
            por_dia: series,
        };
    }

    function buildSolarComparisonResult(base, dailySolarData, eventKey) {
        const field = eventKey === "nascer" ? "nascer_minutos" : "por_minutos";
        const label = eventKey === "nascer" ? "nascer do sol" : "pôr do sol";
        const series = dailySolarData
            .filter(day => Number.isFinite(day[field]))
            .map(day => ({
                data: day.data,
                horario: eventKey === "nascer" ? day.nascer_do_sol : day.por_do_sol,
                diferenca_minutos: null,
            }));

        if (!series.length) return null;

        const firstMinutes = dailySolarData.find(day => Number.isFinite(day[field]))?.[field];
        series.forEach(item => {
            const day = dailySolarData.find(candidate => candidate.data === item.data);
            item.diferenca_minutos = Number.isFinite(day?.[field]) && Number.isFinite(firstMinutes)
                ? day[field] - firstMinutes
                : null;
        });

        return {
            ...base,
            tipo_resultado: "solar_comparacao_evento",
            evento: label,
            por_dia: series,
        };
    }

    function buildDailySolarCycleFromEvents(solarSource, date) {
        const events = window.ClimateSolar?.getSolarEventsForSelectedDate?.(solarSource, date);
        if (!events) return null;

        const amanhecer = window.ClimateData.formatTime(events.dawn);
        const nascerDoSol = window.ClimateData.formatTime(events.sunrise);
        const zenite = window.ClimateData.formatTime(events.zenith);
        const porDoSol = window.ClimateData.formatTime(events.sunset);
        const anoitecer = window.ClimateData.formatTime(events.dusk);

        return {
            data: formatDate(date),
            amanhecer,
            nascer_do_sol: nascerDoSol,
            zenite,
            por_do_sol: porDoSol,
            anoitecer,
            nascer_minutos: hourToMinutes(nascerDoSol),
            por_minutos: hourToMinutes(porDoSol),
            duracao_dia: calculateDurationLabel(nascerDoSol, porDoSol),
            duracao_minutos: calculateDurationMinutes(nascerDoSol, porDoSol),
            periodo_luz_total: calculateDurationLabel(amanhecer, anoitecer),
            periodo_luz_total_minutos: calculateDurationMinutes(amanhecer, anoitecer),
        };
    }

    function calculateDurationLabel(start, end) {
        const diff = calculateDurationMinutes(start, end);
        if (diff === null) return null;

        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        return minutes === 0 ? `${hours}h` : `${hours}h${String(minutes).padStart(2, "0")}`;
    }

    function calculateDurationMinutes(start, end) {
        const startMinutes = hourToMinutes(start);
        const endMinutes = hourToMinutes(end);
        if (startMinutes === null || endMinutes === null) return null;

        let diff = endMinutes - startMinutes;
        if (diff < 0) diff += 24 * 60;
        return diff;
    }

    function trendFromMinuteDelta(delta) {
        if (!Number.isFinite(delta) || Math.abs(delta) < 1) return "estavel";
        return delta > 0 ? "mais_tarde" : "mais_cedo";
    }

    function hourToMinutes(value) {
        if (!value) return null;

        const match = String(value).match(/^(\d{2}):(\d{2})$/);
        if (!match) return null;

        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

        return hour * 60 + minute;
    }

    namespace.solar = { buildSolarCycleResult };
    window.ClimateAssistant = namespace;
})();
