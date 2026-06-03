'use strict';

(function () {
    const HEADER_LABELS = {
        temperaturaDS18B20: "Temperatura",
        Aceton: "Acetona",
        Alcohol: "Álcool",
        NH4: "Amônia"
    };

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
                        const numericValue = Number(val);
                        row.insertCell().innerText = Number.isFinite(numericValue) ? numericValue.toFixed(2) : "--";
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
                        const numericValue = Number(item[dataKey]);
                        extractedData[dataKey].push(Number.isFinite(numericValue) ? numericValue : null);
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
        const hours = Math.floor(value);
        const minutes = Math.floor((value - hours) * 60);
        return `${hours}:${String(minutes).padStart(2, "0")}`;
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
        convertInputDateToFirebase,
        convertFirebaseDateToInput,
        createTables,
        extractData,
        mapRange,
        formatTime,
        formatHoursArray,
        secondsToHours,
    };
})();
