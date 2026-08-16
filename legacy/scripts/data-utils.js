'use strict';

(function () {
    const HEADER_LABELS = {
        temperaturaDS18B20: "Temperatura",
        Aceton: "Acetona",
        Alcohol: "Álcool",
        NH4: "Amônia",
        Toluen: "Tolueno"
    };

    function getMeasurementUnit(key) {
        return window.AppConfig?.measurementUnits?.[key] || "";
    }

    function normalizeMeasurementValue(key, value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return null;

        if (key === "TDS") return numericValue / 10;
        if (key === "Turbidez") return numericValue / 1000;
        return numericValue;
    }

    function formatTableValue(key, value) {
        const numericValue = normalizeMeasurementValue(key, value);
        if (numericValue === null) return "--";

        const unit = getMeasurementUnit(key);
        return unit ? `${numericValue.toFixed(2)}${unit}` : numericValue.toFixed(2);
    }

    function dataAtual() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
    }

    function parseFirebaseDate(str) {
        const [d, m, y] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    function filterDataByDays(data, days, selectedDate, useSelectedDate = true) {
        if (useSelectedDate && selectedDate) {
            const selectedData = data[selectedDate];

            if (!selectedData) return {};

            return {
                [selectedDate]: selectedData
            };
        }

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        cutoff.setHours(0, 0, 0, 0);

        const filtered = {};

        for (const date of Object.keys(data).sort((a, b) => parseFirebaseDate(a) - parseFirebaseDate(b))) {
            if (parseFirebaseDate(date) >= cutoff) {
                filtered[date] = data[date];
            }
        }

        return filtered;
    }

    function filterDataByRollingHours(data, selectedDate, hours = 24, referenceDate = new Date()) {
        const selectedDateParts = parseFirebaseDateParts(selectedDate || dataAtual());
        if (!selectedDateParts) return {};

        const windowEnd = new Date(
            selectedDateParts.year,
            selectedDateParts.month - 1,
            selectedDateParts.day,
            referenceDate.getHours(),
            referenceDate.getMinutes(),
            referenceDate.getSeconds(),
            referenceDate.getMilliseconds()
        );
        const windowStart = new Date(windowEnd);
        windowStart.setHours(windowStart.getHours() - hours);

        const filtered = {};

        for (const date of Object.keys(data || {}).sort((a, b) => parseFirebaseDate(a) - parseFirebaseDate(b))) {
            const dateData = data[date];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData).sort()) {
                const timestamp = parseFirebaseDateTime(date, time);
                if (!timestamp || timestamp < windowStart || timestamp > windowEnd) continue;

                filtered[date] ||= {};
                filtered[date][time] = dateData[time];
            }
        }

        return filtered;
    }

    function parseFirebaseDateTime(date, time) {
        const dateParts = parseFirebaseDateParts(date);
        if (!dateParts) return null;

        const [hourText, minuteText = "0"] = String(time || "").split("-");
        const hour = Number(hourText);
        const minute = Number(minuteText);
        if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

        return new Date(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute, 0, 0);
    }

    function parseFirebaseDateParts(date) {
        const [day, month, year] = String(date || "").split("-").map(Number);
        if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null;
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        return { day, month, year };
    }

    function convertInputDateToFirebase(dateString) {
        if (!dateString) return dataAtual();

        const [year, month, day] = dateString.split("-");

        return `${day}-${month}-${year}`;
    }

    function convertFirebaseDateToInput(dateString) {
        const [day, month, year] = dateString.split("-");

        return `${year}-${month}-${day}`;
    }

    function createTables(headers, data) {
        const table = document.createElement("table");

        const headerRow = table.insertRow();
        headers.forEach(key => {
            const th = document.createElement("th");
            th.innerText = HEADER_LABELS[key] || key;
            headerRow.appendChild(th);
        });

        const allDates = Object.keys(data).sort((a, b) => parseFirebaseDate(b) - parseFirebaseDate(a));

        let lastDate = null;
        let rowCount = 0;

        for (const date of allDates) {
            if (rowCount >= 24) break;
            const dateData = data[date];
            if (!dateData || typeof dateData !== "object") continue;
            const allTimes = Object.keys(dateData).sort().reverse();

            for (const time of allTimes) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;
                for (const key in timeData) {
                    if (rowCount >= 24) break;
                    const item = timeData[key];
                    if (!item || typeof item !== "object") continue;
                    const row = table.insertRow();

                    row.insertCell().innerText = date !== lastDate ? date.replace(/-/g, "/") : "";
                    const [hour, minute] = time.split("-");
                    row.insertCell().innerText = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

                    for (let i = 2; i < headers.length; i++) {
                        const val = item[headers[i]];
                        row.insertCell().innerText = formatTableValue(headers[i], val);
                    }

                    rowCount++;
                    lastDate = date;
                }
            }
        }

        return table;
    }

    function extractData(data, keys) {
        const allDates = Object.keys(data || {});
        const hours = [];
        const extractedData = Object.fromEntries(keys.map(k => [k, []]));

        for (const date of allDates.sort((a, b) => parseFirebaseDate(a) - parseFirebaseDate(b))) {
            const dateData = data[date];
            if (!dateData || typeof dateData !== "object") continue;
            const allTimes = Object.keys(dateData).sort();
            for (const time of allTimes) {
                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;
                const [hourPart, minutePart = "0"] = time.split("-");
                const hour = Number(hourPart);
                const minute = Number(minutePart);
                const decimalHour = hour + (Number.isFinite(minute) ? minute / 60 : 0);
                for (const itemKey in timeData) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;
                    hours.push(decimalHour);
                    keys.forEach(dataKey => {
                        extractedData[dataKey].push(normalizeMeasurementValue(dataKey, item[dataKey]));
                    });
                }
            }
        }

        return { hours, ...extractedData };
    }

    function mapRange(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    }

    function formatTime(value) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return "--";

        const totalMinutes = Math.round(numericValue * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = ((totalMinutes % 60) + 60) % 60;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }

    function formatHoursArray(hours) {
        return hours.map(h => formatTime(h));
    }

    function secondsToHours(seconds) {
        return seconds / 3600;
    }

    window.ClimateData = {
        dataAtual,
        parseFirebaseDate,
        filterDataByDays,
        filterDataByRollingHours,
        convertInputDateToFirebase,
        convertFirebaseDateToInput,
        createTables,
        extractData,
        normalizeMeasurementValue,
        mapRange,
        formatTime,
        formatHoursArray,
        secondsToHours,
    };
})();
