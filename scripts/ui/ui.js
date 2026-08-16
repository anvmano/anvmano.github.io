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
        el.appendChild(criarFerramentasTabela(table));
        el.appendChild(table);
    }

    function criarFerramentasTabela(tabela) {
        const ferramentas = document.createElement("div");
        ferramentas.className = "table-tools";
        const total = tabela.tBodies?.[0]?.rows?.length || Math.max(0, tabela.rows.length - 1);
        ferramentas.innerHTML = `
            <span class="table-tools__count">${total} de 24 horários</span>
            <div class="table-tools__actions">
                <button type="button" data-table-sort aria-label="Inverter ordem temporal">Mais antigos primeiro</button>
                <button type="button" data-table-csv aria-label="Baixar tabela visível em CSV">CSV</button>
            </div>
        `;

        let ordemAscendente = false;
        ferramentas.querySelector("[data-table-sort]")?.addEventListener("click", evento => {
            ordemAscendente = !ordemAscendente;
            ordenarTabelaPorHorario(tabela, ordemAscendente);
            evento.currentTarget.textContent = ordemAscendente ? "Mais recentes primeiro" : "Mais antigos primeiro";
        });
        ferramentas.querySelector("[data-table-csv]")?.addEventListener("click", () => baixarTabelaCsv(tabela));
        return ferramentas;
    }

    function ordenarTabelaPorHorario(tabela, ordemAscendente) {
        const corpo = tabela.tBodies?.[0];
        if (!corpo) return;
        const linhas = Array.from(corpo.rows).sort((a, b) => {
            const comparacao = String(a.dataset.timestamp || "").localeCompare(String(b.dataset.timestamp || ""));
            return ordemAscendente ? comparacao : -comparacao;
        });
        linhas.forEach(linha => corpo.appendChild(linha));
        preencherDatasOcultas(corpo.rows);
    }

    function preencherDatasOcultas(linhas) {
        let dataAtual = "";
        Array.from(linhas).forEach(linha => {
            const dataIso = String(linha.dataset.timestamp || "").slice(0, 10);
            const [ano, mes, dia] = dataIso.split("-");
            const data = ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
            linha.cells[0].textContent = data !== dataAtual ? data : "";
            dataAtual = data;
        });
    }

    function baixarTabelaCsv(tabela) {
        const linhas = Array.from(tabela.rows).map(linha => Array.from(linha.cells).map(celula => {
            const valor = celula.textContent.replace(/\s*⚠\s*$/, "").trim().replaceAll('"', '""');
            return `"${valor}"`;
        }).join(";"));
        const blob = new Blob(["\uFEFF", linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${tabela.dataset.exportName || "tabela"}-${ClimateData.dataAtual()}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
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
            el.setAttribute("tabindex", "-1");
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
            selectedButton.setAttribute("tabindex", "0");
        }

        storeActiveTab(tabName);
    }

    function setupTabs(defaultTab = "Tab1") {
        const tabButtons = document.querySelectorAll(".tablink[data-tab-target]");
        tabButtons.forEach(button => {
            button.addEventListener("click", () => openTab(button.dataset.tabTarget, button));
            button.addEventListener("keydown", evento => navegarAbasPorTeclado(evento, tabButtons));
        });

        const storedTab = getStoredTab();
        const initialTab = storedTab && document.getElementById(storedTab) ? storedTab : defaultTab;
        openTab(initialTab);
    }

    function navegarAbasPorTeclado(evento, tabButtons) {
        const teclasSuportadas = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!teclasSuportadas.includes(evento.key)) return;

        evento.preventDefault();
        const botoes = Array.from(tabButtons);
        const indiceAtual = botoes.indexOf(evento.currentTarget);
        if (indiceAtual < 0) return;

        let proximoIndice = indiceAtual;
        if (evento.key === "Home") proximoIndice = 0;
        if (evento.key === "End") proximoIndice = botoes.length - 1;
        if (evento.key === "ArrowLeft") proximoIndice = (indiceAtual - 1 + botoes.length) % botoes.length;
        if (evento.key === "ArrowRight") proximoIndice = (indiceAtual + 1) % botoes.length;

        const proximoBotao = botoes[proximoIndice];
        openTab(proximoBotao.dataset.tabTarget, proximoBotao);
        proximoBotao.focus();
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
        ordenarTabelaPorHorario,
        baixarTabelaCsv,
        getActiveTabName,
        setupCollapsibleSections,
        setupDateControls,
        setupTabSwipe,
        setupTabs,
        navegarAbasPorTeclado,
    };
})();
