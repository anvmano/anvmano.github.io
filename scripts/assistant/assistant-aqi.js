'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const {
        normalizeHourFilter,
        formatDate,
        formatPeriodLabel,
        formatHourLabel,
        formatNumber,
        formatTimestampLabel,
    } = namespace.format;

    function buildAirQualityResult(environment, metric, periodDates, intent, data) {
        const dailyAqi = periodDates
            .map(date => buildDailyAirQuality(data?.[date], date, intent.hour))
            .filter(Boolean);
        const base = {
            ambiente: environment.label,
            metrica: metric.label,
            unidade: metric.unit,
            operacao: intent.operation,
            criterio: "aqi_estimado_mq135",
            periodo: intent.periodLabel || formatPeriodLabel(periodDates),
            hora_consultada: intent.hour ? formatHourLabel(intent.hour) : null,
            datas_consultadas: periodDates.map(formatDate),
            dias_com_dados: dailyAqi.map(day => day.data),
        };

        if (!dailyAqi.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: intent.hour
                    ? `Sem dados de AQI estimado em ${environment.label} para ${intent.periodLabel || formatPeriodLabel(periodDates)} às ${formatHourLabel(intent.hour)}.`
                    : `Sem dados de AQI estimado em ${environment.label} para ${intent.periodLabel || formatPeriodLabel(periodDates)}.`,
            };
        }

        if (intent.hour) {
            const firstDay = dailyAqi[0];
            return {
                ...base,
                tipo_resultado: "consulta_horaria",
                valor: firstDay.aqi,
                classificacao: firstDay.classificacao,
                impacto: firstDay.impacto,
                dominante: firstDay.dominante,
                subindices: firstDay.subindices,
            };
        }

        const values = dailyAqi.map(day => day.aqi);
        const stats = namespace.metrics.calculateStats(values);
        const latest = dailyAqi[dailyAqi.length - 1];

        return {
            ...base,
            tipo_resultado: "qualidade_ar",
            media: Math.round(stats.avg),
            minima: Math.round(stats.min),
            maxima: Math.round(stats.max),
            delta: Math.round(stats.delta),
            tendencia: namespace.metrics.trendFromDelta(stats.delta),
            classificacao_atual: latest.classificacao,
            impacto_atual: latest.impacto,
            dominante_atual: latest.dominante,
            atualizado_em: latest.horario,
            por_dia: dailyAqi,
        };
    }

    function buildDailyAirQuality(dayData, date, hour) {
        if (!window.ClimateAqi?.calculate) return null;

        const scopedData = scopeDayDataByHour(dayData, hour);
        if (!Object.keys(scopedData).length) return null;

        const result = window.ClimateAqi.calculate({ [date]: scopedData });
        if (!result) return null;

        return {
            data: formatDate(date),
            aqi: result.aqi,
            classificacao: result.category.label,
            impacto: result.category.impact,
            dominante: `${result.dominant.label} (${formatAqiConcentration(result.dominant)})`,
            horario: formatTimestampLabel(result.timestamp),
            subindices: result.subIndexes.slice(0, 6).map(item => ({
                indicador: item.label,
                valor: formatAqiConcentration(item),
                aqi: Math.round(item.aqi),
            })),
        };
    }

    function scopeDayDataByHour(dayData, hour) {
        const scopedData = {};
        for (const time of Object.keys(dayData || {}).sort()) {
            const normalizedTimeHour = normalizeHourFilter(time);
            if (hour && normalizedTimeHour !== hour) continue;
            scopedData[time] = dayData[time];
        }
        return scopedData;
    }

    function formatAqiConcentration(item) {
        return `${formatNumber(Number(item.value))}${item.unit}`;
    }

    namespace.aqi = { buildAirQualityResult };
    window.ClimateAssistant = namespace;
})();
