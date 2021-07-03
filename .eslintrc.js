module.exports = {
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['eslint-plugin-jsdoc', 'eslint-plugin-prefer-arrow', 'eslint-plugin-react', '@typescript-eslint'],
  rules: {
    "no-fallthrough": ["error", { "commentPattern": "break[\\s\\w]*omitted" }]
  },
};
