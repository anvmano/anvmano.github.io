'use strict';

(function () {
    let auth = null;
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
        if (auth) return auth;
        if (carregamentoAuth) return carregamentoAuth;

        carregamentoAuth = (async () => {
            await window.FirebaseService.initialize();
            const config = window.AppConfig.firebase;
            const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } = await import(config.authUrl);
            const app = window.FirebaseService.getApp();
            auth = getAuth(app);

            window.ClimateAuthService._googleAuthProvider = GoogleAuthProvider;
            window.ClimateAuthService._signInWithPopup = signInWithPopup;
            window.ClimateAuthService._signOut = signOut;
            window.ClimateAuthService._onAuthStateChanged = onAuthStateChanged;

            onAuthStateChanged(auth, usuario => {
                usuarioAtual = usuario;
                observadores.forEach(observador => observador(usuario));
            });

            return auth;
        })();

        return carregamentoAuth;
    }

    async function entrarComGoogle() {
        await inicializar();
        const provider = new window.ClimateAuthService._googleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        return window.ClimateAuthService._signInWithPopup(auth, provider);
    }

    async function sair() {
        await inicializar();
        return window.ClimateAuthService._signOut(auth);
    }

    async function observarEstado(callback) {
        observadores.push(callback);
        await inicializar();
        callback(usuarioAtual);
        return () => {
            observadores = observadores.filter(observador => observador !== callback);
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
