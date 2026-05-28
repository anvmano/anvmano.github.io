'use strict';

(function () {
    let zoomOverlay = null;

    function renderEmptyState(id, message, type = "empty") {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = "";
        const empty = document.createElement("p");
        empty.className = `state-message state-message--${type}`;
        empty.innerText = message;
        el.appendChild(empty);
    }

    function renderTable(id, table, emptyMessage = "Sem registros recentes.") {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = "";
        if (table.rows && table.rows.length <= 1) {
            renderEmptyState(id, emptyMessage);
            return;
        }
        el.appendChild(table);
    }

    function clearChartMessage(id) {
        const el = document.getElementById(id);
        const status = el ? el.querySelector(".chart-message") : null;
        if (status) status.remove();
    }

    function renderChartMessage(id, message, type = "empty") {
        const el = document.getElementById(id);
        if (!el) return;
        clearChartMessage(id);
        const status = document.createElement("p");
        status.className = `chart-message state-message state-message--${type}`;
        status.innerText = message;
        el.appendChild(status);
    }

    function renderStartupError() {
        renderEmptyState("data", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderEmptyState("dataSala", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderEmptyState("dataAquario", "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderChartMessage("chart-container-sun", "Falha ao carregar o Firebase.", "error");
        renderChartMessage("chart-container-sun-today", "Falha ao carregar o Firebase.", "error");
    }

    function getStoredTab() {
        try {
            return localStorage.getItem("activeTab");
        } catch {
            return null;
        }
    }

    function storeActiveTab(tabName) {
        try {
            localStorage.setItem("activeTab", tabName);
        } catch {
            // localStorage can be blocked in private or embedded contexts.
        }
    }

    function openTab(tabName, trigger) {
        document.querySelectorAll(".tabcontent").forEach(el => {
            el.style.display = "none";
            el.setAttribute("hidden", "");
        });
        document.querySelectorAll(".tablink").forEach(el => {
            el.classList.remove("active");
            el.setAttribute("aria-selected", "false");
        });

        const tab = document.getElementById(tabName);
        if (tab) {
            tab.style.display = "block";
            tab.removeAttribute("hidden");
        }

        const selectedButton = trigger || document.querySelector(`.tablink[data-tab-target="${tabName}"]`);
        if (selectedButton) {
            selectedButton.classList.add("active");
            selectedButton.setAttribute("aria-selected", "true");
        }

        storeActiveTab(tabName);
    }

    function setupTabs(defaultTab = "Tab1") {
        const tabButtons = document.querySelectorAll(".tablink[data-tab-target]");
        tabButtons.forEach(button => {
            button.addEventListener("click", () => openTab(button.dataset.tabTarget, button));
        });

        const storedTab = getStoredTab();
        const initialTab = storedTab && document.getElementById(storedTab) ? storedTab : defaultTab;
        openTab(initialTab);
    }

    function setupCollapsibleSections() {
        document.querySelectorAll(".collapsible-section").forEach(section => {
            const trigger = section.querySelector(".collapsible-trigger");
            if (!trigger) return;

            trigger.addEventListener("click", () => {
                const isCollapsed = section.classList.toggle("is-collapsed");
                trigger.setAttribute("aria-expanded", String(!isCollapsed));
            });
        });
    }

    function setupDateControls({ getSelectedDate, setSelectedDate, getTodayDate, onDateChange }) {
        const dateInput = document.getElementById("selectedDate");
        const todayButton = document.getElementById("btnToday");

        if (dateInput) {
            dateInput.value = ClimateData.convertFirebaseDateToInput(getSelectedDate());
            dateInput.addEventListener("change", () => {
                setSelectedDate(ClimateData.convertInputDateToFirebase(dateInput.value));
                onDateChange();
            });
        }

        if (todayButton) {
            todayButton.addEventListener("click", () => {
                setSelectedDate(getTodayDate());
                if (dateInput) dateInput.value = ClimateData.convertFirebaseDateToInput(getSelectedDate());
                onDateChange();
            });
        }
    }

    function closeZoom() {
        if (!zoomOverlay) return;
        const zoomChart = zoomOverlay._chart;
        if (zoomChart) zoomChart.destroy();
        zoomOverlay.remove();
        zoomOverlay = null;
    }

    function cloneChartData(sourceChart) {
        return {
            labels: sourceChart.data.labels ? [...sourceChart.data.labels] : undefined,
            datasets: sourceChart.data.datasets.map(dataset => ({
                type: dataset.type,
                label: dataset.label,
                data: Array.isArray(dataset.data)
                    ? dataset.data.map(item => item && typeof item === "object" ? { ...item } : item)
                    : dataset.data,
                yAxisID: dataset.yAxisID,
                borderColor: dataset.borderColor,
                backgroundColor: Array.isArray(dataset.backgroundColor) || typeof dataset.backgroundColor === "string"
                    ? dataset.backgroundColor
                    : "transparent",
                fill: dataset.fill,
                tension: dataset.tension,
                borderWidth: dataset.borderWidth,
                pointRadius: dataset.pointRadius,
                pointHitRadius: dataset.pointHitRadius || 18,
                pointHoverRadius: dataset.pointHoverRadius || 6,
                pointBackgroundColor: dataset.pointBackgroundColor,
                pointBorderColor: dataset.pointBorderColor,
                pointHoverBackgroundColor: dataset.pointHoverBackgroundColor,
                pointHoverBorderColor: dataset.pointHoverBorderColor,
                pointHoverBorderWidth: dataset.pointHoverBorderWidth,
                showLine: dataset.showLine,
                order: dataset.order,
                parsing: dataset.parsing,
            }))
        };
    }

    function createZoomChart({ sourceChart, targetCtx, getZoomOptions }) {
        const sourceId = sourceChart.canvas.id;
        const config = {
            type: sourceChart.config.type || "line",
            data: cloneChartData(sourceChart),
            options: getZoomOptions(sourceId),
            plugins: sourceId === "plotSolarToday" ? [ClimateSolar.solarDayBackgroundPlugin] : []
        };

        const zoomChart = new Chart(targetCtx, config);
        if (sourceId === "plotSolarToday") {
            zoomChart.$solarDayTimes = sourceChart.$solarDayTimes;
        }
        if (sourceChart.$comfortBand) {
            zoomChart.$comfortBand = sourceChart.$comfortBand;
            zoomChart.update();
        }
        zoomOverlay._chart = zoomChart;
        return zoomChart;
    }

    function handleZoom(card, { chartInstances, getZoomOptions }) {
        closeZoom();

        const sourceCanvas = card.querySelector("canvas");
        if (!sourceCanvas) return;

        const sourceChart = chartInstances[sourceCanvas.id];
        if (!sourceChart) return;

        const overlay = document.createElement("div");
        overlay.className = "plot-zoom-overlay";

        const clone = card.cloneNode(false);
        const label = card.querySelector(".chart-label");
        const zoomCanvas = document.createElement("canvas");
        zoomCanvas.className = "plot plot--zoom";
        zoomCanvas.setAttribute("aria-label", sourceCanvas.getAttribute("aria-label") || "Gráfico ampliado");
        zoomCanvas.setAttribute("role", "img");

        if (label) clone.appendChild(label.cloneNode(true));
        clone.appendChild(zoomCanvas);
        overlay.appendChild(clone);

        overlay.addEventListener("click", event => {
            if (event.target.closest(".chart-card")) closeZoom();
        });

        zoomOverlay = overlay;
        document.body.appendChild(overlay);
        createZoomChart({ sourceChart, targetCtx: zoomCanvas.getContext("2d"), getZoomOptions });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function createZoomButton(card, zoomOptions) {
        if (card.querySelector(".chart-zoom-button")) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-zoom-button";
        button.setAttribute("aria-label", "Ampliar gráfico");
        button.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 3h6v6"/>
                <path d="M21 3l-7 7"/>
                <path d="M9 21H3v-6"/>
                <path d="M3 21l7-7"/>
            </svg>
        `;
        button.addEventListener("click", event => {
            event.stopPropagation();
            handleZoom(card, zoomOptions);
        });

        card.appendChild(button);
    }

    function setupChartZoom(zoomOptions) {
        document.addEventListener("keydown", event => {
            if (event.key === "Escape") closeZoom();
        });

        document.querySelectorAll(".chart-card").forEach(card => {
            card.classList.add("chart-card--zoomable");
            card.title = "Dê duplo clique ou use o botão para ampliar";
            createZoomButton(card, zoomOptions);
            card.addEventListener("dblclick", () => handleZoom(card, zoomOptions));
        });
    }

    window.ClimateUI = {
        clearChartMessage,
        renderChartMessage,
        renderEmptyState,
        renderStartupError,
        renderTable,
        setupChartZoom,
        setupCollapsibleSections,
        setupDateControls,
        setupTabs,
    };
})();
