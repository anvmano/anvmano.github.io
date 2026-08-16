'use strict';

(function () {
    const AQI_CATEGORIES = [
        { min: 0, max: 50, label: "Boa", className: "good", impact: "Ar satisfatório, risco mínimo." },
        { min: 51, max: 100, label: "Moderado", className: "moderate", impact: "Aceitável, mas pode haver risco moderado para grupos sensíveis." },
        { min: 101, max: 150, label: "Insalubre para grupos sensíveis", className: "sensitive", impact: "Grupos de risco podem apresentar sintomas." },
        { min: 151, max: 200, label: "Insalubre", className: "unhealthy", impact: "Toda a população pode começar a sentir efeitos na saúde." },
        { min: 201, max: 300, label: "Muito insalubre", className: "very-unhealthy", impact: "Alerta de saúde; riscos aumentados para todos." },
        { min: 301, max: 500, label: "Perigoso", className: "hazardous", impact: "Condições de emergência; toda a população é severamente afetada." },
    ];

    const POLLUTANTS = [
        {
            key: "CO",
            label: "CO",
            unit: "ppm",
            breakpoints: [
                [0, 4.4, 0, 50],
                [4.5, 9.4, 51, 100],
                [9.5, 12.4, 101, 150],
                [12.5, 15.4, 151, 200],
                [15.5, 30.4, 201, 300],
                [30.5, 50.4, 301, 500],
            ],
        },
        {
            key: "CO2",
            label: "CO2",
            unit: "ppm",
            breakpoints: [
                [0, 700, 0, 50],
                [701, 1000, 51, 100],
                [1001, 1500, 101, 150],
                [1501, 2000, 151, 200],
                [2001, 5000, 201, 300],
                [5001, 10000, 301, 500],
            ],
        },
        {
            key: "Toluen",
            label: "Tolueno",
            unit: "ppm",
            breakpoints: [
                [0, 1, 0, 50],
                [1.1, 5, 51, 100],
                [5.1, 10, 101, 150],
                [10.1, 25, 151, 200],
                [25.1, 50, 201, 300],
                [50.1, 100, 301, 500],
            ],
        },
        {
            key: "NH4",
            label: "Amônia",
            unit: "ppm",
            breakpoints: [
                [0, 1, 0, 50],
                [1.1, 5, 51, 100],
                [5.1, 10, 101, 150],
                [10.1, 25, 151, 200],
                [25.1, 50, 201, 300],
                [50.1, 100, 301, 500],
            ],
        },
        {
            key: "Aceton",
            label: "Acetona",
            unit: "ppm",
            breakpoints: [
                [0, 1, 0, 50],
                [1.1, 5, 51, 100],
                [5.1, 10, 101, 150],
                [10.1, 25, 151, 200],
                [25.1, 50, 201, 300],
                [50.1, 100, 301, 500],
            ],
        },
        {
            key: "Alcohol",
            label: "Álcool",
            unit: "ppm",
            breakpoints: [
                [0, 1, 0, 50],
                [1.1, 5, 51, 100],
                [5.1, 10, 101, 150],
                [10.1, 25, 151, 200],
                [25.1, 50, 201, 300],
                [50.1, 100, 301, 500],
            ],
        },
    ];

    let indicator = null;
    let popover = null;

    function setup({ indicatorId = "aqiIndicator", popoverId = "aqiPopover" } = {}) {
        indicator = document.getElementById(indicatorId);
        popover = document.getElementById(popoverId);
        if (!indicator || !popover) return;

        indicator.addEventListener("click", event => {
            event.stopPropagation();
            togglePopover();
        });

        document.addEventListener("click", event => {
            if (!popover || popover.hidden) return;
            if (popover.contains(event.target) || indicator.contains(event.target)) return;
            closePopover();
        });

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closePopover();
        });
        window.addEventListener("header-popover-open", event => {
            if (event.detail?.source !== "aqi") closePopover();
        });

        renderUnavailable();
    }

    function update(data) {
        if (!indicator || !popover) return;

        const result = calculate(data);
        if (!result) {
            renderUnavailable();
            return;
        }

        const valueEl = indicator.querySelector(".aqi-indicator__value");
        const statusEl = indicator.querySelector(".aqi-indicator__status");
        const title = `AQI estimado da Sala: ${result.aqi} ${result.category.label}. Dominante: ${result.dominant.label}.`;

        indicator.className = `aqi-indicator aqi-indicator--${result.category.className}`;
        indicator.title = title;
        indicator.setAttribute("aria-label", title);
        if (valueEl) valueEl.textContent = result.aqi;
        if (statusEl) statusEl.textContent = result.category.label;

        renderPopover(result);
    }

    function calculate(data) {
        const latest = findLatestRecord(data);
        if (!latest) return null;

        const subIndexes = POLLUTANTS
            .map(pollutant => calculatePollutantIndex(pollutant, latest.item))
            .filter(Boolean)
            .sort((a, b) => b.aqi - a.aqi);

        if (!subIndexes.length) return null;

        const dominant = subIndexes[0];
        const aqi = Math.min(500, Math.max(0, Math.round(dominant.aqi)));
        const category = getCategory(aqi);

        return {
            aqi,
            category,
            dominant,
            subIndexes,
            timestamp: latest.timestamp,
        };
    }

    function findLatestRecord(data) {
        let latest = null;

        for (const date of Object.keys(data || {})) {
            const dateData = data[date];
            if (!dateData || typeof dateData !== "object") continue;

            for (const time of Object.keys(dateData)) {
                const timestamp = parseTimestamp(date, time);
                if (!timestamp) continue;

                const timeData = dateData[time];
                if (!timeData || typeof timeData !== "object") continue;

                for (const itemKey of Object.keys(timeData)) {
                    const item = timeData[itemKey];
                    if (!item || typeof item !== "object") continue;
                    if (!latest || timestamp > latest.timestamp) latest = { timestamp, item };
                }
            }
        }

        return latest;
    }

    function parseTimestamp(date, time) {
        const [day, month, year] = String(date || "").split("-").map(Number);
        const [hour, minute = 0] = String(time || "").split("-").map(Number);
        if (![day, month, year, hour, minute].every(Number.isFinite)) return null;
        return new Date(year, month - 1, day, hour, minute, 0, 0);
    }

    function calculatePollutantIndex(pollutant, item) {
        const concentration = Number(item[pollutant.key]);
        if (!Number.isFinite(concentration)) return null;

        const breakpoint = pollutant.breakpoints.find(([low, high]) => concentration >= low && concentration <= high)
            || pollutant.breakpoints[pollutant.breakpoints.length - 1];
        const [bpLow, bpHigh, indexLow, indexHigh] = breakpoint;
        const boundedConcentration = Math.min(bpHigh, Math.max(bpLow, concentration));
        const aqi = ((indexHigh - indexLow) / (bpHigh - bpLow)) * (boundedConcentration - bpLow) + indexLow;

        return {
            ...pollutant,
            value: concentration,
            aqi,
        };
    }

    function getCategory(aqi) {
        return AQI_CATEGORIES.find(category => aqi >= category.min && aqi <= category.max) || AQI_CATEGORIES[AQI_CATEGORIES.length - 1];
    }

    function renderUnavailable() {
        indicator.className = "aqi-indicator aqi-indicator--unknown";
        indicator.title = "AQI estimado indisponível";
        indicator.setAttribute("aria-label", indicator.title);
        indicator.setAttribute("aria-expanded", "false");

        const valueEl = indicator.querySelector(".aqi-indicator__value");
        const statusEl = indicator.querySelector(".aqi-indicator__status");
        if (valueEl) valueEl.textContent = "--";
        if (statusEl) statusEl.textContent = "--";

        popover.hidden = true;
        popover.innerHTML = `
            <div class="aqi-popover__header">
                <span>AQI estimado da Sala</span>
                <strong>--</strong>
            </div>
            <p class="aqi-popover__text">Sem dados suficientes do MQ135.</p>
        `;
    }

    function renderPopover(result) {
        const topPollutants = result.subIndexes.slice(0, 3).map(item => `
            <li>
                <span>${item.label}</span>
                <strong>${item.value.toFixed(2)}${item.unit}</strong>
                <em>AQI ${Math.round(item.aqi)}</em>
            </li>
        `).join("");

        popover.innerHTML = `
            <div class="aqi-popover__header">
                <span>AQI estimado da Sala</span>
                <strong>${result.aqi}</strong>
            </div>
            <div class="aqi-popover__badge aqi-popover__badge--${result.category.className}">
                ${result.category.label}
            </div>
            <p class="aqi-popover__text">${result.category.impact}</p>
            <dl class="aqi-popover__meta">
                <div><dt>Dominante</dt><dd>${result.dominant.label}</dd></div>
                <div><dt>Atualizado</dt><dd>${formatTimestamp(result.timestamp)}</dd></div>
            </dl>
            <ul class="aqi-popover__list">${topPollutants}</ul>
            <p class="aqi-popover__note">Estimativa pelo MQ135; categorias visuais seguem as faixas AQI.</p>
        `;
    }

    function togglePopover() {
        if (popover.hidden) {
            window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "aqi" } }));
            popover.hidden = false;
            indicator.setAttribute("aria-expanded", "true");
        } else {
            closePopover();
        }
    }

    function closePopover() {
        if (!popover || !indicator) return;
        popover.hidden = true;
        indicator.setAttribute("aria-expanded", "false");
    }

    function formatTimestamp(timestamp) {
        return `${String(timestamp.getDate()).padStart(2, "0")}/${String(timestamp.getMonth() + 1).padStart(2, "0")} ${String(timestamp.getHours()).padStart(2, "0")}:${String(timestamp.getMinutes()).padStart(2, "0")}`;
    }

    window.ClimateAqi = {
        setup,
        update,
        calculate,
    };
})();
