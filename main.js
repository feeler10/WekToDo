const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db');

let mainWindow = null;
let tray = null;
let isMaximized = false;
let isQuitting = false;
let isAlwaysOnTop = false;

let windowState = {
    width: 420,
    height: 820,
    x: undefined,
    y: undefined
};

function configureAppStoragePaths() {
    const rootDataDir = path.join(process.cwd(), 'data');
    const userDataDir = path.join(rootDataDir, 'electron-user-data');
    const cacheDir = path.join(rootDataDir, 'electron-cache');
    const sessionDataDir = path.join(rootDataDir, 'electron-session-data');

    try {
        fs.mkdirSync(userDataDir, { recursive: true });
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.mkdirSync(sessionDataDir, { recursive: true });

        app.setPath('userData', userDataDir);
        app.setPath('cache', cacheDir);
        app.setPath('sessionData', sessionDataDir);
    } catch (error) {
        console.warn('璁剧疆缂撳瓨璺緞澶辫触锛屽皢浣跨敤榛樿璺緞:', error);
    }
}

configureAppStoragePaths();

function findExistingFile(candidates) {
    return candidates.find(p => {
        try {
            return p && fs.existsSync(p);
        } catch {
            return false;
        }
    });
}

function getTrayIcon() {
    // 优先级：
    // 1. 开发环境项目根目录
    // 2. renderer 目录
    // 3. 打包后 resources 目录
    // 4. exe 同级目录
    const iconPath = findExistingFile([
        path.join(__dirname, 'icon.ico'),
        path.join(__dirname, 'icon.png'),
        path.join(__dirname, 'renderer', 'icon.ico'),
        path.join(__dirname, 'renderer', 'icon.png'),
        path.join(process.resourcesPath || '', 'icon.ico'),
        path.join(process.resourcesPath || '', 'icon.png'),
        path.join(path.dirname(process.execPath), 'icon.ico'),
        path.join(path.dirname(process.execPath), 'icon.png')
    ]);

    if (!iconPath) {
        console.warn('未找到托盘图标，请在项目根目录放置 icon.ico 或 icon.png');
        return nativeImage.createEmpty();
    }

    const image = nativeImage.createFromPath(iconPath);
    if (image.isEmpty()) {
        console.warn('托盘图标加载失败:', iconPath);
        return nativeImage.createEmpty();
    }

    return image;
}

function showMainWindow() {
    if (!mainWindow) return;

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
}

function toggleMainWindow() {
    if (!mainWindow) return;

    if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
    } else {
        showMainWindow();
    }
}

function createTray() {
    if (tray) return;

    tray = new Tray(getTrayIcon());
    tray.setToolTip('WekToDo');

    const buildContextMenu = async () => {
        let taskCountText = '查看应用';
        try {
            const tasks = await db.getAllTasks();
            const completed = tasks.filter(t => !!t.completed).length;
            taskCountText = `共 ${tasks.length} 个任务，已完成 ${completed} 个`;
        } catch {
            // 忽略统计失败
        }

        const menu = Menu.buildFromTemplate([
            {
                label: '显示 / 隐藏',
                click: () => toggleMainWindow()
            },
            {
                label: taskCountText,
                enabled: false
            },
            { type: 'separator' },
            {
                label: '显示窗口',
                click: () => showMainWindow()
            },
            {
                label: '隐藏到托盘',
                click: () => {
                    if (mainWindow) mainWindow.hide();
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setContextMenu(menu);
    };

    buildContextMenu();

    tray.on('click', () => {
        toggleMainWindow();
    });

    tray.on('right-click', () => {
        buildContextMenu();
        tray.popUpContextMenu();
    });

    tray.on('double-click', () => {
        showMainWindow();
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: windowState.width,
        height: windowState.height,
        x: windowState.x,
        y: windowState.y,
        minWidth: 520,
        minHeight: 480,
        resizable: true,
        autoHideMenuBar: true,
        transparent: true,
        backgroundColor: '#00000000',
        frame: false,
        titleBarStyle: 'hidden',
        show: true,
        skipTaskbar: false,
        icon: getTrayIcon(),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('resize', () => {
        if (!isMaximized && mainWindow) {
            const bounds = mainWindow.getBounds();
            windowState.width = bounds.width;
            windowState.height = bounds.height;
        }
    });

    mainWindow.on('move', () => {
        if (!isMaximized && mainWindow) {
            const bounds = mainWindow.getBounds();
            windowState.x = bounds.x;
            windowState.y = bounds.y;
        }
    });

    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('hide', () => {
        if (mainWindow) {
            mainWindow.setSkipTaskbar(true);
        }
    });

    mainWindow.on('show', () => {
        if (mainWindow) {
            mainWindow.setSkipTaskbar(false);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const dbPath = path.join(dataDir, 'wektodo.db');
        await db.initDB(dbPath);

        createWindow();
        createTray();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            } else {
                showMainWindow();
            }
        });
    } catch (error) {
        console.error('应用启动失败:', error);
        dialog.showErrorBox('启动失败', String(error));
        app.quit();
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        // 托盘应用不在这里主动退出
    }
});

// ===== IPC =====

ipcMain.handle('get-all-tasks', async () => {
    return await db.getAllTasks();
});

ipcMain.handle('add-task', async (_, title, planDate) => {
    if (!title || !String(title).trim()) {
        throw new Error('任务标题不能为空');
    }
    return await db.addTask(String(title).trim(), planDate || null);
});

ipcMain.handle('update-task', async (_, id, completed) => {
    return await db.updateTask(Number(id), !!completed);
});

ipcMain.handle('update-task-title', async (_, id, title) => {
    if (!title || !String(title).trim()) {
        throw new Error('浠诲姟鏍囬涓嶈兘涓虹┖');
    }

    return await db.updateTaskTitle(Number(id), String(title).trim());
});

ipcMain.handle('delete-task', async (_, id) => {
    return await db.deleteTask(Number(id));
});

ipcMain.handle('get-today-tasks', async () => {
    return await db.getTodayTasks();
});

ipcMain.handle('get-week-tasks', async () => {
    return await db.getWeekTasks();
});

ipcMain.handle('get-history', async () => {
    return await db.getHistoryTasks();
});

ipcMain.handle('get-calendar-data', async () => {
    return await db.getCalendarData();
});

ipcMain.handle('get-tasks-by-date', async (_, dateStr) => {
    return await db.getTasksByDate(dateStr);
});

ipcMain.handle('get-future-plan-groups', async () => {
    return await db.getFuturePlanGroups();
});

ipcMain.handle('get-daily-templates', async () => {
    return await db.getDailyTemplates();
});

ipcMain.handle('add-daily-template', async (_, title, startDate) => {
    if (!title || !String(title).trim()) {
        throw new Error('任务标题不能为空');
    }
    return await db.addDailyTemplate(String(title).trim(), startDate || null);
});

ipcMain.handle('update-daily-template-title', async (_, id, title) => {
    if (!title || !String(title).trim()) {
        throw new Error('任务标题不能为空');
    }
    return await db.updateDailyTemplateTitle(Number(id), String(title).trim());
});

ipcMain.handle('delete-daily-template', async (_, id) => {
    return await db.deleteDailyTemplate(Number(id));
});

ipcMain.handle('get-irregular-plans', async () => {
    return await db.getIrregularPlans();
});

ipcMain.handle('add-irregular-plan', async (_, title) => {
    if (!title || !String(title).trim()) {
        throw new Error('任务标题不能为空');
    }
    return await db.addIrregularPlan(String(title).trim());
});

ipcMain.handle('update-irregular-plan', async (_, id, completed) => {
    return await db.updateIrregularPlan(Number(id), !!completed);
});

ipcMain.handle('update-irregular-plan-title', async (_, id, title) => {
    if (!title || !String(title).trim()) {
        throw new Error('任务标题不能为空');
    }
    return await db.updateIrregularPlanTitle(Number(id), String(title).trim());
});

ipcMain.handle('delete-irregular-plan', async (_, id) => {
    return await db.deleteIrregularPlan(Number(id));
});

// ===== 窗口控制 =====

ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window-maximize', () => {
    if (!mainWindow) return;

    if (isMaximized) {
        isMaximized = false;
        mainWindow.unmaximize();

        setImmediate(() => {
            if (mainWindow) {
                mainWindow.setBounds({
                    width: windowState.width,
                    height: windowState.height,
                    x: windowState.x ?? 100,
                    y: windowState.y ?? 100
                });
            }
        });
    } else {
        const bounds = mainWindow.getBounds();
        windowState.width = bounds.width;
        windowState.height = bounds.height;
        windowState.x = bounds.x;
        windowState.y = bounds.y;

        isMaximized = true;
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', async () => {
    if (!mainWindow) return;

    const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['最小化到托盘', '退出应用', '取消'],
        defaultId: 0,
        cancelId: 2,
        title: '关闭 WekToDo',
        message: '你希望如何处理当前应用？',
        detail: '可以最小化到托盘继续后台运行，或者直接退出。'
    });

    if (result.response === 0) {
        mainWindow.hide();
        return;
    }

    if (result.response === 1) {
        isQuitting = true;
        app.quit();
    }
});

ipcMain.handle('set-opacity', (_, opacity) => {
    if (mainWindow) {
        const opacityValue = Math.max(0.3, Math.min(1.0, opacity / 100));
        mainWindow.setOpacity(opacityValue);
    }
});

ipcMain.handle('resize-window', (_, direction, deltaX, deltaY) => {
    if (!mainWindow) return;

    const bounds = mainWindow.getBounds();
    const newBounds = { ...bounds };

    const minWidth = 520;
    const minHeight = 480;

    if (direction.includes('top')) {
        newBounds.y = bounds.y + deltaY;
        newBounds.height = Math.max(minHeight, bounds.height - deltaY);
    }

    if (direction.includes('bottom')) {
        newBounds.height = Math.max(minHeight, bounds.height + deltaY);
    }

    if (direction.includes('left')) {
        newBounds.x = bounds.x + deltaX;
        newBounds.width = Math.max(minWidth, bounds.width - deltaX);
    }

    if (direction.includes('right')) {
        newBounds.width = Math.max(minWidth, bounds.width + deltaX);
    }

    mainWindow.setBounds(newBounds);
});

ipcMain.handle('window-toggle-always-on-top', () => {
    if (!mainWindow) return isAlwaysOnTop;

    isAlwaysOnTop = !isAlwaysOnTop;
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    
    return isAlwaysOnTop;
});
