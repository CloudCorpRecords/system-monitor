class AIGuardian {
    constructor(computerControl, aiAssistant) {
        this.computer = computerControl;
        this.ai = aiAssistant;
        this.lastCpuAlert = 0;
        this.lastTempAlert = 0;
    }

    check(stats) {
        if (!stats) return;

        // Check CPU Load (> 90%)
        if (stats.cpu && stats.cpu.usage > 90) {
            if (Date.now() - this.lastCpuAlert > 300000) { // 5 min cooldown
                this.computer.notify('High CPU Load detected ⚠️', `CPU is at ${stats.cpu.usage}%. Check 'Top Processes' or ask AI to optimize.`);
                this.lastCpuAlert = Date.now();
            }
        }

        // Check Temperature (> 85°C)
        if (stats.sensors && stats.sensors.cpu && stats.sensors.cpu.main) {
            const temp = stats.sensors.cpu.main;
            if (temp > 85) {
                if (Date.now() - this.lastTempAlert > 300000) { // 5 min cooldown
                    this.computer.notify('System Overheating 🔥', `CPU Temperature is ${temp}°C. Close heavy apps.`);
                    this.lastTempAlert = Date.now();
                }
            }
        }
    }
}

module.exports = AIGuardian;
