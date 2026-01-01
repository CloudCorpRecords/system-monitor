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

        return {
            cpu: {
                usage: cpu.currentLoad.toFixed(1),
                cores: cpu.cpus.length
            },
            memory: {
                used: mem.used,
                total: mem.total,
                usedPercent: ((mem.used / mem.total) * 100).toFixed(1)
            },
            disk: {
                used: disk.reduce((acc, d) => acc + d.used, 0),
                total: disk.reduce((acc, d) => acc + d.size, 0),
                usedPercent: disk.length > 0
                    ? ((disk.reduce((acc, d) => acc + d.used, 0) / disk.reduce((acc, d) => acc + d.size, 0)) * 100).toFixed(1)
                    : 0
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
        const processes = await si.processes();

        // Sort by CPU usage and get top 20
        const topProcesses = processes.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 20)
            .map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu.toFixed(1),
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
}

module.exports = SystemInfo;
