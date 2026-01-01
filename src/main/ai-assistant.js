const { exec } = require('child_process');
const { promisify } = require('util');
const Store = require('electron-store');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

class AIAssistant {
    constructor() {
        this.store = new Store();
        this.systemContext = null;
        this.memoryPath = path.join(os.homedir(), '.system-monitor-memory');
        this.initMemory();
    }

    async initMemory() {
        try {
            await fs.mkdir(this.memoryPath, { recursive: true });
        } catch (e) { }
    }

    // ==================== SETTINGS ====================
    getSettings() {
        return {
            provider: this.store.get('ai.provider', 'gemini'),
            geminiKey: this.store.get('ai.geminiKey', ''),
            ollamaModel: this.store.get('ai.ollamaModel', 'llama3.2'),
            ollamaEndpoint: this.store.get('ai.ollamaEndpoint', 'http://127.0.0.1:11434')
        };
    }

    saveSettings(settings) {
        if (settings.provider) this.store.set('ai.provider', settings.provider);
        if (settings.geminiKey !== undefined) this.store.set('ai.geminiKey', settings.geminiKey);
        if (settings.ollamaModel) this.store.set('ai.ollamaModel', settings.ollamaModel);
        if (settings.ollamaEndpoint) this.store.set('ai.ollamaEndpoint', settings.ollamaEndpoint);
        return { success: true };
    }

    // ==================== MEMORY SYSTEM ====================

    // Get conversation history
    getConversationHistory() {
        return this.store.get('memory.conversations', []);
    }

    // Save a conversation turn
    saveConversation(userMessage, assistantResponse) {
        const history = this.getConversationHistory();
        history.push({
            timestamp: Date.now(),
            user: userMessage,
            assistant: assistantResponse
        });
        // Keep last 50 conversations
        const trimmed = history.slice(-50);
        this.store.set('memory.conversations', trimmed);
    }

    // Get system profile (learned info about this machine)
    getSystemProfile() {
        return this.store.get('memory.systemProfile', {
            hostname: null,
            cpu: null,
            totalRam: null,
            diskSize: null,
            commonIssues: [],
            optimizationsPerformed: [],
            userPreferences: {},
            firstSeen: null,
            lastSeen: null
        });
    }

    // Update system profile with new info
    async updateSystemProfile(systemInfo) {
        const profile = this.getSystemProfile();

        profile.hostname = systemInfo?.os?.hostname || profile.hostname;
        profile.cpu = systemInfo?.cpu?.cores ? `${systemInfo.cpu.cores} cores` : profile.cpu;
        profile.totalRam = systemInfo?.memory?.total || profile.totalRam;
        profile.diskSize = systemInfo?.disk?.total || profile.diskSize;
        profile.lastSeen = Date.now();
        if (!profile.firstSeen) profile.firstSeen = Date.now();

        this.store.set('memory.systemProfile', profile);
        return profile;
    }

    // Record an optimization action
    recordOptimization(action, result) {
        const profile = this.getSystemProfile();
        profile.optimizationsPerformed.push({
            action,
            result,
            timestamp: Date.now()
        });
        // Keep last 100 optimizations
        profile.optimizationsPerformed = profile.optimizationsPerformed.slice(-100);
        this.store.set('memory.systemProfile', profile);
    }

    // Record common issues
    recordIssue(issue) {
        const profile = this.getSystemProfile();
        const existing = profile.commonIssues.find(i => i.type === issue.type);
        if (existing) {
            existing.count++;
            existing.lastSeen = Date.now();
        } else {
            profile.commonIssues.push({
                type: issue.type,
                description: issue.description,
                count: 1,
                firstSeen: Date.now(),
                lastSeen: Date.now()
            });
        }
        this.store.set('memory.systemProfile', profile);
    }

    // Save user preference
    savePreference(key, value) {
        const profile = this.getSystemProfile();
        profile.userPreferences[key] = value;
        this.store.set('memory.systemProfile', profile);
    }

    // Get memory stats for UI
    getMemoryStats() {
        const history = this.getConversationHistory();
        const profile = this.getSystemProfile();
        return {
            conversationCount: history.length,
            optimizationCount: profile.optimizationsPerformed?.length || 0,
            issueCount: profile.commonIssues?.length || 0,
            firstSeen: profile.firstSeen,
            lastSeen: profile.lastSeen,
            hasMemory: history.length > 0 || profile.firstSeen !== null
        };
    }

    // Clear all memory
    clearMemory() {
        this.store.delete('memory.conversations');
        this.store.delete('memory.systemProfile');
        return { success: true };
    }

    // ==================== CONTEXT BUILDING ====================

    async updateSystemContext(systemInfo, deps, cacheSize) {
        this.systemContext = { systemInfo, deps, cacheSize, timestamp: Date.now() };
        // Also update the persistent profile
        if (systemInfo) {
            await this.updateSystemProfile(systemInfo);
            // Check for issues
            if (systemInfo.memory?.usedPercent > 90) {
                this.recordIssue({ type: 'high_memory', description: 'Memory usage above 90%' });
            }
            if (systemInfo.disk?.usedPercent > 90) {
                this.recordIssue({ type: 'low_disk', description: 'Disk usage above 90%' });
            }
        }
    }

    buildSystemPrompt() {
        const ctx = this.systemContext;
        const profile = this.getSystemProfile();
        const history = this.getConversationHistory().slice(-10); // Last 10 conversations

        let prompt = `You are an AI assistant integrated into a System Monitor app on macOS.
You have PERSISTENT MEMORY and remember our past conversations.

=== SYSTEM PROFILE (What I know about this computer) ===
- Hostname: ${profile.hostname || 'Unknown'}
- CPU: ${profile.cpu || 'Unknown'}
- Total RAM: ${profile.totalRam ? this.formatBytes(profile.totalRam) : 'Unknown'}
- First monitored: ${profile.firstSeen ? new Date(profile.firstSeen).toLocaleDateString() : 'Never'}
- Optimizations performed: ${profile.optimizationsPerformed?.length || 0}
`;

        if (profile.commonIssues?.length > 0) {
            prompt += `\n=== RECURRING ISSUES ===\n`;
            profile.commonIssues.slice(-5).forEach(issue => {
                prompt += `- ${issue.description} (occurred ${issue.count} times)\n`;
            });
        }

        if (Object.keys(profile.userPreferences || {}).length > 0) {
            prompt += `\n=== USER PREFERENCES ===\n`;
            for (const [key, value] of Object.entries(profile.userPreferences)) {
                prompt += `- ${key}: ${value}\n`;
            }
        }

        if (history.length > 0) {
            prompt += `\n=== RECENT CONVERSATION HISTORY ===\n`;
            history.forEach(h => {
                const date = new Date(h.timestamp).toLocaleString();
                prompt += `[${date}] User: ${h.user.substring(0, 100)}...\n`;
            });
        }

        if (ctx) {
            prompt += `
=== CURRENT SYSTEM STATUS ===
- CPU: ${ctx.systemInfo?.cpu?.usage || 'N/A'}% usage, ${ctx.systemInfo?.cpu?.cores || 'N/A'} cores
- Memory: ${ctx.systemInfo?.memory?.usedPercent || 'N/A'}% used
- Disk: ${ctx.systemInfo?.disk?.usedPercent || 'N/A'}% used
- Battery: ${ctx.systemInfo?.battery?.percent || 'N/A'}%, ${ctx.systemInfo?.battery?.charging ? 'charging' : 'not charging'}
- Uptime: ${ctx.systemInfo?.uptime ? Math.floor(ctx.systemInfo.uptime / 3600) + ' hours' : 'N/A'}
`;
        }

        prompt += `
=== YOUR CAPABILITIES ===
1. Remember our conversations and learn about this system over time
2. Analyze system performance and give personalized recommendations
3. Suggest optimizations based on past issues and patterns
4. Check and update dependencies (npm, pip, brew)
5. Control the computer (open apps, run commands, manage processes)
6. Remember user preferences (ask if unsure)

=== AVAILABLE ACTIONS (use these tags in your response) ===
System Optimization:
- [ACTION:CLEAR_CACHE] - Clear system caches
- [ACTION:FREE_MEMORY] - Free up memory
- [ACTION:EMPTY_TRASH] - Empty the trash

Dependencies:
- [ACTION:SCAN_DEPS] - Scan for outdated dependencies
- [ACTION:UPDATE_ALL_NPM] - Update all npm packages
- [ACTION:UPDATE_ALL_PIP] - Update all pip packages
- [ACTION:UPDATE_ALL_BREW] - Update all Homebrew packages

Computer Control:
- [ACTION:OPEN_APP:AppName] - Open an application (e.g., [ACTION:OPEN_APP:Safari])
- [ACTION:OPEN_URL:url] - Open a URL in browser
- [ACTION:RUN_CMD:command] - Run a terminal command
- [ACTION:NOTIFY:message] - Show a notification
- [ACTION:SET_VOLUME:level] - Set volume (0-100)
- [ACTION:KILL_PROCESS:pid] - Kill a process (e.g., [ACTION:KILL_PROCESS:1234]). ALWAYS check the PID first by asking me or checking the top processes list. Ask for confirmation before killing if unsure.

File System Agent (POWERFUL):
- [ACTION:LIST_DIR:path] - List directory contents (e.g. [ACTION:LIST_DIR:/Users/reneturcios/Desktop])
- [ACTION:READ_FILE:path] - Read file content
- [ACTION:WRITE_FILE:{"path":"...","content":"..."}] - Write/Create file. Use JSON format. CAUTION: OVERWRITES EXISTING FILES.
- [ACTION:MOVE_FILE:src|dest] - Move or Rename file

Automation Agent (Self-Programming):
- [ACTION:ADD_RULE:trigger|action] - Create a background rule.
  Examples:
  - [ACTION:ADD_RULE:IF_RUNNING:Spotify|SET_VOLUME:80] (If Spotify opens -> Set Volume)
  - [ACTION:ADD_RULE:HIGH_CPU|NOTIFY:CPU is High!]

  - [ACTION:ADD_RULE:IF_RUNNING:Spotify|SET_VOLUME:80] (If Spotify opens -> Set Volume)
  - [ACTION:ADD_RULE:HIGH_CPU|NOTIFY:CPU is High!]

Cyber Shield (Security):
- [ACTION:ENABLE_ADBLOCK] - Enable system-wide ad blocking (Blocks ads in ALL apps). Note: Will ask user for Admin Password.
- [ACTION:DISABLE_ADBLOCK] - Restore original hosts file.
- [ACTION:SCAN_NETWORK] - Radar scan for devices on local Wi-Fi.

Be concise, personalized, and reference past conversations when relevant. When suggesting actions, include the relevant action tags.`;

        return prompt;
    }

    formatBytes(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // ==================== CHAT ====================

    async chat(message) {
        const settings = this.getSettings();
        let result;

        if (settings.provider === 'gemini') {
            result = await this.chatGemini(message, settings.geminiKey);
        } else {
            result = await this.chatOllama(message, settings.ollamaModel, settings.ollamaEndpoint);
        }

        // Save to memory if successful
        if (result.success) {
            this.saveConversation(message, result.response);
        }

        return result;
    }

    async chatGemini(message, apiKey) {
        if (!apiKey) {
            return { success: false, error: 'Gemini API key not configured. Go to Settings to add it.' };
        }

        try {
            const systemPrompt = this.buildSystemPrompt();
            const history = this.getConversationHistory().slice(-5);

            // Build conversation contents
            const contents = [];

            // Add system context as first message
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt }]
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'I understand. I have access to my memory of this system and our past conversations. How can I help you?' }]
            });

            // Add recent history for context
            history.forEach(h => {
                contents.push({ role: 'user', parts: [{ text: h.user }] });
                contents.push({ role: 'model', parts: [{ text: h.assistant }] });
            });

            // Add current message
            contents.push({ role: 'user', parts: [{ text: message }] });

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents,
                        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                    })
                }
            );

            const data = await response.json();

            if (data.error) {
                return { success: false, error: data.error.message };
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
            const actions = this.parseActions(text);

            return { success: true, response: text, actions };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async chatOllama(message, model, endpoint) {
        try {
            const systemPrompt = this.buildSystemPrompt();
            const history = this.getConversationHistory().slice(-5);

            // Build conversation context
            let context = systemPrompt + '\n\n';
            history.forEach(h => {
                context += `User: ${h.user}\nAssistant: ${h.assistant}\n\n`;
            });
            context += `User: ${message}\n\nAssistant:`;

            const response = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: context,
                    stream: false
                })
            });

            const data = await response.json();

            if (data.error) {
                return { success: false, error: data.error };
            }

            const text = data.response || 'No response';
            const actions = this.parseActions(text);

            return { success: true, response: text, actions };
        } catch (err) {
            return { success: false, error: `Ollama error: ${err.message}. Is Ollama running?` };
        }
    }

    parseActions(text) {
        // Match both simple [ACTION:NAME] and parameterized [ACTION:NAME:param]
        const actionPattern = /\[ACTION:(\w+)(?::([^\]]+))?\]/g;
        const actions = [];
        let match;
        while ((match = actionPattern.exec(text)) !== null) {
            actions.push({
                action: match[1],
                param: match[2] || null
            });
        }
        return actions;
    }

    async checkOllamaStatus() {
        try {
            const settings = this.getSettings();
            const response = await fetch(`${settings.ollamaEndpoint}/api/tags`);
            const data = await response.json();
            return { running: true, models: data.models?.map(m => m.name) || [] };
        } catch (err) {
            return { running: false, models: [] };
        }
    }
}

module.exports = AIAssistant;
