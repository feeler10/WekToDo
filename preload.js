const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskApi', {
    getAllTasks: () => ipcRenderer.invoke('get-all-tasks'),
    addTask: (title, planDate) => ipcRenderer.invoke('add-task', title, planDate),
    updateTask: (id, completed) => ipcRenderer.invoke('update-task', id, completed),
    updateTaskTitle: (id, title) => ipcRenderer.invoke('update-task-title', id, title),
    deleteTask: (id) => ipcRenderer.invoke('delete-task', id),
    getTodayTasks: () => ipcRenderer.invoke('get-today-tasks'),
    getWeekTasks: () => ipcRenderer.invoke('get-week-tasks'),
    getHistory: () => ipcRenderer.invoke('get-history'),
    getCalendarData: () => ipcRenderer.invoke('get-calendar-data'),
    getTasksByDate: (dateStr) => ipcRenderer.invoke('get-tasks-by-date', dateStr),
    getFuturePlanGroups: () => ipcRenderer.invoke('get-future-plan-groups'),
    getDailyTemplates: () => ipcRenderer.invoke('get-daily-templates'),
    addDailyTemplate: (title, startDate) => ipcRenderer.invoke('add-daily-template', title, startDate),
    updateDailyTemplateTitle: (id, title) => ipcRenderer.invoke('update-daily-template-title', id, title),
    deleteDailyTemplate: (id) => ipcRenderer.invoke('delete-daily-template', id),
    getIrregularPlans: () => ipcRenderer.invoke('get-irregular-plans'),
    addIrregularPlan: (title) => ipcRenderer.invoke('add-irregular-plan', title),
    updateIrregularPlan: (id, completed) => ipcRenderer.invoke('update-irregular-plan', id, completed),
    updateIrregularPlanTitle: (id, title) => ipcRenderer.invoke('update-irregular-plan-title', id, title),
    deleteIrregularPlan: (id) => ipcRenderer.invoke('delete-irregular-plan', id)
});

contextBridge.exposeInMainWorld('windowApi', {
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),
    setOpacity: (opacity) => ipcRenderer.invoke('set-opacity', opacity),
    resizeWindow: (direction, deltaX, deltaY) => ipcRenderer.invoke('resize-window', direction, deltaX, deltaY),
    toggleAlwaysOnTop: () => ipcRenderer.invoke('window-toggle-always-on-top')
});
