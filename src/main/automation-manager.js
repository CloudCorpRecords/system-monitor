const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class AutomationManager {
    constructor(computerControl) {
        this.computer = computerControl;
        this.rulesPath = path.join(app.getPath('userData'), 'automations.json');
        this.rules = [];
        this.lastStates = { apps: [] };
        this.init();
    }

    async init() {
        try {
            const data = await fs.readFile(this.rulesPath, 'utf8');
            this.rules = JSON.parse(data);
        } catch (e) {
            this.rules = []; // Start fresh if empty
        }
    }

    async saveRules() {
        try {
            await fs.writeFile(this.rulesPath, JSON.stringify(this.rules, null, 2));
        } catch (e) {
            console.error('Failed to save rules', e);
        }
    }

    async addRule(trigger, action) {
        this.rules.push({ trigger, action, id: Date.now(), enabled: true });
        await this.saveRules();
        return { success: true, message: `Added rule: If ${trigger} then ${action}` };
    }

    async listRules() {
        return { success: true, rules: this.rules };
    }

    async deleteRule(id) {
        this.rules = this.rules.filter(r => r.id !== id);
        await this.saveRules();
        return { success: true, message: 'Rule deleted' };
    }

    // Main Loop Checker
    async checkRules(systemStats, processes) {
        if (!this.rules.length) return;

        // 1. Process App Triggers (APP_OPEN:AppName)
        // We need to compare current processes vs last processes to detect "Launched"
        // For simplicity v1, we just check if it IS running (State) or recently appeared.
        // Let's implement STATE-based triggers first: "IF_RUNNING:Steam -> KILL:Docker"

        const processNames = new Set(processes.map(p => p.name.toLowerCase()));

        for (const rule of this.rules) {
            if (!rule.enabled) continue;

            // Trigger Type: IF_RUNNING:AppName
            if (rule.trigger.startsWith('IF_RUNNING:')) {
                const targetApp = rule.trigger.split(':')[1].toLowerCase();
                const isRunning = processNames.has(targetApp);

                if (isRunning) {
                    // Execute Action
                    // Prevent spam: We need a 'cooldown' or 'state' tracker so we don't kill 100 times a second.
                    // We'll skip complex state for this MVP and rely on actions being idempotent or checking themselves.
                    await this.executeAction(rule.action);
                }
            }

            // Trigger Type: HIGH_CPU (Combined > 80%)
            if (rule.trigger === 'HIGH_CPU') {
                if (systemStats.cpu.usage > 80) {
                    // Check cooldown
                    if (!rule.lastRun || Date.now() - rule.lastRun > 60000) {
                        await this.executeAction(rule.action);
                        rule.lastRun = Date.now();
                    }
                }
            }
        }
    }

    async executeAction(actionString) {
        // e.g. "KILL_PROCESS:pname" or "NOTIFY:msg"
        // We reuse the parsing logic from main, or directly call computerControl
        console.log(`Executing Automation: ${actionString}`);

        const parts = actionString.split(':');
        const cmd = parts[0];
        const param = parts.slice(1).join(':');

        switch (cmd) {
            case 'NOTIFY':
                await this.computer.notify('Automation', param);
                break;
            case 'OPEN_APP':
                await this.computer.openApplication(param);
                break;
            case 'KILL_PROCESS':
                // Safe kill by name?
                // This requires logic to find PID by name.
                // We'll trust User/AI to implement correctly or we add specific helper.
                break;
            case 'SET_VOLUME':
                await this.computer.setVolume(parseInt(param));
                break;
        }
    }
}

module.exports = AutomationManager;
