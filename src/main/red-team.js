const net = require('net');

class RedTeam {
    constructor() {
        this.commonPorts = [
            21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445,
            993, 995, 1433, 3306, 3389, 5900, 8080, 8443
        ];
    }

    // Single Port Scan with Banner Grabbing (The "Stronger" part)
    checkPort(host, port, timeout = 1000) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            let status = 'closed';
            let banner = '';

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                status = 'open';
                // If it's a web port, send a request to trigger a response
                if ([80, 8080, 443, 8443].includes(port)) {
                    socket.write('HEAD / HTTP/1.0\r\n\r\n');
                }
            });

            socket.on('data', (data) => {
                banner = data.toString().trim();
                // Clean up banner (take first line or relevant header)
                if (banner.length > 50) banner = banner.substring(0, 50) + '...';
                socket.destroy();
            });

            socket.on('timeout', () => {
                socket.destroy();
            });

            socket.on('error', (err) => {
                socket.destroy();
            });

            socket.on('close', () => {
                resolve({ port, status, banner });
            });

            socket.connect(port, host);
        });
    }

    // Scan a single target for common ports
    async scanTarget(host) {
        // Run in batches to avoid EMFILE
        const results = [];
        const batchSize = 5; // Lower batch size for stability with full connections

        for (let i = 0; i < this.commonPorts.length; i += batchSize) {
            const batch = this.commonPorts.slice(i, i + batchSize);
            const promises = batch.map(port => this.checkPort(host, port));
            const batchResults = await Promise.all(promises);
            results.push(...batchResults.filter(r => r.status === 'open'));
        }

        return { host, openPorts: results.map(r => ({ port: r.port, banner: r.banner })) };
    }

    // Mass Scan (Auto-Discovery)
    async scanSubnet(hosts) {
        // hosts is array of { ip, mac, ... }
        const targets = hosts.map(h => h.ip).filter(ip => ip && ip !== 'undefined');
        const report = [];

        // Scan 3 hosts at a time
        for (let i = 0; i < targets.length; i += 3) {
            const batch = targets.slice(i, i + 3);
            const promises = batch.map(ip => this.scanTarget(ip));
            const results = await Promise.all(promises);
            // Only add if ports found
            report.push(...results.filter(r => r.openPorts.length > 0));
        }

        return report;
    }

    // Scan the local subnet (ARP + Port Scan)
    // We reuse CyberShield's ARP logic or just ping sweep?
    // Node generic ping is hard without sudo.
    // We'll rely on ARP cache (local devices).
}

module.exports = RedTeam;
