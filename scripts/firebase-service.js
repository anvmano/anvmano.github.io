'use strict';

(function () {
    let app = null;
    let database = null;
    let refFn = null;
    let onValueFn = null;
    let carregamentoApp = null;
    let carregamentoDatabase = null;
    let pendingLoads = 0;
    let appCheckInitialized = false;

    function setLoading(isLoading) {
        const el = document.getElementById("loadingBar");
        if (!el) return;
        el.classList.toggle("is-active", isLoading);
    }

    function trackLoadStart() {
        pendingLoads++;
        setLoading(true);
    }

    function trackLoadEnd() {
        pendingLoads = Math.max(0, pendingLoads - 1);
        setLoading(pendingLoads > 0);
    }

    function handleError(path, error) {
        window.ClimateDiagnostics?.erro(`Erro ao carregar ${path}.`, error);
    }

    async function initialize() {
        if (app) return app;
        if (carregamentoApp) return carregamentoApp;

        carregamentoApp = (async () => {
            const config = window.AppConfig.firebase;
            const { initializeApp } = await import(config.appUrl);
            app = initializeApp(config.options);
            return app;
        })();

        return carregamentoApp;
    }

    async function initializeDatabase() {
        if (database) return database;
        if (carregamentoDatabase) return carregamentoDatabase;

        carregamentoDatabase = (async () => {
            await initialize();
            const { getDatabase, onValue, ref } = await import(window.AppConfig.firebase.databaseUrl);
            database = getDatabase(app);
            refFn = ref;
            onValueFn = onValue;
            return database;
        })();

        return carregamentoDatabase;
    }

    async function ensureAppCheckInitialized() {
        await initialize();
        return initializeAppCheckIfConfigured();
    }

    async function initializeAppCheckIfConfigured() {
        const config = window.AppConfig.firebase;
        // App Check fica sob demanda para evitar carregar reCAPTCHA antes de recursos protegidos, como a IA.
        if (appCheckInitialized || !config.recaptchaEnterpriseSiteKey || !config.appCheckUrl || ehHostLocal()) return;

        try {
            const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(config.appCheckUrl);
            initializeAppCheck(app, {
                provider: new ReCaptchaEnterpriseProvider(config.recaptchaEnterpriseSiteKey),
                isTokenAutoRefreshEnabled: true,
            });
            appCheckInitialized = true;
        } catch (error) {
            window.ClimateDiagnostics?.depurar("App Check não foi inicializado.", error);
        }
    }

    function ehHostLocal() {
        const hostname = window.location.hostname;
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }

    function listenToPath(path, onData, onError) {
        if (!database || !refFn || !onValueFn) {
            throw new Error("Firebase Database ainda não foi inicializado.");
        }
        let firstLoad = true;
        trackLoadStart();

        return onValueFn(refFn(database, path), snapshot => {
            if (firstLoad) {
                trackLoadEnd();
                firstLoad = false;
            }
            const dados = snapshot.val();
            if (!window.ClimateContracts?.validarColecaoFirebase?.(dados)) {
                const erro = new TypeError(`Estrutura Firebase inválida em ${path}.`);
                handleError(path, erro);
                if (onError) onError(erro);
                return;
            }
            onData(dados);
        }, error => {
            if (firstLoad) {
                trackLoadEnd();
                firstLoad = false;
            }
            handleError(path, error);
            if (onError) onError(error);
        });
    }

    window.FirebaseService = {
        initialize,
        initializeDatabase,
        ensureAppCheckInitialized,
        listenToPath,
        getApp: () => app,
        setLoading,
        trackLoadStart,
        trackLoadEnd,
        handleError,
    };
})();
