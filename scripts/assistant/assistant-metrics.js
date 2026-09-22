'use strict';

(function () {
    const espacoNomes = window.ClimateAssistant || {};
    const { METRIC_ALIASES: ALIASES_METRICAS } = espacoNomes.config;
    const {
        normalizeText: normalizarTextoConsulta,
        hasWord: temPalavraConsulta,
        normalizeHourFilter: normalizarFiltroHoraConsulta,
        formatDate: formatarDataConsulta,
        formatPeriodLabel: formatarRotuloPeriodoConsulta,
        formatHourLabel: formatarRotuloHoraGrafico,
        formatHourRangeLabel: formatarRotuloFaixaHoraria,
    } = espacoNomes.format;

    function montarResultadoMetrica(ambiente, metrica, estatisticasDiarias, datasPeriodo, intencao, dados, contexto) {
        if (metrica.key === "cicloSolar") {
            return espacoNomes.solar.buildSolarCycleResult(ambiente, contexto, datasPeriodo, intencao);
        }
        if (metrica.key === "qualidadeAr") {
            return espacoNomes.aqi.buildAirQualityResult(ambiente, metrica, datasPeriodo, intencao, dados);
        }
        if (intencao.operation === "status_faixa") {
            return montarResultadoFaixaConforto(ambiente, metrica, estatisticasDiarias, datasPeriodo, intencao);
        }

        const todosValores = estatisticasDiarias.flatMap(dia => dia.values);
        const qualidadeDados = combinarQualidades(estatisticasDiarias.map(dia => dia.qualidade).filter(Boolean));
        const base = {
            ambiente: ambiente.label,
            metrica: metrica.label,
            unidade: metrica.unit,
            operacao: intencao.operation,
            criterio: intencao.criterion || criterioPadraoOperacao(intencao.operation),
            periodo: intencao.periodLabel || formatarRotuloPeriodoConsulta(datasPeriodo),
            hora_consultada: intencao.hour ? formatarRotuloHoraGrafico(intencao.hour) : null,
            faixa_horaria_consultada: intencao.hourRange ? formatarRotuloFaixaHoraria(intencao.hourRange) : null,
            datas_consultadas: datasPeriodo.map(formatarDataConsulta),
            dias_com_dados: estatisticasDiarias.map(dia => dia.dateLabel),
            ...(intencao.hour ? {} : { amostras: todosValores.length }),
            qualidade_dados: qualidadeDados,
        };

        if (!todosValores.length) {
            return {
                ...base,
                sem_dados: true,
                mensagem: montarMensagemSemDados(metrica, ambiente, datasPeriodo, intencao),
            };
        }

        if (intencao.operation === "horario_maior_valor" || intencao.operation === "horario_menor_valor") {
            return montarResultadoExtremoHorario(base, metrica, estatisticasDiarias, intencao);
        }
        if (intencao.operation === "calendario_dia_maior_valor" || intencao.operation === "calendario_dia_menor_valor") {
            return montarResultadoExtremoDiaCalendario(base, estatisticasDiarias, intencao);
        }
        if (intencao.operation === "heatmap_hora_maior_valor" || intencao.operation === "heatmap_hora_menor_valor") {
            return montarResultadoExtremoHoraDia(base, estatisticasDiarias, intencao);
        }
        if (intencao.operation === "heatmap_semana_maior_valor" || intencao.operation === "heatmap_semana_menor_valor") {
            return montarResultadoExtremoFaixaSemanal(base, estatisticasDiarias, intencao);
        }
        if (intencao.operation === "ultima_medicao") {
            return montarResultadoUltimaMedicao(base, estatisticasDiarias);
        }
        if (intencao.operation === "comparar_dias") {
            return montarResultadoComparacaoDias(base, estatisticasDiarias);
        }

        const estatisticasGerais = calcularEstatisticas(todosValores);
        if (intencao.hour) {
            return {
                ...base,
                tipo_resultado: "consulta_horaria",
                valor: arredondar(estatisticasGerais.avg),
            };
        }

        const resumosDiarios = estatisticasDiarias.map(dia => ({
            data: dia.dateLabel,
            media: arredondar(dia.stats.avg),
            minima: arredondar(dia.stats.min),
            maxima: arredondar(dia.stats.max),
            delta: arredondar(dia.stats.delta),
            qualidade_dados: dia.qualidade,
            amostras: dia.values.length,
        }));

        const resultadoEstatistico = montarResultadoEstatistico(base, estatisticasDiarias, estatisticasGerais, intencao.operation);
        if (resultadoEstatistico) return resultadoEstatistico;

        return {
            ...base,
            media: arredondar(estatisticasGerais.avg),
            minima: arredondar(estatisticasGerais.min),
            maxima: arredondar(estatisticasGerais.max),
            delta: arredondar(estatisticasGerais.delta),
            tendencia: tendenciaDaDiferenca(estatisticasGerais.delta),
            dia_mais_frio: selecionarDia(resumosDiarios, "media", "min"),
            dia_mais_quente: selecionarDia(resumosDiarios, "media", "max"),
            menor_registro: selecionarDia(resumosDiarios, "minima", "min"),
            maior_registro: selecionarDia(resumosDiarios, "maxima", "max"),
            comparacao: montarComparacao(resumosDiarios),
            por_dia: resumosDiarios,
        };
    }

    function montarResultadoEstatistico(base, estatisticasDiarias, estatisticasGerais, operacao) {
        if (!["media", "maxima", "minima", "delta", "tendencia", "resumo", "dia_mais_frio", "dia_mais_quente"].includes(operacao)) return null;

        const baseSemAmostras = { ...base };
        delete baseSemAmostras.amostras;
        if (operacao === "resumo") {
            return {
                ...baseSemAmostras,
                tipo_resultado: "resumo_metrica",
                media: arredondar(estatisticasGerais.avg),
                minima: arredondar(estatisticasGerais.min),
                maxima: arredondar(estatisticasGerais.max),
                delta: arredondar(estatisticasGerais.delta),
                tendencia: tendenciaDaDiferenca(estatisticasGerais.delta),
            };
        }

        if (operacao === "dia_mais_frio" || operacao === "dia_mais_quente") {
            const resumosDiarios = estatisticasDiarias.map(dia => ({
                data: dia.dateLabel,
                valor: dia.stats.avg,
            }));
            const diaSelecionado = [...resumosDiarios].sort((a, b) => (
                operacao === "dia_mais_frio" ? a.valor - b.valor : b.valor - a.valor
            ))[0];
            return {
                ...baseSemAmostras,
                tipo_resultado: "extremo_diario",
                criterio: operacao === "dia_mais_frio" ? "menor_media_diaria" : "maior_media_diaria",
                data: diaSelecionado.data,
                valor: arredondar(diaSelecionado.valor),
            };
        }

        if (operacao === "media") {
            return {
                ...baseSemAmostras,
                tipo_resultado: "estatistica_media",
                valor: arredondar(estatisticasGerais.avg),
            };
        }

        const registros = obterRegistrosOrdenados(estatisticasDiarias);
        if (operacao === "maxima" || operacao === "minima") {
            const registro = [...registros].sort((a, b) => (
                operacao === "maxima" ? b.value - a.value : a.value - b.value
            ))[0];

            return {
                ...baseSemAmostras,
                tipo_resultado: "estatistica_extremo",
                criterio: operacao === "maxima" ? "maior_registro" : "menor_registro",
                valor: arredondar(registro.value),
                data: registro.dateLabel,
                horario: registro.time,
            };
        }

        if (registros.length < 2) {
            return {
                ...baseSemAmostras,
                tipo_resultado: "dados_insuficientes_tendencia",
                mensagem: `Há somente ${registros.length} medição válida; são necessárias pelo menos duas para calcular ${operacao === "tendencia" ? "tendência" : "variação"}.`,
            };
        }

        const primeiro = registros[0];
        const ultimo = registros[registros.length - 1];
        const diferenca = arredondar(ultimo.value - primeiro.value);
        return {
            ...baseSemAmostras,
            tipo_resultado: operacao === "tendencia" ? "tendencia_periodo" : "variacao_periodo",
            valor_inicial: arredondar(primeiro.value),
            valor_final: arredondar(ultimo.value),
            diferenca,
            tendencia: tendenciaDaDiferenca(diferenca),
            inicio: {
                data: primeiro.dateLabel,
                horario: primeiro.time,
            },
            fim: {
                data: ultimo.dateLabel,
                horario: ultimo.time,
            },
        };
    }

    function obterRegistrosOrdenados(estatisticasDiarias) {
        return estatisticasDiarias
            .flatMap(dia => dia.records.map(registro => ({
                ...registro,
                date: dia.date,
                dateLabel: dia.dateLabel,
            })))
            .sort((a, b) => {
                const diferencaData = window.ClimateData.parseFirebaseDate(a.date) - window.ClimateData.parseFirebaseDate(b.date);
                if (diferencaData !== 0) return diferencaData;
                return converterHoraEmMinutos(a.time) - converterHoraEmMinutos(b.time);
            });
    }

    function montarEstatisticasDiarias(dadosDia, metrica, dataReferencia, hora, faixaHoraria) {
        const registros = extrairRegistrosMetrica(dadosDia, metrica.key, hora, dataReferencia, faixaHoraria);
        const valores = registros.map(registro => registro.value);
        if (!valores.length) return null;

        return {
            date: dataReferencia,
            dateLabel: formatarDataConsulta(dataReferencia),
            values: valores,
            records: registros,
            stats: calcularEstatisticas(valores),
            qualidade: window.ClimateDataQuality?.resumirParaExportacao?.(
                window.ClimateDataQuality?.analisarSerie?.({ [dataReferencia]: dadosDia }, metrica.key)
            ) || null,
        };
    }

    function extrairRegistrosMetrica(dadosDia, chave, hora, dataReferencia = null, faixaHoraria = null) {
        const valores = [];
        for (const horario of Object.keys(dadosDia || {}).sort()) {
            const horaNormalizada = normalizarFiltroHoraConsulta(horario);
            if (hora && horaNormalizada !== hora) continue;
            if (faixaHoraria && !horaEstaNaFaixa(horaNormalizada, faixaHoraria)) continue;

            const dadosHorario = dadosDia[horario];
            if (!dadosHorario || typeof dadosHorario !== "object") continue;

            for (const chaveItem of Object.keys(dadosHorario).sort()) {
                const item = dadosHorario[chaveItem];
                if (!item || typeof item !== "object") continue;

                const valor = window.ClimateData.normalizeMeasurementValue(chave, item[chave]);
                if (valor !== null) {
                    valores.push({
                        value: valor,
                        time: formatarHorarioFirebase(horario),
                        date: dataReferencia,
                    });
                }
            }
        }
        return valores;
    }

    function montarResultadoUltimaMedicao(base, estatisticasDiarias) {
        const registros = estatisticasDiarias.flatMap(dia => (
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

        const baseSemAmostras = { ...base };
        delete baseSemAmostras.amostras;
        return {
            ...baseSemAmostras,
            tipo_resultado: "consulta_horaria",
            operacao: "ultima_medicao",
            valor: arredondar(registroMaisRecente.value),
            hora_consultada: registroMaisRecente.time,
            datas_consultadas: [registroMaisRecente.dateLabel],
            periodo: registroMaisRecente.dateLabel,
        };
    }

    function selecionarRegistroMaisRecente(registros) {
        return [...registros].sort((a, b) => {
            const diferencaDatas = window.ClimateData.parseFirebaseDate(b.date) - window.ClimateData.parseFirebaseDate(a.date);
            if (diferencaDatas !== 0) return diferencaDatas;
            return converterHoraEmMinutos(b.time) - converterHoraEmMinutos(a.time);
        })[0] || null;
    }

    function converterHoraEmMinutos(hora) {
        const [horas, minutos] = String(hora || "00:00").split(":").map(Number);
        return (Number.isFinite(horas) ? horas : 0) * 60 + (Number.isFinite(minutos) ? minutos : 0);
    }

    function montarResultadoComparacaoDias(base, estatisticasDiarias) {
        const resumos = estatisticasDiarias.map(dia => ({
            data: dia.dateLabel,
            media: arredondar(dia.stats.avg),
            minima: arredondar(dia.stats.min),
            maxima: arredondar(dia.stats.max),
            delta: arredondar(dia.stats.delta),
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
            diferenca: arredondar(vencedor.media - referencia.media),
            por_dia: ordenados,
        };
    }

    function montarResultadoExtremoHorario(base, metrica, estatisticasDiarias, intencao) {
        const registros = estatisticasDiarias.flatMap(dia => (
            dia.records.map(registro => ({ ...registro, date: dia.date, dateLabel: dia.dateLabel }))
        ));
        const agrupado = agruparRegistrosPorFaixaHoraria(registros);
        const modo = intencao.operation === "horario_menor_valor" ? "min" : "max";
        const melhor = selecionarFaixaHoraria(agrupado, modo);

        if (!melhor) {
            return {
                ...base,
                sem_dados: true,
                mensagem: `Sem dados de ${base.metrica} em ${base.ambiente} para ${base.periodo}.`,
            };
        }

        return {
            ...base,
            tipo_resultado: "analise_horaria",
            criterio: modo === "max" ? "maior_media_horaria" : "menor_media_horaria",
            horario: melhor.time,
            data: melhor.dateLabel,
            valor: arredondar(melhor.average),
            minima_no_horario: arredondar(melhor.stats.min),
            maxima_no_horario: arredondar(melhor.stats.max),
            registros_no_horario: melhor.values.length,
            por_horario: agrupado.map(faixaHorario => ({
                data: faixaHorario.dateLabel,
                horario: faixaHorario.time,
                media: arredondar(faixaHorario.average),
                minima: arredondar(faixaHorario.stats.min),
                maxima: arredondar(faixaHorario.stats.max),
            })).sort((a, b) => (
                modo === "max" ? b.media - a.media : a.media - b.media
            )).slice(0, 6),
        };
    }

    function montarResultadoExtremoDiaCalendario(base, estatisticasDiarias, intencao) {
        const modo = intencao.operation === "calendario_dia_menor_valor" ? "min" : "max";
        const dias = estatisticasDiarias.map(dia => ({
            data: dia.dateLabel,
            valor: dia.stats.avg,
            minima: dia.stats.min,
            maxima: dia.stats.max,
            amostras: dia.values.length,
        }));
        const melhor = selecionarFaixa(dias, "valor", modo);

        if (!melhor) return montarResultadoAnaliticoSemDados(base, "calendário mensal");

        return {
            ...base,
            tipo_resultado: "analise_calendario_mensal",
            criterio: modo === "max" ? "maior_media_diaria" : "menor_media_diaria",
            data: melhor.data,
            valor: arredondar(melhor.valor),
            minima_no_dia: arredondar(melhor.minima),
            maxima_no_dia: arredondar(melhor.maxima),
            ranking: dias
                .map(dia => ({ ...dia, valor: arredondar(dia.valor), minima: arredondar(dia.minima), maxima: arredondar(dia.maxima) }))
                .sort((a, b) => modo === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function montarResultadoExtremoHoraDia(base, estatisticasDiarias, intencao) {
        const modo = intencao.operation === "heatmap_hora_menor_valor" ? "min" : "max";
        const agrupado = agruparRegistrosPorHoraDia(estatisticasDiarias);
        const melhor = selecionarFaixa(agrupado, "valor", modo);

        if (!melhor) return montarResultadoAnaliticoSemDados(base, "heatmap por hora");

        return {
            ...base,
            tipo_resultado: "analise_heatmap_horario",
            criterio: modo === "max" ? "maior_media_por_hora" : "menor_media_por_hora",
            horario: melhor.horario,
            valor: arredondar(melhor.valor),
            minima_no_horario: arredondar(melhor.minima),
            maxima_no_horario: arredondar(melhor.maxima),
            dias_com_dados_no_horario: melhor.diasComDados,
            ranking: agrupado
                .map(faixaHorario => ({ ...faixaHorario, valor: arredondar(faixaHorario.valor), minima: arredondar(faixaHorario.minima), maxima: arredondar(faixaHorario.maxima) }))
                .sort((a, b) => modo === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function montarResultadoExtremoFaixaSemanal(base, estatisticasDiarias, intencao) {
        const modo = intencao.operation === "heatmap_semana_menor_valor" ? "min" : "max";
        const agrupado = agruparRegistrosPorDiaSemanaHora(estatisticasDiarias);
        const melhor = selecionarFaixa(agrupado, "valor", modo);

        if (!melhor) return montarResultadoAnaliticoSemDados(base, "mapa semanal");

        return {
            ...base,
            tipo_resultado: "analise_heatmap_semanal",
            criterio: modo === "max" ? "maior_media_dia_hora" : "menor_media_dia_hora",
            dia_semana: melhor.diaSemana,
            horario: melhor.horario,
            valor: arredondar(melhor.valor),
            minima_no_periodo: arredondar(melhor.minima),
            maxima_no_periodo: arredondar(melhor.maxima),
            datas: melhor.datas,
            ranking: agrupado
                .map(faixaHorario => ({ ...faixaHorario, valor: arredondar(faixaHorario.valor), minima: arredondar(faixaHorario.minima), maxima: arredondar(faixaHorario.maxima) }))
                .sort((a, b) => modo === "max" ? b.valor - a.valor : a.valor - b.valor)
                .slice(0, 6),
        };
    }

    function agruparRegistrosPorFaixaHoraria(registros) {
        const grupos = new Map();

        for (const registro of registros) {
            const chave = `${registro.dateLabel || formatarDataConsulta(registro.date)}|${registro.time}`;
            if (!grupos.has(chave)) {
                grupos.set(chave, {
                    date: registro.date,
                    dateLabel: registro.dateLabel || formatarDataConsulta(registro.date),
                    time: registro.time,
                    values: [],
                });
            }
            grupos.get(chave).values.push(registro.value);
        }

        return [...grupos.values()].map(grupo => ({
            ...grupo,
            stats: calcularEstatisticas(grupo.values),
            average: calcularEstatisticas(grupo.values).avg,
        }));
    }

    function selecionarFaixaHoraria(faixasAgrupadas, modo) {
        if (!faixasAgrupadas.length) return null;
        const ordenado = [...faixasAgrupadas].sort((a, b) => (
            modo === "max" ? b.average - a.average : a.average - b.average
        ));
        return ordenado[0];
    }

    function agruparRegistrosPorHoraDia(estatisticasDiarias) {
        const grupos = new Map();

        for (const dia of estatisticasDiarias) {
            for (const registro of dia.records) {
                const hora = String(registro.time || "").slice(0, 2);
                if (!grupos.has(hora)) grupos.set(hora, { hour: hora, values: [], dates: new Set() });
                const grupo = grupos.get(hora);
                grupo.values.push(registro.value);
                grupo.dates.add(dia.dateLabel);
            }
        }

        return [...grupos.values()].map(grupo => {
            const estatisticas = calcularEstatisticas(grupo.values);
            return {
                horario: `${grupo.hour}:00`,
                valor: estatisticas.avg,
                minima: estatisticas.min,
                maxima: estatisticas.max,
                diasComDados: grupo.dates.size,
            };
        });
    }

    function agruparRegistrosPorDiaSemanaHora(estatisticasDiarias) {
        const rotulosSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        const grupos = new Map();

        for (const dia of estatisticasDiarias) {
            const dataReferencia = window.ClimateData.parseFirebaseDate(dia.date);
            const diaSemana = dataReferencia.getDay();
            for (const registro of dia.records) {
                const hora = String(registro.time || "").slice(0, 2);
                const chave = `${diaSemana}-${hora}`;
                if (!grupos.has(chave)) {
                    grupos.set(chave, {
                        weekday: diaSemana,
                        hour: hora,
                        values: [],
                        dates: new Set(),
                    });
                }
                const grupo = grupos.get(chave);
                grupo.values.push(registro.value);
                grupo.dates.add(dia.dateLabel);
            }
        }

        return [...grupos.values()].map(grupo => {
            const estatisticas = calcularEstatisticas(grupo.values);
            return {
                diaSemana: rotulosSemana[grupo.weekday],
                horario: `${grupo.hour}:00`,
                valor: estatisticas.avg,
                minima: estatisticas.min,
                maxima: estatisticas.max,
                datas: [...grupo.dates],
            };
        });
    }

    function selecionarFaixa(faixasHorarios, campo, modo) {
        if (!faixasHorarios.length) return null;
        return [...faixasHorarios].sort((a, b) => modo === "max" ? b[campo] - a[campo] : a[campo] - b[campo])[0];
    }

    function montarResultadoAnaliticoSemDados(base, rotulo) {
        return {
            ...base,
            sem_dados: true,
            mensagem: `Sem dados de ${base.metrica} em ${base.ambiente} para análise de ${rotulo} no período ${base.periodo}.`,
        };
    }

    function horaEstaNaFaixa(hora, faixaHoraria) {
        const atual = Number(hora);
        const inicio = Number(faixaHoraria?.start);
        const fim = Number(faixaHoraria?.end);
        if (![atual, inicio, fim].every(Number.isFinite)) return true;
        if (inicio <= fim) return atual >= inicio && atual <= fim;
        return atual >= inicio || atual <= fim;
    }

    function montarResultadoFaixaConforto(ambiente, metrica, estatisticasDiarias, datasPeriodo, intencao) {
        const faixa = obterFaixaConfortoMetrica(ambiente, metrica);
        const base = {
            ambiente: ambiente.label,
            metrica: metrica.label,
            unidade: metrica.unit,
            operacao: intencao.operation,
            criterio: "faixa_de_conforto",
            periodo: intencao.periodLabel || formatarRotuloPeriodoConsulta(datasPeriodo),
            hora_consultada: intencao.hour ? formatarRotuloHoraGrafico(intencao.hour) : null,
            datas_consultadas: datasPeriodo.map(formatarDataConsulta),
            dias_com_dados: estatisticasDiarias.map(dia => dia.dateLabel),
        };

        if (!faixa) {
            return {
                ...base,
                sem_faixa: true,
                mensagem: `Não há faixa de conforto configurada para ${metrica.label} em ${ambiente.label}.`,
            };
        }

        const registros = estatisticasDiarias.flatMap(dia => (
            dia.records.map(registro => ({ ...registro, date: dia.date, dateLabel: dia.dateLabel }))
        ));

        if (!registros.length) {
            return {
                ...base,
                sem_dados: true,
                faixa: formatarFaixa(faixa, metrica.unit),
                mensagem: montarMensagemSemDados(metrica, ambiente, datasPeriodo, intencao),
            };
        }

        const fora = registros.filter(registro => estaForaDaFaixa(registro.value, faixa));
        const dentro = registros.filter(registro => !estaForaDaFaixa(registro.value, faixa));
        const pior = fora
            .map(registro => ({ ...registro, distance: distanciaDaFaixa(registro.value, faixa) }))
            .sort((a, b) => b.distance - a.distance)[0] || null;
        const horasFora = faixasUnicas(fora);

        return {
            ...base,
            tipo_resultado: "faixa_conforto",
            faixa: formatarFaixa(faixa, metrica.unit),
            limite_minimo: faixa.min,
            limite_maximo: faixa.max,
            status: fora.length ? "fora_da_faixa" : "dentro_da_faixa",
            total_registros: registros.length,
            registros_dentro: dentro.length,
            registros_fora: fora.length,
            percentual_dentro: arredondar((dentro.length / registros.length) * 100),
            horas_fora: horasFora.length,
            horarios_fora: horasFora.slice(0, 12),
            pior_horario_fora: pior ? {
                data: pior.dateLabel,
                horario: pior.time,
                valor: arredondar(pior.value),
                distancia: arredondar(pior.distance),
                direcao: pior.value < faixa.min ? "abaixo" : "acima",
            } : null,
        };
    }

    function obterFaixaConfortoMetrica(ambiente, metrica) {
        if (!window.AppConfig) return null;
        if (metrica.key === "humidity" || metrica.key === "Umidade" || metrica.key === "umidade") {
            return window.AppConfig.humidityComfortBand;
        }
        if (metrica.key === "temperature" || metrica.key === "feelsLike" || metrica.key === "Temperatura" || metrica.key === "Sensacao termica" || metrica.key === "temperatura" || metrica.key === "sensacaoTermica") {
            return window.AppConfig.comfortBand;
        }
        if (ambiente.dataKey === "aquarium" && metrica.key === "temperaturaDS18B20") {
            return window.AppConfig.aquariumComfortBand;
        }
        return null;
    }

    function estaForaDaFaixa(valor, faixa) {
        return valor < faixa.min || valor > faixa.max;
    }

    function distanciaDaFaixa(valor, faixa) {
        if (valor < faixa.min) return faixa.min - valor;
        if (valor > faixa.max) return valor - faixa.max;
        return 0;
    }

    function formatarFaixa(faixa, unidade) {
        return `${arredondar(faixa.min)}${unidade} a ${arredondar(faixa.max)}${unidade}`;
    }

    function montarMensagemSemDados(metrica, ambiente, datasPeriodo, intencao) {
        const periodo = intencao.periodLabel || formatarRotuloPeriodoConsulta(datasPeriodo);
        if (intencao.hour) {
            return `Sem dados de ${metrica.label} em ${ambiente.label} para ${periodo} às ${formatarRotuloHoraGrafico(intencao.hour)}.`;
        }
        if (intencao.hourRange) {
            return `Sem dados de ${metrica.label} em ${ambiente.label} para ${periodo} entre ${formatarRotuloFaixaHoraria(intencao.hourRange)}.`;
        }
        return `Sem dados de ${metrica.label} em ${ambiente.label} para ${periodo}.`;
    }

    function faixasUnicas(registros) {
        const vistos = new Set();
        return registros
            .map(registro => `${registro.dateLabel || formatarDataConsulta(registro.date)} ${registro.time}`)
            .filter(faixaHorario => {
                if (vistos.has(faixaHorario)) return false;
                vistos.add(faixaHorario);
                return true;
            });
    }

    function formatarHorarioFirebase(horario) {
        const [hora, minuto = "0"] = String(horario || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    function resolverMetricasAmbientes(ambientes, metricasSolicitadas, pergunta) {
        const perguntaNormalizada = normalizarTextoConsulta(pergunta);
        const solicitado = metricasSolicitadas.length ? metricasSolicitadas : inferirMetricasPergunta(perguntaNormalizada);
        const metricas = [];

        for (const ambiente of ambientes) {
            for (const metrica of ambiente.metrics.map(converterParaObjetoMetrica)) {
                if (!solicitado.length || solicitado.some(valor => correspondenciasMetricas(metrica, valor))) {
                    metricas.push(metrica);
                }
            }
        }

        return metricasUnicas(metricas);
    }

    function inferirMetricasPergunta(perguntaNormalizada) {
        if (temIntencaoQualidadeAr(perguntaNormalizada)) return ["qualidade_ar"];
        if (perguntaNormalizada.includes("temperatura") || perguntaNormalizada.includes("temp")) return ["temperatura"];
        if (perguntaNormalizada.includes("sensacao") || perguntaNormalizada.includes("termica")) return ["sensacao_termica"];
        if (perguntaNormalizada.includes("fri") || perguntaNormalizada.includes("quent") || perguntaNormalizada.includes("calor")) return ["temperatura"];
        if (temIntencaoSolar(perguntaNormalizada)) return ["ciclo_solar"];
        if (perguntaNormalizada.includes("umid") || perguntaNormalizada.includes("humid")) return ["umidade"];
        if (perguntaNormalizada.includes("press")) return ["pressao"];
        if (temPalavraConsulta(perguntaNormalizada, "co2")) return ["co2"];
        if (temPalavraConsulta(perguntaNormalizada, "co")) return ["co"];
        if (perguntaNormalizada.includes("acetona") || perguntaNormalizada.includes("aceton")) return ["acetona"];
        if (perguntaNormalizada.includes("alcool") || perguntaNormalizada.includes("alcohol")) return ["alcool"];
        if (perguntaNormalizada.includes("amonia") || perguntaNormalizada.includes("nh4")) return ["amonia"];
        if (perguntaNormalizada.includes("toluen")) return ["tolueno"];
        if (perguntaNormalizada.includes("ph")) return ["ph"];
        if (perguntaNormalizada.includes("tds")) return ["tds"];
        if (perguntaNormalizada.includes("turb")) return ["turbidez"];
        return [];
    }

    function temIntencaoQualidadeAr(perguntaNormalizada) {
        return ["aqi", "iaq", "qualidade do ar", "qualidade ar", "indice de qualidade do ar", "indice do ar", "ar da sala"]
            .some(termo => perguntaNormalizada.includes(termo));
    }

    function temIntencaoSolar(perguntaNormalizada) {
        return ["solar", "sol", "nascer", "por do sol", "pôr do sol", "zenite", "zênite", "amanhecer", "anoitecer", "duracao do dia", "duração do dia", "duracao de luz", "duração de luz", "tempo de luz", "luz solar", "periodo de luz", "fotoperiodo", "dia mais longo", "dia mais curto", "dia com mais tempo de luz", "dia com menos tempo de luz"]
            .some(termo => perguntaNormalizada.includes(normalizarTextoConsulta(termo)));
    }

    function correspondenciasMetricas(metrica, metricaSolicitada) {
        const solicitado = normalizarTextoConsulta(metricaSolicitada).replace(/_/g, " ");
        const apelidos = [
            metrica.label,
            metrica.key,
            normalizarTextoConsulta(metrica.key).replace(/([a-z])([A-Z])/g, "$1 $2"),
            ...(ALIASES_METRICAS[metrica.key] || []),
        ].map(valor => normalizarTextoConsulta(valor).replace(/_/g, " "));

        if (solicitado === "ciclo solar" && metrica.key === "cicloSolar") return true;
        if (apelidos.some(apelido => apelido === solicitado)) return true;

        return apelidos.some(apelido => (
            apelido.length > 3
            && solicitado.length > 3
            && (apelido.includes(solicitado) || solicitado.includes(apelido))
        ));
    }

    function converterParaObjetoMetrica(metrica) {
        return {
            label: metrica[0],
            key: metrica[1],
            unit: metrica[2],
        };
    }

    function obterMetricaPadrao(ambiente) {
        return converterParaObjetoMetrica(ambiente.metrics[0]);
    }

    function metricasUnicas(metricas) {
        const vistos = new Set();
        return metricas.filter(metrica => {
            const chave = metrica.key;
            if (vistos.has(chave)) return false;
            vistos.add(chave);
            return true;
        });
    }

    function calcularEstatisticas(valores) {
        if (!valores.length) return { avg: null, min: null, max: null, delta: null };
        const primeiro = valores[0];
        const ultimo = valores[valores.length - 1];
        return {
            avg: valores.reduce((soma, valor) => soma + valor, 0) / valores.length,
            min: Math.min(...valores),
            max: Math.max(...valores),
            delta: valores.length >= 2 ? ultimo - primeiro : null,
        };
    }

    function combinarQualidades(qualidades) {
        if (!qualidades.length) return null;
        const ordem = ["adequada", "incompleta", "desatualizada", "suspeita", "critica"];
        const nivel = qualidades.reduce((pior, atual) => (
            ordem.indexOf(atual.nivel) > ordem.indexOf(pior) ? atual.nivel : pior
        ), "adequada");
        return {
            nivel,
            status: qualidades.find(item => item.nivel === nivel)?.status || "Dados suficientes",
            leiturasValidas: qualidades.reduce((total, item) => total + (item.leiturasValidas || 0), 0),
            leiturasEsperadas: qualidades.reduce((total, item) => total + (item.leiturasEsperadas || 0), 0),
            avisos: [...new Set(qualidades.flatMap(item => item.avisos || []))],
        };
    }

    function criterioPadraoOperacao(operacao) {
        if (operacao === "dia_mais_frio" || operacao === "dia_mais_quente" || operacao === "comparar_dias") return "media_diaria";
        if (operacao === "maxima") return "maxima_registrada";
        if (operacao === "minima") return "minima_registrada";
        return "valores_registrados";
    }

    function selecionarDia(resumosDiarios, campo, modo) {
        if (!resumosDiarios.length) return null;
        const ordenado = [...resumosDiarios].sort((a, b) => modo === "min" ? a[campo] - b[campo] : b[campo] - a[campo]);
        return {
            data: ordenado[0].data,
            valor: ordenado[0][campo],
            amostras: ordenado[0].amostras,
        };
    }

    function montarComparacao(resumosDiarios) {
        if (resumosDiarios.length < 2) return null;
        const porMedia = [...resumosDiarios].sort((a, b) => b.media - a.media);
        const rotuloHoje = formatarDataConsulta(window.ClimateData.dataAtual());
        const hoje = resumosDiarios.find(dia => dia.data === rotuloHoje);

        return {
            mais_quente_por_media: {
                data: porMedia[0].data,
                media: porMedia[0].media,
            },
            mais_frio_por_media: {
                data: porMedia[porMedia.length - 1].data,
                media: porMedia[porMedia.length - 1].media,
            },
            hoje: hoje || null,
            dias_mais_quentes_que_hoje: hoje ? resumosDiarios.filter(dia => dia.media > hoje.media).map(dia => ({
                data: dia.data,
                media: dia.media,
                diferenca: arredondar(dia.media - hoje.media),
            })) : [],
        };
    }

    function tendenciaDaDiferenca(delta) {
        if (!Number.isFinite(delta)) return "dados insuficientes";
        if (Math.abs(delta) < 0.05) return "estável";
        return delta > 0 ? "subindo" : "caindo";
    }

    function arredondar(valor) {
        return Number.isFinite(valor) ? Number(valor.toFixed(2)) : null;
    }

    espacoNomes.metrics = {
        buildMetricResult: montarResultadoMetrica,
        buildDailyStats: montarEstatisticasDiarias,
        resolveMetricsForEnvironments: resolverMetricasAmbientes,
        inferMetricsFromQuestion: inferirMetricasPergunta,
        hasAirQualityIntent: temIntencaoQualidadeAr,
        hasSolarIntent: temIntencaoSolar,
        metricMatches: correspondenciasMetricas,
        toMetricObject: converterParaObjetoMetrica,
        getDefaultMetric: obterMetricaPadrao,
        calculateStats: calcularEstatisticas,
        buildComfortBandResult: montarResultadoFaixaConforto,
        trendFromDelta: tendenciaDaDiferenca,
        round: arredondar,
    };

    window.ClimateAssistant = espacoNomes;
})();
