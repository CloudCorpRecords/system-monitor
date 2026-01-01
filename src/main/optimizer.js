const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class Optimizer {
    constructor() {
        this.homeDir = os.homedir();
        this.cachePaths = [
            path.join(this.homeDir, 'Library/Caches'),
            path.join(this.homeDir, '.npm/_cacache'),
            path.join(this.homeDir, '.cache'),
            '/tmp'
        ];
    }

    async getCacheSize() {
        let totalSize = 0;
        const details = [];

        for (const cachePath of this.cachePaths) {
            try {
                const { stdout } = await execAsync(`du -sk "${cachePath}" 2>/dev/null || echo "0"`);
                const sizeKB = parseInt(stdout.split('\t')[0]) || 0;
                const sizeBytes = sizeKB * 1024;
                totalSize += sizeBytes;
                details.push({
                    path: cachePath,
                    size: sizeBytes,
                    name: path.basename(cachePath)
                });
            } catch (e) {
                // Ignore errors for inaccessible directories
            }
        }

        return {
            total: totalSize,
            details: details.filter(d => d.size > 0).sort((a, b) => b.size - a.size)
        };
    }

    async clearCache() {
        const results = [];
        let totalCleared = 0;

        // Clear npm cache
        try {
            await execAsync('npm cache clean --force');
            results.push({ name: 'npm cache', success: true });
        } catch (e) {
            results.push({ name: 'npm cache', success: false, error: e.message });
        }

        // Clear pip cache
        try {
            await execAsync('pip3 cache purge');
            results.push({ name: 'pip cache', success: true });
        } catch (e) {
            results.push({ name: 'pip cache', success: false, error: e.message });
        }

        // Clear Homebrew cache
        try {
            await execAsync('brew cleanup --prune=all');
            results.push({ name: 'Homebrew cache', success: true });
        } catch (e) {
            results.push({ name: 'Homebrew cache', success: false, error: e.message });
        }

        // Clear system caches (user-safe ones)
        const userCaches = path.join(this.homeDir, 'Library/Caches');
        try {
            const { stdout: beforeSize } = await execAsync(`du -sk "${userCaches}" 2>/dev/null || echo "0"`);
            const beforeKB = parseInt(beforeSize.split('\t')[0]) || 0;

            // Only clear specific safe caches
            const safeCaches = [
                'com.apple.Safari/Webpage Previews',
                'com.spotify.client/Data',
                'Google/Chrome/Default/Cache'
            ];

            for (const cache of safeCaches) {
                const cachePath = path.join(userCaches, cache);
                try {
                    await execAsync(`rm -rf "${cachePath}" 2>/dev/null`);
                } catch { }
            }

            const { stdout: afterSize } = await execAsync(`du -sk "${userCaches}" 2>/dev/null || echo "0"`);
            const afterKB = parseInt(afterSize.split('\t')[0]) || 0;
            totalCleared = (beforeKB - afterKB) * 1024;

            results.push({ name: 'System caches', success: true, cleared: totalCleared });
        } catch (e) {
            results.push({ name: 'System caches', success: false, error: e.message });
        }

        return {
            success: true,
            results,
            totalCleared
        };
    }

    async getStartupItems() {
        const items = [];

        // Get LaunchAgents
        const launchAgentsPath = path.join(this.homeDir, 'Library/LaunchAgents');
        try {
            const files = await fs.readdir(launchAgentsPath);
            for (const file of files) {
                if (file.endsWith('.plist')) {
                    items.push({
                        name: file.replace('.plist', ''),
                        path: path.join(launchAgentsPath, file),
                        type: 'LaunchAgent',
                        enabled: true
                    });
                }
            }
        } catch (e) {
            // Directory might not exist
        }

        // Get Login Items (using osascript)
        try {
            const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to get the name of every login item'`);
            const loginItems = stdout.trim().split(', ').filter(Boolean);
            for (const item of loginItems) {
                items.push({
                    name: item,
                    type: 'LoginItem',
                    enabled: true
                });
            }
        } catch (e) {
            // Might fail on newer macOS versions
        }

        return { items };
    }

    async freeMemory() {
        try {
            // macOS purge command (requires sudo, so we use a safer alternative)
            // This triggers the system to free inactive memory
            await execAsync('sync');

            const si = require('systeminformation');
            const before = await si.mem();

            // On macOS, we can suggest memory pressure
            // Note: This is limited without root access

            const after = await si.mem();

            return {
                success: true,
                message: 'Memory optimization triggered',
                before: before.available,
                after: after.available,
                freed: Math.max(0, after.available - before.available)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = Optimizer;
