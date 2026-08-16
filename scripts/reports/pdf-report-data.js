'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format } = modules;
    const { formatValue, formatDelta, getMetricStatus } = format;

    function getFields(tabConfig) {
        if (tabConfig.tableType === "station") return {};
        if (tabConfig.tableType === "room") return AppConfig.fields.room;
        if (tabConfig.tableType === "livingRoom") return AppConfig.fields.livingRoom;
        return AppConfig.fields.aquarium;
    }

    function getPdfTableMetrics(tabConfig) {
        return tabConfig.tableMetrics || tabConfig.metrics;
    }

    function getAllReportMetrics(tabConfig) {
        const merged = [...tabConfig.metrics, ...getPdfTableMetrics(tabConfig)];
        const seen = new Set();
        return merged.filter(metric => {
            if (seen.has(metric.key)) return false;
            seen.add(metric.key);
            return true;
        });
    }

    function construirFonteDadosRelatorio(tabConfig, latestData, selectedDate) {
        const dadosOriginais = latestData?.[tabConfig.dataKey] || {};
        const dadosSelecionados = ClimateData.filterDataByDays(dadosOriginais, 2, selectedDate);
        const campos = getFields(tabConfig);
        const metricas = getAllReportMetrics(tabConfig);
        const qualidades = Object.fromEntries(metricas.map(metrica => [
            metrica.key,
            window.ClimateDataQuality?.analisarSerie?.(dadosSelecionados, campos[metrica.key]) || null,
        ]));
        const linhasDetalhadas = extractReportRows(dadosSelecionados, metricas, campos, qualidades);
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

    function construirLinhasNormalizadas(rows, metrics) {
        const agrupadas = new Map();

        rows.forEach(row => {
            if (!row.fullTime || !metrics.some(metric => metric.key === row.metricKey)) return;
            if (!agrupadas.has(row.fullTime)) {
                agrupadas.set(row.fullTime, {
                    time: row.fullTime,
                    numericValues: {},
                    values: {},
                    statuses: {},
                });
            }

            const grupo = agrupadas.get(row.fullTime);
            if (!(row.metricKey in grupo.numericValues)) {
                grupo.numericValues[row.metricKey] = null;
                grupo.values[row.metricKey] = "--";
                grupo.statuses[row.metricKey] = "Sem dados";
            }
            if (!Number.isFinite(row.numericValue)) return;

            grupo.numericValues[row.metricKey] = row.numericValue;
            grupo.values[row.metricKey] = row.value;
            grupo.statuses[row.metricKey] = row.status;
        });

        return Array.from(agrupadas.values()).sort((a, b) => a.time.localeCompare(b.time));
    }

    function buildCompactTableRows(rows, metrics) {
        const normalizadas = rows.some(row => row.numericValues)
            ? rows
            : construirLinhasNormalizadas(rows, metrics);

        return normalizadas.map(row => {
            const values = {};
            const numericValues = {};
            const statuses = [];
            metrics.forEach(metric => {
                values[metric.key] = row.values[metric.key] || "--";
                numericValues[metric.key] = Number.isFinite(row.numericValues[metric.key])
                    ? row.numericValues[metric.key]
                    : null;
                statuses.push(row.statuses[metric.key] || "Sem dados");
            });

            return {
                time: row.time,
                values,
                numericValues,
                status: statuses.includes("Crítico")
                    ? "Crítico"
                    : statuses.includes("Suspeito")
                        ? "Suspeito"
                        : statuses.includes("Alerta") ? "Alerta" : "Estável",
            };
        });
    }

    function buildDailyAlerts(rows, metrics, qualidades = {}) {
        const alertMetrics = metrics.filter(metric => ["temperature", "feelsLike"].includes(metric.key));
        const alerts = [];
        const normalizadas = rows.some(row => row.numericValues)
            ? rows
            : construirLinhasNormalizadas(rows, metrics);

        alertMetrics.forEach(metric => {
            const alertRows = normalizadas
                .filter(row => row.statuses[metric.key] === "Alerta")
                .sort((a, b) => a.time.localeCompare(b.time));

            if (!alertRows.length) return;

            const first = alertRows[0].time;
            const last = alertRows[alertRows.length - 1].time;
            alerts.push(`${metric.label} fora da faixa ideal entre ${first} e ${last}.`);
        });

        metrics.forEach(metric => {
            const qualidade = qualidades[metric.key];
            qualidade?.avisos?.forEach(aviso => alerts.push(`${metric.label}: ${aviso}`));
        });

        return alerts.slice(0, 4);
    }

    function buildSummaryCards(tabConfig, rows, latestData = {}, selectedDate = ClimateData.dataAtual(), qualidades = {}) {
        if (tabConfig.tableType === "station") {
            return buildStationSummaryCards(latestData, selectedDate);
        }

        const normalizadas = rows.some(row => row.numericValues)
            ? rows
            : construirLinhasNormalizadas(rows, getAllReportMetrics(tabConfig));
        const cards = tabConfig.metrics.map(metric => {
            const values = normalizadas
                .map(row => row.numericValues[metric.key])
                .filter(Number.isFinite);
            return buildMetricSummary(metric, values, qualidades[metric.key]);
        });

        return cards;
    }

    function buildStationSummaryCards(latestData, selectedDate) {
        const campos = AppConfig.fields;
        const dadosSala = ClimateData.filterDataByDays(latestData.livingRoom || {}, 2, selectedDate);
        const dadosQuarto = ClimateData.filterDataByDays(latestData.room || {}, 2, selectedDate);
        const dadosAquario = ClimateData.filterDataByDays(latestData.aquarium || {}, 2, selectedDate);

        return [
            buildStationSeasonCard(),
            buildStationMoonCard(selectedDate),
            buildStationAqiCard(dadosSala),
            buildStationLatestCard("Temp. Sala", dadosSala, campos.livingRoom.temperature, "°C"),
            buildStationLatestCard("Temp. Quarto", dadosQuarto, campos.room.temperature, "°C"),
            buildStationLatestCard("Temp. Aquário", dadosAquario, campos.aquarium.temperature, "°C"),
            buildStationLatestCard("Umidade Sala", dadosSala, campos.livingRoom.humidity, "%"),
            buildStationLatestCard("Umidade Quarto", dadosQuarto, campos.room.humidity, "%"),
        ];
    }

    function buildStationSeasonCard() {
        const estado = window.ClimateSeason?.getState?.();
        if (!estado) return emptySummary("Estação do ano");

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

    function buildStationMoonCard(selectedDate) {
        const estado = window.ClimateMoon?.getState?.(selectedDate);
        if (!estado) return emptySummary("Fase da lua");

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

    function buildStationAqiCard(data) {
        const resultado = window.ClimateAqi?.calculate?.(data);
        if (!resultado) return emptySummary("AQI estimado");

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

    function buildStationLatestCard(label, data, campo, unidade) {
        const registro = obterUltimoRegistroEstacao(data, campo);
        if (!registro) return emptySummary(label);

        return {
            label,
            current: formatValue(registro.valor, unidade),
            details: [
                { label: "Data", value: registro.data.replace(/-/g, "/") },
                { label: "Hora", value: registro.horario },
                { label: "Referência", value: "Última medição" },
            ],
            status: "Estável",
        };
    }

    function buildMetricSummary(metric, values, qualidade = null) {
        if (!values.length) {
            return emptySummary(metric.label);
        }

        const first = values[0];
        const last = values[values.length - 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const delta = values.length >= 2 ? last - first : null;
        const status = qualidade?.nivel === "critica"
            ? "Leitura crítica"
            : qualidade && !["adequada", "sem_dados"].includes(qualidade.nivel)
                ? qualidade.rotulo
                : getMetricStatus(metric, last);
        const detalhes = [
            { label: "Mín", value: formatValue(min, metric.unit) },
            { label: "Máx", value: formatValue(max, metric.unit) },
            { label: "Delta", value: Number.isFinite(delta) ? formatDelta(delta, metric.unit) : "--" },
        ];
        if (qualidade?.leiturasEsperadas > 0) {
            detalhes.push({
                label: "Cobertura",
                value: `${qualidade.leiturasValidas}/${qualidade.leiturasEsperadas}`,
            });
        }

        return {
            label: metric.label,
            current: formatValue(last, metric.unit),
            min: formatValue(min, metric.unit),
            max: formatValue(max, metric.unit),
            delta: Number.isFinite(delta) ? formatDelta(delta, metric.unit) : "--",
            details: detalhes,
            status,
            qualidade: window.ClimateDataQuality?.resumirParaExportacao?.(qualidade) || null,
        };
    }

    function buildSolarSummary(chart) {
        const times = chart?.$solarDayTimes;
        if (!times) return emptySummary("Ciclo solar");

        const dayLength = times.sunset - times.sunrise;
        return {
            label: "Ciclo solar",
            current: `Zênite ${ClimateData.formatTime(times.zenith)}`,
            min: `Nascer ${ClimateData.formatTime(times.sunrise)}`,
            max: `Pôr ${ClimateData.formatTime(times.sunset)}`,
            delta: `${dayLength.toFixed(2)}h`,
            details: [
                { label: "Nascer", value: ClimateData.formatTime(times.sunrise) },
                { label: "Pôr", value: ClimateData.formatTime(times.sunset) },
                { label: "Duração", value: `${dayLength.toFixed(2)}h` },
            ],
            status: "Estável",
        };
    }

    function emptySummary(label) {
        return {
            label,
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

    function obterUltimoRegistroEstacao(data, campo) {
        let ultimo = null;

        for (const dataFirebase of Object.keys(data || {})) {
            const dadosData = data[dataFirebase];
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

    function formatarTimestampEstacao(timestamp) {
        if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) return "--";
        const dia = String(timestamp.getDate()).padStart(2, "0");
        const mes = String(timestamp.getMonth() + 1).padStart(2, "0");
        const hora = String(timestamp.getHours()).padStart(2, "0");
        const minuto = String(timestamp.getMinutes()).padStart(2, "0");
        return `${dia}/${mes} ${hora}:${minuto}`;
    }

    function formatarDataCompletaEstacao(data) {
        if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "--";
        const dia = String(data.getDate()).padStart(2, "0");
        const mes = String(data.getMonth() + 1).padStart(2, "0");
        return `${dia}/${mes}/${data.getFullYear()}`;
    }

    function extractReportRows(data, metrics, fields, qualidades = {}) {
        const rows = [];
        const firebaseDates = Object.keys(data || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b));

        for (const firebaseDate of firebaseDates) {
            const dateData = data[firebaseDate];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData).sort()) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;
                const [hour, minute = "0"] = time.split("-");

                for (const itemKey of Object.keys(timeData).sort()) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;

                    metrics.forEach((metric, metricIndex) => {
                        const fieldName = fields[metric.key];
                        const rawValue = item[fieldName];
                        const numericValue = ClimateData.normalizeMeasurementValue(fieldName, rawValue);
                        const hasValue = numericValue !== null;
                        const qualidadeLeitura = window.ClimateDataQuality?.obterQualidadeLeitura?.(
                            qualidades[metric.key],
                            firebaseDate,
                            time,
                            itemKey
                        );
                        const statusQualidade = qualidadeLeitura?.nivel === "critica"
                            ? "Crítico"
                            : qualidadeLeitura?.nivel === "suspeita" ? "Suspeito" : null;
                        rows.push({
                            time: metricIndex === 0 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "",
                            fullTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
                            metricKey: metric.key,
                            label: metric.label,
                            numericValue: hasValue ? numericValue : null,
                            value: hasValue ? formatValue(numericValue, metric.unit) : "--",
                            status: hasValue ? (statusQualidade || getMetricStatus(metric, numericValue)) : "Sem dados",
                            qualidade: qualidadeLeitura || null,
                        });
                    });
                }
            }
        }

        return rows;
    }

    modules.data = {
        construirFonteDadosRelatorio,
        construirLinhasNormalizadas,
        getFields,
        getPdfTableMetrics,
        getAllReportMetrics,
        buildCompactTableRows,
        buildDailyAlerts,
        buildSummaryCards,
        buildStationSummaryCards,
        buildStationSeasonCard,
        buildStationMoonCard,
        buildStationAqiCard,
        buildStationLatestCard,
        buildMetricSummary,
        buildSolarSummary,
        emptySummary,
        extractReportRows,
    };
})();
