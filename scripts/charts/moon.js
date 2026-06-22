'use strict';

(function () {
    const FASES_LUNARES = [
        { chave: "nova", nome: "Lua nova", min: 0, max: 0.0625 },
        { chave: "crescente", nome: "Crescente", min: 0.0625, max: 0.1875 },
        { chave: "quarto-crescente", nome: "Quarto crescente", min: 0.1875, max: 0.3125 },
        { chave: "gibosa-crescente", nome: "Gibosa crescente", min: 0.3125, max: 0.4375 },
        { chave: "cheia", nome: "Lua cheia", min: 0.4375, max: 0.5625 },
        { chave: "gibosa-minguante", nome: "Gibosa minguante", min: 0.5625, max: 0.6875 },
        { chave: "quarto-minguante", nome: "Quarto minguante", min: 0.6875, max: 0.8125 },
        { chave: "minguante", nome: "Minguante", min: 0.8125, max: 0.9375 },
        { chave: "nova", nome: "Lua nova", min: 0.9375, max: 1 },
    ];

    const DURACAO_CICLO_LUNAR = 29.530588853;
    const REFERENCIA_LUA_NOVA_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

    let indicador = null;
    let popover = null;

    function setup({ indicatorId = "moonIndicator", popoverId = "moonPopover" } = {}) {
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
            if (evento.detail?.source !== "moon") fecharPopover();
        });

        update();
    }

    function update(dataFirebase = window.ClimateData?.dataAtual?.()) {
        if (!indicador || !popover) return;

        const estado = getState(dataFirebase);
        if (!estado) {
            renderizarIndisponivel();
            return;
        }

        const descricao = `${estado.fase.nome}: ${estado.iluminacao}% iluminado.`;
        indicador.className = `moon-indicator moon-indicator--${estado.fase.chave}`;
        indicador.style.setProperty("--moon-shadow", `${estado.sombra}%`);
        indicador.title = descricao;
        indicador.setAttribute("aria-label", `${estado.nomeCurto}. ${descricao}`);

        const valor = indicador.querySelector(".moon-indicator__value");
        if (valor) valor.textContent = estado.nomeCurto;

        renderizarPopover(estado);
    }

    function getState(dataFirebase = window.ClimateData?.dataAtual?.()) {
        const data = parseDataFirebase(dataFirebase);
        if (!data) return null;

        const meioDiaLocal = new Date(data.getFullYear(), data.getMonth(), data.getDate(), 12, 0, 0, 0);
        const diasDesdeReferencia = (meioDiaLocal.getTime() - REFERENCIA_LUA_NOVA_UTC) / 86400000;
        const idade = normalizarModulo(diasDesdeReferencia, DURACAO_CICLO_LUNAR);
        const fracao = idade / DURACAO_CICLO_LUNAR;
        const fase = obterFase(fracao);
        const iluminacao = Math.round(((1 - Math.cos(2 * Math.PI * fracao)) / 2) * 100);
        const crescente = fracao > 0 && fracao < 0.5;
        const minguante = fracao > 0.5;
        const sombra = calcularSombraVisual(fracao);

        return {
            data,
            fase,
            fracao,
            idade,
            iluminacao,
            crescente,
            minguante,
            sombra,
            nomeCurto: fase.nome.replace("Lua ", "").replace("Quarto ", "Q. "),
            proximaNova: calcularProximaFase(data, idade, DURACAO_CICLO_LUNAR),
            proximaCheia: calcularProximaCheia(data, idade),
        };
    }

    function renderizarIndisponivel() {
        indicador.className = "moon-indicator moon-indicator--unknown";
        indicador.title = "Fase da lua indisponível";
        indicador.setAttribute("aria-label", "--. Fase da lua indisponível.");
        indicador.setAttribute("aria-expanded", "false");

        const valor = indicador.querySelector(".moon-indicator__value");
        if (valor) valor.textContent = "--";

        popover.hidden = true;
        popover.innerHTML = `
            <div class="moon-popover__header">
                <span>Fase da lua</span>
                <strong>--</strong>
            </div>
            <p class="moon-popover__text">Não foi possível identificar a data.</p>
        `;
    }

    function renderizarPopover(estado) {
        popover.innerHTML = `
            <div class="moon-popover__header">
                <span>Fase da lua</span>
                <strong>${estado.fase.nome}</strong>
            </div>
            <dl class="moon-popover__list">
                <div><dt>Iluminação</dt><dd>${estado.iluminacao}%</dd></div>
                <div><dt>Idade lunar</dt><dd>${estado.idade.toFixed(1)} dias</dd></div>
                <div><dt>Próxima cheia</dt><dd>${formatarDataCompleta(estado.proximaCheia)}</dd></div>
                <div><dt>Próxima nova</dt><dd>${formatarDataCompleta(estado.proximaNova)}</dd></div>
            </dl>
        `;
    }

    function alternarPopover() {
        if (!indicador || !popover) return;

        if (popover.hidden) {
            window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "moon" } }));
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

    function obterFase(fracao) {
        return FASES_LUNARES.find(fase => fracao >= fase.min && fracao < fase.max) || FASES_LUNARES[0];
    }

    function parseDataFirebase(valor) {
        if (window.ClimateData?.parseFirebaseDate && valor) {
            const data = window.ClimateData.parseFirebaseDate(valor);
            if (data instanceof Date && !Number.isNaN(data.getTime())) return data;
        }

        const dataAtual = new Date();
        return Number.isNaN(dataAtual.getTime()) ? null : dataAtual;
    }

    function normalizarModulo(valor, modulo) {
        return ((valor % modulo) + modulo) % modulo;
    }

    function calcularSombraVisual(fracao) {
        const distanciaDaCheia = Math.abs(fracao - 0.5) * 2;
        return Math.round(distanciaDaCheia * 100);
    }

    function calcularProximaFase(data, idade, idadeAlvo) {
        const diasRestantes = idadeAlvo - idade;
        const proxima = new Date(data);
        proxima.setDate(proxima.getDate() + Math.max(0, Math.ceil(diasRestantes)));
        return proxima;
    }

    function calcularProximaCheia(data, idade) {
        const idadeCheia = DURACAO_CICLO_LUNAR / 2;
        const diasRestantes = idade <= idadeCheia
            ? idadeCheia - idade
            : DURACAO_CICLO_LUNAR - idade + idadeCheia;
        const proxima = new Date(data);
        proxima.setDate(proxima.getDate() + Math.max(0, Math.ceil(diasRestantes)));
        return proxima;
    }

    function formatarDataCompleta(data) {
        return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
    }

    window.ClimateMoon = {
        setup,
        update,
        getState,
    };
})();
