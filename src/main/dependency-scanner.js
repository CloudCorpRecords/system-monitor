const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

class DependencyScanner {
    constructor() {
        this.homeDir = os.homedir();
    }

    async scanNpm() {
        try {
            // Get global npm packages
            const { stdout: globalList } = await execAsync('npm list -g --depth=0 --json');
            const globalPackages = JSON.parse(globalList);

            // Check for outdated global packages
            let outdated = {};
            try {
                const { stdout: outdatedList } = await execAsync('npm outdated -g --json');
                outdated = JSON.parse(outdatedList || '{}');
            } catch (e) {
                // npm outdated returns exit code 1 if packages are outdated
                if (e.stdout) {
                    try {
                        outdated = JSON.parse(e.stdout);
                    } catch { }
                }
            }

            const packages = [];
            if (globalPackages.dependencies) {
                for (const [name, info] of Object.entries(globalPackages.dependencies)) {
                    const isOutdated = outdated[name];
                    packages.push({
                        name,
                        current: info.version,
                        wanted: isOutdated?.wanted || info.version,
                        latest: isOutdated?.latest || info.version,
                        isOutdated: !!isOutdated,
                        type: 'npm',
                        global: true
                    });
                }
            }

            return {
                success: true,
                packages: packages.sort((a, b) => b.isOutdated - a.isOutdated),
                total: packages.length,
                outdatedCount: packages.filter(p => p.isOutdated).length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                packages: [],
                total: 0,
                outdatedCount: 0
            };
        }
    }

    async scanPip() {
        try {
            // Get pip packages
            const { stdout: pipList } = await execAsync('pip3 list --format=json');
            const packages = JSON.parse(pipList);

            // Check for outdated packages
            let outdated = [];
            try {
                const { stdout: outdatedList } = await execAsync('pip3 list --outdated --format=json');
                outdated = JSON.parse(outdatedList || '[]');
            } catch (e) {
                // Ignore errors in outdated check
            }

            const outdatedMap = new Map(outdated.map(p => [p.name, p]));

            const result = packages.map(pkg => {
                const outdatedInfo = outdatedMap.get(pkg.name);
                return {
                    name: pkg.name,
                    current: pkg.version,
                    latest: outdatedInfo?.latest_version || pkg.version,
                    isOutdated: !!outdatedInfo,
                    type: 'pip'
                };
            });

            return {
                success: true,
                packages: result.sort((a, b) => b.isOutdated - a.isOutdated),
                total: result.length,
                outdatedCount: result.filter(p => p.isOutdated).length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                packages: [],
                total: 0,
                outdatedCount: 0
            };
        }
    }

    async scanBrew() {
        try {
            // Get Homebrew packages
            const { stdout: brewList } = await execAsync('brew list --versions');
            const lines = brewList.trim().split('\n');

            // Check for outdated packages
            let outdated = [];
            try {
                const { stdout: outdatedList } = await execAsync('brew outdated --json');
                const parsed = JSON.parse(outdatedList || '{"formulae":[],"casks":[]}');
                outdated = [...(parsed.formulae || []), ...(parsed.casks || [])];
            } catch (e) {
                // Ignore errors
            }

            const outdatedMap = new Map(outdated.map(p => [p.name, p]));

            const packages = lines.map(line => {
                const parts = line.split(' ');
                const name = parts[0];
                const version = parts.slice(1).join(' ');
                const outdatedInfo = outdatedMap.get(name);

                return {
                    name,
                    current: version,
                    latest: outdatedInfo?.current_version || version,
                    isOutdated: !!outdatedInfo,
                    type: 'brew'
                };
            });

            return {
                success: true,
                packages: packages.sort((a, b) => b.isOutdated - a.isOutdated),
                total: packages.length,
                outdatedCount: packages.filter(p => p.isOutdated).length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                packages: [],
                total: 0,
                outdatedCount: 0
            };
        }
    }

    async updatePackage(type, name) {
        try {
            let command;
            switch (type) {
                case 'npm':
                    command = `npm update -g ${name}`;
                    break;
                case 'pip':
                    command = `pip3 install --upgrade ${name}`;
                    break;
                case 'brew':
                    command = `brew upgrade ${name}`;
                    break;
                default:
                    throw new Error(`Unknown package type: ${type}`);
            }

            await execAsync(command);
            return { success: true, message: `Updated ${name}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateAll(type) {
        try {
            let command;
            switch (type) {
                case 'npm':
                    command = 'npm update -g';
                    break;
                case 'pip':
                    command = 'pip3 list --outdated --format=freeze | cut -d = -f 1 | xargs -n1 pip3 install --upgrade';
                    break;
                case 'brew':
                    command = 'brew upgrade';
                    break;
                default:
                    throw new Error(`Unknown package type: ${type}`);
            }

            await execAsync(command);
            return { success: true, message: `Updated all ${type} packages` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = DependencyScanner;
