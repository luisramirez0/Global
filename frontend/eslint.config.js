import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const HTML_SINK_MESSAGE = 'Interpreta HTML (riesgo XSS, regla 3): usar textContent o h() de src/utils/dom.';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'error' },
  },
  {
    // Código de producción: sin APIs que interpretan HTML, sin eval, sin localStorage y sin console
    // (design D2/D5; reglas 3 y 5). Los tests pueden usar innerHTML para armar fixtures.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: HTML_SINK_MESSAGE },
        { property: 'outerHTML', message: HTML_SINK_MESSAGE },
        { property: 'insertAdjacentHTML', message: HTML_SINK_MESSAGE },
        { property: 'createContextualFragment', message: HTML_SINK_MESSAGE },
        { object: 'document', property: 'write', message: HTML_SINK_MESSAGE },
        { object: 'document', property: 'writeln', message: HTML_SINK_MESSAGE },
        { object: 'window', property: 'localStorage', message: 'Prohibido: la sesión usa sessionStorage (design D2).' },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='DOMParser']", message: HTML_SINK_MESSAGE },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Prohibido: la sesión usa sessionStorage (design D2).' },
      ],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
      'no-console': 'error',
    },
  },
);
