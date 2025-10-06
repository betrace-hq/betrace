const eslintConfig = [
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn",
      "prefer-const": "error",
    },
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.d.ts",
      ".tanstack/**",
    ],
  },
];

export default eslintConfig;
