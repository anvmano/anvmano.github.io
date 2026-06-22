'use strict';

(function () {
    const ESTACOES_BASE = [
        { chave: "verao", nome: "Verão", mes: 11, dia: 21 },
        { chave: "outono", nome: "Outono", mes: 2, dia: 20 },
        { chave: "inverno", nome: "Inverno", mes: 5, dia: 21 },
        { chave: "primavera", nome: "Primavera", mes: 8, dia: 22 },
    ];

    let indicador = null;
    let popover = null;
    function setup({ indicatorId = "seasonIndicator", popoverId = "seasonPopover" } = {}) {
        indicador = document.getElementById(indicatorId);
        popover = document.getElementById(popoverId);

        if (!indicador || !popover) return;

        indicador.addEventListener("click", evento => {
            evento.stopPropagation();
            alternarPopover();
        });

        document.addEventListener("click", evento => {
            if (!popover || popover.hidden) return;
            if (popover.contains(evento.target) || indicador.contains(evento.target)) return;
            fecharPopover();
        });

        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") fecharPopover();
        });

        window.addEventListener("header-popover-open", evento => {
            if (evento.detail?.source !== "season") fecharPopover();
        });

        update();
    }

    function update(dataFirebase = window.ClimateData?.dataAtual?.()) {
        if (!indicador || !popover) return;

        const data = parseDataFirebase(dataFirebase);
        if (!data) {
            renderizarIndisponivel();
            return;
        }

        const estado = obterEstadoDaEstacao(data);
        const descricao = `${estado.estacao.nome}: começa em ${formatarDataCompleta(estado.estacao.inicio)}.`;

        indicador.className = `season-indicator season-indicator--${estado.estacao.chave}`;
        indicador.title = descricao;
        indicador.setAttribute("aria-label", descricao);

        const valor = indicador.querySelector(".season-indicator__value");
        if (valor) valor.textContent = estado.estacao.nome;

        renderizarPopover(estado);
    }

    function renderizarIndisponivel() {
        indicador.className = "season-indicator season-indicator--unknown";
        indicador.title = "Estação do ano indisponível";
        indicador.setAttribute("aria-label", indicador.title);
        indicador.setAttribute("aria-expanded", "false");

        const valor = indicador.querySelector(".season-indicator__value");
        if (valor) valor.textContent = "--";

        popover.hidden = true;
        popover.innerHTML = `
            <div class="season-header-popover__header">
                <span>Estação do ano</span>
                <strong>--</strong>
            </div>
            <p class="season-header-popover__text">Não foi possível identificar a data.</p>
        `;
    }

    function renderizarPopover(estado) {
        popover.innerHTML = `
            <div class="season-header-popover__header">
                <span>Estação do ano</span>
                <strong>${estado.estacao.nome}</strong>
            </div>
            <dl class="season-header-popover__list">
                ${estado.estacoes.map(estacao => `
                    <div class="${estacao.chave === estado.estacao.chave ? "is-current" : ""}">
                        <dt>${estacao.nome}</dt>
                        <dd>${formatarDataCompleta(estacao.inicio)}</dd>
                    </div>
                `).join("")}
            </dl>
        `;
    }

    function alternarPopover() {
        if (!indicador || !popover) return;

        if (popover.hidden) {
            window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "season" } }));
            update();
            popover.hidden = false;
            indicador.setAttribute("aria-expanded", "true");
        } else {
            fecharPopover();
        }
    }

    function fecharPopover() {
        if (!indicador || !popover) return;
        popover.hidden = true;
        indicador.setAttribute("aria-expanded", "false");
    }

    function obterEstadoDaEstacao(data) {
        const ano = data.getFullYear();
        const inicioVeraoAtual = new Date(ano, 11, 21);
        const anoFimCiclo = data >= inicioVeraoAtual ? ano + 1 : ano;
        const estacoes = ESTACOES_BASE.map(estacao => ({
            ...estacao,
            inicio: new Date(estacao.chave === "verao" ? anoFimCiclo - 1 : anoFimCiclo, estacao.mes, estacao.dia),
        }));
        const proximoVerao = { ...ESTACOES_BASE[0], inicio: new Date(anoFimCiclo, 11, 21) };
        const indiceAtual = estacoes.findIndex((estacao, indice) => {
            const proxima = estacoes[indice + 1] || proximoVerao;
            return data >= estacao.inicio && data < proxima.inicio;
        });
        const indiceSeguro = indiceAtual >= 0 ? indiceAtual : 0;
        const estacao = estacoes[indiceSeguro];
        const proxima = estacoes[indiceSeguro + 1] || proximoVerao;
        const duracao = proxima.inicio - estacao.inicio || 1;
        const progressoSegmento = Math.min(1, Math.max(0, (data - estacao.inicio) / duracao));
        const progressoAno = (indiceSeguro * 25) + (progressoSegmento * 25);

        return { estacao, estacoes, progressoAno: progressoAno.toFixed(2) };
    }

    function getState(dataFirebase = window.ClimateData?.dataAtual?.()) {
        const data = parseDataFirebase(dataFirebase);
        return data ? obterEstadoDaEstacao(data) : null;
    }

    function parseDataFirebase(valor) {
        if (window.ClimateData?.parseFirebaseDate && valor) {
            const data = window.ClimateData.parseFirebaseDate(valor);
            if (data instanceof Date && !Number.isNaN(data.getTime())) return data;
        }

        const dataAtual = new Date();
        return Number.isNaN(dataAtual.getTime()) ? null : dataAtual;
    }

    function formatarDataCompleta(data) {
        return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
    }

    window.ClimateSeason = {
        setup,
        update,
        getState,
    };
})();
