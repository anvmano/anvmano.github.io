'use strict';

(function () {
    function configurar(opcoes = {}) {
        window.ClimateAssistant?.ui?.setup(opcoes);
    }

    window.ClimateChat = { setup: configurar };
})();
