'use strict';

(function () {
    const CATEGORIAS_AQI = [
        { min: 0, max: 50, label: "Boa", className: "good", impact: "Ar satisfatório, risco mínimo." },
        { min: 51, max: 100, label: "Moderado", className: "moderate", impact: "Aceitável, mas pode haver risco moderado para grupos sensíveis." },
        { min: 101, max: 150, label: "Insalubre para grupos sensíveis", className: "sensitive", impact: "Grupos de risco podem apresentar sintomas." },
        { min: 151, max: 200, label: "Insalubre", className: "unhealthy", impact: "Toda a população pode começar a sentir efeitos na saúde." },
        { min: 201, max: 300, label: "Muito insalubre", className: "very-unhealthy", impact: "Alerta de saúde; riscos aumentados para todos." },
        { min: 301, max: 500, label: "Perigoso", className: "hazardous", impact: "Condições de emergência; toda a população é severamente afetada." },
    ];

    const POLUENTES = [
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

    let indicador = null;
    let janelaDetalhes = null;

    function configurarModulo({ indicatorId: idIndicador = "aqiIndicator", popoverId: idJanelaDetalhes = "aqiPopover" } = {}) {
        indicador = document.getElementById(idIndicador);
        janelaDetalhes = document.getElementById(idJanelaDetalhes);
        if (!indicador || !janelaDetalhes) return;

        indicador.addEventListener("click", evento => {
            evento.stopPropagation();
            alternarDetalhes();
        });

        document.addEventListener("click", evento => {
            if (!janelaDetalhes || janelaDetalhes.hidden) return;
            if (janelaDetalhes.contains(evento.target) || indicador.contains(evento.target)) return;
            fecharDetalhes();
        });

        document.addEventListener("keydown", evento => {
            if (evento.key === "Escape") fecharDetalhes();
        });
        window.addEventListener("header-popover-open", evento => {
            if (evento.detail?.source !== "aqi") fecharDetalhes();
        });

        renderizarIndisponibilidade();
    }

    function atualizarModulo(dados) {
        if (!indicador || !janelaDetalhes) return;

        const resultado = calcularIndice(dados);
        if (!resultado) {
            renderizarIndisponibilidade("interno");
            return;
        }

        const elementoValor = indicador.querySelector(".aqi-indicator__value");
        const elementoEstado = indicador.querySelector(".aqi-indicator__status");
        const titulo = `AQI ${resultado.aqi}. AQI estimado da Sala: ${resultado.category.label}. Dominante: ${resultado.dominant.label}.`;

        indicador.className = `aqi-indicator aqi-indicator--${resultado.category.className}`;
        indicador.title = titulo;
        indicador.setAttribute("aria-label", titulo);
        if (elementoValor) elementoValor.textContent = resultado.aqi;
        if (elementoEstado) elementoEstado.textContent = resultado.category.label;

        renderizarDetalhes(resultado);
    }

    function atualizarExterno(dados) {
        if (!indicador || !janelaDetalhes) return;

        const valor = Number(dados?.valor);
        if (!Number.isFinite(valor)) {
            renderizarIndisponibilidade("publico");
            return;
        }

        const aqi = Math.min(500, Math.max(0, Math.round(valor)));
        const categoria = obterCategoria(aqi);
        const origem = dados?.origem || "localização consultada";
        const atualizadoEm = dados?.atualizadoEm instanceof Date ? dados.atualizadoEm : null;
        const titulo = `AQI ${aqi}. AQI externo de ${origem}: ${categoria.label}.`;
        const elementoValor = indicador.querySelector(".aqi-indicator__value");
        const elementoEstado = indicador.querySelector(".aqi-indicator__status");

        indicador.className = `aqi-indicator aqi-indicator--${categoria.className}`;
        indicador.title = titulo;
        indicador.setAttribute("aria-label", titulo);
        indicador.setAttribute("aria-expanded", "false");
        if (elementoValor) elementoValor.textContent = aqi;
        if (elementoEstado) elementoEstado.textContent = categoria.label;

        renderizarDetalhesExternos({
            aqi,
            category: categoria,
            origem,
            atualizadoEm,
        });
    }

    function calcularIndice(dados) {
        const maisRecente = encontrarUltimoRegistro(dados);
        if (!maisRecente) return null;

        const subindices = POLUENTES
            .map(poluente => calcularIndicePoluente(poluente, maisRecente.item))
            .filter(Boolean)
            .sort((a, b) => b.aqi - a.aqi);

        if (!subindices.length) return null;

        const dominante = subindices[0];
        const aqi = Math.min(500, Math.max(0, Math.round(dominante.aqi)));
        const categoria = obterCategoria(aqi);

        return {
            aqi,
            category: categoria,
            dominant: dominante,
            subIndexes: subindices,
            timestamp: maisRecente.timestamp,
        };
    }

    function encontrarUltimoRegistro(dados) {
        let maisRecente = null;

        for (const dataReferencia of Object.keys(dados || {})) {
            const dadosData = dados[dataReferencia];
            if (!dadosData || typeof dadosData !== "object") continue;

            for (const horario of Object.keys(dadosData)) {
                const instanteRegistro = interpretarInstanteRegistro(dataReferencia, horario);
                if (!instanteRegistro) continue;

                const dadosHorario = dadosData[horario];
                if (!dadosHorario || typeof dadosHorario !== "object") continue;

                for (const chaveItem of Object.keys(dadosHorario)) {
                    const item = dadosHorario[chaveItem];
                    if (!item || typeof item !== "object") continue;
                    if (!maisRecente || instanteRegistro > maisRecente.timestamp) maisRecente = { timestamp: instanteRegistro, item };
                }
            }
        }

        return maisRecente;
    }

    function interpretarInstanteRegistro(dataReferencia, horario) {
        const [dia, mes, ano] = String(dataReferencia || "").split("-").map(Number);
        const [hora, minuto = 0] = String(horario || "").split("-").map(Number);
        if (![dia, mes, ano, hora, minuto].every(Number.isFinite)) return null;
        return new Date(ano, mes - 1, dia, hora, minuto, 0, 0);
    }

    function calcularIndicePoluente(poluente, item) {
        const concentracao = Number(item[poluente.key]);
        if (!Number.isFinite(concentracao)) return null;

        const limiteFaixa = poluente.breakpoints.find(([inferior, superior]) => concentracao >= inferior && concentracao <= superior)
            || poluente.breakpoints[poluente.breakpoints.length - 1];
        const [limiteInferiorFaixa, limiteSuperiorFaixa, indiceInferior, indiceSuperior] = limiteFaixa;
        const concentracaoLimitada = Math.min(limiteSuperiorFaixa, Math.max(limiteInferiorFaixa, concentracao));
        const aqi = ((indiceSuperior - indiceInferior) / (limiteSuperiorFaixa - limiteInferiorFaixa)) * (concentracaoLimitada - limiteInferiorFaixa) + indiceInferior;

        return {
            ...poluente,
            value: concentracao,
            aqi,
        };
    }

    function obterCategoria(aqi) {
        return CATEGORIAS_AQI.find(categoria => aqi >= categoria.min && aqi <= categoria.max) || CATEGORIAS_AQI[CATEGORIAS_AQI.length - 1];
    }

    function renderizarIndisponibilidade(modo = "interno") {
        const ehPublico = modo === "publico";
        const titulo = ehPublico ? "AQI externo" : "AQI estimado da Sala";
        const texto = ehPublico
            ? "Informe um CEP ou permita a localização para consultar o AQI externo."
            : "Sem dados suficientes do MQ135.";

        indicador.className = "aqi-indicator aqi-indicator--unknown";
        indicador.title = ehPublico ? "AQI externo indisponível" : "AQI estimado indisponível";
        indicador.setAttribute("aria-label", `AQI --. ${indicador.title}.`);
        indicador.setAttribute("aria-expanded", "false");

        const elementoValor = indicador.querySelector(".aqi-indicator__value");
        const elementoEstado = indicador.querySelector(".aqi-indicator__status");
        if (elementoValor) elementoValor.textContent = "--";
        if (elementoEstado) elementoEstado.textContent = "--";

        janelaDetalhes.hidden = true;
        janelaDetalhes.innerHTML = `
            <div class="aqi-popover__header">
                <span>${titulo}</span>
                <strong>--</strong>
            </div>
            <p class="aqi-popover__text">${texto}</p>
        `;
    }

    function renderizarDetalhes(resultado) {
        const principaisPoluentes = resultado.subIndexes.slice(0, 3).map(item => `
            <li>
                <span>${item.label}</span>
                <strong>${item.value.toFixed(2)}${item.unit}</strong>
                <em>AQI ${Math.round(item.aqi)}</em>
            </li>
        `).join("");

        janelaDetalhes.innerHTML = `
            <div class="aqi-popover__header">
                <span>AQI estimado da Sala</span>
                <strong>${resultado.aqi}</strong>
            </div>
            <div class="aqi-popover__badge aqi-popover__badge--${resultado.category.className}">
                ${resultado.category.label}
            </div>
            <p class="aqi-popover__text">${resultado.category.impact}</p>
            <dl class="aqi-popover__meta">
                <div><dt>Dominante</dt><dd>${resultado.dominant.label}</dd></div>
                <div><dt>Atualizado</dt><dd>${formatarInstanteRegistro(resultado.timestamp)}</dd></div>
            </dl>
            <ul class="aqi-popover__list">${principaisPoluentes}</ul>
            <p class="aqi-popover__note">Estimativa pelo MQ135; categorias visuais seguem as faixas AQI.</p>
        `;
    }

    function renderizarDetalhesExternos(resultado) {
        janelaDetalhes.hidden = true;
        janelaDetalhes.innerHTML = `
            <div class="aqi-popover__header">
                <span>AQI externo</span>
                <strong>${resultado.aqi}</strong>
            </div>
            <div class="aqi-popover__badge aqi-popover__badge--${resultado.category.className}">
                ${resultado.category.label}
            </div>
            <p class="aqi-popover__text">${resultado.category.impact}</p>
            <dl class="aqi-popover__meta">
                <div><dt>Origem</dt><dd>${resultado.origem}</dd></div>
                <div><dt>Atualizado</dt><dd>${resultado.atualizadoEm ? formatarInstanteRegistro(resultado.atualizadoEm) : "--"}</dd></div>
            </dl>
            <p class="aqi-popover__note">Dado externo da API Open-Meteo Air Quality; não usa sensores internos da estação.</p>
        `;
    }

    function alternarDetalhes() {
        if (janelaDetalhes.hidden) {
            window.dispatchEvent(new CustomEvent("header-popover-open", { detail: { source: "aqi" } }));
            janelaDetalhes.hidden = false;
            indicador.setAttribute("aria-expanded", "true");
        } else {
            fecharDetalhes();
        }
    }

    function fecharDetalhes() {
        if (!janelaDetalhes || !indicador) return;
        janelaDetalhes.hidden = true;
        indicador.setAttribute("aria-expanded", "false");
    }

    function formatarInstanteRegistro(instanteRegistro) {
        return `${String(instanteRegistro.getDate()).padStart(2, "0")}/${String(instanteRegistro.getMonth() + 1).padStart(2, "0")} ${String(instanteRegistro.getHours()).padStart(2, "0")}:${String(instanteRegistro.getMinutes()).padStart(2, "0")}`;
    }

    window.ClimateAqi = {
        setup: configurarModulo,
        update: atualizarModulo,
        updateExternal: atualizarExterno,
        calculate: calcularIndice,
    };
})();
