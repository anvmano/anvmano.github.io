'use strict';

(function () {
    let app = null;
    let database = null;
    let refFn = null;
    let onValueFn = null;
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
        if (database) return;

        const config = window.AppConfig.firebase;
        const [
            { initializeApp },
            { getDatabase, onValue, ref }
        ] = await Promise.all([
            import(config.appUrl),
            import(config.databaseUrl)
        ]);

        app = initializeApp(config.options);
        await initializeAppCheckIfConfigured();

        database = getDatabase(app);
        refFn = ref;
        onValueFn = onValue;
    }

    async function initializeAppCheckIfConfigured() {
        const config = window.AppConfig.firebase;
        if (appCheckInitialized || !config.recaptchaEnterpriseSiteKey || !config.appCheckUrl || isLocalHost()) return;

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

    function isLocalHost() {
        const hostname = window.location.hostname;
        return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    }

    function listenToPath(path, onData, onError) {
        let firstLoad = true;
        trackLoadStart();

        return onValueFn(refFn(database, path), snapshot => {
            if (firstLoad) {
                trackLoadEnd();
                firstLoad = false;
            }
            onData(snapshot.val());
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
        listenToPath,
        getApp: () => app,
        setLoading,
        trackLoadStart,
        trackLoadEnd,
        handleError,
    };
})();
