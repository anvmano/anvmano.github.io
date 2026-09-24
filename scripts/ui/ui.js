'use strict';

(function () {
    function renderizarEstadoVazio(id, mensagem, tipo = "empty") {
        const elementoDom = document.getElementById(id);
        if (!elementoDom) return;
        elementoDom.innerHTML = "";
        const vazio = document.createElement("p");
        vazio.className = `state-message state-message--${tipo}`;
        vazio.innerText = mensagem;
        elementoDom.appendChild(vazio);
    }

    function renderizarTabela(id, tabela, mensagemVazia = "Sem registros recentes.") {
        const elementoDom = document.getElementById(id);
        if (!elementoDom) return;
        elementoDom._observadorColuna?.disconnect();
        elementoDom.innerHTML = "";
        if (tabela.rows && tabela.rows.length <= 1) {
            renderizarEstadoVazio(id, mensagemVazia);
            return;
        }
        elementoDom.appendChild(criarFerramentasTabela(tabela));
        elementoDom.appendChild(tabela);
        elementoDom.tabIndex = 0;
        elementoDom.setAttribute("role", "region");
        elementoDom.setAttribute("aria-label", "Registros por data e hora");
        const cabecalhoData = tabela.querySelector("th");
        if (cabecalhoData && window.ResizeObserver) {
            elementoDom._observadorColuna = new ResizeObserver(() => {
                elementoDom.style.setProperty("--table-date-width", `${cabecalhoData.getBoundingClientRect().width}px`);
            });
            elementoDom._observadorColuna.observe(cabecalhoData);
        }
    }

    function renderizarContextoGrafico(id, texto) {
        const titulo = document.getElementById(id)?.querySelector(".chart-label");
        if (!titulo) return;
        let contexto = titulo.querySelector(".chart-period");
        if (!contexto) {
            contexto = document.createElement("span");
            contexto.className = "chart-period";
            titulo.appendChild(contexto);
        }
        contexto.textContent = texto;
    }

    function renderizarPeriodoMovel(id, dataSelecionada) {
        const janela = ClimateData.getRollingWindow(dataSelecionada);
        if (!janela) return;
        const formatar = data => data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        renderizarContextoGrafico(id, `24h: ${formatar(janela.inicio)} a ${formatar(janela.fim)}`);
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
            const dados = ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
            linha.cells[0].textContent = dados !== dataAtual ? dados : "";
            dataAtual = dados;
        });
    }

    function baixarTabelaCsv(tabela) {
        const linhas = Array.from(tabela.rows).map(linha => Array.from(linha.cells).map(celula => {
            const valor = celula.textContent.replace(/\s*⚠\s*$/, "").trim().replaceAll('"', '""');
            return `"${valor}"`;
        }).join(";"));
        const blob = new Blob(["\uFEFF", linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const ligacao = document.createElement("a");
        ligacao.href = url;
        ligacao.download = `${tabela.dataset.exportName || "tabela"}-${ClimateData.dataAtual()}.csv`;
        document.body.appendChild(ligacao);
        ligacao.click();
        ligacao.remove();
        URL.revokeObjectURL(url);
    }

    function limparMensagemGrafico(id) {
        const elementoDom = document.getElementById(id);
        const estado = elementoDom ? elementoDom.querySelector(".chart-message") : null;
        if (estado) estado.remove();
    }

    function renderizarMensagemGrafico(id, mensagem, tipo = "empty") {
        const elementoDom = document.getElementById(id);
        if (!elementoDom) return;
        limparMensagemGrafico(id);
        const estado = document.createElement("p");
        estado.className = `chart-message state-message state-message--${tipo}`;
        estado.innerText = mensagem;
        elementoDom.appendChild(estado);
    }

    function renderizarErroInicializacao() {
        const { ids } = window.AppConfig;
        renderizarEstadoVazio(ids.tables.room, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderizarEstadoVazio(ids.tables.livingRoom, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderizarEstadoVazio(ids.tables.aquarium, "Falha ao carregar o Firebase. Verifique a conexão com a internet.");
        renderizarMensagemGrafico(ids.chartContainers.sunHistory, "Falha ao carregar o Firebase.", "error");
        renderizarMensagemGrafico(ids.chartContainers.solarToday, "Falha ao carregar o Firebase.", "error");
    }

    function obterAbaArmazenada() {
        try {
            return localStorage.getItem("activeTab");
        } catch {
            return null;
        }
    }

    function armazenarAbaAtiva(nomeAba) {
        try {
            localStorage.setItem("activeTab", nomeAba);
        } catch {
            // localStorage can be blocked in private or embedded contexts.
        }
    }

    function abrirAba(nomeAba, acionador) {
        document.querySelectorAll(".tabcontent").forEach(elementoDom => {
            elementoDom.style.display = "none";
            elementoDom.setAttribute("hidden", "");
        });
        document.querySelectorAll(".tablink").forEach(elementoDom => {
            elementoDom.classList.remove("active");
            elementoDom.setAttribute("aria-selected", "false");
            elementoDom.setAttribute("tabindex", "-1");
        });

        const aba = document.getElementById(nomeAba);
        if (aba) {
            aba.style.display = "block";
            aba.removeAttribute("hidden");
        }

        const botaoSelecionado = acionador || document.querySelector(`.tablink[data-tab-target="${nomeAba}"]`);
        if (botaoSelecionado) {
            botaoSelecionado.classList.add("active");
            botaoSelecionado.setAttribute("aria-selected", "true");
            botaoSelecionado.setAttribute("tabindex", "0");
        }

        armazenarAbaAtiva(nomeAba);
    }

    function configurarAbas(abaPadrao = "Tab1") {
        const botoesAbas = document.querySelectorAll(".tablink[data-tab-target]");
        botoesAbas.forEach(botao => {
            botao.addEventListener("click", () => abrirAba(botao.dataset.tabTarget, botao));
            botao.addEventListener("keydown", evento => navegarAbasPorTeclado(evento, botoesAbas));
        });

        const abaArmazenada = obterAbaArmazenada();
        const abaInicial = abaArmazenada && document.getElementById(abaArmazenada) ? abaArmazenada : abaPadrao;
        abrirAba(abaInicial);
    }

    function navegarAbasPorTeclado(evento, botoesAbas) {
        const teclasSuportadas = ["ArrowLeft", "ArrowRight", "Home", "End"];
        if (!teclasSuportadas.includes(evento.key)) return;

        evento.preventDefault();
        const botoes = Array.from(botoesAbas);
        const indiceAtual = botoes.indexOf(evento.currentTarget);
        if (indiceAtual < 0) return;

        let proximoIndice = indiceAtual;
        if (evento.key === "Home") proximoIndice = 0;
        if (evento.key === "End") proximoIndice = botoes.length - 1;
        if (evento.key === "ArrowLeft") proximoIndice = (indiceAtual - 1 + botoes.length) % botoes.length;
        if (evento.key === "ArrowRight") proximoIndice = (indiceAtual + 1) % botoes.length;

        const proximoBotao = botoes[proximoIndice];
        abrirAba(proximoBotao.dataset.tabTarget, proximoBotao);
        proximoBotao.focus();
    }

    function obterNomeAbaAtiva() {
        const botaoAtivo = document.querySelector(".tablink.active[data-tab-target]");
        if (botaoAtivo) return botaoAtivo.dataset.tabTarget;

        const abaVisivel = Array.from(document.querySelectorAll(".tabcontent")).find(aba => !aba.hasAttribute("hidden"));
        return abaVisivel ? abaVisivel.id : null;
    }

    function configurarDeslizeAbas({ tabOrder: ordemAbas, minDistance: distanciaMinima = 60, maxVerticalDrift: desvioVerticalMaximo = 80 } = {}) {
        if (!Array.isArray(ordemAbas) || ordemAbas.length < 2) return;

        const recipiente = document.querySelector(".container");
        if (!recipiente) return;

        let inicioToqueX = 0;
        let inicioToqueY = 0;
        let ignorarDeslize = false;

        recipiente.addEventListener("touchstart", evento => {
            const toque = evento.touches[0];
            if (!toque) return;
            ignorarDeslize = deveIgnorarDeslizeAbas(evento.target);
            inicioToqueX = toque.clientX;
            inicioToqueY = toque.clientY;
        }, { passive: true });

        recipiente.addEventListener("touchend", evento => {
            if (ignorarDeslize) {
                ignorarDeslize = false;
                return;
            }

            const toque = evento.changedTouches[0];
            if (!toque) return;

            const deltaX = toque.clientX - inicioToqueX;
            const deltaY = toque.clientY - inicioToqueY;

            if (Math.abs(deltaX) < distanciaMinima) return;
            if (Math.abs(deltaY) > desvioVerticalMaximo) return;

            const abaAtual = obterNomeAbaAtiva();
            const indiceAtual = ordemAbas.indexOf(abaAtual);
            if (indiceAtual === -1) return;

            const proximoIndice = deltaX < 0 ? indiceAtual + 1 : indiceAtual - 1;
            const proximaAba = ordemAbas[proximoIndice];
            if (!proximaAba) return;

            abrirAba(proximaAba);
        }, { passive: true });
    }

    function deveIgnorarDeslizeAbas(destino) {
        const areaInterativaExplicita = destino?.closest?.(".table-wrapper, .weekly-heatmap, .hourly-heatmap, .calendar-heatmap");
        if (areaInterativaExplicita) return true;

        let elemento = destino instanceof Element ? destino : null;
        while (elemento && !elemento.classList.contains("container")) {
            const estilo = window.getComputedStyle(elemento);
            const podeRolarHorizontalmente = /(auto|scroll)/.test(estilo.overflowX) && elemento.scrollWidth > elemento.clientWidth;
            if (podeRolarHorizontalmente) return true;
            elemento = elemento.parentElement;
        }

        return false;
    }

    function configurarSecoesRecolhiveis() {
        document.querySelectorAll(".collapsible-section").forEach(secao => {
            const acionador = secao.querySelector(".collapsible-trigger");
            if (!acionador) return;

            acionador.addEventListener("click", () => {
                const estaRecolhido = secao.classList.toggle("is-collapsed");
                acionador.setAttribute("aria-expanded", String(!estaRecolhido));
                if (!estaRecolhido) {
                    document.dispatchEvent(new CustomEvent("climate-collapsible-expanded", {
                        detail: { section: secao }
                    }));
                }
            });
        });
    }

    function configurarCabecalhoMovel() {
        const cabecalho = document.querySelector(".app-header");
        if (!cabecalho || cabecalho.dataset.autoHideReady === "true") return;

        const consultaMovel = window.matchMedia("(max-width: 640px)");
        const limiteMovimento = 8;
        let posicaoReferencia = Math.max(0, window.scrollY);
        let quadroPendente = false;

        cabecalho.dataset.autoHideReady = "true";

        function possuiPopoverAberto() {
            return !!cabecalho.querySelector('.header-status [aria-expanded="true"]');
        }

        function mostrarCabecalho() {
            cabecalho.classList.remove("is-hidden-on-scroll");
        }

        function atualizarCabecalho() {
            quadroPendente = false;
            const posicaoAtual = Math.max(0, window.scrollY);

            if (!consultaMovel.matches || possuiPopoverAberto() || posicaoAtual <= cabecalho.offsetHeight) {
                mostrarCabecalho();
                posicaoReferencia = posicaoAtual;
                return;
            }

            const deslocamento = posicaoAtual - posicaoReferencia;
            if (deslocamento >= limiteMovimento) {
                cabecalho.classList.add("is-hidden-on-scroll");
                posicaoReferencia = posicaoAtual;
            } else if (deslocamento <= -limiteMovimento) {
                mostrarCabecalho();
                posicaoReferencia = posicaoAtual;
            }
        }

        window.addEventListener("scroll", () => {
            if (quadroPendente) return;
            quadroPendente = true;
            window.requestAnimationFrame(atualizarCabecalho);
        }, { passive: true });
        window.addEventListener("header-popover-open", mostrarCabecalho);
        cabecalho.addEventListener("focusin", mostrarCabecalho);
        consultaMovel.addEventListener?.("change", () => {
            mostrarCabecalho();
            posicaoReferencia = Math.max(0, window.scrollY);
        });
    }

    function configurarControlesData({ getSelectedDate: obterDataSelecionada, setSelectedDate: definirDataSelecionada, getTodayDate: obterDataHoje, onDateChange: aoAlterarData }) {
        const entradaData = document.getElementById("selectedDate");
        const botaoHoje = document.getElementById("btnToday");

        if (entradaData) {
            entradaData.value = ClimateData.convertFirebaseDateToInput(obterDataSelecionada());
            entradaData.addEventListener("change", () => {
                definirDataSelecionada(ClimateData.convertInputDateToFirebase(entradaData.value));
                aoAlterarData();
            });
        }

        if (botaoHoje) {
            botaoHoje.addEventListener("click", () => {
                definirDataSelecionada(obterDataHoje());
                if (entradaData) entradaData.value = ClimateData.convertFirebaseDateToInput(obterDataSelecionada());
                aoAlterarData();
            });
        }
    }

    window.ClimateUI = {
        clearChartMessage: limparMensagemGrafico,
        renderChartMessage: renderizarMensagemGrafico,
        renderEmptyState: renderizarEstadoVazio,
        renderStartupError: renderizarErroInicializacao,
        renderTable: renderizarTabela,
        renderChartContext: renderizarContextoGrafico,
        renderRollingPeriod: renderizarPeriodoMovel,
        ordenarTabelaPorHorario,
        baixarTabelaCsv,
        getActiveTabName: obterNomeAbaAtiva,
        setupCollapsibleSections: configurarSecoesRecolhiveis,
        setupMobileHeader: configurarCabecalhoMovel,
        setupDateControls: configurarControlesData,
        setupTabSwipe: configurarDeslizeAbas,
        setupTabs: configurarAbas,
        navegarAbasPorTeclado,
    };
})();
