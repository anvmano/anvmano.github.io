'use strict';

(function () {
    const firebaseSdkVersion = "12.13.0";

    window.AppConfig = {
        firebase: {
            sdkVersion: firebaseSdkVersion,
            appUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-app.js`,
            databaseUrl: `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/firebase-database.js`,
            options: {
                apiKey: "AIzaSyD5gYEvLzvZItMrXGRlNbhfOPgNMj756_I",
                authDomain: "estacaometereologicaesp32.firebaseapp.com",
                databaseURL: "https://estacaometereologicaesp32-default-rtdb.firebaseio.com",
                projectId: "estacaometereologicaesp32",
                storageBucket: "estacaometereologicaesp32.appspot.com",
                messagingSenderId: "589754957740",
                appId: "1:589754957740:web:6299b8ce6763127b600409",
                measurementId: "G-8GE5G3X1Y9"
            }
        },
        colors: {
            blue: '#38bdf8',
            green: '#34d399',
            purple: '#a78bfa',
            amber: '#fbbf24',
            teal: '#2dd4bf',
            rose: '#fb7185',
            grid: 'rgba(99,132,200,0.1)',
            text: '#94a3b8',
        },
        comfortBand: {
            min: 20,
            max: 26,
            label: "Faixa de conforto",
        }
    };
})();
