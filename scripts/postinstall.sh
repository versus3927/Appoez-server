#!/bin/bash
# Fix: simple-ytdl-core/dist/index.d.cts has ESM syntax but .cts extension
# causes Next.js Turbopack to treat it as CJS → build error.
FILE="./node_modules/simple-ytdl-core/dist/index.d.cts"
if [ -f "$FILE" ]; then
    rm "$FILE"
    echo "[postinstall] Removed $FILE (Turbopack CJS/ESM conflict workaround)"
fi
