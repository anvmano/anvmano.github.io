import globals from "globals";

export default [
    { ignores: ["legacy/**", "node_modules/**", "docs/**"] },
    {
        files: ["scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "script",
            globals: {
                ...globals.browser,
                Chart: "readonly",
                ClimateData: "readonly",
                ClimateAnalytics: "readonly",
                ClimateCharts: "readonly",
                ClimateSolar: "readonly",
                AppConfig: "readonly",
                FirebaseService: "readonly",
                ClimateUI: "readonly",
                ClimateAqi: "readonly",
                ClimateZoom: "readonly",
                ClimatePdfReport: "readonly",
                ClimateChat: "readonly",
                PublicWeatherView: "readonly",
                ClimateAuthService: "readonly",
                html2canvas: "readonly",
            },
        },
        rules: {
            "no-undef": "error",
            "no-unreachable": "error",
            "no-dupe-keys": "error",
            "no-redeclare": "off",
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["tools/**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.browser,
                axe: "readonly",
                ClimateUI: "readonly",
                ClimateData: "readonly",
                ClimatePdfReport: "readonly",
                ClimatePdfReportModules: "readonly",
                AppConfig: "readonly",
            },
        },
        rules: { "no-undef": "error", "no-unreachable": "error" },
    },
];
