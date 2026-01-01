const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const https = require('https');
const path = require('path');
const { app } = require('electron');

const execAsync = promisify(exec);

class CyberShield {
    constructor(computerControl) {
        this.computer = computerControl;
        this.hostsPath = '/etc/hosts';
        this.backupPath = path.join(app.getPath('userData'), 'hosts.backup');
        this.blocklistUrl = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';
    }

    async scanLocalNetwork() {
        try {
            // arp -a lists known neighbors in ARP cache
            const { stdout } = await execAsync('arp -a');

            // Parse Output
            const lines = stdout.split('\n');
            const hosts = [];
            lines.forEach(line => {
                const match = line.match(/\((.*?)\) at (.*?) on/);
                if (match) {
                    hosts.push({ ip: match[1], mac: match[2] });
                }
            });

            return { success: true, scan: stdout, hosts };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async enableAdBlock() {
        try {
            // 1. Backup existing hosts if not exists
            try {
                await fs.access(this.backupPath);
            } catch {
                const currentHosts = await fs.readFile(this.hostsPath, 'utf8');
                await fs.writeFile(this.backupPath, currentHosts);
            }

            // 2. Download blocklist
            const blocklist = await this.downloadBlocklist();
            if (!blocklist) throw new Error('Failed to download blocklist');

            // 3. Write via Sudo (osascript)
            // We write to a temp file first
            const tempPath = path.join(app.getPath('temp'), 'hosts_new');
            await fs.writeFile(tempPath, blocklist);

            // Escape double quotes for the AppleScript string
            const safeTempPath = tempPath.replace(/"/g, '\\"');
            const safeHostsPath = this.hostsPath.replace(/"/g, '\\"');

            // We use double quotes for the AppleScript string, and single quotes for the shell path
            // But we need to use a different quoting strategy for the execAsync call to avoid conflicts
            // Strategy: escaping double quotes for the shell command

            const appleScript = `do shell script "cp '${safeTempPath}' '${safeHostsPath}'" with administrator privileges`;

            // Write AppleScript to temp file to avoid complex quoting issues
            const scriptPath = path.join(app.getPath('temp'), 'enable_shield.scpt');
            await fs.writeFile(scriptPath, appleScript);

            await execAsync(`osascript "${scriptPath}"`);

            return { success: true, message: 'AdBlock Enabled (System-wide)' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async disableAdBlock() {
        try {
            // Restore from backup
            try {
                await fs.access(this.backupPath);
            } catch {
                return { success: false, error: 'No backup found' };
            }

            // Escape double quotes for paths
            const safeBackupPath = this.backupPath.replace(/"/g, '\\"');
            const safeHostsPath = this.hostsPath.replace(/"/g, '\\"');

            const appleScript = `do shell script "cp '${safeBackupPath}' '${safeHostsPath}'" with administrator privileges`;

            // Write AppleScript to temp file to avoid complex quoting issues
            const scriptPath = path.join(app.getPath('temp'), 'disable_shield.scpt');
            await fs.writeFile(scriptPath, appleScript);

            await execAsync(`osascript "${scriptPath}"`);

            return { success: true, message: 'AdBlock Disabled' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    downloadBlocklist() {
        return new Promise((resolve, reject) => {
            https.get(this.blocklistUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', err => reject(err));
        });
    }

    async searchBlocklist(query) {
        try {
            const content = await fs.readFile(this.hostsPath, 'utf8');
            const lines = content.split('\n');
            const matches = lines
                .filter(line => !line.trim().startsWith('#') && line.includes(query))
                .slice(0, 50) // Limit results
                .map(line => line.trim());

            return { success: true, matches };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}

module.exports = CyberShield;
