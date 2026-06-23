'use strict';

(function () {
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
        const { ids } = window.AppConfig;
        renderEmptyState(ids.tables.room, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderEmptyState(ids.tables.livingRoom, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderEmptyState(ids.tables.aquarium, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderChartMessage(ids.chartContainers.sunHistory, "Falha ao carregar o Firebase.", "error");
        renderChartMessage(ids.chartContainers.solarToday, "Falha ao carregar o Firebase.", "error");
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

    function getActiveTabName() {
        const activeButton = document.querySelector(".tablink.active[data-tab-target]");
        if (activeButton) return activeButton.dataset.tabTarget;

        const visibleTab = Array.from(document.querySelectorAll(".tabcontent")).find(tab => !tab.hasAttribute("hidden"));
        return visibleTab ? visibleTab.id : null;
    }

    function setupTabSwipe({ tabOrder, minDistance = 60, maxVerticalDrift = 80 } = {}) {
        if (!Array.isArray(tabOrder) || tabOrder.length < 2) return;

        const container = document.querySelector(".container");
        if (!container) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let ignoreSwipe = false;

        container.addEventListener("touchstart", event => {
            const touch = event.touches[0];
            if (!touch) return;
            ignoreSwipe = shouldIgnoreTabSwipe(event.target);
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }, { passive: true });

        container.addEventListener("touchend", event => {
            if (ignoreSwipe) {
                ignoreSwipe = false;
                return;
            }

            const touch = event.changedTouches[0];
            if (!touch) return;

            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;

            if (Math.abs(deltaX) < minDistance) return;
            if (Math.abs(deltaY) > maxVerticalDrift) return;

            const currentTab = getActiveTabName();
            const currentIndex = tabOrder.indexOf(currentTab);
            if (currentIndex === -1) return;

            const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
            const nextTab = tabOrder[nextIndex];
            if (!nextTab) return;

            openTab(nextTab);
        }, { passive: true });
    }

    function shouldIgnoreTabSwipe(target) {
        const explicitInteractiveArea = target?.closest?.(".table-wrapper, .weekly-heatmap, .hourly-heatmap, .calendar-heatmap");
        if (explicitInteractiveArea) return true;

        let element = target instanceof Element ? target : null;
        while (element && !element.classList.contains("container")) {
            const style = window.getComputedStyle(element);
            const canScrollHorizontally = /(auto|scroll)/.test(style.overflowX) && element.scrollWidth > element.clientWidth;
            if (canScrollHorizontally) return true;
            element = element.parentElement;
        }

        return false;
    }

    function setupCollapsibleSections() {
        document.querySelectorAll(".collapsible-section").forEach(section => {
            const trigger = section.querySelector(".collapsible-trigger");
            if (!trigger) return;

            trigger.addEventListener("click", () => {
                const isCollapsed = section.classList.toggle("is-collapsed");
                trigger.setAttribute("aria-expanded", String(!isCollapsed));
                if (!isCollapsed) {
                    document.dispatchEvent(new CustomEvent("climate-collapsible-expanded", {
                        detail: { section }
                    }));
                }
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

    window.ClimateUI = {
        clearChartMessage,
        renderChartMessage,
        renderEmptyState,
        renderStartupError,
        renderTable,
        getActiveTabName,
        setupCollapsibleSections,
        setupDateControls,
        setupTabSwipe,
        setupTabs,
    };
})();
