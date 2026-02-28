import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { importJsxModule } from '../helpers/jsx-loader.js';

const loaderModulePath = path.resolve(process.cwd(), 'src/components/Loader.jsx');

test('Loader renders progress and step labels', async () => {
  const { default: Loader } = await importJsxModule(loaderModulePath);
  const html = renderToStaticMarkup(React.createElement(Loader, {
    steps: ['Load ICAL', 'Import data'],
    activeStep: 1,
    message: 'Chargement'
  }));

  assert.match(html, /50%/);
  assert.match(html, /Load ICAL/);
  assert.match(html, /Import data/);
  assert.match(html, /Chargement/);
});

test('Loader shows ready state when all steps are done', async () => {
  const { default: Loader } = await importJsxModule(loaderModulePath);
  const html = renderToStaticMarkup(React.createElement(Loader, {
    steps: ['Step A', 'Step B'],
    activeStep: 2
  }));

  assert.match(html, /Prêt/);
  assert.match(html, /Initialisation/);
});
