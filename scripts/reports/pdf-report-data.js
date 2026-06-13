'use strict';

(function () {
    const modules = window.ClimatePdfReportModules = window.ClimatePdfReportModules || {};

    const { format } = modules;
    const { formatValue, formatDelta, getMetricStatus } = format;

    function getFields(tabConfig) {
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

    function buildSummaryCards(tabConfig, rows, chartInstances) {
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
            status: "Sem dados",
        };
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
        buildMetricSummary,
        buildSolarSummary,
        emptySummary,
        extractReportRows,
    };
})();
