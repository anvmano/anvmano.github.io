'use strict';

(function () {
    const modulos = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format: formatacao } = modulos;
    const { formatValue: formatarValorRelatorio, formatDelta: formatarDiferenca, getMetricStatus: obterEstadoMetrica } = formatacao;

    function obterCampos(configuracaoAba) {
        if (configuracaoAba.tableType === "station") return {};
        if (configuracaoAba.tableType === "room") return AppConfig.fields.room;
        if (configuracaoAba.tableType === "livingRoom") return AppConfig.fields.livingRoom;
        return AppConfig.fields.aquarium;
    }

    function obterMetricasTabelaPdf(configuracaoAba) {
        return configuracaoAba.tableMetrics || configuracaoAba.metrics;
    }

    function obterTodasMetricasRelatorio(configuracaoAba) {
        const mesclado = [...configuracaoAba.metrics, ...obterMetricasTabelaPdf(configuracaoAba)];
        const vistos = new Set();
        return mesclado.filter(metrica => {
            if (vistos.has(metrica.key)) return false;
            vistos.add(metrica.key);
            return true;
        });
    }

    function construirFonteDadosRelatorio(configuracaoAba, dadosMaisRecentes, dataSelecionada) {
        const dadosOriginais = dadosMaisRecentes?.[configuracaoAba.dataKey] || {};
        const dadosSelecionados = ClimateData.filterDataByDays(dadosOriginais, 2, dataSelecionada);
        const campos = obterCampos(configuracaoAba);
        const metricas = obterTodasMetricasRelatorio(configuracaoAba);
        const qualidades = Object.fromEntries(metricas.map(metrica => [
            metrica.key,
            window.ClimateDataQuality?.analisarSerie?.(dadosSelecionados, campos[metrica.key]) || null,
        ]));
        const linhasDetalhadas = extrairLinhasRelatorio(dadosSelecionados, metricas, campos, qualidades);
        const linhasNormalizadas = construirLinhasNormalizadas(linhasDetalhadas, metricas);

        return {
            dadosOriginais,
            dadosSelecionados,
            campos,
            metricas,
            qualidades,
            linhasDetalhadas,
            linhasNormalizadas,
        };
    }

    function construirLinhasNormalizadas(linhas, metricas) {
        const agrupadas = new Map();

        linhas.forEach(linha => {
            if (!linha.fullTime || !metricas.some(metrica => metrica.key === linha.metricKey)) return;
            if (!agrupadas.has(linha.fullTime)) {
                agrupadas.set(linha.fullTime, {
                    time: linha.fullTime,
                    numericValues: {},
                    values: {},
                    statuses: {},
                });
            }

            const grupo = agrupadas.get(linha.fullTime);
            if (!(linha.metricKey in grupo.numericValues)) {
                grupo.numericValues[linha.metricKey] = null;
                grupo.values[linha.metricKey] = "--";
                grupo.statuses[linha.metricKey] = "Sem dados";
            }
            if (!Number.isFinite(linha.numericValue)) return;

            grupo.numericValues[linha.metricKey] = linha.numericValue;
            grupo.values[linha.metricKey] = linha.value;
            grupo.statuses[linha.metricKey] = linha.status;
        });

        return Array.from(agrupadas.values()).sort((a, b) => a.time.localeCompare(b.time));
    }

    function montarLinhasTabelaCompacta(linhas, metricas) {
        const normalizadas = linhas.some(linha => linha.numericValues)
            ? linhas
            : construirLinhasNormalizadas(linhas, metricas);

        return normalizadas.map(linha => {
            const valores = {};
            const valoresNumericos = {};
            const estados = [];
            metricas.forEach(metrica => {
                valores[metrica.key] = linha.values[metrica.key] || "--";
                valoresNumericos[metrica.key] = Number.isFinite(linha.numericValues[metrica.key])
                    ? linha.numericValues[metrica.key]
                    : null;
                estados.push(linha.statuses[metrica.key] || "Sem dados");
            });

            return {
                time: linha.time,
                values: valores,
                numericValues: valoresNumericos,
                status: estados.includes("Crítico")
                    ? "Crítico"
                    : estados.includes("Suspeito")
                        ? "Suspeito"
                        : estados.includes("Alerta") ? "Alerta" : "Estável",
            };
        });
    }

    function montarAlertasDiarios(linhas, metricas, qualidades = {}) {
        const metricasAlerta = metricas.filter(metrica => ["temperature", "feelsLike"].includes(metrica.key));
        const alertas = [];
        const normalizadas = linhas.some(linha => linha.numericValues)
            ? linhas
            : construirLinhasNormalizadas(linhas, metricas);

        metricasAlerta.forEach(metrica => {
            const linhasAlerta = normalizadas
                .filter(linha => linha.statuses[metrica.key] === "Alerta")
                .sort((a, b) => a.time.localeCompare(b.time));

            if (!linhasAlerta.length) return;

            const primeiro = linhasAlerta[0].time;
            const ultimo = linhasAlerta[linhasAlerta.length - 1].time;
            alertas.push(`${metrica.label} fora da faixa ideal entre ${primeiro} e ${ultimo}.`);
        });

        metricas.forEach(metrica => {
            const qualidade = qualidades[metrica.key];
            qualidade?.avisos?.forEach(aviso => alertas.push(`${metrica.label}: ${aviso}`));
        });

        return alertas.slice(0, 4);
    }

    function montarCardsResumo(configuracaoAba, linhas, dadosMaisRecentes = {}, dataSelecionada = ClimateData.dataAtual(), qualidades = {}, dadosClimaExterno = null) {
        if (configuracaoAba.tableType === "station") {
            return montarCardsResumoEstacao(dadosMaisRecentes, dataSelecionada, dadosClimaExterno);
        }

        const normalizadas = linhas.some(linha => linha.numericValues)
            ? linhas
            : construirLinhasNormalizadas(linhas, obterTodasMetricasRelatorio(configuracaoAba));
        const cards = configuracaoAba.metrics.map(metrica => {
            const valores = normalizadas
                .map(linha => linha.numericValues[metrica.key])
                .filter(Number.isFinite);
            return montarResumoMetrica(metrica, valores, qualidades[metrica.key]);
        });

        return cards;
    }

    function montarCardsResumoEstacao(dadosMaisRecentes, dataSelecionada, dadosClimaExterno = null) {
        const campos = AppConfig.fields;
        const dadosSala = ClimateData.filterDataByDays(dadosMaisRecentes.livingRoom || {}, 2, dataSelecionada);
        const dadosQuarto = ClimateData.filterDataByDays(dadosMaisRecentes.room || {}, 2, dataSelecionada);
        const dadosAquario = ClimateData.filterDataByDays(dadosMaisRecentes.aquarium || {}, 2, dataSelecionada);

        return [
            montarCardEstacaoDoAno(),
            montarCardLuaEstacao(dataSelecionada),
            montarCardAqiEstacao(dadosSala),
            montarCardUltimaLeituraEstacao("Temp. Sala", dadosSala, campos.livingRoom.temperature, "°C"),
            montarCardUltimaLeituraEstacao("Temp. Quarto", dadosQuarto, campos.room.temperature, "°C"),
            montarCardUltimaLeituraEstacao("Temp. Aquário", dadosAquario, campos.aquarium.temperature, "°C"),
            montarCardUltimaLeituraEstacao("Umidade Sala", dadosSala, campos.livingRoom.humidity, "%"),
            montarCardUltimaLeituraEstacao("Umidade Quarto", dadosQuarto, campos.room.humidity, "%"),
            montarCardChuvaEstacao(dadosClimaExterno),
        ].filter(Boolean);
    }

    function montarCardChuvaEstacao(dadosClimaExterno) {
        if (!dadosClimaExterno) return null;

        const estadoAtual = window.ClimateChuva?.analisarAgora?.(dadosClimaExterno.climaAtual || {});
        const previsao = window.ClimateInsightsAmbientais?.resumirChuva?.(
            dadosClimaExterno.previsaoCurtoPrazo || [],
            dadosClimaExterno.atualizadoEm,
            6
        );
        if (!estadoAtual || !previsao) return null;

        return {
            label: "Chuva externa",
            current: estadoAtual.disponivel ? estadoAtual.rotulo : "--",
            details: [
                { label: "Maior chance", value: `${Math.round(previsao.probabilidade)}%` },
                { label: "Acumulado 6h", value: `${previsao.acumulado.toFixed(1)} mm` },
                { label: "Pico", value: `${previsao.intensidadeMaxima.toFixed(1)} mm/h` },
                { label: "Origem", value: dadosClimaExterno.origem?.rotulo || "Clima externo" },
            ],
            status: previsao.rotulo,
        };
    }

    function montarCardEstacaoDoAno() {
        const estado = window.ClimateSeason?.getState?.();
        if (!estado) return resumoVazio("Estação do ano");

        const indiceAtual = estado.estacoes.findIndex(estacao => estacao.chave === estado.estacao.chave);
        const proxima = estado.estacoes[indiceAtual + 1] || estado.estacoes[0];

        return {
            label: "Estação do ano",
            current: estado.estacao.nome,
            details: [
                { label: "Início", value: formatarDataCompletaEstacao(estado.estacao.inicio) },
                { label: "Próxima", value: proxima.nome },
                { label: "Na estação", value: `${Number(estado.progressoEstacao ?? 0).toFixed(1)}%` },
            ],
            status: "Atual",
        };
    }

    function montarCardLuaEstacao(dataSelecionada) {
        const estado = window.ClimateMoon?.getState?.(dataSelecionada);
        if (!estado) return resumoVazio("Fase da lua");

        return {
            label: "Fase da lua",
            current: `${estado.iluminacao}% iluminada`,
            details: [
                { label: "Fase", value: estado.fase.nome },
                { label: "Próx. cheia", value: formatarDataCompletaEstacao(estado.proximaCheia) },
                { label: "Próx. nova", value: formatarDataCompletaEstacao(estado.proximaNova) },
            ],
            status: "Atual",
        };
    }

    function montarCardAqiEstacao(dados) {
        const resultado = window.ClimateAqi?.calculate?.(dados);
        if (!resultado) return resumoVazio("AQI estimado");

        return {
            label: "AQI estimado",
            current: String(resultado.aqi),
            details: [
                { label: "Status", value: resultado.category.label },
                { label: "Dominante", value: resultado.dominant.label },
                { label: "Atualizado", value: formatarTimestampEstacao(resultado.timestamp) },
            ],
            status: resultado.category.label,
        };
    }

    function montarCardUltimaLeituraEstacao(rotulo, dados, campo, unidade) {
        const registro = obterUltimoRegistroEstacao(dados, campo);
        if (!registro) return resumoVazio(rotulo);

        return {
            label: rotulo,
            current: formatarValorRelatorio(registro.valor, unidade),
            details: [
                { label: "Data", value: registro.data.replace(/-/g, "/") },
                { label: "Hora", value: registro.horario },
                { label: "Referência", value: "Última medição" },
            ],
            status: "Estável",
        };
    }

    function montarResumoMetrica(metrica, valores, qualidade = null) {
        if (!valores.length) {
            return resumoVazio(metrica.label);
        }

        const primeiro = valores[0];
        const ultimo = valores[valores.length - 1];
        const minimo = Math.min(...valores);
        const maximo = Math.max(...valores);
        const delta = valores.length >= 2 ? ultimo - primeiro : null;
        const estado = qualidade?.nivel === "critica"
            ? "Leitura crítica"
            : qualidade && !["adequada", "sem_dados"].includes(qualidade.nivel)
                ? qualidade.rotulo
                : obterEstadoMetrica(metrica, ultimo);
        const detalhes = [
            { label: "Mín", value: formatarValorRelatorio(minimo, metrica.unit) },
            { label: "Máx", value: formatarValorRelatorio(maximo, metrica.unit) },
            { label: "Delta", value: Number.isFinite(delta) ? formatarDiferenca(delta, metrica.unit) : "--" },
        ];
        if (qualidade?.leiturasEsperadas > 0) {
            detalhes.push({
                label: "Cobertura",
                value: `${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas}`,
            });
        }

        return {
            label: metrica.label,
            current: formatarValorRelatorio(ultimo, metrica.unit),
            min: formatarValorRelatorio(minimo, metrica.unit),
            max: formatarValorRelatorio(maximo, metrica.unit),
            delta: Number.isFinite(delta) ? formatarDiferenca(delta, metrica.unit) : "--",
            details: detalhes,
            status: estado,
            qualidade: window.ClimateDataQuality?.resumirParaExportacao?.(qualidade) || null,
        };
    }

    function montarResumoSolar(grafico) {
        const horarios = grafico?.$solarDayTimes;
        if (!horarios) return resumoVazio("Ciclo solar");

        const duracaoDia = horarios.sunset - horarios.sunrise;
        return {
            label: "Ciclo solar",
            current: `Zênite ${ClimateData.formatTime(horarios.zenith)}`,
            min: `Nascer ${ClimateData.formatTime(horarios.sunrise)}`,
            max: `Pôr ${ClimateData.formatTime(horarios.sunset)}`,
            delta: `${duracaoDia.toFixed(2)}h`,
            details: [
                { label: "Nascer", value: ClimateData.formatTime(horarios.sunrise) },
                { label: "Pôr", value: ClimateData.formatTime(horarios.sunset) },
                { label: "Duração", value: `${duracaoDia.toFixed(2)}h` },
            ],
            status: "Estável",
        };
    }

    function resumoVazio(rotulo) {
        return {
            label: rotulo,
            current: "--",
            min: "--",
            max: "--",
            delta: "--",
            details: [
                { label: "Status", value: "Sem dados" },
            ],
            status: "Sem dados",
        };
    }

    function obterUltimoRegistroEstacao(dados, campo) {
        let ultimo = null;

        for (const dataFirebase of Object.keys(dados || {})) {
            const dadosData = dados[dataFirebase];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData)) {
                const valores = obterValoresDoHorarioEstacao(dadosData[horario], campo);
                if (!valores.length) continue;

                const chave = `${formatarDataOrdenavelEstacao(dataFirebase)} ${formatarHorarioEstacao(horario)}`;
                const valor = valores[valores.length - 1];
                if (!ultimo || chave > ultimo.chave) {
                    ultimo = {
                        chave,
                        valor,
                        data: dataFirebase,
                        horario: formatarHorarioEstacao(horario),
                    };
                }
            }
        }

        return ultimo;
    }

    function obterValoresDoHorarioEstacao(dadosHorario, campo) {
        const valores = [];
        if (!dadosHorario || typeof dadosHorario !== "object") return valores;

        for (const item of Object.values(dadosHorario)) {
            if (!item || typeof item !== "object") continue;
            const valor = ClimateData.normalizeMeasurementValue(campo, item[campo]);
            if (valor !== null) valores.push(valor);
        }

        return valores;
    }

    function formatarDataOrdenavelEstacao(dataFirebase) {
        const [dia, mes, ano] = String(dataFirebase || "").split("-");
        return `${ano}-${mes}-${dia}`;
    }

    function formatarHorarioEstacao(horarioFirebase) {
        const [hora, minuto = "0"] = String(horarioFirebase || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    function formatarTimestampEstacao(instanteRegistro) {
        if (!(instanteRegistro instanceof Date) || Number.isNaN(instanteRegistro.getTime())) return "--";
        const dia = String(instanteRegistro.getDate()).padStart(2, "0");
        const mes = String(instanteRegistro.getMonth() + 1).padStart(2, "0");
        const hora = String(instanteRegistro.getHours()).padStart(2, "0");
        const minuto = String(instanteRegistro.getMinutes()).padStart(2, "0");
        return `${dia}/${mes} ${hora}:${minuto}`;
    }

    function formatarDataCompletaEstacao(dados) {
        if (!(dados instanceof Date) || Number.isNaN(dados.getTime())) return "--";
        const dia = String(dados.getDate()).padStart(2, "0");
        const mes = String(dados.getMonth() + 1).padStart(2, "0");
        return `${dia}/${mes}/${dados.getFullYear()}`;
    }

    function extrairLinhasRelatorio(dados, metricas, campos, qualidades = {}) {
        const linhas = [];
        const datasFirebase = Object.keys(dados || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b));

        for (const dataFirebase of datasFirebase) {
            const dadosData = dados[dataFirebase];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData).sort()) {
                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;
                const [hora, minuto = "0"] = horario.split("-");

                for (const chaveItem of Object.keys(dadosHorario).sort()) {
                    const item = dadosHorario[chaveItem];
                    if (!item || typeof item !== "object") continue;

                    metricas.forEach((metrica, indiceMetrica) => {
                        const nomeCampo = campos[metrica.key];
                        const valorBruto = item[nomeCampo];
                        const valorNumerico = ClimateData.normalizeMeasurementValue(nomeCampo, valorBruto);
                        const temValor = valorNumerico !== null;
                        const qualidadeLeitura = window.ClimateDataQuality?.obterQualidadeLeitura?.(
                            qualidades[metrica.key],
                            dataFirebase,
                            horario,
                            chaveItem
                        );
                        const statusQualidade = qualidadeLeitura?.nivel === "critica"
                            ? "Crítico"
                            : qualidadeLeitura?.nivel === "suspeita" ? "Suspeito" : null;
                        linhas.push({
                            time: indiceMetrica === 0 ? `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}` : "",
                            fullTime: `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`,
                            metricKey: metrica.key,
                            label: metrica.label,
                            numericValue: temValor ? valorNumerico : null,
                            value: temValor ? formatarValorRelatorio(valorNumerico, metrica.unit) : "--",
                            status: temValor ? (statusQualidade || obterEstadoMetrica(metrica, valorNumerico)) : "Sem dados",
                            qualidade: qualidadeLeitura || null,
                        });
                    });
                }
            }
        }

        return linhas;
    }

    modulos.data = {
        construirFonteDadosRelatorio,
        construirLinhasNormalizadas,
        getFields: obterCampos,
        getPdfTableMetrics: obterMetricasTabelaPdf,
        getAllReportMetrics: obterTodasMetricasRelatorio,
        buildCompactTableRows: montarLinhasTabelaCompacta,
        buildDailyAlerts: montarAlertasDiarios,
        buildSummaryCards: montarCardsResumo,
        buildStationSummaryCards: montarCardsResumoEstacao,
        buildStationRainCard: montarCardChuvaEstacao,
        buildStationSeasonCard: montarCardEstacaoDoAno,
        buildStationMoonCard: montarCardLuaEstacao,
        buildStationAqiCard: montarCardAqiEstacao,
        buildStationLatestCard: montarCardUltimaLeituraEstacao,
        buildMetricSummary: montarResumoMetrica,
        buildSolarSummary: montarResumoSolar,
        emptySummary: resumoVazio,
        extractReportRows: extrairLinhasRelatorio,
    };
})();
