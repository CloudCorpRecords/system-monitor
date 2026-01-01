#!/bin/bash

# System Monitor - One Click Installer (Source)
echo "🚀 Starting Installation of System Monitor..."

# 1. Install Dependencies
echo "📦 Installing System Dependencies..."
npm install

# 2. Build the App
echo "🔨 Building Application (Vite + Electron)..."
npm run build

# 3. Detect Platform and Install
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍏 macOS detected. Deploying to /Applications..."
    
    # Close if running
    pkill -f "System Monitor" || true
    
    # Remove old
    rm -rf "/Applications/System Monitor.app"
    
    # Copy new (Check architecture)
    if [ -d "release/mac-arm64/System Monitor.app" ]; then
        cp -r "release/mac-arm64/System Monitor.app" /Applications/
    elif [ -d "release/mac/System Monitor.app" ]; then
        cp -r "release/mac/System Monitor.app" /Applications/
    else
        echo "❌ Error: Could not find built application!"
        exit 1
    fi
    
    echo "✅ Installed successfully!"
    echo "🚀 Launching..."
    open "/Applications/System Monitor.app"
else
    echo "⚠️  This installer script is optimized for macOS. Please install manually on this OS."
fi
