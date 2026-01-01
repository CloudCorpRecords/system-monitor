// System Monitor - Renderer Entry Point
class SystemMonitor {
    constructor() {
        this.currentPanel = 'dashboard';
        this.currentDepsType = 'npm';
        this.depsData = { npm: null, pip: null, brew: null };
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupNavigation();
        this.setupDependencies();
        this.setupNetwork();
        this.setupSecurity();
        this.setupOptimizer();
        this.setupAI();
        this.setupSettings();
        this.startUpdates();
    }

    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.switchPanel(item.dataset.panel));
        });
    }

    switchPanel(panel) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`[data-panel="${panel}"]`).classList.add('active');
        document.getElementById(panel).classList.add('active');
        this.currentPanel = panel;
        if (panel === 'settings') this.loadSettings();
        if (panel === 'ai-chat') this.updateAIBadge();
        this.updateCurrentPanel();
    }

    startUpdates() {
        this.updateCurrentPanel();
        this.updateInterval = setInterval(() => this.updateCurrentPanel(), 2000);
    }

    async updateCurrentPanel() {
        switch (this.currentPanel) {
            case 'dashboard': await this.updateDashboard(); break;
            case 'cpu': await this.updateCpu(); break;
            case 'memory': await this.updateMemory(); break;
            case 'disk': await this.updateDisk(); break;
            case 'network': await this.updateNetwork(); break;
        }
    }

    async updateDashboard() {
        try {
            const [overview, processes, sensors] = await Promise.all([
                window.systemMonitor.getOverview(),
                window.systemMonitor.getProcesses(),
                window.systemMonitor.getSensors()
            ]);
            document.getElementById('hostname').textContent = overview.os.hostname;
            document.getElementById('uptime').textContent = `Uptime: ${this.formatUptime(overview.uptime)}`;
            this.updateGauge('cpu', overview.cpu.usage);
            this.updateGauge('memory', overview.memory.usedPercent);
            this.updateGauge('disk', overview.disk.usedPercent);
            if (overview.battery.hasBattery) {
                this.updateGauge('battery', overview.battery.percent);
                document.getElementById('battery-detail').textContent = overview.battery.charging ? 'Charging' : 'On Battery';
            } else {
                document.getElementById('battery-value').textContent = 'N/A';
                document.getElementById('battery-detail').textContent = 'No Battery';
            }
            document.getElementById('cpu-cores').textContent = `${overview.cpu.cores} Cores`;
            document.getElementById('memory-detail').textContent = `${this.formatBytes(overview.memory.used)} / ${this.formatBytes(overview.memory.total)}`;
            document.getElementById('disk-detail').textContent = `${this.formatBytes(overview.disk.used)} / ${this.formatBytes(overview.disk.total)}`;
            this.renderProcesses(processes.top);
            this.updateSensors(sensors);
        } catch (err) { console.error('Dashboard error:', err); }
    }

    updateGauge(type, value) {
        const gauge = document.getElementById(`${type}-gauge`);
        const valueEl = document.getElementById(`${type}-value`);
        if (gauge && valueEl) {
            gauge.style.strokeDashoffset = 283 - (283 * value / 100);
            valueEl.textContent = `${Math.round(value)}%`;
        }
    }

    renderProcesses(processes) {
        document.getElementById('processes-list').innerHTML = processes.map(p => `<div class="table-row">
            <span class="process-name" title="PID: ${p.pid}">${p.name}</span>
            <span class="process-cpu">${p.cpuNormalized}% <small style="opacity:0.5; font-size:0.8em">(${p.cpu}% core)</small></span>
            <span class="process-mem">${p.mem}%</span>
            <span class="process-status ${p.state === 'running' ? 'status-running' : 'status-sleeping'}">${p.state}</span>
        </div>`).join('');
    }

    updateSensors(sensors) {
        // CPU Temp
        if (sensors.cpu.main) {
            const temp = sensors.cpu.main;
            document.getElementById('sensor-cpu-temp').textContent = `${temp.toFixed(1)}°C`;
            document.getElementById('sensor-cpu-bar').style.width = `${Math.min(100, temp)}%`;

            // Dynamic Color
            const bar = document.getElementById('sensor-cpu-bar');
            if (temp > 80) bar.style.background = '#ef4444'; // Red
            else if (temp > 60) bar.style.background = '#f59e0b'; // Orange
            else bar.style.background = '#10b981'; // Green
        } else {
            document.getElementById('sensor-cpu-temp').textContent = `N/A`;
        }

        // GPU
        if (sensors.gpu.controllers && sensors.gpu.controllers.length > 0) {
            const gpu = sensors.gpu.controllers[0];
            document.getElementById('sensor-gpu-model').textContent = gpu.model || 'GPU';
            document.getElementById('sensor-gpu-temp').textContent = gpu.temperature ? `${gpu.temperature}°C` : 'N/A';
            document.getElementById('sensor-gpu-util').textContent = gpu.utilization ? `${gpu.utilization}%` : 'Active';
        }
    }

    async updateCpu() {
        try {
            const cpu = await window.systemMonitor.getCpuInfo();
            document.getElementById('cpu-brand').textContent = cpu.brand;
            document.getElementById('cpu-speed').textContent = `${cpu.speed} GHz`;
            document.getElementById('cpu-cores-detail').textContent = `${cpu.physicalCores} Physical / ${cpu.cores} Logical`;
            document.getElementById('cpu-temp').textContent = cpu.temperature ? `${cpu.temperature}°C` : 'N/A';
            document.getElementById('cores-grid').innerHTML = cpu.perCore.map(c => `<div class="core-card"><h4>Core ${c.core}</h4><span>${c.load}%</span><div class="core-bar"><div class="core-bar-fill" style="width: ${c.load}%"></div></div></div>`).join('');
        } catch (err) { console.error('CPU error:', err); }
    }

    async updateMemory() {
        try {
            const mem = await window.systemMonitor.getMemoryInfo();
            const pct = (mem.used / mem.total) * 100;
            document.getElementById('memory-bar-fill').style.width = `${pct}%`;
            document.getElementById('memory-used-label').textContent = `Used: ${this.formatBytes(mem.used)}`;
            document.getElementById('memory-total-label').textContent = `Total: ${this.formatBytes(mem.total)}`;
            document.getElementById('ram-total').textContent = this.formatBytes(mem.total);
            document.getElementById('ram-available').textContent = this.formatBytes(mem.available);
            document.getElementById('swap-used').textContent = this.formatBytes(mem.swapUsed);
            document.getElementById('swap-total').textContent = this.formatBytes(mem.swapTotal);
        } catch (err) { console.error('Memory error:', err); }
    }

    async updateDisk() {
        try {
            const disk = await window.systemMonitor.getDiskInfo();
            document.getElementById('disks-grid').innerHTML = disk.partitions.map(d => `<div class="disk-card-item"><h3>${d.mount}</h3><div class="disk-bar-container"><div class="disk-bar" style="width: ${d.usePercent}%"></div></div><div class="disk-details"><span>${this.formatBytes(d.used)} used</span><span>${this.formatBytes(d.available)} free</span></div></div>`).join('');
        } catch (err) { console.error('Disk error:', err); }
    }

    setupNetwork() {
        const btn = document.getElementById('run-speedtest');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                const resultsDiv = document.getElementById('speedtest-results');
                btn.textContent = 'Running...';
                btn.disabled = true;
                resultsDiv.style.display = 'none';

                try {
                    const result = await window.systemMonitor.runSpeedTest();
                    if (result.success) {
                        document.getElementById('st-download').textContent = result.download;
                        document.getElementById('st-upload').textContent = result.upload;
                        document.getElementById('st-response').textContent = result.responsiveness;
                        resultsDiv.style.display = 'block';
                    } else {
                        console.error('Speed Test Failed: ' + result.error);
                        btn.textContent = 'Failed';
                    }
                } catch (err) {
                    console.error('Error: ' + err.message);
                    btn.textContent = 'Error';
                } finally {
                    if (btn.textContent === 'Running...') btn.textContent = 'Run Test 🚀';
                    else setTimeout(() => btn.textContent = 'Run Test 🚀', 2000);
                    btn.disabled = false;
                }
            });
        }
    }

    setupSecurity() {
        const btnEnable = document.getElementById('btn-enable-adblock');
        const btnDisable = document.getElementById('btn-disable-adblock');
        const btnScan = document.getElementById('btn-scan-network');
        const scanResults = document.getElementById('network-scan-results');

        if (btnEnable) btnEnable.addEventListener('click', async () => {
            btnEnable.textContent = 'Securing... (Check for popup)';
            btnEnable.disabled = true;
            const res = await window.systemMonitor.executeAIAction({ action: 'ENABLE_ADBLOCK' });
            if (res.success) {
                alert('Shield Enabled!');
                btnEnable.style.display = 'none';
                btnDisable.style.display = 'block';
            } else {
                alert('Failed: ' + res.error);
                btnEnable.textContent = 'Enable Shield';
                btnEnable.disabled = false;
            }
        });

        if (btnDisable) btnDisable.addEventListener('click', async () => {
            btnDisable.textContent = 'Disabling...';
            btnDisable.disabled = true;
            const res = await window.systemMonitor.executeAIAction({ action: 'DISABLE_ADBLOCK' });
            if (res.success) {
                alert('Shield Disabled.');
                btnDisable.style.display = 'none';
                btnEnable.style.display = 'block';
                btnEnable.textContent = 'Enable Shield';
                btnEnable.disabled = false;
            } else {
                alert('Failed: ' + res.error);
                btnDisable.textContent = 'Disable Shield';
                btnDisable.disabled = false;
            }
        });

        if (btnScan) btnScan.addEventListener('click', async () => {
            if (scanResults) scanResults.textContent = 'Scanning local network... please wait...';
            const res = await window.systemMonitor.executeAIAction({ action: 'SCAN_NETWORK' });
            if (scanResults) {
                if (res.success) {
                    scanResults.textContent = res.scan || 'No devices found.';
                } else {
                    scanResults.textContent = 'Scan failed: ' + res.error;
                }
            }
        });
    }

    async updateNetwork() {
        try {
            const net = await window.systemMonitor.getNetworkInfo();
            const rx = net.stats.reduce((a, s) => a + (s.rxSec || 0), 0);
            const tx = net.stats.reduce((a, s) => a + (s.txSec || 0), 0);
            document.getElementById('net-download').textContent = `${this.formatBytes(rx)}/s`;
            document.getElementById('net-upload').textContent = `${this.formatBytes(tx)}/s`;
            document.getElementById('net-connections').textContent = net.activeConnections;
            document.getElementById('interfaces-list').innerHTML = net.interfaces.map(i => `<div class="interface-card"><h4>${i.iface} <span class="interface-type">${i.type || 'unknown'}</span></h4><div class="interface-info"><p>IP: <code>${i.ip4}</code></p><p>MAC: <code>${i.mac}</code></p>${i.speed ? `<p>Speed: ${i.speed} Mbps</p>` : ''}</div></div>`).join('');
        } catch (err) { console.error('Network error:', err); }
    }

    // Dependencies
    setupDependencies() {
        document.querySelectorAll('.deps-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.deps-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentDepsType = tab.dataset.type;
                this.renderDeps();
            });
        });
        document.getElementById('scan-all-deps').addEventListener('click', () => this.scanAllDeps());
        document.getElementById('update-all-deps').addEventListener('click', () => this.updateAllDeps());
    }

    async scanAllDeps() {
        const btn = document.getElementById('scan-all-deps');
        btn.disabled = true; btn.textContent = 'Scanning...';
        try {
            const [npm, pip, brew] = await Promise.all([window.systemMonitor.scanNpm(), window.systemMonitor.scanPip(), window.systemMonitor.scanBrew()]);
            this.depsData = { npm, pip, brew };
            this.renderDeps();
        } catch (err) { console.error('Scan error:', err); }
        btn.disabled = false; btn.textContent = 'Scan All';
    }

    renderDeps() {
        const data = this.depsData[this.currentDepsType];
        const list = document.getElementById('deps-list');
        if (!data || !data.packages) {
            list.innerHTML = '<p class="deps-placeholder">Click "Scan All" to discover packages</p>';
            document.getElementById('deps-total').textContent = '0 packages';
            document.getElementById('deps-outdated').textContent = '0 outdated';
            return;
        }
        document.getElementById('deps-total').textContent = `${data.total} packages`;
        document.getElementById('deps-outdated').textContent = `${data.outdatedCount} outdated`;
        list.innerHTML = data.packages.map(p => `<div class="dep-item"><div class="dep-info"><span class="dep-name">${p.name}</span><span class="dep-version ${p.isOutdated ? 'dep-outdated' : ''}">${p.current}</span>${p.isOutdated ? `<span class="dep-latest">→ ${p.latest}</span>` : ''}</div>${p.isOutdated ? `<button class="btn btn-sm btn-secondary" onclick="app.updatePackage('${p.type}', '${p.name}')">Update</button>` : ''}</div>`).join('');
    }

    async updatePackage(type, name) {
        this.log(`Updating ${name}...`, 'info');
        const result = await window.systemMonitor.updatePackage(type, name);
        result.success ? (this.log(`Updated ${name}`, 'success'), this.scanAllDeps()) : this.log(`Failed: ${result.error}`, 'error');
    }

    async updateAllDeps() {
        this.log(`Updating all ${this.currentDepsType}...`, 'info');
        const result = await window.systemMonitor.updateAll(this.currentDepsType);
        result.success ? (this.log(result.message, 'success'), this.scanAllDeps()) : this.log(`Failed: ${result.error}`, 'error');
    }

    // Optimizer
    setupOptimizer() {
        document.getElementById('clear-cache-btn').addEventListener('click', () => this.clearCache());
        document.getElementById('free-memory-btn').addEventListener('click', () => this.freeMemory());
        document.getElementById('view-startup-btn').addEventListener('click', () => this.viewStartup());
        this.loadOptimizerInfo();
    }

    async loadOptimizerInfo() {
        try {
            const [cache, startup] = await Promise.all([window.systemMonitor.getCacheSize(), window.systemMonitor.getStartupItems()]);
            document.getElementById('cache-size').textContent = `${this.formatBytes(cache.total)} cached`;
            document.getElementById('startup-count').textContent = `${startup.items.length} items`;
        } catch (err) { console.error('Optimizer error:', err); }
    }

    async clearCache() {
        const btn = document.getElementById('clear-cache-btn');
        btn.disabled = true; btn.textContent = 'Clearing...';
        this.log('Starting cache cleanup...', 'info');
        const result = await window.systemMonitor.clearCache();
        result.results.forEach(r => this.log(`${r.name}: ${r.success ? 'Cleared' : 'Failed'}`, r.success ? 'success' : 'error'));
        this.loadOptimizerInfo();
        btn.disabled = false; btn.textContent = 'Clear Cache';
    }

    async freeMemory() {
        const btn = document.getElementById('free-memory-btn');
        btn.disabled = true;
        this.log('Optimizing memory...', 'info');
        const result = await window.systemMonitor.freeMemory();
        this.log(result.message, result.success ? 'success' : 'error');
        btn.disabled = false;
    }

    async viewStartup() {
        const startup = await window.systemMonitor.getStartupItems();
        const list = document.getElementById('startup-list');
        list.classList.toggle('hidden');
        list.innerHTML = `<h3>Startup Items</h3>` + startup.items.map(i => `<div class="startup-item"><span>${i.name}</span><span class="interface-type">${i.type}</span></div>`).join('');
    }

    log(message, type = 'info') {
        const log = document.getElementById('optimizer-log');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    // AI Chat
    setupAI() {
        document.getElementById('chat-send-btn').addEventListener('click', () => this.sendChat());
        document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendChat(); });
        document.getElementById('clear-memory-btn').addEventListener('click', () => this.clearAIMemory());
        this.updateAIBadge();
        this.updateMemoryStats();
    }

    async updateMemoryStats() {
        try {
            const stats = await window.systemMonitor.getMemoryStats();
            const countEl = document.getElementById('memory-count');
            const badgeEl = document.getElementById('memory-stats');
            const totalMemories = stats.conversationCount + stats.optimizationCount;
            countEl.textContent = totalMemories;
            if (stats.hasMemory) {
                badgeEl.classList.add('has-memory');
                badgeEl.title = `${stats.conversationCount} conversations, ${stats.optimizationCount} optimizations recorded`;
            } else {
                badgeEl.classList.remove('has-memory');
            }
        } catch (e) { console.error('Memory stats error:', e); }
    }

    async clearAIMemory() {
        if (confirm('Clear all AI memory? This will erase conversation history and learned system info.')) {
            await window.systemMonitor.clearAIMemory();
            this.updateMemoryStats();
            this.addChatMessage('🧠 Memory cleared. I\'ve forgotten our previous conversations, but I\'m ready to learn about your system again!', 'assistant');
        }
    }

    async updateAIBadge() {
        const settings = await window.systemMonitor.getAISettings();
        const badge = document.getElementById('ai-provider-badge');
        if (settings.provider === 'gemini' && settings.geminiKey) {
            badge.textContent = 'Gemini'; badge.style.background = 'rgba(66, 133, 244, 0.2)'; badge.style.color = '#4285f4';
        } else if (settings.provider === 'ollama') {
            const status = await window.systemMonitor.checkOllama();
            badge.textContent = status.running ? `Ollama (${settings.ollamaModel})` : 'Ollama (offline)';
            badge.style.background = status.running ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            badge.style.color = status.running ? '#10b981' : '#ef4444';
        } else {
            badge.textContent = 'Not configured'; badge.style.background = 'rgba(255,255,255,0.1)'; badge.style.color = 'rgba(255,255,255,0.5)';
        }
    }

    quickChat(message) { document.getElementById('chat-input').value = message; this.sendChat(); }

    async sendChat() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (!message) return;
        input.value = '';
        this.addChatMessage(message, 'user');
        this.showTyping();
        const result = await window.systemMonitor.aiChat(message);
        this.hideTyping();
        if (result.success) {
            this.addChatMessage(result.response, 'assistant', result.actions);
            this.updateMemoryStats(); // Update memory count after chat
        } else {
            this.addChatMessage(`Error: ${result.error}`, 'assistant');
        }
    }

    addChatMessage(text, role, actions = []) {
        const messages = document.getElementById('chat-messages');
        const welcome = messages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;
        let displayText = text.replace(/\[ACTION:\w+\]/g, '').trim();
        msgDiv.innerHTML = `<div class="chat-bubble">${this.formatMarkdown(displayText)}</div>`;
        if (actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'chat-actions';
            actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = 'action-btn';
                btn.textContent = this.formatActionName(action);
                btn.onclick = () => this.executeAction(action);
                actionsDiv.appendChild(btn);
            });
            msgDiv.appendChild(actionsDiv);
        }
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;
    }

    formatMarkdown(text) {
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n/g, '<br>');
    }

    formatActionName(actionObj) {
        const action = typeof actionObj === 'string' ? actionObj : actionObj.action;
        const param = typeof actionObj === 'object' ? actionObj.param : null;
        const names = {
            'CLEAR_CACHE': '🗑️ Clear Cache', 'FREE_MEMORY': '💨 Free Memory', 'EMPTY_TRASH': '🗑️ Empty Trash',
            'SCAN_DEPS': '📦 Scan Dependencies', 'UPDATE_ALL_NPM': '⬆️ Update npm',
            'UPDATE_ALL_PIP': '⬆️ Update pip', 'UPDATE_ALL_BREW': '⬆️ Update Homebrew',
            'OPEN_APP': `🚀 Open ${param}`, 'OPEN_URL': '🌐 Open URL', 'RUN_CMD': '⚡ Run Command',
            'NOTIFY': '🔔 Send Notification', 'SET_VOLUME': `🔊 Volume ${param}%`
        };
        return names[action] || action;
    }

    async executeAction(actionObj) {
        this.addChatMessage(`Executing: ${this.formatActionName(actionObj)}...`, 'assistant');
        const result = await window.systemMonitor.executeAIAction(actionObj);
        this.addChatMessage(result.success !== false ? '✅ Action completed!' : `❌ Error: ${result.error}`, 'assistant');
        this.updateMemoryStats();
    }

    showTyping() {
        const messages = document.getElementById('chat-messages');
        const typing = document.createElement('div');
        typing.id = 'typing-indicator';
        typing.className = 'chat-message assistant';
        typing.innerHTML = '<div class="chat-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
    }

    hideTyping() { const t = document.getElementById('typing-indicator'); if (t) t.remove(); }

    // Settings
    setupSettings() {
        document.getElementById('ai-provider-select').addEventListener('change', (e) => {
            document.getElementById('gemini-settings').classList.toggle('hidden', e.target.value !== 'gemini');
            document.getElementById('ollama-settings').classList.toggle('hidden', e.target.value !== 'ollama');
        });
        document.getElementById('save-ai-settings').addEventListener('click', () => this.saveSettings());
        document.getElementById('quick-setup-btn').addEventListener('click', () => this.runQuickSetup());
    }

    async runQuickSetup() {
        const btn = document.getElementById('quick-setup-btn');
        const progress = document.getElementById('setup-progress');
        const status = document.getElementById('setup-status');

        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = '⏳ Setting up...';
        progress.classList.remove('hidden');
        status.className = 'setup-status';
        status.textContent = '';

        // Start the quick setup
        const result = await window.systemMonitor.ollamaQuickSetup('llama3.2');

        // Update step indicators
        const icons = ['✅', '✅', '✅'];
        if (result.steps) {
            result.steps.forEach((step, i) => {
                const stepEl = document.getElementById(`setup-step-${i + 1}`);
                if (stepEl) {
                    const icon = stepEl.querySelector('.step-icon');
                    const text = stepEl.querySelector('.step-text');
                    icon.textContent = step.status === 'done' ? '✅' : step.status === 'error' ? '❌' : '⏳';
                    text.textContent = step.message;
                }
            });
        }

        if (result.success) {
            btn.querySelector('.btn-text').textContent = '✅ Setup Complete!';
            status.className = 'setup-status success';
            status.innerHTML = '🎉 AI Assistant is ready! Go to <strong>AI Assistant</strong> to start chatting.';

            // Auto-save Ollama as provider
            await window.systemMonitor.saveAISettings({
                provider: 'ollama',
                ollamaModel: result.model || 'llama3.2',
                ollamaEndpoint: 'http://localhost:11434'
            });
            document.getElementById('ai-provider-select').value = 'ollama';
            this.updateAIBadge();
            this.loadModels();
        } else {
            btn.disabled = false;
            btn.querySelector('.btn-text').textContent = '⚡ Quick Setup';
            status.className = 'setup-status error';
            status.textContent = `Setup failed: ${result.error}`;
        }
    }

    async loadModels() {
        const models = await window.systemMonitor.ollamaGetModels();
        const list = document.getElementById('models-list');
        if (models.models?.length > 0) {
            list.innerHTML = models.models.map(m =>
                `<div class="model-item"><span class="model-name">${m.name}</span><span class="model-size">${this.formatBytes(m.size)}</span></div>`
            ).join('');
        } else {
            list.innerHTML = '<p style="color:var(--text-muted)">No models installed. Use Quick Setup above.</p>';
        }
    }

    async loadSettings() {
        const s = await window.systemMonitor.getAISettings();
        document.getElementById('ai-provider-select').value = s.provider;
        document.getElementById('gemini-key-input').value = s.geminiKey;
        document.getElementById('gemini-settings').classList.toggle('hidden', s.provider !== 'gemini');
        document.getElementById('ollama-settings').classList.toggle('hidden', s.provider !== 'ollama');

        // Check Ollama status and load models
        const status = await window.systemMonitor.checkOllama();
        const statusEl = document.getElementById('ollama-install-status');
        if (status.running) {
            statusEl.textContent = '✅ Ollama running';
            this.loadModels();
        } else {
            statusEl.textContent = '⚠️ Use Quick Setup above';
        }
    }

    async saveSettings() {
        const provider = document.getElementById('ai-provider-select').value;
        await window.systemMonitor.saveAISettings({
            provider,
            geminiKey: document.getElementById('gemini-key-input').value,
            ollamaEndpoint: 'http://127.0.0.1:11434',
            ollamaModel: 'llama3.2'
        });
        this.updateAIBadge();
        alert('Settings saved!');
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatUptime(seconds) {
        const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
        return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
    }
}

try {
    const app = new SystemMonitor();
} catch (err) {
    document.body.innerHTML = `<div style="padding:20px; color:red; font-family:monospace">
        <h1>Startup Error</h1>
        <pre>${err.stack}</pre>
    </div>`;
    console.error(err);
}

