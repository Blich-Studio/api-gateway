import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettierConfig from "./prettier.js";
const toConfigArray = (config) => {
    if (!config) {
        return [];
    }
    return Array.isArray(config) ? config : [config];
};
const prettierCompatibilityConfig = eslintConfigPrettier;
const prettierPlugin = eslintPluginPrettier;
const prettierRuleEntry = [
    "warn",
    { ...prettierConfig, severity: 1 },
];
const sharedRules = {
    "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
    "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/dot-notation": [
        "error",
        {
            allowKeywords: true,
            allowPattern: "",
        },
    ],
    "@typescript-eslint/member-ordering": [
        "error",
        {
            default: ["signature", "field", "constructor", "method"],
        },
    ],
    "@typescript-eslint/no-confusing-void-expression": "error",
    "@typescript-eslint/no-empty-function": [
        "error",
        {
            allow: [],
        },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-unnecessary-condition": "error",
    "@typescript-eslint/no-unused-expressions": [
        "error",
        {
            allowShortCircuit: false,
            allowTernary: false,
            allowTaggedTemplates: false,
            enforceForJSX: true,
        },
    ],
    "@typescript-eslint/no-unused-vars": [
        "error",
        {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
        },
    ],
    "@typescript-eslint/prefer-as-const": "error",
    "@typescript-eslint/prefer-destructuring": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "@typescript-eslint/require-await": "error",
};
const sharedSegments = [
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "*.config.js",
            "*.config.mjs",
            "*.config.ts",
            "coverage/**",
            ".turbo/**",
        ],
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    prettierCompatibilityConfig,
    {
        plugins: {
            prettier: prettierPlugin,
        },
        rules: {
            "prettier/prettier": prettierRuleEntry,
        },
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: sharedRules,
    },
];
export const sharedConfig = tseslint.config(...sharedSegments);
export const defineSharedConfig = (...overrides) => tseslint.config(...sharedSegments, ...overrides.flatMap(toConfigArray));
export { prettierConfig };
export default defineSharedConfig;
