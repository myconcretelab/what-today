#!/bin/bash
set -euo pipefail

# Synchronize repository with remote
git pull

# Build the frontend application
npm run build
