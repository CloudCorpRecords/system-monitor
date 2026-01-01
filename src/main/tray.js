const { Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

let tray = null;

function setupTray(mainWindow) {
    // Create icon (use a simple template or file)
    // For now, we'll try to use a system icon or an asset if available.
    // If no icon asset, we can use an empty image and just rely on the text title.
    const icon = nativeImage.createEmpty();

    tray = new Tray(icon);

    // Set Tooltip
    tray.setToolTip('System Monitor AI');

    // Initial Title
    tray.setTitle('Init...');

    // Context Menu
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Dashboard',
            click: () => mainWindow.show()
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    // Click handler to toggle window
    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    return tray;
}

function updateTrayTitle(trayInstance, stats) {
    if (!trayInstance || trayInstance.isDestroyed()) return;

    // Format: "CPU: 15% | 45°C"
    const cpu = Math.round(stats.cpu.usage);
    let title = `CPU: ${cpu}%`;

    // Add Temp if available (and safe)
    if (stats.sensors && stats.sensors.cpu && stats.sensors.cpu.main) {
        title += ` | ${Math.round(stats.sensors.cpu.main)}°C`;
    }

    trayInstance.setTitle(title);
}

module.exports = { setupTray, updateTrayTitle };
