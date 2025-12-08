#!/bin/bash
set -e

echo "Building Kagome WASM..."

cd "$(dirname "$0")/../packages/metime"

# Ensure dependencies
echo "Fetching Go dependencies..."
go mod download

# Build WASM
echo "Compiling to WebAssembly..."
GOOS=js GOARCH=wasm go build -o ../../public/kagome.wasm main.go

# Copy wasm_exec.js
echo "Copying wasm_exec.js..."
GOROOT=$(go env GOROOT)
if [ -f "$GOROOT/misc/wasm/wasm_exec.js" ]; then
    cp "$GOROOT/misc/wasm/wasm_exec.js" ../../public/
elif [ -f "$GOROOT/lib/wasm/wasm_exec.js" ]; then
    cp "$GOROOT/lib/wasm/wasm_exec.js" ../../public/
else
    echo "Error: wasm_exec.js not found in $GOROOT/misc/wasm or $GOROOT/lib/wasm"
    exit 1
fi

echo "✓ WASM build complete!"
echo "  - kagome.wasm: $(du -h ../../public/kagome.wasm | cut -f1)"
echo "  - wasm_exec.js: copied"
