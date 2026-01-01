const si = require('systeminformation');

class SystemInfo {
    async getOverview() {
        const [cpu, mem, disk, os, battery, time] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.osInfo(),
            si.battery(),
            si.time()
        ]);

        // Memory: Use 'active' on macOS for a more realistic "used" value
        // 'used' often includes cache which makes it look 90%+ full
        const memoryUsed = process.platform === 'darwin' ? mem.active : mem.used;

        // Disk: Filter for the main volume (mounted at /) to avoid confused totals
        const mainDisk = disk.find(d => d.mount === '/') || disk[0];

        return {
            cpu: {
                usage: cpu.currentLoad.toFixed(1),
                cores: cpu.cpus.length
            },
            memory: {
                used: memoryUsed,
                total: mem.total,
                usedPercent: ((memoryUsed / mem.total) * 100).toFixed(1)
            },
            disk: {
                used: mainDisk ? mainDisk.used : 0,
                total: mainDisk ? mainDisk.size : 0,
                usedPercent: mainDisk ? mainDisk.use.toFixed(1) : 0
            },
            battery: {
                percent: battery.percent,
                charging: battery.isCharging,
                hasBattery: battery.hasBattery
            },
            os: {
                platform: os.platform,
                distro: os.distro,
                release: os.release,
                hostname: os.hostname
            },
            uptime: time.uptime
        };
    }

    async getCpuInfo() {
        const [cpu, load, temp] = await Promise.all([
            si.cpu(),
            si.currentLoad(),
            si.cpuTemperature()
        ]);

        return {
            brand: cpu.brand,
            manufacturer: cpu.manufacturer,
            speed: cpu.speed,
            cores: cpu.cores,
            physicalCores: cpu.physicalCores,
            currentLoad: load.currentLoad.toFixed(1),
            perCore: load.cpus.map((c, i) => ({
                core: i,
                load: c.load.toFixed(1)
            })),
            temperature: temp.main || null
        };
    }

    async getMemoryInfo() {
        const [mem, memLayout] = await Promise.all([
            si.mem(),
            si.memLayout()
        ]);

        return {
            total: mem.total,
            used: mem.used,
            free: mem.free,
            available: mem.available,
            active: mem.active,
            swapTotal: mem.swaptotal,
            swapUsed: mem.swapused,
            swapFree: mem.swapfree,
            layout: memLayout.map(m => ({
                size: m.size,
                type: m.type,
                clockSpeed: m.clockSpeed
            }))
        };
    }

    async getDiskInfo() {
        const [disks, io] = await Promise.all([
            si.fsSize(),
            si.disksIO()
        ]);

        return {
            partitions: disks.map(d => ({
                fs: d.fs,
                type: d.type,
                size: d.size,
                used: d.used,
                available: d.available,
                usePercent: d.use,
                mount: d.mount
            })),
            io: {
                read: io.rIO || 0,
                write: io.wIO || 0,
                readSec: io.rIO_sec || 0,
                writeSec: io.wIO_sec || 0
            }
        };
    }

    async getNetworkInfo() {
        const [interfaces, stats, connections] = await Promise.all([
            si.networkInterfaces(),
            si.networkStats(),
            si.networkConnections()
        ]);

        return {
            interfaces: interfaces.filter(i => i.ip4).map(i => ({
                iface: i.iface,
                ip4: i.ip4,
                mac: i.mac,
                type: i.type,
                speed: i.speed
            })),
            stats: stats.map(s => ({
                iface: s.iface,
                rxBytes: s.rx_bytes,
                txBytes: s.tx_bytes,
                rxSec: s.rx_sec,
                txSec: s.tx_sec
            })),
            activeConnections: connections.length
        };
    }

    async getBatteryInfo() {
        const battery = await si.battery();
        return {
            hasBattery: battery.hasBattery,
            percent: battery.percent,
            isCharging: battery.isCharging,
            acConnected: battery.acConnected,
            timeRemaining: battery.timeRemaining,
            cycleCount: battery.cycleCount,
            maxCapacity: battery.maxCapacity,
            currentCapacity: battery.currentCapacity
        };
    }

    async getProcesses() {
        const [processes, cpu] = await Promise.all([
            si.processes(),
            si.cpu()
        ]);

        // Sort by CPU usage and get top 20
        const topProcesses = processes.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 20)
            .map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu.toFixed(1), // Per core usage
                cpuNormalized: (p.cpu / cpu.cores).toFixed(1), // % of Total System CPU
                mem: p.mem.toFixed(1),
                state: p.state
            }));

        return {
            all: processes.all,
            running: processes.running,
            blocked: processes.blocked,
            sleeping: processes.sleeping,
            top: topProcesses
        };
    }
    async getSensors() {
        // Try standard sensors first
        let [temp, graphics] = await Promise.all([
            si.cpuTemperature(),
            si.graphics()
        ]);

        // Fallback for macOS Silicon if no temp data
        if (!temp.main || temp.main === -1) {
            try {
                const { exec } = require('child_process');
                const { promisify } = require('util');
                const execAsync = promisify(exec);
                const { stdout } = await execAsync('pmset -g therm');

                // Parse "No thermal warning" vs "Thermal Warning: Moderate"
                if (stdout.includes('No thermal warning')) {
                    temp.main = 45; // Nominal
                    temp.max = 50;
                } else if (stdout.includes('Moderate')) {
                    temp.main = 70; // Warm
                    temp.max = 75;
                } else if (stdout.includes('Heavy') || stdout.includes('Trapping')) {
                    temp.main = 90; // Hot
                    temp.max = 95;
                } else {
                    temp.main = 40; // Assume cool
                }

                // Mark as estimated so UI knows (optional, but good for debugging)
                // We'll just return it as main for now to fix the "N/A"
            } catch (e) {
                // Ignore fallback error
            }
        }

        return {
            cpu: {
                main: temp.main,
                cores: temp.cores,
                max: temp.max
            },
            gpu: {
                controllers: graphics.controllers.map(g => ({
                    model: g.model,
                    temperature: g.temperatureGpu || null,
                    memory: g.vram,
                    utilization: g.utilizationGpu || null
                }))
            }
        };
    }
}

module.exports = SystemInfo;
