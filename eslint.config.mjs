import typescriptEslint from "typescript-eslint";

export default [
    // 1. 忽略构建产物和第三方包
    {
        ignores: [
            "**/dist/**",
            "**/node_modules/**",
            "**/out/**",
            "**/release/**",
            "pnpm-lock.yaml"
        ],
    },
    // 2. 针对所有 TypeScript 文件的统一规则
    {
        files: ["**/*.ts"],
        plugins: {
            "@typescript-eslint": typescriptEslint.plugin,
        },
        languageOptions: {
            parser: typescriptEslint.parser,
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            // 核心质量规则：强制检查未使用的变量
            "@typescript-eslint/no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            // 代码风格规则
            "curly": "warn",
            "eqeqeq": "warn",
            "no-throw-literal": "warn",
            "semi": ["warn", "always"],
            "@typescript-eslint/naming-convention": ["warn", {
                selector: "import",
                format: ["camelCase", "PascalCase"],
            }],
        },
    }
];
