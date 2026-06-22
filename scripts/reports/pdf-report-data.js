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

    function buildCompactTableRows(rows, metrics) {
        const grouped = new Map();
        rows.forEach(row => {
            if (!row.fullTime || !metrics.some(metric => metric.key === row.metricKey)) return;

            if (!grouped.has(row.fullTime)) {
                grouped.set(row.fullTime, {
                    time: row.fullTime,
                    values: {},
                    statuses: [],
                });
            }

            const group = grouped.get(row.fullTime);
            group.values[row.metricKey] = row.value;
            group.statuses.push(row.status);
        });

        return Array.from(grouped.values())
            .sort((a, b) => a.time.localeCompare(b.time))
            .map(group => ({
                time: group.time,
                values: group.values,
                status: group.statuses.includes("Alerta") ? "Alerta" : "Estável",
            }));
    }

    function buildDailyAlerts(rows, metrics) {
        const alertMetrics = metrics.filter(metric => ["temperature", "feelsLike"].includes(metric.key));
        const alerts = [];

        alertMetrics.forEach(metric => {
            const alertRows = rows
                .filter(row => row.metricKey === metric.key && row.status === "Alerta" && row.fullTime)
                .sort((a, b) => a.fullTime.localeCompare(b.fullTime));

            if (!alertRows.length) return;

            const first = alertRows[0].fullTime;
            const last = alertRows[alertRows.length - 1].fullTime;
            alerts.push(`${metric.label} fora da faixa ideal entre ${first} e ${last}.`);
        });

        return alerts.slice(0, 4);
    }

    function buildSummaryCards(tabConfig, rows, chartInstances, latestData = {}, selectedDate = ClimateData.dataAtual()) {
        if (tabConfig.tableType === "station") {
            return buildStationSummaryCards(latestData, selectedDate);
        }

        const cards = tabConfig.metrics.map(metric => {
            const values = rows
                .filter(row => row.metricKey === metric.key && Number.isFinite(row.numericValue))
                .map(row => row.numericValue);
            return buildMetricSummary(metric, values);
        });

        if (tabConfig.includeSolar) {
            const solarChart = chartInstances[AppConfig.ids.charts.solarToday];
            cards.push(buildSolarSummary(solarChart));
        }

        return cards;
    }

    function buildStationSummaryCards(latestData, selectedDate) {
        const campos = AppConfig.fields;

        return [
            buildStationSeasonCard(),
            buildStationMoonCard(selectedDate),
            buildStationAqiCard(latestData.livingRoom),
            buildStationLatestCard("Temp. Sala", latestData.livingRoom, campos.livingRoom.temperature, "°C"),
            buildStationLatestCard("Temp. Quarto", latestData.room, campos.room.temperature, "°C"),
            buildStationLatestCard("Temp. Aquário", latestData.aquarium, campos.aquarium.temperature, "°C"),
            buildStationLatestCard("Umidade Sala", latestData.livingRoom, campos.livingRoom.humidity, "%"),
            buildStationLatestCard("Umidade Quarto", latestData.room, campos.room.humidity, "%"),
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

    function buildMetricSummary(metric, values) {
        if (!values.length) {
            return emptySummary(metric.label);
        }

        const first = values[0];
        const last = values[values.length - 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const delta = last - first;
        const status = getMetricStatus(metric, last);

        return {
            label: metric.label,
            current: formatValue(last, metric.unit),
            min: formatValue(min, metric.unit),
            max: formatValue(max, metric.unit),
            delta: formatDelta(delta, metric.unit),
            details: [
                { label: "Mín", value: formatValue(min, metric.unit) },
                { label: "Máx", value: formatValue(max, metric.unit) },
                { label: "Delta", value: formatDelta(delta, metric.unit) },
            ],
            status,
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

    function extractReportRows(data, metrics, fields) {
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
                        rows.push({
                            time: metricIndex === 0 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` : "",
                            fullTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
                            metricKey: metric.key,
                            label: metric.label,
                            numericValue: hasValue ? numericValue : null,
                            value: hasValue ? formatValue(numericValue, metric.unit) : "--",
                            status: hasValue ? getMetricStatus(metric, numericValue) : "Sem dados",
                        });
                    });
                }
            }
        }

        return rows;
    }

    modules.data = {
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
