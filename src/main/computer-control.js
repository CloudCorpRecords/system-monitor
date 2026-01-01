const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class ComputerControl {
    constructor() {
        this.commandHistory = [];
    }

    // ==================== OLLAMA MANAGEMENT ====================

    async checkOllamaInstalled() {
        try {
            // Check for macOS app first
            const appPath = '/Applications/Ollama.app';
            try {
                await fs.access(appPath);
                return { installed: true, path: appPath };
            } catch (e) { }

            // Check for CLI install
            const { stdout } = await execAsync('which ollama');
            return { installed: true, path: stdout.trim() };
        } catch (e) {
            return { installed: false, path: null };
        }
    }

    async installOllama() {
        try {
            // Check if already installed
            const check = await this.checkOllamaInstalled();
            if (check.installed) {
                return { success: true, message: 'Ollama is already installed', alreadyInstalled: true };
            }

            // Download and install macOS app
            await execAsync('curl -L -o /tmp/Ollama.zip https://ollama.com/download/Ollama-darwin.zip', { timeout: 300000 });
            await execAsync('unzip -o /tmp/Ollama.zip -d /Applications');
            return { success: true, message: 'Ollama installed successfully!' };
        } catch (err) {
            return { success: false, error: `Install failed: ${err.message}` };
        }
    }

    async startOllamaServer() {
        try {
            // Check if already running
            try {
                const response = await fetch('http://127.0.0.1:11434/api/tags');
                if (response.ok) {
                    return { success: true, message: 'Ollama server already running' };
                }
            } catch (e) { }

            // Start the ollama server binary directly (no GUI)
            const ollamaPath = '/Applications/Ollama.app/Contents/Resources/ollama';
            const child = spawn(ollamaPath, ['serve'], {
                detached: true,
                stdio: 'ignore'
            });
            child.unref();

            // Wait for server to start
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verify it started
            try {
                const response = await fetch('http://127.0.0.1:11434/api/tags');
                if (response.ok) {
                    return { success: true, message: 'Ollama server started!' };
                }
            } catch (e) { }

            return { success: true, message: 'Ollama server starting...' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async getAvailableModels() {
        try {
            const response = await fetch('http://127.0.0.1:11434/api/tags');
            const data = await response.json();
            return {
                success: true,
                models: data.models?.map(m => ({
                    name: m.name,
                    size: m.size,
                    modified: m.modified_at
                })) || []
            };
        } catch (err) {
            return { success: false, error: 'Ollama not running', models: [] };
        }
    }

    async pullModel(modelName) {
        try {
            // Start the pull - this can take a while
            const response = await fetch('http://127.0.0.1:11434/api/pull', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelName, stream: false })
            });

            if (!response.ok) {
                const error = await response.text();
                return { success: false, error };
            }

            return { success: true, message: `Model ${modelName} downloaded!` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async deleteModel(modelName) {
        try {
            await execAsync(`/Applications/Ollama.app/Contents/Resources/ollama rm ${modelName}`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ==================== ONE-CLICK SETUP ====================

    async quickSetup(preferredModel = 'llama3.2') {
        const steps = [];

        try {
            // Step 1: Check/Install Ollama
            steps.push({ step: 'install', status: 'running', message: 'Checking Ollama installation...' });

            const installed = await this.checkOllamaInstalled();
            if (!installed.installed) {
                steps[0].message = 'Installing Ollama...';
                const installResult = await this.installOllama();
                if (!installResult.success) {
                    steps[0].status = 'error';
                    steps[0].message = installResult.error;
                    return { success: false, steps, error: 'Installation failed' };
                }
            }
            steps[0].status = 'done';
            steps[0].message = 'Ollama installed ✓';

            // Step 2: Start Server
            steps.push({ step: 'server', status: 'running', message: 'Starting Ollama server...' });

            const serverResult = await this.startOllamaServer();
            if (!serverResult.success) {
                steps[1].status = 'error';
                steps[1].message = serverResult.error;
                return { success: false, steps, error: 'Server start failed' };
            }
            steps[1].status = 'done';
            steps[1].message = 'Server running ✓';

            // Step 3: Check/Download Model
            steps.push({ step: 'model', status: 'running', message: 'Checking for AI model...' });

            let activeModel = preferredModel;
            try {
                const models = await this.getAvailableModels();
                if (models.models && models.models.length > 0) {
                    // Use existing model!
                    activeModel = models.models[0].name.split(':')[0];
                    steps[2].status = 'done';
                    steps[2].message = `Using ${models.models[0].name} ✓`;
                } else {
                    // No models installed - download one
                    steps[2].message = `Downloading ${preferredModel}...`;
                    const pullResult = await this.pullModel(preferredModel);
                    if (!pullResult.success) {
                        steps[2].status = 'error';
                        steps[2].message = pullResult.error || 'Download failed';
                        return { success: false, steps, error: 'Model download failed' };
                    }
                    steps[2].status = 'done';
                    steps[2].message = 'AI model ready ✓';
                }
            } catch (fetchErr) {
                steps[2].status = 'error';
                steps[2].message = 'Could not check models';
                return { success: false, steps, error: fetchErr.message };
            }

            // All done!
            return {
                success: true,
                steps,
                message: 'AI Assistant is ready!',
                model: activeModel
            };
        } catch (err) {
            return { success: false, steps, error: err.message };
        }
    }

    // ==================== TERMINAL COMMANDS ====================

    async runCommand(command, options = {}) {
        const { timeout = 30000, safe = true } = options;

        // Safety check - block dangerous commands
        if (safe) {
            const dangerous = ['rm -rf /', 'sudo rm', 'mkfs', 'dd if=', ':(){', 'chmod -R 777 /'];
            if (dangerous.some(d => command.includes(d))) {
                return { success: false, error: 'Command blocked for safety reasons' };
            }
        }

        try {
            const { stdout, stderr } = await execAsync(command, { timeout });
            this.commandHistory.push({
                command,
                output: stdout,
                error: stderr,
                timestamp: Date.now(),
                success: true
            });
            return { success: true, output: stdout, error: stderr };
        } catch (err) {
            this.commandHistory.push({
                command,
                output: err.stdout || '',
                error: err.message,
                timestamp: Date.now(),
                success: false
            });
            return { success: false, error: err.message, output: err.stdout || '' };
        }
    }

    getCommandHistory() {
        return this.commandHistory.slice(-50);
    }

    // ==================== PROCESS CONTROL ====================

    async killProcess(pid) {
        try {
            process.kill(pid, 'SIGTERM');
            return { success: true, message: `Process ${pid} terminated` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async getProcessByName(name) {
        try {
            const { stdout } = await execAsync(`pgrep -l "${name}"`);
            const processes = stdout.trim().split('\n').map(line => {
                const [pid, ...nameParts] = line.split(' ');
                return { pid: parseInt(pid), name: nameParts.join(' ') };
            });
            return { success: true, processes };
        } catch (err) {
            return { success: true, processes: [] }; // No matching processes
        }
    }

    // ==================== SYSTEM ACTIONS ====================

    async openApplication(appName) {
        try {
            await execAsync(`open -a "${appName}"`);
            return { success: true, message: `Opened ${appName}` };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async openUrl(url) {
        try {
            await execAsync(`open "${url}"`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async setVolume(level) {
        try {
            const vol = Math.min(100, Math.max(0, level));
            await execAsync(`osascript -e "set volume output volume ${vol}"`);
            return { success: true, volume: vol };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async getClipboard() {
        try {
            const { stdout } = await execAsync('pbpaste');
            return { success: true, content: stdout };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async setClipboard(text) {
        try {
            await execAsync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async notify(title, message) {
        try {
            await execAsync(`osascript -e 'display notification "${message}" with title "${title}"'`);
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async sleep() {
        try {
            await execAsync('pmset sleepnow');
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async emptyTrash() {
        try {
            await execAsync('rm -rf ~/.Trash/*');
            return { success: true, message: 'Trash emptied' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }
}

module.exports = ComputerControl;
