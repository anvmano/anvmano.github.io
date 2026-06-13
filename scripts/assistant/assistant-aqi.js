'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const {
        normalizeHourFilter: normalizarFiltroHora,
        formatDate: formatarData,
        formatPeriodLabel: formatarRotuloPeriodo,
        formatHourLabel: formatarRotuloHora,
        formatNumber: formatarNumero,
        formatTimestampLabel: formatarRotuloTimestamp,
    } = namespace.format;

    function montarResultadoQualidadeAr(ambiente, metrica, datasPeriodo, intencao, dados) {
        const aqiDiario = datasPeriodo
            .map(data => montarQualidadeArDiaria(dados?.[data], data, intencao.hour))
            .filter(Boolean);
        const base = {
            ambiente: ambiente.label,
            metrica: metrica.label,
            unidade: metrica.unit,
            operacao: intencao.operation,
            criterio: "aqi_estimado_mq135",
            periodo: intencao.periodLabel || formatarRotuloPeriodo(datasPeriodo),
            hora_consultada: intencao.hour ? formatarRotuloHora(intencao.hour) : null,
            datas_consultadas: datasPeriodo.map(formatarData),
            dias_com_dados: aqiDiario.map(dia => dia.data),
        };

        if (!aqiDiario.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: intencao.hour
                    ? `Sem dados de AQI estimado em ${ambiente.label} para ${intencao.periodLabel || formatarRotuloPeriodo(datasPeriodo)} às ${formatarRotuloHora(intencao.hour)}.`
                    : `Sem dados de AQI estimado em ${ambiente.label} para ${intencao.periodLabel || formatarRotuloPeriodo(datasPeriodo)}.`,
            };
        }

        if (intencao.hour) {
            const primeiroDia = aqiDiario[0];
            return {
                ...base,
                tipo_resultado: "consulta_horaria",
                valor: primeiroDia.aqi,
                classificacao: primeiroDia.classificacao,
                impacto: primeiroDia.impacto,
                dominante: primeiroDia.dominante,
                subindices: primeiroDia.subindices,
            };
        }

        const valores = aqiDiario.map(dia => dia.aqi);
        const estatisticas = namespace.metrics.calculateStats(valores);
        const maisRecente = aqiDiario[aqiDiario.length - 1];

        return {
            ...base,
            tipo_resultado: "qualidade_ar",
            media: Math.round(estatisticas.avg),
            minima: Math.round(estatisticas.min),
            maxima: Math.round(estatisticas.max),
            delta: Math.round(estatisticas.delta),
            tendencia: namespace.metrics.trendFromDelta(estatisticas.delta),
            classificacao_atual: maisRecente.classificacao,
            impacto_atual: maisRecente.impacto,
            dominante_atual: maisRecente.dominante,
            atualizado_em: maisRecente.horario,
            por_dia: aqiDiario,
        };
    }

    function montarQualidadeArDiaria(dadosDia, data, hora) {
        if (!window.ClimateAqi?.calculate) return null;

        const dadosFiltrados = filtrarDadosDiaPorHora(dadosDia, hora);
        if (!Object.keys(dadosFiltrados).length) return null;

        const resultado = window.ClimateAqi.calculate({ [data]: dadosFiltrados });
        if (!resultado) return null;

        return {
            data: formatarData(data),
            aqi: resultado.aqi,
            classificacao: resultado.category.label,
            impacto: resultado.category.impact,
            dominante: `${resultado.dominant.label} (${formatarConcentracaoAqi(resultado.dominant)})`,
            horario: formatarRotuloTimestamp(resultado.timestamp),
            subindices: resultado.subIndexes.slice(0, 6).map(item => ({
                indicador: item.label,
                valor: formatarConcentracaoAqi(item),
                aqi: Math.round(item.aqi),
            })),
        };
    }

    function filtrarDadosDiaPorHora(dadosDia, hora) {
        const dadosFiltrados = {};
        for (const horario of Object.keys(dadosDia || {}).sort()) {
            const horaNormalizada = normalizarFiltroHora(horario);
            if (hora && horaNormalizada !== hora) continue;
            dadosFiltrados[horario] = dadosDia[horario];
        }
        return dadosFiltrados;
    }

    function formatarConcentracaoAqi(item) {
        return `${formatarNumero(Number(item.value))}${item.unit}`;
    }

    namespace.aqi = { buildAirQualityResult: montarResultadoQualidadeAr };
    window.ClimateAssistant = namespace;
})();
