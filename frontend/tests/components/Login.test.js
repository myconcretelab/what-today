import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsxModule } from '../helpers/jsx-loader.js';

const loginModulePath = path.resolve(process.cwd(), 'src/components/Login.jsx');

test('Login renders password access form', async () => {
  const { default: Login } = await importJsxModule(loginModulePath);
  const html = renderToStaticMarkup(React.createElement(Login, { onLogin: () => {} }));

  assert.match(html, /Accès réservé/);
  assert.match(html, /Mot de passe/);
  assert.match(html, /Entrer/);
});
