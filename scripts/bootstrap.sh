#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="app"

echo "==> Checking required tools..."
command -v node >/dev/null 2>&1 || { echo "Node.js not found"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "npx not found"; exit 1; }

echo "==> Node version: $(node -v)"
echo "==> npm version: $(npm -v)"

if [ -d "$PROJECT_DIR" ]; then
  echo "==> '$PROJECT_DIR' already exists, skip app creation."
else
  echo "==> Creating Expo TypeScript app in '$PROJECT_DIR'..."
  npx create-expo-app@latest "$PROJECT_DIR" --template blank-typescript
fi

echo "==> Installing EAS CLI (global)..."
npm i -g eas-cli

echo
echo "Setup complete."
echo "Next:"
echo "  cd $PROJECT_DIR"
echo "  npm run start"
echo "  npm run ios"
echo "  npm run android"
echo "  eas init"
