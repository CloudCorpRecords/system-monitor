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
            return { success: true, scan: stdout };
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

            const command = `do shell script "cp '${tempPath}' '${this.hostsPath}'" with administrator privileges`;
            await execAsync(`osascript -e '${command}'`);

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

            const command = `do shell script "cp '${this.backupPath}' '${this.hostsPath}'" with administrator privileges`;
            await execAsync(`osascript -e '${command}'`);

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
}

module.exports = CyberShield;
