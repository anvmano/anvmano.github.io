'use strict';

(function () {
    const espacoNomes = window.ClimateAssistant || {};
    const { MAX_PROMPT_CHARS: MAX_CARACTERES_INSTRUCAO } = espacoNomes.config;
    const {
        formatNumber: formatarNumeroConsulta,
        formatMetricValue: formatarValorMetricaConsulta,
        formatPeriodLabel: formatarRotuloPeriodoConsulta,
    } = espacoNomes.format;

    async function responderPergunta(pergunta, contexto) {
        const resultadoResposta = await responderPerguntaDetalhada(pergunta, contexto);
        return resultadoResposta.answer;
    }

    async function responderPerguntaDetalhada(pergunta, contexto) {
        const intencao = await espacoNomes.intent.resolveQuestionIntent(pergunta, contexto);
        const resultado = executarConsulta(contexto, intencao, pergunta);

        if (resultado.needsClarification) {
            return {
                answer: resultado.message,
                result: resultado,
            };
        }

        const instrucaoModelo = montarInstrucaoResposta(pergunta, resultado);

        try {
            return {
                answer: await window.ClimateAIService.generateText(instrucaoModelo),
                result: resultado,
            };
        } catch (erro) {
            window.ClimateDiagnostics?.depurar("Falha ao redigir resposta com IA. Usando resposta local.", erro);
            return {
                answer: formatarResultadoAlternativo(resultado),
                result: resultado,
            };
        }
    }

    function executarConsulta(contexto, intencao, pergunta) {
        const intencaoEfetiva = espacoNomes.planner.planQuestionIntent(intencao, pergunta, contexto);

        if (intencaoEfetiva.needsClarification) {
            return {
                needsClarification: true,
                message: intencaoEfetiva.clarificationQuestion || "Preciso de mais detalhes para responder com segurança.",
            };
        }

        const ambientes = intencaoEfetiva.environments;
        const datasPeriodo = espacoNomes.intent.resolvePeriodDates(intencaoEfetiva.period);
        const rotuloPeriodo = obterRotuloPeriodoConsulta(intencaoEfetiva.period, datasPeriodo);

        if (!ambientes.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o ambiente. Você quer consultar Sala, Quarto ou Aquário?",
            };
        }

        if (!datasPeriodo.length) {
            return {
                needsClarification: true,
                message: "Não consegui identificar o período da consulta. Tente informar uma data ou período.",
            };
        }

        const resultadosAmbientes = ambientes
            .map(ambiente => executarConsultaAmbiente(contexto, ambiente, datasPeriodo, intencaoEfetiva, rotuloPeriodo, pergunta))
            .filter(resultado => resultado.metricas.length);
        const rotulosMetricas = [...new Set(resultadosAmbientes.flatMap(resultado => resultado.metricas.map(metrica => metrica.metrica)))];

        if (!resultadosAmbientes.length) {
            return {
                needsClarification: true,
                message: "Não encontrei uma métrica compatível com o ambiente consultado.",
            };
        }

        return {
            question: pergunta,
            resolvedIntent: intencaoEfetiva,
            intent: {
                environments: ambientes.map(ambiente => ambiente.label),
                metrics: rotulosMetricas,
                operation: intencaoEfetiva.operation,
                criterion: intencaoEfetiva.criterion,
                period: {
                    label: rotuloPeriodo,
                    dates: datasPeriodo,
                },
                confidence: intencaoEfetiva.confidence,
            },
            results: resultadosAmbientes,
            generatedAt: new Date().toLocaleString("pt-BR"),
        };
    }

    function executarConsultaAmbiente(contexto, ambiente, datasPeriodo, intencao, rotuloPeriodo, pergunta) {
        const dadosOrigem = contexto.latestData?.[ambiente.dataKey] || {};
        const dados = obterDadosRecortadosPeriodo(dadosOrigem, intencao.period);
        const metricas = espacoNomes.metrics.resolveMetricsForEnvironments([ambiente], intencao.metrics, pergunta);
        const datasDoRecorte = Object.keys(dados || {}).sort((a, b) => window.ClimateData.parseFirebaseDate(a) - window.ClimateData.parseFirebaseDate(b));
        const datasConsulta = intencao.period?.type === "rolling_hours" ? datasDoRecorte : datasPeriodo;
        const intencaoDoRecorte = { ...intencao, periodLabel: rotuloPeriodo };

        const resultadosMetricas = metricas.map(metrica => {
                const estatisticasDiarias = metrica.key === "cicloSolar" || metrica.key === "qualidadeAr"
                    ? []
                    : datasConsulta.map(dataReferencia => espacoNomes.metrics.buildDailyStats(dados?.[dataReferencia], metrica, dataReferencia, intencao.hour, intencao.hourRange)).filter(Boolean);

            return espacoNomes.metrics.buildMetricResult(ambiente, metrica, estatisticasDiarias, datasConsulta.length ? datasConsulta : datasPeriodo, intencaoDoRecorte, dados, contexto);
        });

        return {
            ambiente: ambiente.label,
            metricas: resultadosMetricas,
        };
    }

    function obterDadosRecortadosPeriodo(dados, periodo) {
        if (periodo?.type !== "rolling_hours") return dados;
        return window.ClimateData.filterDataByRollingHours(
            dados,
            periodo.selectedDate || window.ClimateData.dataAtual(),
            periodo.hours || 24
        );
    }

    function obterRotuloPeriodoConsulta(periodo, datasPeriodo) {
        if (periodo?.type === "selected_month") return formatarRotuloPeriodoMensal(periodo.selectedDate || datasPeriodo[0]);
        if (periodo?.type === "selected_year") return formatarRotuloPeriodoAnual(periodo.selectedDate || datasPeriodo[0]);
        if (periodo?.type === "selected_week") return `semana de ${formatarRotuloPeriodoConsulta(datasPeriodo)}`;
        if (periodo?.type === "last_days") {
            const limite = periodo.limited
                ? `; solicitados ${periodo.requestedDays} dias, limitado a ${periodo.days} dias`
                : "";
            return `últimos ${periodo.days} dias até ${formatarRotuloData(periodo.selectedDate)} (${formatarRotuloPeriodoConsulta(datasPeriodo)}${limite})`;
        }
        if (periodo?.type !== "rolling_hours") return formatarRotuloPeriodoConsulta(datasPeriodo);
        const limite = periodo.limited
            ? `; solicitadas ${periodo.requestedHours} horas, limitado a ${periodo.hours} horas`
            : "";
        return `últimas ${periodo.hours || 24} horas até ${formatarRotuloData(periodo.selectedDate)} (${formatarRotuloPeriodoConsulta(datasPeriodo)}${limite})`;
    }

    function formatarRotuloData(dataFirebase) {
        return window.ClimateData.formatarDataExibicao?.(dataFirebase)
            || String(dataFirebase || "").replace(/-/g, "/");
    }

    function formatarRotuloPeriodoMensal(dataFirebase) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(dataFirebase || window.ClimateData.dataAtual());
        return `${String(dataReferencia.getMonth() + 1).padStart(2, "0")}/${dataReferencia.getFullYear()}`;
    }

    function formatarRotuloPeriodoAnual(dataFirebase) {
        const dataReferencia = window.ClimateData.parseFirebaseDate(dataFirebase || window.ClimateData.dataAtual());
        return String(dataReferencia.getFullYear());
    }

    function montarInstrucaoResposta(pergunta, resultado) {
        const conteudoEnvio = JSON.stringify(resultado, null, 2);
        const instrucaoModelo = `
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
            - Se o resultado tiver "tipo_resultado": "estatistica_media", responda somente a média, a métrica, o ambiente e o período.
            - Se o resultado tiver "tipo_resultado": "estatistica_extremo", responda somente a máxima ou mínima pedida, com data, horário, ambiente e período.
            - Se o resultado tiver "tipo_resultado": "variacao_periodo", informe valor inicial, valor final e diferença.
            - Se o resultado tiver "tipo_resultado": "tendencia_periodo", informe a tendência, valor inicial, valor final e diferença.
            - Se o resultado tiver "tipo_resultado": "dados_insuficientes_tendencia", informe diretamente que são necessárias pelo menos duas medições válidas.
            - Quando "qualidade_dados" indicar dados incompletos, suspeitos, críticos ou desatualizados, mencione o aviso sem descartar ou alterar a medição.
            - Se o resultado tiver "tipo_resultado": "extremo_diario", informe somente o dia mais quente/frio, a média diária, o ambiente e o período.
            - Se o resultado tiver "tipo_resultado": "resumo_metrica", faça um resumo curto da métrica sem mencionar amostras.
            - Se o resultado tiver "tipo_resultado": "analise_horaria", responda o horário/período encontrado, o valor principal e a data. Se houver "faixa_horaria_consultada", diga que a análise ficou restrita a essa faixa.
            - Se o resultado tiver "tipo_resultado": "analise_calendario_mensal", responda o dia do mês encontrado, o valor principal e o período consultado.
            - Se o resultado tiver "tipo_resultado": "analise_heatmap_horario", responda a hora do dia encontrada, o valor principal e o período consultado.
            - Se o resultado tiver "tipo_resultado": "analise_heatmap_semanal", responda o dia da semana/hora encontrados, o valor principal e o período consultado.
            - Se o resultado tiver "tipo_resultado": "comparacao_dias", responda qual dia venceu, a diferença e o critério usado.
            - Não mencione número de amostras, exceto se o usuário perguntar explicitamente.
            - Se existirem vários ambientes ou métricas no resultado, não descarte os demais: resuma cada resultado relevante.
            - Se o período tiver sido limitado pelo sistema, informe claramente o limite aplicado.
            - Quando útil, informe o período consultado.
            - Se não houver dados, diga isso diretamente.

            Pergunta do usuário:
            ${pergunta}

            Resultado calculado:
            ${conteudoEnvio}
        `.trim();

        return instrucaoModelo.length > MAX_CARACTERES_INSTRUCAO ? instrucaoModelo.slice(0, MAX_CARACTERES_INSTRUCAO) : instrucaoModelo;
    }

    function formatarResultadoAlternativo(resultado) {
        const metricas = resultado.results?.flatMap(item => item.metricas || []) || [];
        if (!metricas.length) return "Não encontrei dados suficientes para responder.";
        return metricas.map(formatarMetricaAlternativa).filter(Boolean).join("\n\n");
    }

    function formatarMetricaAlternativa(primeiraMetrica) {
        if (primeiraMetrica.sem_dados) return primeiraMetrica.mensagem;

        if (primeiraMetrica.tipo_resultado === "ciclo_solar") return formatarSolarAlternativo(primeiraMetrica);
        if (primeiraMetrica.tipo_resultado?.startsWith?.("solar_")) return formatarAnaliseSolarAlternativa(primeiraMetrica);
        if (primeiraMetrica.tipo_resultado === "faixa_conforto") return formatarConfortoAlternativo(primeiraMetrica);
        if (primeiraMetrica.tipo_resultado === "dados_insuficientes_tendencia") return primeiraMetrica.mensagem;
        if (primeiraMetrica.sem_faixa) return primeiraMetrica.mensagem;

        if (primeiraMetrica.tipo_resultado === "consulta_horaria") {
            const rotuloData = primeiraMetrica.datas_consultadas?.[0] || primeiraMetrica.periodo;
            const valor = formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade);
            const classificacao = primeiraMetrica.classificacao ? ` (${primeiraMetrica.classificacao})` : "";
            const dominante = primeiraMetrica.dominante ? ` Dominante: ${primeiraMetrica.dominante}.` : "";
            return `${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} no dia ${rotuloData} às ${primeiraMetrica.hora_consultada}: ${valor}${classificacao}.${dominante}`;
        }

        if (primeiraMetrica.tipo_resultado === "estatistica_media") {
            return `A média de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi ${formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade)} no período ${primeiraMetrica.periodo}.`;
        }

        if (primeiraMetrica.tipo_resultado === "estatistica_extremo") {
            const descricao = primeiraMetrica.criterio === "menor_registro" ? "mínima" : "máxima";
            return `A ${descricao} de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi ${formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade)} em ${primeiraMetrica.data} às ${primeiraMetrica.horario}. Período: ${primeiraMetrica.periodo}.`;
        }

        if (primeiraMetrica.tipo_resultado === "variacao_periodo" || primeiraMetrica.tipo_resultado === "tendencia_periodo") {
            const inicio = formatarValorMetricaConsulta(primeiraMetrica.valor_inicial, primeiraMetrica.unidade);
            const fim = formatarValorMetricaConsulta(primeiraMetrica.valor_final, primeiraMetrica.unidade);
            const diferenca = formatarValorMetricaConsulta(primeiraMetrica.diferenca, primeiraMetrica.unidade);
            const tendencia = primeiraMetrica.tipo_resultado === "tendencia_periodo"
                ? ` A tendência foi ${primeiraMetrica.tendencia}.`
                : "";
            return `${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi de ${inicio} em ${primeiraMetrica.inicio.data} às ${primeiraMetrica.inicio.horario} para ${fim} em ${primeiraMetrica.fim.data} às ${primeiraMetrica.fim.horario}, diferença de ${diferenca}.${tendencia}`;
        }

        if (primeiraMetrica.tipo_resultado === "extremo_diario") {
            const descricao = primeiraMetrica.criterio === "menor_media_diaria" ? "mais frio" : "mais quente";
            return `No período ${primeiraMetrica.periodo}, o dia ${descricao} em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.data}, com média de ${formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade)}.`;
        }

        if (primeiraMetrica.tipo_resultado === "analise_horaria") {
            const valor = formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade);
            const descritor = primeiraMetrica.criterio === "menor_media_horaria" ? "menor valor médio" : "maior valor médio";
            const intervalo = primeiraMetrica.faixa_horaria_consultada
                ? `, considerando apenas ${primeiraMetrica.faixa_horaria_consultada}`
                : "";
            return `O ${descritor} de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente}${intervalo} foi em ${primeiraMetrica.data} às ${primeiraMetrica.horario}: ${valor}.`;
        }

        if (primeiraMetrica.tipo_resultado === "analise_calendario_mensal") {
            const valor = formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade);
            const descritor = primeiraMetrica.criterio === "menor_media_diaria" ? "menor média diária" : "maior média diária";
            return `No calendário mensal de ${primeiraMetrica.periodo}, o dia com ${descritor} de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.data}: ${valor}.`;
        }

        if (primeiraMetrica.tipo_resultado === "analise_heatmap_horario") {
            const valor = formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade);
            const descritor = primeiraMetrica.criterio === "menor_media_por_hora" ? "menor média por hora" : "maior média por hora";
            return `No período ${primeiraMetrica.periodo}, a hora com ${descritor} de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.horario}: ${valor}.`;
        }

        if (primeiraMetrica.tipo_resultado === "analise_heatmap_semanal") {
            const valor = formatarValorMetricaConsulta(primeiraMetrica.valor, primeiraMetrica.unidade);
            const descritor = primeiraMetrica.criterio === "menor_media_dia_hora" ? "menor média por dia/hora" : "maior média por dia/hora";
            return `No mapa semanal (${primeiraMetrica.periodo}), o ponto com ${descritor} de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.dia_semana} às ${primeiraMetrica.horario}: ${valor}.`;
        }

        if (primeiraMetrica.tipo_resultado === "comparacao_dias") {
            const valorVencedor = formatarValorMetricaConsulta(primeiraMetrica.vencedor.media, primeiraMetrica.unidade);
            const valorReferencia = formatarValorMetricaConsulta(primeiraMetrica.comparado_com.media, primeiraMetrica.unidade);
            const diferenca = formatarValorMetricaConsulta(primeiraMetrica.diferenca, primeiraMetrica.unidade);
            return `${primeiraMetrica.vencedor.data} teve maior média de ${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente}: ${valorVencedor}. ${primeiraMetrica.comparado_com.data} ficou com ${valorReferencia}, diferença de ${diferenca}.`;
        }

        if (primeiraMetrica.tipo_resultado === "qualidade_ar") {
            return [
                `AQI estimado em ${primeiraMetrica.ambiente}: ${primeiraMetrica.media} (${primeiraMetrica.classificacao_atual || "sem classificação"}).`,
                primeiraMetrica.dominante_atual ? `Dominante: ${primeiraMetrica.dominante_atual}.` : null,
                "",
                `Mínimo: ${primeiraMetrica.minima}`,
                `Máximo: ${primeiraMetrica.maxima}`,
                `Período: ${primeiraMetrica.periodo}`
            ].filter(Boolean).join("\n");
        }

        if (primeiraMetrica.operacao === "dia_mais_frio") {
            return `No período ${primeiraMetrica.periodo}, o dia mais frio em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.dia_mais_frio.data}, com média de ${formatarNumeroConsulta(primeiraMetrica.dia_mais_frio.valor)}${primeiraMetrica.unidade}.`;
        }

        if (primeiraMetrica.operacao === "dia_mais_quente") {
            return `No período ${primeiraMetrica.periodo}, o dia mais quente em ${primeiraMetrica.ambiente} foi ${primeiraMetrica.dia_mais_quente.data}, com média de ${formatarNumeroConsulta(primeiraMetrica.dia_mais_quente.valor)}${primeiraMetrica.unidade}.`;
        }

        return [
            `${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente}:`,
            "",
            `Média: ${formatarNumeroConsulta(primeiraMetrica.media)}${primeiraMetrica.unidade}`,
            `Mínima: ${formatarNumeroConsulta(primeiraMetrica.minima)}${primeiraMetrica.unidade}`,
            `Máxima: ${formatarNumeroConsulta(primeiraMetrica.maxima)}${primeiraMetrica.unidade}`,
            primeiraMetrica.faixa_horaria_consultada ? `Faixa horária: ${primeiraMetrica.faixa_horaria_consultada}` : null,
            "",
            `Período: ${primeiraMetrica.periodo}`
        ].filter(linhaTexto => linhaTexto !== null).join("\n");
    }

    function formatarSolarAlternativo(primeiraMetrica) {
        const primeiroDia = primeiraMetrica.por_dia?.[0];
        if (!primeiroDia) return primeiraMetrica.mensagem || "Não encontrei dados de ciclo solar para o período consultado.";

        const linhasTexto = [
            `Ciclo solar em ${primeiraMetrica.ambiente} no dia ${primeiroDia.data}:`,
            "",
        ];

        if (primeiroDia.amanhecer) linhasTexto.push(`Amanhecer: ${primeiroDia.amanhecer}`);
        if (primeiroDia.nascer_do_sol) linhasTexto.push(`Nascer do sol: ${primeiroDia.nascer_do_sol}`);
        if (primeiroDia.zenite) linhasTexto.push(`Zênite: ${primeiroDia.zenite}`);
        if (primeiroDia.por_do_sol) linhasTexto.push(`Pôr do sol: ${primeiroDia.por_do_sol}`);
        if (primeiroDia.anoitecer) linhasTexto.push(`Anoitecer: ${primeiroDia.anoitecer}`);
        if (primeiroDia.duracao_dia) linhasTexto.push(`Duração do dia: ${primeiroDia.duracao_dia}`);
        if (primeiroDia.periodo_luz_total) linhasTexto.push(`Período total de luz: ${primeiroDia.periodo_luz_total}`);

        linhasTexto.push("");
        linhasTexto.push(`Período consultado: ${primeiraMetrica.periodo}`);

        return linhasTexto.join("\n");
    }

    function formatarAnaliseSolarAlternativa(primeiraMetrica) {
        if (primeiraMetrica.tipo_resultado === "solar_duracao_dia") {
            return `A duração do dia em ${primeiraMetrica.data} foi ${primeiraMetrica.duracao_dia}, de ${primeiraMetrica.nascer_do_sol} até ${primeiraMetrica.por_do_sol}.`;
        }

        if (primeiraMetrica.tipo_resultado === "solar_extremo_duracao_luz") {
            const descritor = primeiraMetrica.criterio === "menor_duracao_luz" ? "menor duração de luz" : "maior duração de luz";
            return `No período ${primeiraMetrica.periodo}, o dia com ${descritor} foi ${primeiraMetrica.data}: ${primeiraMetrica.duracao_dia} de luz (${primeiraMetrica.nascer_do_sol} às ${primeiraMetrica.por_do_sol}).`;
        }

        if (primeiraMetrica.tipo_resultado === "solar_tendencia_evento") {
            const rotuloTendencia = {
                mais_cedo: "ficando mais cedo",
                mais_tarde: "ficando mais tarde",
                estavel: "praticamente estável",
            }[primeiraMetrica.tendencia] || primeiraMetrica.tendencia;
            const delta = formatarDiferencaMinutos(primeiraMetrica.delta_minutos);
            return `No período (${primeiraMetrica.periodo}), o ${primeiraMetrica.evento} está ${rotuloTendencia}: foi de ${primeiraMetrica.primeiro.horario} em ${primeiraMetrica.primeiro.data} para ${primeiraMetrica.ultimo.horario} em ${primeiraMetrica.ultimo.data} (${delta}).`;
        }

        if (primeiraMetrica.tipo_resultado === "solar_comparacao_evento") {
            const linhas = primeiraMetrica.por_dia
                .map(dia => `${dia.data}: ${dia.horario}${dia.diferenca_minutos ? ` (${formatarDiferencaMinutos(dia.diferenca_minutos)})` : ""}`)
                .join("\n");
            return `Comparação de ${primeiraMetrica.evento} no período (${primeiraMetrica.periodo}):\n\n${linhas}`;
        }

        return primeiraMetrica.mensagem || "Não encontrei dados solares suficientes para responder.";
    }

    function formatarDiferencaMinutos(minutos) {
        if (!Number.isFinite(minutos) || minutos === 0) return "sem variação";
        const sinal = minutos > 0 ? "+" : "-";
        const absoluto = Math.abs(minutos);
        return `${sinal}${absoluto} min`;
    }

    function formatarConfortoAlternativo(primeiraMetrica) {
        const estado = primeiraMetrica.status === "dentro_da_faixa"
            ? "ficou dentro da faixa"
            : "ficou fora da faixa";
        const linhasTexto = [
            `${primeiraMetrica.metrica} em ${primeiraMetrica.ambiente} ${estado} no período ${primeiraMetrica.periodo}.`,
            "",
            `Faixa usada: ${primeiraMetrica.faixa}`,
            `Horas fora da faixa: ${primeiraMetrica.horas_fora}`,
            `Dentro da faixa: ${formatarNumeroConsulta(primeiraMetrica.percentual_dentro)}%`,
        ];

        if (primeiraMetrica.pior_horario_fora) {
            const valor = formatarValorMetricaConsulta(primeiraMetrica.pior_horario_fora.valor, primeiraMetrica.unidade);
            linhasTexto.push(`Pior horário fora da faixa: ${primeiraMetrica.pior_horario_fora.data} às ${primeiraMetrica.pior_horario_fora.horario}, com ${valor} (${primeiraMetrica.pior_horario_fora.direcao} da faixa).`);
        }

        return linhasTexto.join("\n");
    }

    espacoNomes.query = {
        answerQuestion: responderPergunta,
        answerQuestionDetailed: responderPerguntaDetalhada,
    };
    window.ClimateAssistant = espacoNomes;
})();
