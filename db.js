const sqlite3 = require('sqlite3').verbose();

let db = null;

function connect(dbPath) {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('数据库未初始化'));
            return;
        }

        db.run(sql, params, function (err) {
            if (err) reject(err);
            else {
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('数据库未初始化'));
            return;
        }

        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

exports.initDB = async (dbPath) => {
    await connect(dbPath);

    await run(`
        CREATE TABLE IF NOT EXISTS task (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            create_time TEXT NOT NULL,
            update_time TEXT NOT NULL
        )
    `);
};

exports.addTask = async (title) => {
    const now = new Date().toISOString();
    const result = await run(
        `INSERT INTO task (title, completed, create_time, update_time)
         VALUES (?, 0, ?, ?)`,
        [title, now, now]
    );

    return {
        id: result.lastID,
        title,
        completed: 0,
        create_time: now,
        update_time: now
    };
};

exports.getAllTasks = async () => {
    return await all(`
        SELECT id, title, completed, create_time, update_time
        FROM task
        ORDER BY create_time DESC
    `);
};
exports.getHisTasks = async (startDate, endDate) => {
    return await all(
        `
        SELECT id, title, completed, create_time, update_time
        FROM task
        WHERE create_time BETWEEN ? AND ?
        ORDER BY create_time DESC
        `,
        [startDate, endDate]
    );
};

exports.updateTask = async (id, completed) => {
    const now = new Date().toISOString();

    await run(
        `UPDATE task
         SET completed = ?, update_time = ?
         WHERE id = ?`,
        [completed ? 1 : 0, now, id]
    );

    return true;
};

exports.updateTaskTitle = async (id, title) => {
    const now = new Date().toISOString();

    await run(
        `UPDATE task
         SET title = ?, update_time = ?
         WHERE id = ?`,
        [title, now, id]
    );

    return true;
};

exports.deleteTask = async (id) => {
    await run(`DELETE FROM task WHERE id = ?`, [id]);
    return true;
};

function isToday(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function isWithinLast7Days(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

exports.getTodayTasks = async () => {
    const tasks = await exports.getAllTasks();
    return tasks.filter(task => isToday(task.create_time));
};

exports.getWeekTasks = async () => {
    const tasks = await exports.getAllTasks();
    return tasks.filter(task => isWithinLast7Days(task.create_time));
};

exports.getHistoryTasks = async () => {
    const date = new Date().toISOString().split('T')[0];
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const enddate = d.toISOString().split('T')[0];
    const tasks = await exports.getHisTasks(enddate,date);
    const map = {};

    for (const task of tasks) {
        const date = task.create_time.split('T')[0];
        // 跳过今天
        if (isToday(task.create_time)) continue;

        if (!map[date]) {
            map[date] = [];
        }
        map[date].push(task);
    }

    return Object.keys(map)
        .sort((a, b) => b.localeCompare(a))
        .map(date => ({
            date,
            tasks: map[date]
        }));
};

exports.getCalendarData = async () => {
    const tasks = await exports.getAllTasks();
    const calendarData = {};

    // 首先按日期分组任务
    const tasksByDate = {};
    for (const task of tasks) {
        const dateStr = task.create_time.split('T')[0];
        if (!tasksByDate[dateStr]) {
            tasksByDate[dateStr] = [];
        }
        tasksByDate[dateStr].push(task);
    }

    // 处理每个日期的任务
    for (const dateStr in tasksByDate) {
        const [year, month, day] = dateStr.split('-');
        const yearNum = Number(year);
        const monthNum = Number(month);
        const dayNum = Number(day);

        const tasksOnDate = tasksByDate[dateStr];
        const allCompleted = tasksOnDate.every(task => task.completed);

        if (!calendarData[yearNum]) {
            calendarData[yearNum] = {};
        }

        if (!calendarData[yearNum][monthNum]) {
            calendarData[yearNum][monthNum] = [];
        }

        // 存储日期对象，包含完成状态
        const dayData = {
            day: dayNum,
            allCompleted: allCompleted,
            hasTask: true
        };

        calendarData[yearNum][monthNum].push(dayData);
    }

    // 对每个月份的日期进行排序
    for (const year in calendarData) {
        for (const month in calendarData[year]) {
            calendarData[year][month].sort((a, b) => a.day - b.day);
        }
    }

    return calendarData;
};

exports.getTasksByDate = async (dateStr) => {
    const tasks = await exports.getAllTasks();
    return tasks.filter(task => task.create_time.split('T')[0] === dateStr);
};
function getDateOnly(dateString) {
    return dateString.split('T')[0];
}

// ===== Enhanced task date logic (plan_date + daily rollover) =====

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getTodayDateStr() {
    return formatLocalDate(new Date());
}

function normalizeDateStr(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
    return trimmed;
}

function getDateFromISOToLocal(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return getTodayDateStr();
    return formatLocalDate(date);
}

function getTaskEffectiveDate(task) {
    return normalizeDateStr(task.plan_date) || getDateFromISOToLocal(task.create_time);
}

function compareDateOnly(a, b) {
    if (a === b) return 0;
    return a > b ? 1 : -1;
}

function diffDays(dateStrA, dateStrB) {
    const a = new Date(`${dateStrA}T00:00:00`);
    const b = new Date(`${dateStrB}T00:00:00`);
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

async function ensurePlanDateColumnExists() {
    const columns = await all(`PRAGMA table_info(task)`);
    const hasPlanDate = columns.some(col => col.name === 'plan_date');
    if (!hasPlanDate) {
        await run(`ALTER TABLE task ADD COLUMN plan_date TEXT`);
    }
}

async function ensureDailySchemaExists() {
    await run(`
        CREATE TABLE IF NOT EXISTS daily_template (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            start_date TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            create_time TEXT NOT NULL,
            update_time TEXT NOT NULL
        )
    `);

    const columns = await all(`PRAGMA table_info(task)`);
    const hasDailyTemplateId = columns.some(col => col.name === 'daily_template_id');
    if (!hasDailyTemplateId) {
        await run(`ALTER TABLE task ADD COLUMN daily_template_id INTEGER`);
    }

    await run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_task_daily_unique
        ON task (daily_template_id, plan_date)
        WHERE daily_template_id IS NOT NULL AND plan_date IS NOT NULL
    `);
}

async function ensureIrregularPlanSchemaExists() {
    await run(`
        CREATE TABLE IF NOT EXISTS irregular_plan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER NOT NULL DEFAULT 0,
            create_time TEXT NOT NULL,
            update_time TEXT NOT NULL
        )
    `);
}

function addDays(dateStr, delta) {
    const base = new Date(`${dateStr}T00:00:00`);
    base.setDate(base.getDate() + delta);
    return formatLocalDate(base);
}

async function ensureDailyTasksUpToToday() {
    const today = getTodayDateStr();
    const templates = await all(`
        SELECT id, title, start_date
        FROM daily_template
        WHERE active = 1
    `);

    for (const tpl of templates) {
        const startDate = normalizeDateStr(tpl.start_date) || today;
        if (compareDateOnly(startDate, today) > 0) continue;

        for (let d = startDate; compareDateOnly(d, today) <= 0; d = addDays(d, 1)) {
            const existing = await all(
                `SELECT id FROM task WHERE daily_template_id = ? AND plan_date = ? LIMIT 1`,
                [tpl.id, d]
            );
            if (existing.length > 0) continue;

            const now = new Date().toISOString();
            await run(
                `INSERT INTO task (title, completed, create_time, update_time, plan_date, daily_template_id)
                 VALUES (?, 0, ?, ?, ?, ?)`,
                [tpl.title, now, now, d, tpl.id]
            );
        }
    }
}

async function getAllRawTasksEnhanced() {
    await ensureDailyTasksUpToToday();
    return await all(`
        SELECT id, title, completed, create_time, update_time, plan_date, daily_template_id
        FROM task
        ORDER BY create_time DESC
    `);
}

function sortTasksByEffectiveDateDesc(tasks) {
    return tasks.sort((a, b) => {
        const ad = getTaskEffectiveDate(a);
        const bd = getTaskEffectiveDate(b);
        const dateCmp = compareDateOnly(bd, ad);
        if (dateCmp !== 0) return dateCmp;
        return new Date(b.create_time).getTime() - new Date(a.create_time).getTime();
    });
}

const originalInitDB = exports.initDB;
exports.initDB = async (dbPath) => {
    await originalInitDB(dbPath);
    await ensurePlanDateColumnExists();
    await ensureDailySchemaExists();
    await ensureIrregularPlanSchemaExists();
    await ensureDailyTasksUpToToday();
};

exports.addTask = async (title, planDate = null) => {
    const now = new Date().toISOString();
    const normalizedPlanDate = normalizeDateStr(planDate);
    const result = await run(
        `INSERT INTO task (title, completed, create_time, update_time, plan_date)
         VALUES (?, 0, ?, ?, ?)`,
        [title, now, now, normalizedPlanDate]
    );

    return {
        id: result.lastID,
        title,
        completed: 0,
        create_time: now,
        update_time: now,
        plan_date: normalizedPlanDate
    };
};

exports.getAllTasks = async () => {
    const today = getTodayDateStr();
    const tasks = await getAllRawTasksEnhanced();
    const visible = tasks.filter(task => compareDateOnly(getTaskEffectiveDate(task), today) <= 0);
    return sortTasksByEffectiveDateDesc(visible);
};

exports.getTodayTasks = async () => {
    const today = getTodayDateStr();
    const tasks = await getAllRawTasksEnhanced();
    return sortTasksByEffectiveDateDesc(
        tasks.filter(task => getTaskEffectiveDate(task) === today)
    );
};

exports.getWeekTasks = async () => {
    const today = getTodayDateStr();
    const tasks = await getAllRawTasksEnhanced();
    return sortTasksByEffectiveDateDesc(
        tasks.filter(task => {
            const d = getTaskEffectiveDate(task);
            const diff = diffDays(d, today);
            return diff >= 0 && diff <= 6;
        })
    );
};

exports.getHistoryTasks = async () => {
    const today = getTodayDateStr();
    const tasks = await getAllRawTasksEnhanced();
    const map = {};

    for (const task of tasks) {
        const d = getTaskEffectiveDate(task);
        const diff = diffDays(d, today);
        if (diff <= 0 || diff > 7) continue;
        if (!map[d]) map[d] = [];
        map[d].push(task);
    }

    return Object.keys(map)
        .sort((a, b) => compareDateOnly(b, a))
        .map(date => ({
            date,
            tasks: sortTasksByEffectiveDateDesc(map[date])
        }));
};

exports.getCalendarData = async () => {
    const tasks = await getAllRawTasksEnhanced();
    const calendarData = {};
    const tasksByDate = {};

    for (const task of tasks) {
        const dateStr = getTaskEffectiveDate(task);
        if (!tasksByDate[dateStr]) tasksByDate[dateStr] = [];
        tasksByDate[dateStr].push(task);
    }

    for (const dateStr in tasksByDate) {
        const [year, month, day] = dateStr.split('-');
        const yearNum = Number(year);
        const monthNum = Number(month);
        const dayNum = Number(day);
        const allCompleted = tasksByDate[dateStr].every(task => !!task.completed);

        if (!calendarData[yearNum]) calendarData[yearNum] = {};
        if (!calendarData[yearNum][monthNum]) calendarData[yearNum][monthNum] = [];

        calendarData[yearNum][monthNum].push({
            day: dayNum,
            allCompleted,
            hasTask: true
        });
    }

    for (const year in calendarData) {
        for (const month in calendarData[year]) {
            calendarData[year][month].sort((a, b) => a.day - b.day);
        }
    }

    return calendarData;
};

exports.getTasksByDate = async (dateStr) => {
    const normalized = normalizeDateStr(dateStr);
    if (!normalized) return [];

    const tasks = await getAllRawTasksEnhanced();
    return sortTasksByEffectiveDateDesc(
        tasks.filter(task => getTaskEffectiveDate(task) === normalized)
    );
};

exports.getFuturePlanGroups = async () => {
    const today = getTodayDateStr();
    const tasks = await getAllRawTasksEnhanced();
    const map = {};

    for (const task of tasks) {
        const planDate = normalizeDateStr(task.plan_date);
        if (!planDate) continue;
        if (compareDateOnly(planDate, today) <= 0) continue;

        if (!map[planDate]) {
            map[planDate] = { date: planDate, total: 0, completed: 0 };
        }
        map[planDate].total += 1;
        if (task.completed) map[planDate].completed += 1;
    }

    return Object.keys(map)
        .sort((a, b) => compareDateOnly(a, b))
        .map(date => map[date]);
};

exports.getDailyTemplates = async () => {
    return await all(`
        SELECT id, title, start_date, active, create_time, update_time
        FROM daily_template
        WHERE active = 1
        ORDER BY create_time DESC
    `);
};

exports.addDailyTemplate = async (title, startDate = null) => {
    const now = new Date().toISOString();
    const normalizedStart = normalizeDateStr(startDate) || getTodayDateStr();

    const result = await run(
        `INSERT INTO daily_template (title, start_date, active, create_time, update_time)
         VALUES (?, ?, 1, ?, ?)`,
        [title, normalizedStart, now, now]
    );

    await ensureDailyTasksUpToToday();

    return {
        id: result.lastID,
        title,
        start_date: normalizedStart,
        active: 1,
        create_time: now,
        update_time: now
    };
};

exports.updateDailyTemplateTitle = async (id, title) => {
    const now = new Date().toISOString();
    await run(
        `UPDATE daily_template
         SET title = ?, update_time = ?
         WHERE id = ?`,
        [title, now, id]
    );

    await run(
        `UPDATE task
         SET title = ?, update_time = ?
         WHERE daily_template_id = ?`,
        [title, now, id]
    );

    return true;
};

exports.deleteDailyTemplate = async (id) => {
    const now = new Date().toISOString();
    const today = getTodayDateStr();

    await run(
        `UPDATE daily_template
         SET active = 0, update_time = ?
         WHERE id = ?`,
        [now, id]
    );

    await run(
        `DELETE FROM task
         WHERE daily_template_id = ? AND plan_date >= ?`,
        [id, today]
    );

    return true;
};

exports.getIrregularPlans = async () => {
    return await all(`
        SELECT id, title, completed, create_time, update_time
        FROM irregular_plan
        ORDER BY create_time DESC
    `);
};

exports.addIrregularPlan = async (title) => {
    const now = new Date().toISOString();
    const result = await run(
        `INSERT INTO irregular_plan (title, completed, create_time, update_time)
         VALUES (?, 0, ?, ?)`,
        [title, now, now]
    );

    return {
        id: result.lastID,
        title,
        completed: 0,
        create_time: now,
        update_time: now
    };
};

exports.updateIrregularPlan = async (id, completed) => {
    const now = new Date().toISOString();
    await run(
        `UPDATE irregular_plan
         SET completed = ?, update_time = ?
         WHERE id = ?`,
        [completed ? 1 : 0, now, id]
    );
    return true;
};

exports.updateIrregularPlanTitle = async (id, title) => {
    const now = new Date().toISOString();
    await run(
        `UPDATE irregular_plan
         SET title = ?, update_time = ?
         WHERE id = ?`,
        [title, now, id]
    );
    return true;
};

exports.deleteIrregularPlan = async (id) => {
    await run(`DELETE FROM irregular_plan WHERE id = ?`, [id]);
    return true;
};
