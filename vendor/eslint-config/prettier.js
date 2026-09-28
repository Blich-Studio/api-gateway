export const prettierConfig = {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    quoteProps: 'as-needed',
    trailingComma: 'es5',
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'avoid',
    endOfLine: 'lf',
    overrides: [
        {
            files: '*.json',
            options: {
                printWidth: 200,
            },
        },
        {
            files: '*.md',
            options: {
                printWidth: 80,
                proseWrap: 'preserve',
            },
        },
        {
            files: ['*.yaml', '*.yml'],
            options: {
                tabWidth: 2,
                singleQuote: false,
            },
        },
    ],
};
export default prettierConfig;
