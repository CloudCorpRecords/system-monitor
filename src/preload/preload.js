const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('systemMonitor', {
    // System Info
    getOverview: () => ipcRenderer.invoke('system:getOverview'),
    getCpuInfo: () => ipcRenderer.invoke('system:getCpuInfo'),
    getMemoryInfo: () => ipcRenderer.invoke('system:getMemoryInfo'),
    getDiskInfo: () => ipcRenderer.invoke('system:getDiskInfo'),
    getNetworkInfo: () => ipcRenderer.invoke('system:getNetworkInfo'),
    getBatteryInfo: () => ipcRenderer.invoke('system:getBatteryInfo'),
    getProcesses: () => ipcRenderer.invoke('system:getProcesses'),
    getSensors: () => ipcRenderer.invoke('system:getSensors'),

    // Dependencies
    scanNpm: () => ipcRenderer.invoke('deps:scanNpm'),
    scanPip: () => ipcRenderer.invoke('deps:scanPip'),
    scanBrew: () => ipcRenderer.invoke('deps:scanBrew'),
    updatePackage: (type, name) => ipcRenderer.invoke('deps:updatePackage', { type, name }),
    updateAll: (type) => ipcRenderer.invoke('deps:updateAll', { type }),

    // Optimizer
    clearCache: () => ipcRenderer.invoke('optimize:clearCache'),
    getCacheSize: () => ipcRenderer.invoke('optimize:getCacheSize'),
    getStartupItems: () => ipcRenderer.invoke('optimize:getStartupItems'),
    freeMemory: () => ipcRenderer.invoke('optimize:freeMemory'),

    // AI Assistant
    getAISettings: () => ipcRenderer.invoke('ai:getSettings'),
    saveAISettings: (settings) => ipcRenderer.invoke('ai:saveSettings', settings),
    aiChat: (message) => ipcRenderer.invoke('ai:chat', message),
    checkOllama: () => ipcRenderer.invoke('ai:checkOllama'),
    executeAIAction: (action) => ipcRenderer.invoke('ai:executeAction', action),

    // AI Memory
    getMemoryStats: () => ipcRenderer.invoke('ai:getMemoryStats'),
    clearAIMemory: () => ipcRenderer.invoke('ai:clearMemory'),
    savePreference: (key, value) => ipcRenderer.invoke('ai:savePreference', { key, value }),

    // Ollama Management
    ollamaCheckInstalled: () => ipcRenderer.invoke('ollama:checkInstalled'),
    ollamaInstall: () => ipcRenderer.invoke('ollama:install'),
    ollamaStartServer: () => ipcRenderer.invoke('ollama:startServer'),
    ollamaGetModels: () => ipcRenderer.invoke('ollama:getModels'),
    ollamaPullModel: (name) => ipcRenderer.invoke('ollama:pullModel', name),
    ollamaDeleteModel: (name) => ipcRenderer.invoke('ollama:deleteModel', name),
    ollamaQuickSetup: (model) => ipcRenderer.invoke('ollama:quickSetup', model),

    // Computer Control
    runCommand: (cmd) => ipcRenderer.invoke('computer:runCommand', cmd),
    killProcess: (pid) => ipcRenderer.invoke('computer:killProcess', pid),
    openApp: (name) => ipcRenderer.invoke('computer:openApp', name),
    openUrl: (url) => ipcRenderer.invoke('computer:openUrl', url),
    notify: (title, message) => ipcRenderer.invoke('computer:notify', { title, message }),
    emptyTrash: () => ipcRenderer.invoke('computer:emptyTrash'),
    setVolume: (level) => ipcRenderer.invoke('computer:setVolume', level),
    runSpeedTest: () => ipcRenderer.invoke('computer:runSpeedTest'),

    // Cyber Shield
    searchBlocklist: (query) => ipcRenderer.invoke('cyber-shield:search-blocklist', query)
});
