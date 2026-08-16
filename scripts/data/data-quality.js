'use strict';

(function () {
    function obterConfiguracao(campo) {
        const schema = window.AppConfig?.sensorSchemas?.[campo] || {};
        const especifica = window.AppConfig?.dataQuality?.metrics?.[campo] || {};
        return {
            criticalMin: schema.plausibleMin,
            criticalMax: schema.plausibleMax,
            ...especifica,
        };
    }

    function analisarSerie(dados, campo) {
        const leituras = extrairLeituras(dados, campo);
        const configuracao = obterConfiguracao(campo);
        const leiturasEsperadas = calcularLeiturasEsperadas(dados, campo);
        const qualidadePorLeitura = new Map();
        const avisos = [];

        leituras.forEach(leitura => qualidadePorLeitura.set(leitura.chave, criarQualidadeLeitura()));
        aplicarFaixaCritica(leituras, qualidadePorLeitura, configuracao, avisos);
        aplicarSaltos(leituras, qualidadePorLeitura, configuracao, avisos);
        aplicarRepeticao(leituras, qualidadePorLeitura, configuracao, avisos);
        aplicarSerieZero(leituras, qualidadePorLeitura, configuracao, avisos);

        const leiturasValidas = leituras.length;
        const coberturaPercentual = leiturasEsperadas > 0
            ? Math.min(100, (leiturasValidas / leiturasEsperadas) * 100)
            : 0;
        const limiarCobertura = Number(window.AppConfig?.dataQuality?.minimumCoveragePercent) || 90;
        const incompleta = leiturasValidas > 0 && coberturaPercentual < limiarCobertura;
        const semDados = leiturasValidas === 0;
        const desatualizada = verificarDesatualizacao(dados, leituras);
        const temCritica = [...qualidadePorLeitura.values()].some(item => item.nivel === "critica");
        const temSuspeita = [...qualidadePorLeitura.values()].some(item => item.nivel === "suspeita");
        const ultimaLeitura = leituras.at(-1) || null;

        if (incompleta) avisos.unshift(`Dados incompletos: ${leiturasValidas}/${leiturasEsperadas} leituras.`);
        if (desatualizada) avisos.unshift("Sensor sem leitura recente no dia atual.");

        const nivel = temCritica
            ? "critica"
            : temSuspeita
                ? "suspeita"
                : semDados
                    ? "sem_dados"
                    : desatualizada
                        ? "desatualizada"
                        : incompleta ? "incompleta" : "adequada";
        const estado = obterEstadoOperacional({ semDados, temCritica, temSuspeita, desatualizada, incompleta });

        return {
            campo,
            leituras,
            valores: leituras.map(leitura => leitura.valor),
            leiturasValidas,
            leiturasEsperadas,
            coberturaPercentual,
            incompleta,
            semDados,
            desatualizada,
            nivel,
            rotulo: obterRotuloNivel(nivel),
            estado,
            rotuloEstado: obterRotuloEstado(estado),
            ultimaLeitura,
            ultimaLeituraEm: ultimaLeitura
                ? analisarDataHora(ultimaLeitura.data, ultimaLeitura.horario)
                : null,
            avisos: [...new Set(avisos)],
            qualidadePorLeitura,
        };
    }

    function extrairLeituras(dados, campo) {
        const leituras = [];
        const datas = Object.keys(dados || {}).sort((a, b) => ClimateData.parseFirebaseDate(a) - ClimateData.parseFirebaseDate(b));

        for (const data of datas) {
            const dadosData = dados[data];
            for (const horario of Object.keys(dadosData || {}).sort()) {
                const dadosHorario = dadosData[horario];
                for (const itemId of Object.keys(dadosHorario || {}).sort()) {
                    const item = dadosHorario[itemId];
                    if (!item || typeof item !== "object") continue;
                    const valor = ClimateData.normalizeMeasurementValue(campo, item[campo]);
                    if (valor === null) continue;
                    leituras.push({
                        chave: criarChaveLeitura(data, horario, itemId),
                        data,
                        horario,
                        itemId,
                        valor,
                    });
                }
            }
        }

        return leituras;
    }

    function calcularLeiturasEsperadas(dados, campo) {
        const datas = Object.keys(dados || {});
        if (!datas.length) return 0;

        const intervaloMinutos = Number(window.AppConfig?.sensorSchemas?.[campo]?.expectedMinutes);
        const porDia = Number.isFinite(intervaloMinutos) && intervaloMinutos > 0
            ? Math.round(1440 / intervaloMinutos)
            : Number(window.AppConfig?.dataQuality?.expectedReadingsPerDay) || 24;
        const hoje = ClimateData.dataAtual();
        const horaAtual = new Date().getHours();
        return datas.reduce((total, data) => total + (data === hoje ? Math.min(porDia, horaAtual + 1) : porDia), 0);
    }

    function aplicarFaixaCritica(leituras, mapa, configuracao, avisos) {
        if (!Number.isFinite(configuracao.criticalMin) && !Number.isFinite(configuracao.criticalMax)) return;
        const afetadas = leituras.filter(leitura => (
            (Number.isFinite(configuracao.criticalMin) && leitura.valor < configuracao.criticalMin)
            || (Number.isFinite(configuracao.criticalMax) && leitura.valor > configuracao.criticalMax)
        ));
        afetadas.forEach(leitura => marcarLeitura(mapa.get(leitura.chave), "critica", "Valor fora da faixa crítica configurada."));
        if (afetadas.length) avisos.push(`${afetadas.length} leitura(s) fora da faixa crítica configurada.`);
    }

    function aplicarSaltos(leituras, mapa, configuracao, avisos) {
        if (!Number.isFinite(configuracao.maxJump) || leituras.length < 2) return;
        let saltos = 0;
        for (let indice = 1; indice < leituras.length; indice += 1) {
            if (Math.abs(leituras[indice].valor - leituras[indice - 1].valor) <= configuracao.maxJump) continue;
            marcarLeitura(mapa.get(leituras[indice].chave), "suspeita", "Salto abrupto em relação à leitura anterior.");
            saltos += 1;
        }
        if (saltos) avisos.push(`${saltos} salto(s) abrupto(s) detectado(s).`);
    }

    function aplicarRepeticao(leituras, mapa, configuracao, avisos) {
        const minimo = Number(configuracao.repeatedCount);
        if (!Number.isInteger(minimo) || minimo < 2 || leituras.length < minimo) return;

        let inicio = 0;
        let sequencias = 0;
        for (let indice = 1; indice <= leituras.length; indice += 1) {
            const continua = indice < leituras.length
                && Math.abs(leituras[indice].valor - leituras[inicio].valor) <= (configuracao.repeatTolerance || 0);
            if (continua) continue;

            if (indice - inicio >= minimo) {
                for (let posicao = inicio; posicao < indice; posicao += 1) {
                    marcarLeitura(mapa.get(leituras[posicao].chave), "suspeita", "Valor repetido por período prolongado; verificar sensor.");
                }
                sequencias += 1;
            }
            inicio = indice;
        }
        if (sequencias) avisos.push("Série com valor repetido por período prolongado; verificar sensor.");
    }

    function aplicarSerieZero(leituras, mapa, configuracao, avisos) {
        if (!configuracao.flagConstantZero || leituras.length < (configuracao.repeatedCount || 2)) return;
        if (!leituras.every(leitura => leitura.valor === 0)) return;

        leituras.forEach(leitura => marcarLeitura(
            mapa.get(leitura.chave),
            "suspeita",
            "Série constante em zero; confirmar limite de detecção ou conexão do sensor."
        ));
        avisos.push("Série constante em zero; confirmar se é leitura válida, limite de detecção ou falha do sensor.");
    }

    function verificarDesatualizacao(dados, leituras) {
        if (!leituras.length || !Object.prototype.hasOwnProperty.call(dados || {}, ClimateData.dataAtual())) return false;
        const ultima = leituras[leituras.length - 1];
        if (ultima.data !== ClimateData.dataAtual()) return true;
        const ultimaLeituraEm = analisarDataHora(ultima.data, ultima.horario);
        if (!ultimaLeituraEm) return true;
        const limiteMinutos = Number(window.AppConfig?.dataQuality?.staleAfterMinutes) || 150;
        return Date.now() - ultimaLeituraEm.getTime() > limiteMinutos * 60 * 1000;
    }

    function analisarDataHora(data, horario) {
        if (typeof ClimateData.parseFirebaseDateTime === "function") {
            return ClimateData.parseFirebaseDateTime(data, horario);
        }
        const [dia, mes, ano] = String(data || "").split("-").map(Number);
        const [hora, minuto = 0] = String(horario || "").split("-").map(Number);
        const resultado = new Date(ano, mes - 1, dia, hora, minuto);
        return Number.isNaN(resultado.getTime()) ? null : resultado;
    }

    function obterEstadoOperacional({ semDados, temCritica, temSuspeita, desatualizada, incompleta }) {
        if (semDados) return "offline";
        if (temCritica || temSuspeita) return "suspeito";
        if (desatualizada) return "desatualizado";
        if (incompleta) return "parcial";
        return "ok";
    }

    function obterRotuloEstado(estado) {
        return {
            ok: "OK",
            parcial: "Parcial",
            desatualizado: "Desatualizado",
            suspeito: "Suspeito",
            offline: "Offline",
        }[estado] || "Offline";
    }

    function criarQualidadeLeitura() {
        return { nivel: "normal", motivos: [] };
    }

    function marcarLeitura(qualidade, nivel, motivo) {
        if (!qualidade) return;
        if (nivel === "critica" || qualidade.nivel === "normal") qualidade.nivel = nivel;
        qualidade.motivos.push(motivo);
    }

    function obterQualidadeLeitura(analise, data, horario, itemId) {
        return analise?.qualidadePorLeitura?.get(criarChaveLeitura(data, horario, itemId)) || null;
    }

    function criarChaveLeitura(data, horario, itemId) {
        return `${data}|${horario}|${itemId}`;
    }

    function obterRotuloNivel(nivel) {
        return {
            critica: "Leitura crítica",
            suspeita: "Verificar sensor",
            sem_dados: "Sem dados",
            desatualizada: "Sensor desatualizado",
            incompleta: "Dados incompletos",
            adequada: "Dados suficientes",
        }[nivel] || "Dados suficientes";
    }

    function resumirParaExportacao(analise) {
        if (!analise) return null;
        return {
            nivel: analise.nivel,
            status: analise.rotulo,
            estado: analise.estado,
            estadoRotulo: analise.rotuloEstado,
            leiturasValidas: analise.leiturasValidas,
            leiturasEsperadas: analise.leiturasEsperadas,
            coberturaPercentual: Number(analise.coberturaPercentual.toFixed(1)),
            ultimaLeitura: analise.ultimaLeitura ? {
                data: analise.ultimaLeitura.data,
                horario: formatarHorario(analise.ultimaLeitura.horario),
            } : null,
            avisos: analise.avisos,
        };
    }

    function formatarHorario(horario) {
        const [hora, minuto = "0"] = String(horario || "").split("-");
        return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    }

    function aplicarAoGrafico(containerId, analise) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.querySelector(".chart-quality-badge")?.remove();
        if (!analise || ["adequada", "sem_dados"].includes(analise.nivel)) return;

        const badge = document.createElement("span");
        badge.className = `chart-quality-badge chart-quality-badge--${analise.nivel}`;
        badge.textContent = analise.rotulo;
        badge.title = analise.avisos.join(" ");
        container.appendChild(badge);
    }

    window.ClimateDataQuality = {
        analisarSerie,
        obterQualidadeLeitura,
        resumirParaExportacao,
        aplicarAoGrafico,
    };
})();
