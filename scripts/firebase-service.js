'use strict';

(function () {
    let database = null;
    let refFn = null;
    let onValueFn = null;
    let pendingLoads = 0;

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
        console.error(`Erro ao carregar ${path}:`, error);
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

        const app = initializeApp(config.options);
        database = getDatabase(app);
        refFn = ref;
        onValueFn = onValue;
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
        setLoading,
        trackLoadStart,
        trackLoadEnd,
        handleError,
    };
})();
