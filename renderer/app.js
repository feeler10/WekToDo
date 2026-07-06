const { createApp } = Vue;

createApp({
    data() {
        return {
            tasks: [],
            newTaskTitle: '',
            currentFilter: 'all',
            showPlanBranches: false,
            historyList: [],
            futurePlanList: [],
            selectedTasks: [],
            selectedid: '',
            showCalendar: false,
            calendarMode: 'browse',
            calendarData: {},
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth() + 1,
            selectedDate: null,
            showThemePicker: false,
            themeColor: '#58b2ff',
            pendingThemeColor: '#58b2ff',
            isAlwaysOnTop: false,
            showCompletedMarks: false,
            showingAllTasks: false,
            editingTaskId: null,
            editingTitle: '',
            savingEditTaskId: null,
            midnightRefreshTimer: null,
            calendarReturnFilter: 'all',
            globalMenuClickHandler: null,
            planMenuStyle: {
                top: '0px',
                left: '0px'
            }
        };
    },

    computed: {
        filteredTasks() {
            return this.tasks;
        },

        completedCount() {
            return this.tasks.filter(task => !!task.completed).length;
        },

        calendarDays() {
            const year = this.currentYear;
            const month = this.currentMonth;
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            const daysInMonth = lastDay.getDate();
            const startingDayOfWeek = firstDay.getDay();
            const days = [];

            for (let i = startingDayOfWeek - 1; i >= 0; i--) {
                const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
                days.push({
                    day: prevMonthLastDay - i,
                    isCurrentMonth: false,
                    hasTask: false,
                    allCompleted: false,
                    isClickable: false,
                    isPlanVisible: true,
                    dateStr: ''
                });
            }

            const monthData = this.calendarData[year]?.[month] || [];
            for (let day = 1; day <= daysInMonth; day++) {
                const dayData = monthData.find(d => d.day === day);
                const hasTask = !!dayData;
                const allCompleted = dayData?.allCompleted || false;
                const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isFutureDate = dateStr > this.getTodayDateStr();
                const isClickable = this.calendarMode === 'plan' ? isFutureDate : hasTask;
                const isPlanVisible = true;

                days.push({
                    day,
                    isCurrentMonth: true,
                    hasTask,
                    allCompleted,
                    isClickable,
                    isPlanVisible,
                    dateStr
                });
            }

            const totalCells = 42;
            const remainingDays = totalCells - days.length;
            for (let day = 1; day <= remainingDays; day++) {
                days.push({
                    day,
                    isCurrentMonth: false,
                    hasTask: false,
                    allCompleted: false,
                    isClickable: false,
                    isPlanVisible: true,
                    dateStr: ''
                });
            }

            return days;
        }
    },

    methods: {
        getTodayDateStr() {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        },

        isFutureDate(dateStr) {
            return !!dateStr && dateStr > this.getTodayDateStr();
        },

        hexToRgb(hex) {
            if (!hex) return '88, 178, 255';
            const value = hex.replace('#', '');
            if (value.length !== 6) return '88, 178, 255';

            const r = parseInt(value.slice(0, 2), 16);
            const g = parseInt(value.slice(2, 4), 16);
            const b = parseInt(value.slice(4, 6), 16);
            return `${r}, ${g}, ${b}`;
        },

        applyThemeToDocument(color) {
            const rgb = this.hexToRgb(color);
            document.documentElement.style.setProperty('--theme-rgb', rgb);
            document.body.classList.add('theme-custom');
        },

        loadSavedThemeColor() {
            try {
                const saved = localStorage.getItem('wektodo-theme-color');
                if (saved) {
                    this.themeColor = saved;
                    this.pendingThemeColor = saved;
                    this.applyThemeToDocument(saved);
                }
            } catch (error) {
                console.warn('读取主题颜色失败:', error);
            }
        },

        openThemePicker() {
            this.pendingThemeColor = this.themeColor;
            this.showThemePicker = true;
        },

        closeThemePicker() {
            this.showThemePicker = false;
            this.pendingThemeColor = this.themeColor;
        },

        applyThemeColor() {
            this.themeColor = this.pendingThemeColor;
            this.applyThemeToDocument(this.themeColor);

            try {
                localStorage.setItem('wektodo-theme-color', this.themeColor);
            } catch (error) {
                console.warn('保存主题颜色失败:', error);
            }

            this.showThemePicker = false;
        },

        resetThemeColor() {
            const defaultColor = '#58b2ff';
            this.themeColor = defaultColor;
            this.pendingThemeColor = defaultColor;
            this.applyThemeToDocument(defaultColor);

            try {
                localStorage.setItem('wektodo-theme-color', defaultColor);
            } catch (error) {
                console.warn('保存默认主题颜色失败:', error);
            }

            this.showThemePicker = false;
        },

        formatDate(dateStr) {
            if (!dateStr) return '';
            const date = dateStr.split('T')[0];
            const parts = date.split('-');
            if (parts.length !== 3) return dateStr;
            return Number(parts[1]) + '.' + Number(parts[2]);
        },

        async loadHistory() {
            try {
                const data = await window.taskApi.getHistory();
                this.historyList = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('加载历史记录失败:', error);
                this.historyList = [];
            }
        },

        async loadFuturePlans() {
            try {
                const data = await window.taskApi.getFuturePlanGroups();
                this.futurePlanList = Array.isArray(data) ? data : [];
            } catch (error) {
                console.error('加载未来计划失败:', error);
                this.futurePlanList = [];
            }
        },

        async loadSidebarLists() {
            await this.loadHistory();
            await this.loadFuturePlans();
        },

        async loadDailyTemplates() {
            try {
                const templates = await window.taskApi.getDailyTemplates();
                this.tasks = (Array.isArray(templates) ? templates : []).map(item => ({
                    id: `daily-${item.id}`,
                    templateId: item.id,
                    title: item.title,
                    completed: 0,
                    create_time: item.create_time,
                    update_time: item.update_time,
                    start_date: item.start_date,
                    isDailyTemplate: true
                }));
            } catch (error) {
                console.error('加载每日模板失败:', error);
                this.tasks = [];
            }
        },

        async loadIrregularPlans() {
            try {
                const plans = await window.taskApi.getIrregularPlans();
                this.tasks = (Array.isArray(plans) ? plans : []).map(item => ({
                    id: `irregular-${item.id}`,
                    irregularId: item.id,
                    title: item.title,
                    completed: !!item.completed,
                    create_time: item.create_time,
                    update_time: item.update_time,
                    isIrregularPlan: true
                }));
            } catch (error) {
                console.error('加载不定期计划失败:', error);
                this.tasks = [];
            }
        },

        async loadTasks() {
            try {
                if (this.currentFilter === 'today') {
                    this.tasks = await window.taskApi.getTodayTasks();
                } else if (this.currentFilter === 'daily') {
                    await this.loadDailyTemplates();
                } else if (this.currentFilter === 'plan-irregular') {
                    await this.loadIrregularPlans();
                } else if (this.currentFilter === 'week') {
                    this.tasks = await window.taskApi.getWeekTasks();
                } else if (this.currentFilter === 'other') {
                    await this.selectHistoryTasks(this.selectedid);
                    return;
                } else if (this.currentFilter === 'plan-date') {
                    if (!this.selectedid) {
                        this.tasks = [];
                    } else {
                        this.tasks = await window.taskApi.getTasksByDate(this.selectedid);
                    }
                } else if (this.currentFilter === 'calendar') {
                    return;
                } else {
                    this.tasks = await window.taskApi.getAllTasks();
                }
            } catch (error) {
                console.error('加载任务失败:', error);
                this.tasks = [];
            }
        },

        async addTask() {
            const title = this.newTaskTitle.trim();
            if (!title) {
                alert('请输入任务内容');
                return;
            }

            try {
                if (this.currentFilter === 'daily') {
                    await window.taskApi.addDailyTemplate(title, this.getTodayDateStr());
                    this.newTaskTitle = '';
                    await this.loadDailyTemplates();
                    await this.loadSidebarLists();
                    this.calendarData = await window.taskApi.getCalendarData();
                    return;
                }
                if (this.currentFilter === 'plan-irregular') {
                    await window.taskApi.addIrregularPlan(title);
                    this.newTaskTitle = '';
                    await this.loadIrregularPlans();
                    return;
                }

                const planDate = this.currentFilter === 'plan-date' ? this.selectedid : null;
                await window.taskApi.addTask(title, planDate);
                this.newTaskTitle = '';

                if (this.currentFilter === 'plan-date' && this.selectedid) {
                    this.tasks = await window.taskApi.getTasksByDate(this.selectedid);
                } else {
                    await this.loadTasks();
                }

                await this.loadSidebarLists();
                this.calendarData = await window.taskApi.getCalendarData();
            } catch (error) {
                console.error('添加任务失败:', error);
                alert('添加任务失败');
            }
        },

        async selectHistoryTasks(date) {
            try {
                this.selectedid = date;
                this.currentFilter = 'other';

                if (!this.historyList || this.historyList.length === 0) {
                    await this.loadHistory();
                }

                const target = this.historyList.find(item => item.date === date);
                this.tasks = target?.tasks || [];
                this.selectedTasks = this.tasks;
            } catch (error) {
                console.error('加载历史日期任务失败:', error);
                this.tasks = [];
            }
        },

        async selectFuturePlanTasks(date) {
            try {
                this.selectedid = date;
                this.currentFilter = 'plan-date';
                this.tasks = await window.taskApi.getTasksByDate(date);
            } catch (error) {
                console.error('加载计划日期任务失败:', error);
                this.tasks = [];
            }
        },

        startEditTask(task) {
            this.editingTaskId = task.id;
            this.editingTitle = task.title || '';

            Vue.nextTick(() => {
                const input = this.$refs['taskEditInput-' + task.id];
                if (input && typeof input.focus === 'function') {
                    input.focus();
                    input.select();
                }
            });
        },

        cancelEditTask() {
            this.editingTaskId = null;
            this.editingTitle = '';
        },

        async saveEditTask(taskId) {
            if (this.editingTaskId !== taskId) return;
            if (this.savingEditTaskId === taskId) return;

            const title = this.editingTitle.trim();
            if (!title) {
                alert('任务标题不能为空');
                Vue.nextTick(() => {
                    const input = this.$refs['taskEditInput-' + taskId];
                    if (input && typeof input.focus === 'function') {
                        input.focus();
                    }
                });
                return;
            }

            const currentTask = this.tasks.find(task => task.id === taskId);
            if (currentTask && currentTask.title === title) {
                this.cancelEditTask();
                return;
            }

            this.savingEditTaskId = taskId;

            try {
                const currentTask = this.tasks.find(task => task.id === taskId);
                if (currentTask?.isDailyTemplate) {
                    await window.taskApi.updateDailyTemplateTitle(currentTask.templateId, title);
                } else if (currentTask?.isIrregularPlan) {
                    await window.taskApi.updateIrregularPlanTitle(currentTask.irregularId, title);
                } else {
                    await window.taskApi.updateTaskTitle(taskId, title);
                }
                await this.reloadAfterTaskMutation();
                this.cancelEditTask();
            } catch (error) {
                console.error('修改任务标题失败:', error);
                alert('修改任务标题失败');
            } finally {
                this.savingEditTaskId = null;
            }
        },

        async toggleTaskStatus(taskId, completed) {
            try {
                if (this.currentFilter === 'daily') {
                    return;
                }
                if (this.currentFilter === 'plan-irregular') {
                    const currentTask = this.tasks.find(task => task.id === taskId);
                    if (!currentTask?.irregularId) return;
                    await window.taskApi.updateIrregularPlan(currentTask.irregularId, completed);
                    await this.loadIrregularPlans();
                    return;
                }
                await window.taskApi.updateTask(taskId, completed);
                await this.reloadAfterTaskMutation();
            } catch (error) {
                console.error('更新任务状态失败:', error);
                alert('更新任务状态失败');
            }
        },

        async deleteTask(taskId) {
            if (!confirm('确定要删除这个任务吗？')) {
                return;
            }

            try {
                if (this.currentFilter === 'daily') {
                    const currentTask = this.tasks.find(task => task.id === taskId);
                    if (currentTask?.templateId) {
                        await window.taskApi.deleteDailyTemplate(currentTask.templateId);
                    }
                    await this.loadDailyTemplates();
                    await this.loadSidebarLists();
                    this.calendarData = await window.taskApi.getCalendarData();
                    return;
                }
                if (this.currentFilter === 'plan-irregular') {
                    const currentTask = this.tasks.find(task => task.id === taskId);
                    if (currentTask?.irregularId) {
                        await window.taskApi.deleteIrregularPlan(currentTask.irregularId);
                    }
                    await this.loadIrregularPlans();
                    return;
                }

                await window.taskApi.deleteTask(taskId);

                if (this.currentFilter === 'other') {
                    await this.loadHistory();
                    const stillExists = this.historyList.some(item => item.date === this.selectedid);
                    if (stillExists) {
                        await this.selectHistoryTasks(this.selectedid);
                    } else {
                        this.currentFilter = 'all';
                        this.selectedid = '';
                        await this.loadTasks();
                    }
                } else if (this.currentFilter === 'plan-date') {
                    await this.loadFuturePlans();
                    const stillExists = this.futurePlanList.some(item => item.date === this.selectedid);
                    if (stillExists) {
                        this.tasks = await window.taskApi.getTasksByDate(this.selectedid);
                    } else {
                        this.currentFilter = 'all';
                        this.selectedid = '';
                        await this.loadTasks();
                    }
                } else if (this.currentFilter === 'calendar') {
                    await this.selectDateFromCalendar({ dateStr: this.selectedid, isClickable: true, isCurrentMonth: true });
                } else {
                    await this.loadTasks();
                }

                await this.loadSidebarLists();
                this.calendarData = await window.taskApi.getCalendarData();
            } catch (error) {
                console.error('删除任务失败:', error);
                alert('删除任务失败');
            }
        },

        async reloadAfterTaskMutation() {
            await this.loadSidebarLists();
            this.calendarData = await window.taskApi.getCalendarData();

            if (this.currentFilter === 'daily') {
                await this.loadDailyTemplates();
                return;
            }
            if (this.currentFilter === 'plan-irregular') {
                await this.loadIrregularPlans();
                return;
            }

            if (this.currentFilter === 'other') {
                await this.selectHistoryTasks(this.selectedid);
                return;
            }

            if (this.currentFilter === 'plan-date') {
                this.tasks = await window.taskApi.getTasksByDate(this.selectedid);
                return;
            }

            if (this.currentFilter === 'calendar') {
                this.tasks = await window.taskApi.getTasksByDate(this.selectedid);
                return;
            }

            await this.loadTasks();
        },

        async filterTasks(filter) {
            try {
                if (filter === 'all') {
                    this.showPlanBranches = false;
                    this.calendarReturnFilter = this.currentFilter || 'all';
                    this.currentFilter = 'all';
                    await this.openCalendar('browse');
                    return;
                }

                if (filter === 'plan') {
                    this.showPlanBranches = !this.showPlanBranches;
                    if (this.showPlanBranches) {
                        this.updatePlanMenuPosition();
                    }
                    if (!this.showPlanBranches && (this.currentFilter === 'plan-irregular' || this.currentFilter === 'plan-regular')) {
                        this.currentFilter = 'all';
                        await this.loadTasks();
                    }
                    return;
                }

                if (filter === 'plan-irregular' || filter === 'plan-regular' || filter === 'daily') {
                    this.showPlanBranches = false;
                    if (filter === 'plan-regular') {
                        this.calendarReturnFilter = this.currentFilter || 'all';
                        this.currentFilter = 'plan-regular';
                        await this.openCalendar('plan');
                    } else {
                        this.currentFilter = filter;
                        this.selectedid = '';
                        await this.loadTasks();
                    }
                    return;
                }

                this.showPlanBranches = false;
                this.currentFilter = filter;
                this.selectedid = '';
                await this.loadTasks();
            } catch (error) {
                console.error('筛选任务失败:', error);
                alert('操作失败: ' + error.message);
            }
        },

        async openCalendar(mode = 'browse') {
            try {
                this.calendarMode = (mode === 'plan' || this.currentFilter === 'plan' || this.currentFilter === 'plan-regular') ? 'plan' : 'browse';
                this.showCalendar = true;

                if (!this.calendarData || Object.keys(this.calendarData).length === 0) {
                    this.calendarData = await window.taskApi.getCalendarData();
                }

                this.currentYear = new Date().getFullYear();
                this.currentMonth = new Date().getMonth() + 1;
            } catch (error) {
                console.error('打开日历失败:', error);
                this.showCalendar = false;
                alert('加载日历数据失败: ' + error.message);
            }
        },

        closeCalendar() {
            this.showCalendar = false;
            this.selectedDate = null;
            if (this.currentFilter === 'plan' || this.currentFilter === 'plan-regular') {
                this.currentFilter = this.calendarReturnFilter === 'plan'
                    ? 'all'
                    : (this.calendarReturnFilter || 'all');
            }
            this.calendarMode = 'browse';
        },

        navigateMonth(direction) {
            this.currentMonth += direction;
            if (this.currentMonth > 12) {
                this.currentMonth = 1;
                this.currentYear += 1;
            } else if (this.currentMonth < 1) {
                this.currentMonth = 12;
                this.currentYear -= 1;
            }
        },

        async selectDateFromCalendar(day) {
            if (!day.isCurrentMonth) return;
            const dateStr = day.dateStr;
            if (!dateStr) return;

            const inPlanMode = this.calendarMode === 'plan' || this.currentFilter === 'plan' || this.currentFilter === 'plan-regular';
            if (inPlanMode) {
                if (!this.isFutureDate(dateStr)) {
                    alert('计划模式仅支持明天及未来日期');
                    return;
                }

                this.selectedDate = dateStr;
                this.selectedid = dateStr;
                this.currentFilter = 'plan-date';
                this.closeCalendar();

                try {
                    this.tasks = await window.taskApi.getTasksByDate(dateStr);
                } catch (error) {
                    console.error('加载日期任务失败:', error);
                    alert('加载日期任务失败: ' + error.message);
                    this.tasks = [];
                }
                return;
            }

            if (!day.isClickable) return;

            this.selectedDate = dateStr;
            this.selectedid = dateStr;
            this.currentFilter = 'calendar';
            this.closeCalendar();

            try {
                this.tasks = await window.taskApi.getTasksByDate(dateStr);
            } catch (error) {
                console.error('加载日期任务失败:', error);
                alert('加载日期任务失败: ' + error.message);
                this.tasks = [];
            }
        },

        async refreshAll() {
            await this.loadSidebarLists();
            await this.loadTasks();
            this.calendarData = await window.taskApi.getCalendarData();
        },

        async showAllTasksInCalendar() {
            try {
                const allTasks = await window.taskApi.getAllTasks();

                this.tasks = allTasks.sort((a, b) => {
                    if (a.completed !== b.completed) {
                        return a.completed - b.completed;
                    }
                    return new Date(b.create_time) - new Date(a.create_time);
                });

                this.showingAllTasks = true;
                this.currentFilter = 'all';
                this.closeCalendar();
            } catch (error) {
                console.error('加载所有任务失败:', error);
                alert('加载所有任务失败: ' + error.message);
            }
        },

        scheduleMidnightRefresh() {
            if (this.midnightRefreshTimer) {
                clearTimeout(this.midnightRefreshTimer);
            }

            const now = new Date();
            const next = new Date(now);
            next.setHours(24, 0, 2, 0);
            const waitMs = Math.max(1500, next.getTime() - now.getTime());

            this.midnightRefreshTimer = setTimeout(async () => {
                await this.onDateChanged();
                this.scheduleMidnightRefresh();
            }, waitMs);
        },

        async onDateChanged() {
            await this.loadSidebarLists();
            this.calendarData = await window.taskApi.getCalendarData();

            if (this.currentFilter === 'plan-date' && this.selectedid === this.getTodayDateStr()) {
                this.currentFilter = 'today';
                this.selectedid = '';
            }

            await this.loadTasks();
        },

        handleGlobalMenuClick(event) {
            if (!this.showPlanBranches) return;

            const menu = this.$refs.planMenuPanel;
            const trigger = this.$refs.planEntryButton;
            const target = event.target;

            if (menu && menu.contains(target)) return;
            if (trigger && trigger.contains(target)) return;

            this.showPlanBranches = false;
        },

        updatePlanMenuPosition() {
            const trigger = this.$refs.planEntryButton;
            if (!trigger) return;

            const rect = trigger.getBoundingClientRect();
            const menuWidth = 180;
            const gap = 8;
            const nextLeft = Math.min(
                window.innerWidth - menuWidth - 12,
                Math.max(12, rect.right + gap)
            );
            const nextTop = Math.min(
                window.innerHeight - 180,
                Math.max(12, rect.top)
            );

            this.planMenuStyle = {
                left: `${nextLeft}px`,
                top: `${nextTop}px`
            };
        },

        setupWindowControls() {
            document.getElementById('theme-btn')?.addEventListener('click', () => {
                this.openThemePicker();
            });

            document.getElementById('pin-btn')?.addEventListener('click', async () => {
                try {
                    this.isAlwaysOnTop = await window.windowApi.toggleAlwaysOnTop();
                    const pinBtn = document.getElementById('pin-btn');
                    if (pinBtn) {
                        pinBtn.classList.toggle('active', this.isAlwaysOnTop);
                    }
                } catch (error) {
                    console.error('切换置顶状态失败:', error);
                }
            });

            document.getElementById('minimize-btn')?.addEventListener('click', () => {
                window.windowApi.minimize();
            });

            document.getElementById('maximize-btn')?.addEventListener('click', () => {
                window.windowApi.maximize();
            });

            document.getElementById('close-btn')?.addEventListener('click', () => {
                window.windowApi.close();
            });

            const opacitySlider = document.getElementById('opacity-slider');
            const opacityValue = document.getElementById('opacity-value');
            const container = document.querySelector('.container');

            if (opacitySlider) {
                opacitySlider.addEventListener('input', (e) => {
                    const value = parseInt(e.target.value, 10);
                    opacityValue.textContent = value + '%';

                    window.windowApi.setOpacity(value);

                    const ratio = value / 100;

                    if (container) {
                        const containerOpacity = 0.18 + (1 - 0.18) * ratio;
                        container.style.backgroundColor = `rgba(255, 255, 255, ${Math.min(containerOpacity, 1)})`;
                        container.style.borderColor = `rgba(255, 255, 255, ${Math.min(0.38 * ratio, 1)})`;
                    }
                });
            }

            this.setupResizers();
        },

        setupResizers() {
            const resizers = document.querySelectorAll('.window-resizer');

            resizers.forEach(resizer => {
                resizer.addEventListener('mousedown', (e) => {
                    e.preventDefault();

                    const direction = Array.from(resizer.classList).find(cls => cls !== 'window-resizer');
                    const startX = e.screenX;
                    const startY = e.screenY;
                    let totalDeltaX = 0;
                    let totalDeltaY = 0;

                    const handleMouseMove = (moveEvent) => {
                        totalDeltaX = moveEvent.screenX - startX;
                        totalDeltaY = moveEvent.screenY - startY;
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);

                        if ((totalDeltaX !== 0 || totalDeltaY !== 0) && window.windowApi.resizeWindow) {
                            window.windowApi.resizeWindow(direction, totalDeltaX, totalDeltaY);
                        }
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                });
            });
        },

        updateDynamicScale() {
            const container = document.querySelector('.container');
            const app = document.querySelector('#app');
            if (!container || !app) return;

            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;

            const baseWidth = 576;
            const baseHeight = 352;

            const scaleX = containerWidth / baseWidth;
            const scaleY = containerHeight / baseHeight;
            const scale = Math.max(0.2, Math.min(1, Math.min(scaleX, scaleY)));

            document.documentElement.style.fontSize = (16 * scale) + 'px';
        },

        setupDynamicScaleObserver() {
            const container = document.querySelector('.container');
            if (!container) return;

            const resizeObserver = new ResizeObserver(() => {
                this.updateDynamicScale();
            });

            resizeObserver.observe(container);
        },

        initializeOpacity() {
            const opacitySlider = document.getElementById('opacity-slider');
            if (opacitySlider) {
                const value = parseInt(opacitySlider.value, 10);
                const ratio = value / 100;
                const container = document.querySelector('.container');

                if (container) {
                    const containerOpacity = 0.18 + (1 - 0.18) * ratio;
                    container.style.backgroundColor = `rgba(255, 255, 255, ${Math.min(containerOpacity, 1)})`;
                    container.style.borderColor = `rgba(255, 255, 255, ${Math.min(0.38 * ratio, 1)})`;
                }
            }
        }
    },

    async mounted() {
        try {
            await this.loadSidebarLists();
            this.tasks = await window.taskApi.getAllTasks();
            this.calendarData = await window.taskApi.getCalendarData();

            this.setupWindowControls();
            this.loadSavedThemeColor();
            this.scheduleMidnightRefresh();
            this.globalMenuClickHandler = this.handleGlobalMenuClick.bind(this);
            document.addEventListener('click', this.globalMenuClickHandler);
            window.addEventListener('resize', this.updatePlanMenuPosition);

            Vue.nextTick(() => {
                this.initializeOpacity();
                this.updateDynamicScale();
                this.setupDynamicScaleObserver();
            });
        } catch (error) {
            console.error('初始化失败:', error);
            alert('初始化失败: ' + error.message);
        }
    },

    beforeUnmount() {
        if (this.globalMenuClickHandler) {
            document.removeEventListener('click', this.globalMenuClickHandler);
            this.globalMenuClickHandler = null;
        }
        window.removeEventListener('resize', this.updatePlanMenuPosition);
        if (this.midnightRefreshTimer) {
            clearTimeout(this.midnightRefreshTimer);
            this.midnightRefreshTimer = null;
        }
    }
}).mount('#app');
