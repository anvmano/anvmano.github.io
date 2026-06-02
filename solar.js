'use strict';

(function () {
    function getNumberValue(item, names) {
        for (const name of names) {
            const value = Number(item[name]);
            if (Number.isFinite(value)) return value;
        }
        return null;
    }

    function readTimeSeconds(item, hourNames, minuteNames) {
        const hour = getNumberValue(item, hourNames);
        const minute = getNumberValue(item, minuteNames) || 0;
        if (hour == null) return null;
        return hour * 3600 + minute * 60;
    }

    function hasSolarFields(item) {
        return item &&
            typeof item === "object" &&
            (
                item.HourNascerDoSol != null ||
                item.HoraNascerDoSol != null ||
                item.HoraAmanhecer != null ||
                item.HourAmanhecer != null
            );
    }

    function readSolarEventSeconds(item) {
        if (!item) return null;

        const dawn = readTimeSeconds(item, ["HoraAmanhecer", "HourAmanhecer"], ["MinuteAmanhecer", "MinutoAmanhecer"]);
        const sunrise = readTimeSeconds(item, ["HourNascerDoSol", "HoraNascerDoSol"], ["MinuteNascerDoSol", "MinutoNascerDoSol"]);
        const sunset = readTimeSeconds(item, ["HoraPorDoSol", "HourPorDoSol"], ["MinutePorDoSol", "MinutoPorDoSol"]);
        const dusk = readTimeSeconds(item, ["HourAnoitecer", "HoraAnoitecer"], ["MinuteAnoitecer", "MinutoAnoitecer"]);
        const zenithFromData = readTimeSeconds(
            item,
            ["HoraZenite", "HourZenith", "HoraZenith", "HourZenite", "HoraZênite"],
            ["MinuteZenite", "MinutoZenite", "MinuteZenith", "MinutoZenith", "MinutoZênite"]
        );

        if ([dawn, sunrise, sunset, dusk].some(value => value == null)) return null;

        return {
            dawn,
            sunrise,
            zenith: zenithFromData != null ? zenithFromData : sunrise + ((sunset - sunrise) / 2),
            sunset,
            dusk,
        };
    }

    function getFirstItemForDate(data, date) {
        const dateData = data[date];
        if (!dateData || typeof dateData !== "object") return null;
        for (const key of Object.keys(dateData).sort().reverse()) {
            const item = dateData[key];
            if (!item || typeof item !== "object") continue;
            if (hasSolarFields(item)) {
                return item;
            }
            for (const nestedKey of Object.keys(item).sort().reverse()) {
                const nestedItem = item[nestedKey];
                if (hasSolarFields(nestedItem)) return nestedItem;
            }
        }
        return null;
    }

    function getSolarEventsForSelectedDate(data, selectedDate) {
        const item = selectedDate ? getFirstItemForDate(data, selectedDate) : null;
        const eventSeconds = readSolarEventSeconds(item);
        if (!eventSeconds) return null;

        return {
            date: selectedDate,
            dawn: ClimateData.secondsToHours(eventSeconds.dawn),
            sunrise: ClimateData.secondsToHours(eventSeconds.sunrise),
            zenith: ClimateData.secondsToHours(eventSeconds.zenith),
            sunset: ClimateData.secondsToHours(eventSeconds.sunset),
            dusk: ClimateData.secondsToHours(eventSeconds.dusk)
        };
    }

    function getSunriseSunsetData(data) {
        const dates = [], sunriseTimes = [], sunsetTimes = [], amanhecerTimes = [], anoitecerTimes = [];

        for (const date of Object.keys(data).sort((a,b) => ClimateData.parseFirebaseDate(a)-ClimateData.parseFirebaseDate(b))) {
            const item = getFirstItemForDate(data, date);
            const eventSeconds = readSolarEventSeconds(item);
            if (!eventSeconds) continue;

            dates.push(date);
            sunriseTimes.push(eventSeconds.sunrise);
            sunsetTimes.push(eventSeconds.sunset);
            amanhecerTimes.push(eventSeconds.dawn);
            anoitecerTimes.push(eventSeconds.dusk);
        }
        return { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes };
    }

    function tooltipLabel(context) {
        return `${context.dataset.label || ""}: ${ClimateData.formatTime(context.raw)}`;
    }

    function getSunHistoryOptions({ legend = true, tickSize = 11, labelSize = 11, defaults, colors } = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            hover: {
                mode: 'nearest',
                intersect: false
            },
            plugins: {
                legend: {
                    display: legend,
                    position: 'top',
                    labels: { color: colors.text, font: { size: labelSize }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    ...defaults.plugins.tooltip,
                    callbacks: { label: tooltipLabel }
                }
            },
            scales: {
                x: {
                    grid:  { color: colors.grid, drawBorder: false },
                    ticks: { color: colors.text, font: { size: tickSize }, maxRotation: 45 }
                },
                yLeft: {
                    type: "linear", position: "right",
                    min: 4, max: 7,
                    grid: { color: colors.grid, drawBorder: false },
                    ticks: { callback: ClimateData.formatTime, color: colors.text, font: { size: tickSize } }
                },
                yRight: {
                    type: "linear", position: "left",
                    min: 17, max: 21,
                    grid: { drawOnChartArea: false },
                    ticks: { callback: ClimateData.formatTime, color: colors.text, font: { size: tickSize } }
                }
            }
        };
    }

    function createSunriseSunsetChart({ data, ctx, existingChart, defaults, colors, onEmpty }) {
        const { dates, sunriseTimes, sunsetTimes, amanhecerTimes, anoitecerTimes } = getSunriseSunsetData(data);
        const formattedDates = dates.map(d => d.replace(/-/g, "/"));
        const remap = (arr, i1, i2, o1, o2) => arr.map(t => ClimateData.mapRange(t, i1, i2, o1, o2));

        if (existingChart) existingChart.destroy();

        if (!dates.length) {
            if (onEmpty) onEmpty();
            return null;
        }

        return new Chart(ctx, {
            type: "line",
            data: {
                labels: formattedDates,
                datasets: [
                    { label: "Amanhecer",     yAxisID: "yLeft",  data: remap(amanhecerTimes,14400,25200,4,7),  borderColor: "#fde68a", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 1 },
                    { label: "Nascer do sol", yAxisID: "yLeft",  data: remap(sunriseTimes,  14400,25200,4,7),  borderColor: "#fb923c", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 2 },
                    { label: "Pôr do sol",    yAxisID: "yRight", data: remap(sunsetTimes,   61200,75600,17,21), borderColor: "#f87171", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 3 },
                    { label: "Anoitecer",     yAxisID: "yRight", data: remap(anoitecerTimes,61200,75600,17,21), borderColor: "#818cf8", backgroundColor: "transparent", tension: 0.4, borderWidth: 2, pointRadius: 0, pointHitRadius: 18, pointHoverRadius: 6, order: 4 }
                ]
            },
            options: getSunHistoryOptions({ defaults, colors })
        });
    }

    const solarDayBackgroundPlugin = {
        id: "solarDayBackground",
        beforeDatasetsDraw(chart) {
            const times = chart.$solarDayTimes;
            const xScale = chart.scales.x;
            const area = chart.chartArea;
            if (!times || !xScale || !area) return;

            const ctx = chart.ctx;
            const dawnX = xScale.getPixelForValue(times.dawn);
            const sunriseX = xScale.getPixelForValue(times.sunrise);
            const zenithX = xScale.getPixelForValue(times.zenith);
            const sunsetX = xScale.getPixelForValue(times.sunset);
            const duskX = xScale.getPixelForValue(times.dusk);

            ctx.save();
            ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
            ctx.fillRect(area.left, area.top, Math.max(0, dawnX - area.left), area.bottom - area.top);
            ctx.fillRect(duskX, area.top, Math.max(0, area.right - duskX), area.bottom - area.top);

            const twilight = ctx.createLinearGradient(dawnX, 0, sunriseX, 0);
            twilight.addColorStop(0, "rgba(148, 163, 184, 0.24)");
            twilight.addColorStop(1, "rgba(251, 191, 36, 0.22)");
            ctx.fillStyle = twilight;
            ctx.fillRect(dawnX, area.top, Math.max(0, sunriseX - dawnX), area.bottom - area.top);

            const daylight = ctx.createLinearGradient(sunriseX, 0, sunsetX, 0);
            daylight.addColorStop(0, "rgba(251, 191, 36, 0.20)");
            daylight.addColorStop(0.5, "rgba(254, 240, 138, 0.38)");
            daylight.addColorStop(1, "rgba(251, 191, 36, 0.20)");
            ctx.fillStyle = daylight;
            ctx.fillRect(sunriseX, area.top, Math.max(0, sunsetX - sunriseX), area.bottom - area.top);

            const evening = ctx.createLinearGradient(sunsetX, 0, duskX, 0);
            evening.addColorStop(0, "rgba(251, 146, 60, 0.24)");
            evening.addColorStop(1, "rgba(129, 140, 248, 0.18)");
            ctx.fillStyle = evening;
            ctx.fillRect(sunsetX, area.top, Math.max(0, duskX - sunsetX), area.bottom - area.top);

            ctx.strokeStyle = "rgba(251, 191, 36, 0.35)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(zenithX, area.top);
            ctx.lineTo(zenithX, area.bottom);
            ctx.stroke();
            ctx.restore();
        }
    };

    function getSolarTodayOptions({ tickSize = 11, labelSize = 11, defaults, colors } = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600 },
            interaction: {
                mode: "nearest",
                intersect: false,
                axis: "x"
            },
            hover: {
                mode: "nearest",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: "top",
                    labels: { color: colors.text, font: { size: labelSize }, boxWidth: 12, padding: 16 }
                },
                tooltip: {
                    ...defaults.plugins.tooltip,
                    filter: context => context.dataset.label === "Eventos solares",
                    callbacks: {
                        title: items => items[0]?.raw?.label || "",
                        label: context => {
                            const raw = context.raw;
                            return raw && raw.timeLabel ? raw.timeLabel : ClimateData.formatTime(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    min: 0,
                    max: 24,
                    grid: { color: "rgba(99,132,200,0.13)", drawBorder: false },
                    ticks: {
                        stepSize: 2,
                        color: colors.text,
                        font: { size: tickSize },
                        callback: value => `${value}h`
                    }
                },
                y: {
                    min: 0,
                    max: 1.12,
                    grid: { color: "rgba(99,132,200,0.10)", drawBorder: false },
                    ticks: { display: false }
                }
            }
        };
    }

    function createSolarTodayChart({ data, selectedDate, ctx, existingChart, defaults, colors, onEmpty }) {
        const events = getSolarEventsForSelectedDate(data, selectedDate);
        if (existingChart) existingChart.destroy();

        if (!events) {
            if (onEmpty) onEmpty();
            return null;
        }

        const daylightPoints = [
            { x: 0, y: 0 },
            { x: events.dawn, y: 0.08, label: "Amanhecer", timeLabel: ClimateData.formatTime(events.dawn) },
            { x: events.sunrise, y: 0.52, label: "Nascer do sol", timeLabel: ClimateData.formatTime(events.sunrise) },
            { x: events.zenith, y: 1, label: "Zenite", timeLabel: ClimateData.formatTime(events.zenith) },
            { x: events.sunset, y: 0.52, label: "Pôr do sol", timeLabel: ClimateData.formatTime(events.sunset) },
            { x: events.dusk, y: 0.08, label: "Anoitecer", timeLabel: ClimateData.formatTime(events.dusk) },
            { x: 24, y: 0 }
        ];
        const eventPoints = [
            daylightPoints[1],
            daylightPoints[2],
            daylightPoints[3],
            daylightPoints[4],
            daylightPoints[5]
        ];

        const chart = new Chart(ctx, {
            type: "line",
            data: {
                datasets: [
                    {
                        label: "Luz do dia",
                        data: daylightPoints,
                        borderColor: "#facc15",
                        backgroundColor: "rgba(250, 204, 21, 0.22)",
                        fill: true,
                        tension: 0.42,
                        pointRadius: 0,
                        pointHitRadius: 18,
                        pointHoverRadius: 0,
                        order: 2
                    },
                    {
                        type: "scatter",
                        label: "Eventos solares",
                        data: eventPoints,
                        borderColor: "#f8fafc",
                        backgroundColor: ["#fde68a", "#fb923c", "#facc15", "#f87171", "#818cf8"],
                        pointBorderColor: "#0b1120",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHitRadius: 18,
                        pointHoverRadius: 7,
                        order: 1
                    }
                ]
            },
            options: getSolarTodayOptions({ defaults, colors }),
            plugins: [solarDayBackgroundPlugin]
        });

        chart.$solarDayTimes = events;
        return chart;
    }

    window.ClimateSolar = {
        createSunriseSunsetChart,
        createSolarTodayChart,
        getSunHistoryOptions,
        getSolarTodayOptions,
        solarDayBackgroundPlugin,
    };
})();
