# System Monitor AI 🖥️ 🤖

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

**System Monitor AI** is a next-generation system utility for macOS that combines real-time hardware monitoring with a powerful, agentic AI assistant. Unlike traditional monitors, this app allows you to **talk to your computer** to check stats, optimize performance, and perform system tasks.

## ✨ Features

- **📊 Real-Time Monitoring**: Beautiful, animated dashboards for CPU, Memory, Disk, Network, and Battery.
- **🤖 Integrated AI Assistant**: 
  - **Local Privacy**: One-click setup for **Ollama** (runs 100% offline).
  - **Cloud Power**: Optional integration with Google Gemini.
- **⚡️ Computer Control**: Ask the AI to:
  - "Open Safari"
  - "Clean up my system"
  - "Check for outdated packages"
  - "Tell me what's using the most RAM"
- **🛡️ Cyber Shield**: System-wide ad blocking, network scanning, and process monitoring.
- **🕵️‍♂️ Red Team Recon**: Auto-discover targets on LAN and scan for vulnerabilities (Port Scan + Service Banner Grabbing).
- **⚡️ Agentic Autonomy**: The AI proactively manages your system with self-created rules (e.g., "When I open Code, turn on Do Not Disturb").
- **🛠️ Optimization Tools**: Built-in tools to free RAM, clear caches, and manage dependencies (Homebrew, npm, pip).
- **📦 Auto-Setup**: "Quick Setup" button automatically installs Ollama and downloads models.

## �️‍♂️ Red Team Capabilities
The app helps you audit your local network security with agentic tools:
*   **Auto Recon 🚀**: One-click subnet discovery. Maps all devices on your LAN.
*   **Vulnerability Scanner**: Multi-threaded port scanning to find exposed services (22, 80, 443, etc).
*   **Service Identification**: automatically grabs banners to identify software versions (e.g. `Apache/2.4`, `OpenSSH`).
*   **Report Generation**: Creates structured reports of all found targets.

## �🚀 Getting Started

### One-Click Installer (Recommended)
We've included a script that automatically builds and installs the app to your `/Applications` folder.

```bash
# Clone and Install
git clone https://github.com/CloudCorpRecords/system-monitor.git
cd system-monitor
chmod +x install_local.sh
./install_local.sh
```

### Manual Build
If you prefer to build manually or generate a `.dmg` installer for distribution:

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Release**
   ```bash
   npm run build
   ```
   *   **Application**: `release/mac-arm64/System Monitor.app`
   *   **Installer**: `release/System Monitor Installer.dmg` (Perfect for sharing)

## 🤝 Contributing

We love contributions! Whether it's fixing bugs, improving the UI, or adding new AI capabilities, your help is welcome.

1. **Fork the Project** (Click the 'Fork' button top right)
2. **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes** (`git commit -m 'Add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

##  Acknowledgments
- Built with [Electron](https://www.electronjs.org/) and [Vite](https://vitejs.dev/)
- Charts by [Chart.js](https://www.chartjs.org/)
- AI powered by [Ollama](https://ollama.com/) & [Google Gemini](https://deepmind.google/technologies/gemini/)
