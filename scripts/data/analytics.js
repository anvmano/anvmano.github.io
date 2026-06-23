'use strict';

(function () {
    const STATS_CONFIG = {
        quarto: {
            containerId: "statsQuarto",
            metrics: [
                { key: "Temperatura", label: "Temperatura", suffix: "°C" },
                { key: "Sensacao termica", label: "Sensação", suffix: "°C" },
                { key: "Umidade", label: "Umidade", suffix: "%" },
            ],
        },
        sala: {
            containerId: "statsSala",
            metrics: [
                { key: "temperatura", label: "Temperatura", suffix: "°C" },
                { key: "sensacaoTermica", label: "Sensação", suffix: "°C" },
                { key: "umidade", label: "Umidade", suffix: "%" },
                { key: "pressao", label: "Pressão", suffix: " hPa" },
            ],
        },
        aquario: {
            containerId: "statsAquario",
            metrics: [
                { key: "temperaturaDS18B20", label: "Temperatura", suffix: "°C" },
                { key: "PH", label: "PH", suffix: "" },
                { key: "TDS", label: "TDS", suffix: "ppm" },
                { key: "Turbidez", label: "Turbidez", suffix: "NTU" },
            ],
        },
    };

    function renderStats(type, data, selectedDate) {
        const config = STATS_CONFIG[type];
        if (!config) return;

        const el = document.getElementById(config.containerId);
        if (!el) return;

        el.innerHTML = "";
        const hasAnyData = Object.keys(data || {}).length > 0;
        if (!hasAnyData) {
            const message = document.createElement("p");
            message.className = "state-message";
            message.innerText = `Sem resumo disponível para ${formatFirebaseDate(selectedDate)}.`;
            el.appendChild(message);
            return;
        }

        config.metrics.forEach(metric => {
            const values = extractMetricValues(data, metric.key);
            const stats = calculateStats(values);
            el.appendChild(createStatsCard(metric, stats));
        });
    }

    function extractMetricValues(data, metricKey) {
        const values = [];

        for (const date of Object.keys(data || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b))) {
            const dateData = data[date];
            if (!dateData || typeof dateData !== "object") continue;

            const times = Object.keys(dateData).sort();
            for (const time of times) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;

                for (const itemKey of Object.keys(timeData).sort()) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;

                    const value = ClimateData.normalizeMeasurementValue(metricKey, item[metricKey]);
                    if (value !== null) values.push(value);
                }
            }
        }

        return values;
    }

    function calculateStats(values) {
        if (!values.length) return null;

        const first = values[0];
        const last = values[values.length - 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
        const delta = last - first;

        return {
            avg,
            min,
            max,
            delta,
            trend: getTrend(delta),
        };
    }

    function getTrend(delta) {
        if (Math.abs(delta) < 0.05) {
            return { label: "Estável", className: "stable", symbol: "→" };
        }
        if (delta > 0) {
            return { label: "Subindo", className: "up", symbol: "↗" };
        }
        return { label: "Caindo", className: "down", symbol: "↘" };
    }

    function createStatsCard(metric, stats) {
        const card = document.createElement("article");
        card.className = "stats-card";

        if (!stats) {
            card.innerHTML = `
                <div class="stats-card__header">
                    <span class="stats-card__label">${metric.label}</span>
                    <span class="stats-card__trend stats-card__trend--stable">--</span>
                </div>
                <strong class="stats-card__value">--</strong>
                <dl class="stats-card__details">
                    <div><dt>Mín</dt><dd>--</dd></div>
                    <div><dt>Máx</dt><dd>--</dd></div>
                    <div><dt>Delta</dt><dd>--</dd></div>
                </dl>
            `;
            return card;
        }

        card.innerHTML = `
            <div class="stats-card__header">
                <span class="stats-card__label">${metric.label}</span>
                <span class="stats-card__trend stats-card__trend--${stats.trend.className}">${stats.trend.symbol} ${stats.trend.label}</span>
            </div>
            <strong class="stats-card__value">${formatStat(stats.avg, metric.suffix)}</strong>
            <dl class="stats-card__details">
                <div><dt>Mín</dt><dd>${formatStat(stats.min, metric.suffix)}</dd></div>
                <div><dt>Máx</dt><dd>${formatStat(stats.max, metric.suffix)}</dd></div>
                <div><dt>Delta</dt><dd>${formatDelta(stats.delta, metric.suffix)}</dd></div>
            </dl>
        `;
        return card;
    }

    const DEFAULT_ADVANCED_CONTAINERS = {
        monthlyCalendar: "monthlyClimateCalendar",
        hourlyHeatmap: "hourlyHeatmap",
        weeklyHeatmap: "weeklyHeatmap",
    };

    function renderAdvancedClimateViews(data, selectedDate, options = {}) {
        const dateParts = parseSelectedDate(selectedDate);
        if (!dateParts) return;

        const metricKey = options.metricKey || "Temperatura";
        const containers = {
            ...DEFAULT_ADVANCED_CONTAINERS,
            ...(options.containers || {}),
        };

        if (visualizacoesEstaoRecolhidas(containers)) return;

        const normalizedDate = dateParts.firebaseDate;
        const monthRecords = extractClimateRecordsForSelectedMonth(data, metricKey, normalizedDate);
        const dayRecords = monthRecords.filter(record => record.firebaseDate === normalizedDate);

        try {
            renderMonthlyClimateCalendar(monthRecords, normalizedDate, containers.monthlyCalendar);
            renderHourlyHeatmap(dayRecords, normalizedDate, containers.hourlyHeatmap);
            renderWeeklyHeatmap(monthRecords, normalizedDate, containers.weeklyHeatmap);
        } catch (error) {
            window.ClimateDiagnostics?.depurar("Falha ao renderizar visualizações climáticas avançadas.", error);
        }
    }

    function visualizacoesEstaoRecolhidas(containers) {
        const ids = [containers.monthlyCalendar, containers.hourlyHeatmap, containers.weeklyHeatmap];
        const container = ids
            .map(id => document.getElementById(id))
            .find(Boolean);
        const section = container?.closest?.(".collapsible-section");
        return !!section?.classList.contains("is-collapsed");
    }

    function extractClimateRecordsForSelectedMonth(data, metricKey, selectedDate) {
        const dateParts = parseSelectedDate(selectedDate);
        if (!dateParts) return [];

        const selectedMonth = pad(dateParts.month);
        const selectedYear = String(dateParts.year);
        const records = [];

        for (const firebaseDate of Object.keys(data || {})) {
            const [day, month, year] = firebaseDate.split("-");
            if (month !== selectedMonth || year !== selectedYear) continue;

            const dateData = data[firebaseDate];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData).sort()) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;

                const [hourPart, minutePart = "0"] = time.split("-");
                const hour = Number(hourPart);
                const minute = Number(minutePart);
                if (!Number.isFinite(hour)) continue;

                for (const itemKey of Object.keys(timeData).sort()) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;

                    const value = ClimateData.normalizeMeasurementValue(metricKey, item[metricKey]);
                    if (value === null) continue;

                    records.push({
                        firebaseDate,
                        day: Number(day),
                        month: Number(month),
                        year: Number(year),
                        hour,
                        minute: Number.isFinite(minute) ? minute : 0,
                        value,
                    });
                }
            }
        }

        return records;
    }

    function renderMonthlyClimateCalendar(records, selectedDate, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = "";

        const dateParts = parseSelectedDate(selectedDate);
        if (!dateParts) return;

        const { day: selectedDay, month: selectedMonth, year: selectedYear } = dateParts;
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const firstWeekday = new Date(selectedYear, selectedMonth - 1, 1).getDay();
        const valuesByDay = groupAverage(records, record => record.day);
        const scale = getValueScale(Object.values(valuesByDay));

        addWeekdayHeaders(el);

        for (let i = 0; i < firstWeekday; i++) {
            const empty = document.createElement("span");
            empty.className = "heatmap-cell heatmap-cell--empty";
            el.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const value = valuesByDay[day];
            const cell = document.createElement("span");
            cell.className = "heatmap-cell calendar-heatmap__day";
            if (day === selectedDay) cell.classList.add("is-selected");
            cell.style.backgroundColor = getHeatColor(value, scale);
            cell.innerHTML = `<span>${day}</span><strong>${formatHeatValue(value)}</strong>`;
            cell.title = value == null ? `${pad(day)}/${pad(selectedMonth)} sem dados` : `${pad(day)}/${pad(selectedMonth)} média ${value.toFixed(1)}°C`;
            el.appendChild(cell);
        }
    }

    function renderHourlyHeatmap(records, selectedDate, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = "";
        const valuesByHour = groupAverage(records, record => record.hour);
        const scale = getValueScale(Object.values(valuesByHour));
        const today = new Date();
        const shouldHighlightCurrentHour = parseSelectedDate(selectedDate)?.firebaseDate === ClimateData.dataAtual();
        const currentHour = today.getHours();

        for (let hour = 0; hour < 24; hour++) {
            const value = valuesByHour[hour];
            const cell = document.createElement("span");
            cell.className = "heatmap-cell hourly-heatmap__cell";
            if (shouldHighlightCurrentHour && hour === currentHour) cell.classList.add("is-selected");
            cell.style.backgroundColor = getHeatColor(value, scale);
            cell.innerHTML = `<span>${pad(hour)}h</span><strong>${formatHeatValue(value)}</strong>`;
            cell.title = value == null ? `${pad(hour)}h sem dados` : `${pad(hour)}h média ${value.toFixed(1)}°C`;
            el.appendChild(cell);
        }
    }

    function renderWeeklyHeatmap(records, selectedDate, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = "";
        const dateParts = parseSelectedDate(selectedDate);
        if (!dateParts) return;

        const weekRecords = filterRecordsFromWeekStart(records, dateParts);
        const values = {};
        weekRecords.forEach(record => {
            const weekday = new Date(record.year, record.month - 1, record.day).getDay();
            const key = `${weekday}-${record.hour}`;
            if (!values[key]) values[key] = [];
            values[key].push(record.value);
        });

        const averaged = Object.fromEntries(
            Object.entries(values).map(([key, valuesForKey]) => [key, average(valuesForKey)])
        );
        const scale = getValueScale(Object.values(averaged));
        const weekLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        const today = new Date();
        const shouldHighlightCurrentSlot = dateParts.firebaseDate === ClimateData.dataAtual();
        const currentWeekday = today.getDay();
        const currentHour = today.getHours();

        const corner = document.createElement("span");
        corner.className = "weekly-heatmap__axis weekly-heatmap__axis--corner";
        el.appendChild(corner);

        for (let hour = 0; hour < 24; hour++) {
            const label = document.createElement("span");
            label.className = "weekly-heatmap__axis";
            label.textContent = `${hour}h`;
            el.appendChild(label);
        }

        for (let weekday = 0; weekday < 7; weekday++) {
            const rowLabel = document.createElement("span");
            rowLabel.className = "weekly-heatmap__axis weekly-heatmap__day";
            rowLabel.textContent = weekLabels[weekday];
            el.appendChild(rowLabel);

            for (let hour = 0; hour < 24; hour++) {
                const value = averaged[`${weekday}-${hour}`];
                const cell = document.createElement("span");
                cell.className = "heatmap-cell weekly-heatmap__cell";
                if (shouldHighlightCurrentSlot && weekday === currentWeekday && hour === currentHour) {
                    cell.classList.add("is-selected");
                }
                cell.style.backgroundColor = getHeatColor(value, scale);
                cell.title = value == null ? `${weekLabels[weekday]} ${hour}h sem dados` : `${weekLabels[weekday]} ${hour}h média ${value.toFixed(1)}°C`;
                el.appendChild(cell);
            }
        }
    }

    function filterRecordsFromWeekStart(records, dateParts) {
        const weekStart = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const selectedDateEnd = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
        selectedDateEnd.setHours(23, 59, 59, 999);

        return records.filter(record => {
            const recordDate = new Date(record.year, record.month - 1, record.day);
            recordDate.setHours(12, 0, 0, 0);
            return recordDate >= weekStart && recordDate <= selectedDateEnd;
        });
    }

    function parseSelectedDate(value) {
        const text = String(value || "").trim();
        let match = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (match) return buildDateParts(match[1], match[2], match[3]);

        match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (match) return buildDateParts(match[1], match[2], match[3]);

        match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) return buildDateParts(match[3], match[2], match[1]);

        return null;
    }

    function buildDateParts(dayText, monthText, yearText) {
        const day = Number(dayText);
        const month = Number(monthText);
        const year = Number(yearText);
        if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;

        return {
            day,
            month,
            year,
            firebaseDate: `${pad(day)}-${pad(month)}-${year}`,
        };
    }

    function addWeekdayHeaders(el) {
        ["D", "S", "T", "Q", "Q", "S", "S"].forEach(label => {
            const header = document.createElement("span");
            header.className = "calendar-heatmap__weekday";
            header.textContent = label;
            el.appendChild(header);
        });
    }

    function groupAverage(records, keyFn) {
        const grouped = {};
        records.forEach(record => {
            const key = keyFn(record);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(record.value);
        });

        return Object.fromEntries(
            Object.entries(grouped).map(([key, values]) => [key, average(values)])
        );
    }

    function average(values) {
        return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    function getValueScale(values) {
        const validValues = values.filter(Number.isFinite);
        if (!validValues.length) return { min: 20, max: 30 };
        const min = Math.min(...validValues);
        const max = Math.max(...validValues);
        return min === max ? { min: min - 1, max: max + 1 } : { min, max };
    }

    function getHeatColor(value, scale) {
        if (!Number.isFinite(value)) return "rgba(71, 85, 105, 0.18)";

        const ratio = Math.min(1, Math.max(0, (value - scale.min) / (scale.max - scale.min)));
        if (ratio < 0.5) {
            const local = ratio / 0.5;
            return interpolateColor([56, 189, 248], [52, 211, 153], local);
        }

        const local = (ratio - 0.5) / 0.5;
        return interpolateColor([52, 211, 153], [251, 113, 133], local);
    }

    function interpolateColor(from, to, ratio) {
        const color = from.map((start, index) => Math.round(start + (to[index] - start) * ratio));
        return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.72)`;
    }

    function formatStat(value, suffix) {
        return `${value.toFixed(2)}${suffix}`;
    }

    function formatDelta(value, suffix) {
        const sign = value > 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}${suffix}`;
    }

    function formatFirebaseDate(date) {
        return date ? date.replace(/-/g, "/") : "--";
    }

    function formatHeatValue(value) {
        return Number.isFinite(value) ? `${value.toFixed(1)}°` : "--";
    }

    function pad(value) {
        return String(value).padStart(2, "0");
    }

    window.ClimateAnalytics = {
        renderStats,
        renderAdvancedClimateViews,
    };
})();
