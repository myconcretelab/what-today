#!/bin/bash
set -euo pipefail

before_lock_hash='';
if [[ -f package-lock.json ]]; then
  before_lock_hash="$(shasum package-lock.json | awk '{print $1}')";
fi

# Synchronize repository with remote
git pull

after_lock_hash='';
if [[ -f package-lock.json ]]; then
  after_lock_hash="$(shasum package-lock.json | awk '{print $1}')";
fi

if [[ "${before_lock_hash}" != "${after_lock_hash}" ]]; then
  npm ci
fi

# Build the frontend application
npm run build
