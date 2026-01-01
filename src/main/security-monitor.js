const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SecurityMonitor {
    constructor(computerControl) {
        this.computer = computerControl;
        this.lastConnections = new Set();
        this.knownApps = new Set(['Google Chrome', 'Safari', 'Firefox', 'System Monitor', 'Code Helper']);
        this.suspiciousPorts = new Set([22, 23, 4444, 1337, 6667]); // SSH, Telnet, Metasploit default, etc
    }

    async scanNetwork() {
        try {
            // lsof -i -P -n : List open files (Intelet), Ports (Numeric), No DNS resolution (Speed)
            const { stdout } = await execAsync('lsof -i -P -n | grep ESTABLISHED');
            const lines = stdout.split('\n').filter(l => l.trim().length > 0);

            const currentConnections = new Set();
            const events = [];

            lines.forEach(line => {
                // Parse: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
                // Code Hel 9879 rene 34u IPv4 0x... 0t0 TCP 192.168.1.5:54321->142.250.x.x:443
                const parts = line.split(/\s+/);
                if (parts.length < 9) return;

                const command = parts[0];
                const pid = parts[1];
                const connection = parts[8] || parts[9]; // sometimes offset

                if (!connection) return;

                const id = `${command}:${connection}`;
                currentConnections.add(id);

                if (!this.lastConnections.has(id)) {
                    // NEW CONNECTION DETECTED
                    const event = { type: 'NEW_CONN', command, pid, connection, timestamp: Date.now() };
                    events.push(event);
                    this.analyzeRisk(event);
                }
            });

            this.lastConnections = currentConnections;
            return events;

        } catch (e) {
            // lsof might exit 1 if no results found, which is fine
            return [];
        }
    }

    analyzeRisk(event) {
        // Simple risk heuristic
        if (this.knownApps.has(event.command)) return; // Ignored known browsers

        // Check if connecting to suspicious port
        const remote = event.connection.split('->')[1];
        if (remote) {
            const port = remote.split(':')[1];
            if (this.suspiciousPorts.has(parseInt(port))) {
                this.alert(`HIGH RISK: ${event.command} connected to suspicious port ${port}!`);
                return;
            }
        }

        // Check for shell tools
        if (['bash', 'zsh', 'sh', 'python', 'nc', 'curl'].includes(event.command)) {
            this.alert(`WARNING: Shell Tool '${event.command}' opened a network connection to ${remote}`);
        }
    }

    alert(msg) {
        console.log(`[SECURITY] ${msg}`);
        this.computer.notify('Security Alert 🛡️', msg);
    }
}

module.exports = SecurityMonitor;
