'use strict';

(function () {
    const namespace = window.ClimateAssistant || {};
    const { formatDate: formatarData, formatPeriodLabel: formatarRotuloPeriodo } = namespace.format;

    function montarResultadoCicloSolar(ambiente, contexto, datasPeriodo, intencao) {
        const origemSolar =
            contexto.latestData?.solar ||
            contexto.latestData?.historico?.NascerPorDoSol ||
            contexto.historico?.NascerPorDoSol ||
            contexto.latestData?.NascerPorDoSol ||
            {};

        const dadosSolaresDiarios = datasPeriodo
            .map(data => montarCicloSolarDiarioPorEventos(origemSolar, data))
            .filter(Boolean);

        const base = {
            ambiente: ambiente.label,
            metrica: "Ciclo solar",
            unidade: "",
            operacao: intencao.operation,
            criterio: "dados_solares_registrados",
            periodo: intencao.periodLabel || formatarRotuloPeriodo(datasPeriodo),
            datas_consultadas: datasPeriodo.map(formatarData),
            dias_com_dados: dadosSolaresDiarios.map(dia => dia.data),
            amostras: dadosSolaresDiarios.length,
        };

        if (!dadosSolaresDiarios.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ciclo solar para ${formatarRotuloPeriodo(datasPeriodo)}.`,
            };
        }

        const resultadoAnalitico = montarResultadoAnaliticoSolar(base, dadosSolaresDiarios, intencao);
        if (resultadoAnalitico) return resultadoAnalitico;

        return {
            ...base,
            tipo_resultado: "ciclo_solar",
            por_dia: dadosSolaresDiarios,
        };
    }

    function montarResultadoAnaliticoSolar(base, dadosSolaresDiarios, intencao) {
        if (intencao.operation === "solar_duracao_dia") {
            const dia = dadosSolaresDiarios[0];
            return {
                ...base,
                tipo_resultado: "solar_duracao_dia",
                data: dia.data,
                duracao_dia: dia.duracao_dia,
                duracao_minutos: dia.duracao_minutos,
                nascer_do_sol: dia.nascer_do_sol,
                por_do_sol: dia.por_do_sol,
            };
        }

        if (intencao.operation === "solar_maior_duracao_luz" || intencao.operation === "solar_menor_duracao_luz") {
            const modo = intencao.operation === "solar_menor_duracao_luz" ? "min" : "max";
            const ranking = dadosSolaresDiarios
                .filter(dia => Number.isFinite(dia.duracao_minutos))
                .sort((a, b) => modo === "max" ? b.duracao_minutos - a.duracao_minutos : a.duracao_minutos - b.duracao_minutos);
            const melhor = ranking[0];
            if (!melhor) return null;

            return {
                ...base,
                tipo_resultado: "solar_extremo_duracao_luz",
                criterio: modo === "max" ? "maior_duracao_luz" : "menor_duracao_luz",
                data: melhor.data,
                duracao_dia: melhor.duracao_dia,
                duracao_minutos: melhor.duracao_minutos,
                nascer_do_sol: melhor.nascer_do_sol,
                por_do_sol: melhor.por_do_sol,
                ranking: ranking.slice(0, 6).map(dia => ({
                    data: dia.data,
                    duracao_dia: dia.duracao_dia,
                    nascer_do_sol: dia.nascer_do_sol,
                    por_do_sol: dia.por_do_sol,
                })),
            };
        }

        if (intencao.operation === "solar_tendencia_nascer" || intencao.operation === "solar_tendencia_por") {
            const chaveEvento = intencao.operation === "solar_tendencia_nascer" ? "nascer" : "por";
            return montarResultadoTendenciaSolar(base, dadosSolaresDiarios, chaveEvento);
        }

        if (intencao.operation === "solar_comparar_nascer" || intencao.operation === "solar_comparar_por") {
            const chaveEvento = intencao.operation === "solar_comparar_nascer" ? "nascer" : "por";
            return montarResultadoComparacaoSolar(base, dadosSolaresDiarios, chaveEvento);
        }

        return null;
    }

    function montarResultadoTendenciaSolar(base, dadosSolaresDiarios, chaveEvento) {
        const campo = chaveEvento === "nascer" ? "nascer_minutos" : "por_minutos";
        const rotulo = chaveEvento === "nascer" ? "nascer do sol" : "pôr do sol";
        const serie = dadosSolaresDiarios
            .filter(dia => Number.isFinite(dia[campo]))
            .map(dia => ({
                data: dia.data,
                horario: chaveEvento === "nascer" ? dia.nascer_do_sol : dia.por_do_sol,
                minutos: dia[campo],
            }));

        if (!serie.length) return null;

        const primeiro = serie[0];
        const ultimo = serie[serie.length - 1];
        const delta = ultimo.minutos - primeiro.minutos;

        return {
            ...base,
            tipo_resultado: "solar_tendencia_evento",
            evento: rotulo,
            tendencia: tendenciaPorDeltaMinutos(delta),
            delta_minutos: delta,
            primeiro,
            ultimo,
            por_dia: serie,
        };
    }

    function montarResultadoComparacaoSolar(base, dadosSolaresDiarios, chaveEvento) {
        const campo = chaveEvento === "nascer" ? "nascer_minutos" : "por_minutos";
        const rotulo = chaveEvento === "nascer" ? "nascer do sol" : "pôr do sol";
        const serie = dadosSolaresDiarios
            .filter(dia => Number.isFinite(dia[campo]))
            .map(dia => ({
                data: dia.data,
                horario: chaveEvento === "nascer" ? dia.nascer_do_sol : dia.por_do_sol,
                diferenca_minutos: null,
            }));

        if (!serie.length) return null;

        const minutosIniciais = dadosSolaresDiarios.find(dia => Number.isFinite(dia[campo]))?.[campo];
        serie.forEach(item => {
            const dia = dadosSolaresDiarios.find(candidato => candidato.data === item.data);
            item.diferenca_minutos = Number.isFinite(dia?.[campo]) && Number.isFinite(minutosIniciais)
                ? dia[campo] - minutosIniciais
                : null;
        });

        return {
            ...base,
            tipo_resultado: "solar_comparacao_evento",
            evento: rotulo,
            por_dia: serie,
        };
    }

    function montarCicloSolarDiarioPorEventos(origemSolar, data) {
        const eventos = window.ClimateSolar?.getSolarEventsForSelectedDate?.(origemSolar, data);
        if (!eventos) return null;

        const amanhecer = window.ClimateData.formatTime(eventos.dawn);
        const nascerDoSol = window.ClimateData.formatTime(eventos.sunrise);
        const zenite = window.ClimateData.formatTime(eventos.zenith);
        const porDoSol = window.ClimateData.formatTime(eventos.sunset);
        const anoitecer = window.ClimateData.formatTime(eventos.dusk);

        return {
            data: formatarData(data),
            amanhecer,
            nascer_do_sol: nascerDoSol,
            zenite,
            por_do_sol: porDoSol,
            anoitecer,
            nascer_minutos: converterHoraParaMinutos(nascerDoSol),
            por_minutos: converterHoraParaMinutos(porDoSol),
            duracao_dia: calcularRotuloDuracao(nascerDoSol, porDoSol),
            duracao_minutos: calcularDuracaoMinutos(nascerDoSol, porDoSol),
            periodo_luz_total: calcularRotuloDuracao(amanhecer, anoitecer),
            periodo_luz_total_minutos: calcularDuracaoMinutos(amanhecer, anoitecer),
        };
    }

    function calcularRotuloDuracao(inicio, fim) {
        const diferenca = calcularDuracaoMinutos(inicio, fim);
        if (diferenca === null) return null;

        const horas = Math.floor(diferenca / 60);
        const minutos = diferenca % 60;
        return minutos === 0 ? `${horas}h` : `${horas}h${String(minutos).padStart(2, "0")}`;
    }

    function calcularDuracaoMinutos(inicio, fim) {
        const minutosInicio = converterHoraParaMinutos(inicio);
        const minutosFim = converterHoraParaMinutos(fim);
        if (minutosInicio === null || minutosFim === null) return null;

        let diferenca = minutosFim - minutosInicio;
        if (diferenca < 0) diferenca += 24 * 60;
        return diferenca;
    }

    function tendenciaPorDeltaMinutos(delta) {
        if (!Number.isFinite(delta) || Math.abs(delta) < 1) return "estavel";
        return delta > 0 ? "mais_tarde" : "mais_cedo";
    }

    function converterHoraParaMinutos(valor) {
        if (!valor) return null;

        const partes = String(valor).match(/^(\d{2}):(\d{2})$/);
        if (!partes) return null;

        const hora = Number(partes[1]);
        const minuto = Number(partes[2]);
        if (!Number.isFinite(hora) || !Number.isFinite(minuto)) return null;
        if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

        return hora * 60 + minuto;
    }

    namespace.solar = { buildSolarCycleResult: montarResultadoCicloSolar };
    window.ClimateAssistant = namespace;
})();
