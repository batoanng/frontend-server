module.exports = {
    env: { browser: true, es2020: true },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:react-hooks/recommended',
      'plugin:prettier/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: ['react-refresh'],
    rules: {
      indent: [
        'error',
        2,
        {
          ArrayExpression: 1,
          ImportDeclaration: 1,
          ObjectExpression: 1,
          SwitchCase: 1,
          FunctionExpression: { body: 1, parameters: 1 },
          CallExpression: { arguments: 1 },
          ignoreComments: true,
        },
      ],
      'jsx-quotes': ['error', 'prefer-double'],
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          printWidth: 120,
          endOfLine: 'auto',
        },
      ],
      quotes: [
        'error',
        'single',
        {
          allowTemplateLiterals: true,
          avoidEscape: true,
        },
      ],
      'react-refresh/only-export-components': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  };
  