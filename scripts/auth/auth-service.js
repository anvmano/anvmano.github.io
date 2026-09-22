'use strict';

(function () {
    let autenticacao = null;
    let usuarioAtual = null;
    let carregamentoAuth = null;
    let observadores = [];

    function normalizarEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function obterEmailsAutorizados() {
        return (window.AppConfig?.auth?.usuariosInternosAutorizados || []).map(normalizarEmail);
    }

    function ehUsuarioInterno(usuario = usuarioAtual) {
        const email = normalizarEmail(usuario?.email);
        return !!email && obterEmailsAutorizados().includes(email);
    }

    async function inicializar() {
        if (autenticacao) return autenticacao;
        if (carregamentoAuth) return carregamentoAuth;

        carregamentoAuth = (async () => {
            // Auth precisa apenas do App Firebase; o Database so entra no fluxo interno autorizado.
            await window.FirebaseService.initialize();
            const configuracao = window.AppConfig.firebase;
            const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = await import(configuracao.authUrl);
            const aplicacao = window.FirebaseService.getApp();
            autenticacao = getAuth(aplicacao);

            window.ClimateAuthService._googleAuthProvider = GoogleAuthProvider;
            window.ClimateAuthService._signInWithPopup = signInWithPopup;
            window.ClimateAuthService._signOut = signOut;
            window.ClimateAuthService._onAuthStateChanged = onAuthStateChanged;

            onAuthStateChanged(autenticacao, usuario => {
                usuarioAtual = usuario;
                observadores.forEach(observador => observador(usuario));
            });

            return autenticacao;
        })();

        return carregamentoAuth;
    }

    async function entrarComGoogle() {
        await inicializar();
        const provedor = new window.ClimateAuthService._googleAuthProvider();
        provedor.setCustomParameters({ prompt: "select_account" });
        return window.ClimateAuthService._signInWithPopup(autenticacao, provedor);
    }

    async function sair() {
        await inicializar();
        return window.ClimateAuthService._signOut(autenticacao);
    }

    async function observarEstado(aoConcluir) {
        observadores.push(aoConcluir);
        await inicializar();
        aoConcluir(usuarioAtual);
        return () => {
            observadores = observadores.filter(observador => observador !== aoConcluir);
        };
    }

    window.ClimateAuthService = {
        inicializar,
        entrarComGoogle,
        sair,
        observarEstado,
        obterUsuarioAtual: () => usuarioAtual,
        ehUsuarioInterno,
    };
})();
