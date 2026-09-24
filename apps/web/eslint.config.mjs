import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'public/sw.js'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  { rules: { 'react/no-danger': 'error', '@next/next/no-img-element': 'off' } },
];
