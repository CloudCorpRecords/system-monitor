const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SystemInfo = require('./system-info');
const DependencyScanner = require('./dependency-scanner');
const Optimizer = require('./optimizer');
const AIAssistant = require('./ai-assistant');
const ComputerControl = require('./computer-control');
const AIGuardian = require('./ai-guardian');
const AutomationManager = require('./automation-manager');
const SecurityMonitor = require('./security-monitor');
const CyberShield = require('./cyber-shield');
const Uninstaller = require('./uninstaller');

const systemInfo = new SystemInfo();
const depScanner = new DependencyScanner();
const optimizer = new Optimizer();
const aiAssistant = new AIAssistant();
const computerControl = new ComputerControl();
const guardian = new AIGuardian(computerControl, aiAssistant);
const automation = new AutomationManager(computerControl);
const security = new SecurityMonitor(computerControl);
const cyberShield = new CyberShield(computerControl);
const uninstaller = new Uninstaller();

const { setupTray, updateTrayTitle } = require('./tray');

let mainWindow;
let tray;
let tickCount = 0;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f0f1a',
        webPreferences: {
            preload: path.join(__dirname, '../preload/preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Close to Tray behavior
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });

    // Load Vite dev server in dev, or built files in production
    if (!app.isPackaged) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();
    tray = setupTray(mainWindow);

    // Update Tray every 3 seconds
    // Update Loop (Optimized for Low Power)
    setInterval(async () => {
        try {
            // 1. Lightweight Stats (CPU/Temp)
            const stats = await systemInfo.getTrayStats();
            const struct = {
                cpu: { usage: stats.cpuLoad },
                sensors: { cpu: { main: stats.temp } }
            };

            // 2. Update Tray
            updateTrayTitle(tray, struct);

            // 3. Automation (Every ~9s)
            if (tickCount % 3 === 0) {
                const procs = await systemInfo.getProcesses();
                automation.checkRules(struct, procs.list || []);
            }

            // 4. Security Scan (Every ~30s)
            if (tickCount % 10 === 0) {
                security.scanNetwork();
            }

            // 5. Guardian (Every 3s)
            guardian.check(struct);

            tickCount++;
        } catch (e) {
            console.error('Background loop error:', e);
        }
    }, 3000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers for System Info
ipcMain.handle('system:getOverview', async () => {
    return await systemInfo.getOverview();
});

ipcMain.handle('system:getSensors', async () => {
    return await systemInfo.getSensors();
});

ipcMain.handle('system:getCpuInfo', async () => {
    return await systemInfo.getCpuInfo();
});

ipcMain.handle('system:getMemoryInfo', async () => {
    return await systemInfo.getMemoryInfo();
});

ipcMain.handle('system:getDiskInfo', async () => {
    return await systemInfo.getDiskInfo();
});

ipcMain.handle('system:getNetworkInfo', async () => {
    return await systemInfo.getNetworkInfo();
});

ipcMain.handle('system:getBatteryInfo', async () => {
    return await systemInfo.getBatteryInfo();
});

ipcMain.handle('system:getProcesses', async () => {
    return await systemInfo.getProcesses();
});

// IPC Handlers for Dependencies
ipcMain.handle('deps:scanNpm', async () => {
    return await depScanner.scanNpm();
});

ipcMain.handle('deps:scanPip', async () => {
    return await depScanner.scanPip();
});

ipcMain.handle('deps:scanBrew', async () => {
    return await depScanner.scanBrew();
});

ipcMain.handle('deps:updatePackage', async (event, { type, name }) => {
    return await depScanner.updatePackage(type, name);
});

ipcMain.handle('deps:updateAll', async (event, { type }) => {
    return await depScanner.updateAll(type);
});

// IPC Handlers for Optimizer
ipcMain.handle('optimize:clearCache', async () => {
    return await optimizer.clearCache();
});

ipcMain.handle('optimize:getCacheSize', async () => {
    return await optimizer.getCacheSize();
});

ipcMain.handle('optimize:getStartupItems', async () => {
    return await optimizer.getStartupItems();
});

ipcMain.handle('optimize:freeMemory', async () => {
    return await optimizer.freeMemory();
});

// IPC Handlers for AI Assistant
ipcMain.handle('ai:getSettings', async () => {
    return aiAssistant.getSettings();
});

ipcMain.handle('ai:saveSettings', async (event, settings) => {
    return aiAssistant.saveSettings(settings);
});

ipcMain.handle('ai:chat', async (event, message) => {
    // Update context before chat
    try {
        const overview = await systemInfo.getOverview();
        const cacheSize = await optimizer.getCacheSize();
        await aiAssistant.updateSystemContext(overview, null, cacheSize);
    } catch (e) { }

    return await aiAssistant.chat(message);
});

ipcMain.handle('ai:checkOllama', async () => {
    return await aiAssistant.checkOllamaStatus();
});

ipcMain.handle('ai:getMemoryStats', async () => {
    return aiAssistant.getMemoryStats();
});

ipcMain.handle('ai:clearMemory', async () => {
    return aiAssistant.clearMemory();
});

ipcMain.handle('ai:savePreference', async (event, { key, value }) => {
    aiAssistant.savePreference(key, value);
    return { success: true };
});

ipcMain.handle('ai:executeAction', async (event, actionData) => {
    let result;
    // Handle both old string format and new object format
    const action = typeof actionData === 'string' ? actionData : actionData.action;
    const param = typeof actionData === 'object' ? actionData.param : null;

    switch (action) {
        case 'CLEAR_CACHE':
            result = await optimizer.clearCache();
            aiAssistant.recordOptimization('CLEAR_CACHE', result.success ? 'success' : 'failed');
            return result;
        case 'FREE_MEMORY':
            result = await optimizer.freeMemory();
            aiAssistant.recordOptimization('FREE_MEMORY', result.success ? 'success' : 'failed');
            return result;
        case 'EMPTY_TRASH':
            result = await computerControl.emptyTrash();
            aiAssistant.recordOptimization('EMPTY_TRASH', result.success ? 'success' : 'failed');
            return result;
        case 'SCAN_DEPS':
            const [npm, pip, brew] = await Promise.all([
                depScanner.scanNpm(),
                depScanner.scanPip(),
                depScanner.scanBrew()
            ]);
            return { success: true, npm, pip, brew };
        case 'UPDATE_ALL_NPM':
            result = await depScanner.updateAll('npm');
            aiAssistant.recordOptimization('UPDATE_ALL_NPM', result.success ? 'success' : 'failed');
            return result;
        case 'UPDATE_ALL_PIP':
            result = await depScanner.updateAll('pip');
            aiAssistant.recordOptimization('UPDATE_ALL_PIP', result.success ? 'success' : 'failed');
            return result;
        case 'UPDATE_ALL_BREW':
            result = await depScanner.updateAll('brew');
            aiAssistant.recordOptimization('UPDATE_ALL_BREW', result.success ? 'success' : 'failed');
            return result;
        // Computer Control Actions
        case 'OPEN_APP':
            return await computerControl.openApplication(param);
        case 'OPEN_URL':
            return await computerControl.openUrl(param);
        case 'RUN_CMD':
            result = await computerControl.runCommand(param);
            aiAssistant.recordOptimization('RUN_CMD', result.success ? 'success' : 'failed');
            return result;
        case 'NOTIFY':
            return await computerControl.notify('System Monitor', param);
        case 'SET_VOLUME':
            return await computerControl.setVolume(parseInt(param) || 50);
        // File System Agent Actions
        case 'LIST_DIR':
            return await computerControl.listDir(param);
        case 'READ_FILE':
            return await computerControl.readFile(param);
        case 'WRITE_FILE':
            // Format: path|content OR JSON
            if (param.startsWith('{')) {
                try {
                    const data = JSON.parse(param);
                    return await computerControl.writeFile(data.path, data.content);
                } catch (e) { }
            }
            // Fallback: split by first pipe
            const firstPipe = param.indexOf('|');
            if (firstPipe === -1) return { success: false, error: 'Invalid format. Use path|content' };
            const wPath = param.substring(0, firstPipe);
            const wContent = param.substring(firstPipe + 1);
            return await computerControl.writeFile(wPath, wContent);
        case 'MOVE_FILE':
            const [src, dest] = param.split('|');
            return await computerControl.moveFile(src, dest);
        case 'ADD_RULE':
            const [trig, act] = param.split('|');
            return await automation.addRule(trig, act);
        case 'ENABLE_ADBLOCK':
            return await cyberShield.enableAdBlock();
        case 'UNINSTALL_APP':
            return await uninstaller.uninstall(param);
        case 'DISABLE_ADBLOCK':
            return await cyberShield.disableAdBlock();
        case 'SCAN_NETWORK':
            return await cyberShield.scanLocalNetwork();
        default:
            return { success: false, error: `Unknown action: ${action}` };
    }
});

// ==================== COMPUTER CONTROL ====================

// Ollama Management
ipcMain.handle('ollama:checkInstalled', async () => {
    return await computerControl.checkOllamaInstalled();
});

ipcMain.handle('ollama:install', async () => {
    return await computerControl.installOllama();
});

ipcMain.handle('ollama:startServer', async () => {
    return await computerControl.startOllamaServer();
});

ipcMain.handle('ollama:getModels', async () => {
    return await computerControl.getAvailableModels();
});

ipcMain.handle('ollama:pullModel', async (event, modelName) => {
    return await computerControl.pullModel(modelName);
});

ipcMain.handle('ollama:deleteModel', async (event, modelName) => {
    return await computerControl.deleteModel(modelName);
});

// One-click setup
ipcMain.handle('ollama:quickSetup', async (event, model) => {
    return await computerControl.quickSetup(model || 'llama3.2');
});

// Terminal & Process Control
ipcMain.handle('computer:runCommand', async (event, command) => {
    return await computerControl.runCommand(command);
});

ipcMain.handle('computer:killProcess', async (event, pid) => {
    return await computerControl.killProcess(pid);
});

ipcMain.handle('computer:openApp', async (event, appName) => {
    return await computerControl.openApplication(appName);
});

ipcMain.handle('computer:openUrl', async (event, url) => {
    return await computerControl.openUrl(url);
});

ipcMain.handle('computer:notify', async (event, { title, message }) => {
    return await computerControl.notify(title, message);
});

ipcMain.handle('computer:emptyTrash', async () => {
    return await computerControl.emptyTrash();
});

ipcMain.handle('computer:setVolume', async (event, level) => {
    return await computerControl.setVolume(level);
});

ipcMain.handle('computer:runSpeedTest', async () => {
    return await computerControl.runSpeedTest();
});
