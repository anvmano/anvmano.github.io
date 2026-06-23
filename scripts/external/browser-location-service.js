'use strict';

(function () {
    async function obterLocalizacaoAtual() {
        if (!navigator.geolocation) {
            throw new Error("Geolocalização não está disponível neste navegador.");
        }

        try {
            return await obterLocalizacaoComOpcoes({
                enableHighAccuracy: false,
                timeout: 3000,
                maximumAge: 60 * 60 * 1000,
            });
        } catch (erroCache) {
            if (erroCache.codigo === 1) throw erroCache;
        }

        try {
            return await obterLocalizacaoComOpcoes({
                enableHighAccuracy: false,
                timeout: 25000,
                maximumAge: 15 * 60 * 1000,
            });
        } catch (erroPadrao) {
            if (erroPadrao.codigo === 1) throw erroPadrao;
        }

        return obterLocalizacaoComOpcoes({
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0,
        });
    }

    function obterLocalizacaoComOpcoes(opcoes) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                posicao => resolve(normalizarPosicao(posicao)),
                erro => reject(criarErroLocalizacao(erro)),
                opcoes
            );
        });
    }

    function normalizarPosicao(posicao) {
        return {
            latitude: posicao.coords.latitude,
            longitude: posicao.coords.longitude,
            precisao: posicao.coords.accuracy,
        };
    }

    function criarErroLocalizacao(erro) {
        const erroNormalizado = new Error(obterMensagemErro(erro));
        erroNormalizado.codigo = erro?.code;
        erroNormalizado.PERMISSION_DENIED = erro?.PERMISSION_DENIED;
        erroNormalizado.POSITION_UNAVAILABLE = erro?.POSITION_UNAVAILABLE;
        erroNormalizado.TIMEOUT = erro?.TIMEOUT;
        return erroNormalizado;
    }

    function obterMensagemErro(erro) {
        if (erro?.code === erro.PERMISSION_DENIED) return "Permissão de localização negada.";
        if (erro?.code === erro.POSITION_UNAVAILABLE) return "Localização indisponível no momento.";
        if (erro?.code === erro.TIMEOUT) return "Tempo esgotado ao obter localização. Tente novamente ou informe o CEP.";
        return "Não foi possível obter a localização.";
    }

    window.BrowserLocationService = {
        obterLocalizacaoAtual,
    };
})();
