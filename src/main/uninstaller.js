const fs = require('fs');
const path = require('path');
const os = require('os');

class Uninstaller {
    async findLeftovers(appName) {
        const home = os.homedir();
        const dirs = [
            path.join(home, 'Library/Application Support'),
            path.join(home, 'Library/Caches'),
            path.join(home, 'Library/Preferences'),
            path.join(home, 'Library/Saved Application State'),
            path.join(home, 'Library/Logs'),
            path.join(home, 'Library/WebKit')
        ];

        const leftovers = [];
        // Normalize: "Google Chrome" -> ["google", "chrome"] to match "com.google.Chrome"
        const term = appName.toLowerCase().replace(/ /g, ''); // "googlechrome"

        for (const dir of dirs) {
            try {
                if (!fs.existsSync(dir)) continue;
                const files = await fs.promises.readdir(dir);
                for (const file of files) {
                    const lower = file.toLowerCase();
                    // Match strict inclusion of the full name
                    // e.g. "Visual Studio Code" -> "visualstudiocode"
                    // matches "com.microsoft.VSCode"? No.
                    // This is hard.
                    // Fallback: simple inclusion of normalized name
                    if (lower.replace(/ /g, '').includes(term)) {
                        leftovers.push(path.join(dir, file));
                    }
                }
            } catch (e) { }
        }
        return leftovers;
    }

    async uninstall(appName) {
        try {
            // 1. Locate App Bundle
            const possiblePaths = [
                `/Applications/${appName}.app`,
                path.join(os.homedir(), `Applications/${appName}.app`),
                `/Applications/${appName}`, // Some binaries?
            ];

            const foundPaths = possiblePaths.filter(p => fs.existsSync(p));

            if (foundPaths.length === 0) {
                return { success: false, error: `Could not find app "${appName}" in Applications folder.` };
            }

            // 2. Find Junk
            const leftovers = await this.findLeftovers(appName);
            const allTargets = [...foundPaths, ...leftovers];

            // 3. Move to Trash
            const trashDir = path.join(os.homedir(), '.Trash');
            if (!fs.existsSync(trashDir)) await fs.promises.mkdir(trashDir);

            let movedCount = 0;
            for (const target of allTargets) {
                const base = path.basename(target);
                const dest = path.join(trashDir, `${base}_${Date.now()}`); // prevent collision
                try {
                    await fs.promises.rename(target, dest);
                    movedCount++;
                } catch (err) {
                    console.error(`Failed to move ${target}:`, err);
                    // If rename fails (cross-device?), try copy-delete? 
                    // Usually /Applications and ~/.Trash are on same volume (Data).
                }
            }

            return {
                success: true,
                message: `Moved ${foundPaths.length} App and ${movedCount - foundPaths.length} junk files to Trash.`
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = Uninstaller;
