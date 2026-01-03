/**
 * 数据存储管理模块
 * 负责本地存储、数据库操作和数据同步
 */

class StorageManager {
    constructor() {
        this.dbName = 'RollCallDB';
        this.version = 1;
        this.db = null;
        this.init();
    }

    /**
     * 初始化数据库
     */
    async init() {
        try {
            await this.openDatabase();
            console.log('数据库初始化成功');
        } catch (error) {
            console.error('数据库初始化失败:', error);
            // 使用 localStorage 作为备用方案
            this.useLocalStorage();
        }
    }

    /**
     * 打开 IndexedDB 数据库
     */
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建班级表
                if (!db.objectStoreNames.contains('classes')) {
                    const classStore = db.createObjectStore('classes', { keyPath: 'id', autoIncrement: true });
                    classStore.createIndex('name', 'name', { unique: false });
                    classStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 创建学生表
                if (!db.objectStoreNames.contains('students')) {
                    const studentStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
                    studentStore.createIndex('classId', 'classId', { unique: false });
                    studentStore.createIndex('name', 'name', { unique: false });
                    studentStore.createIndex('callCount', 'callCount', { unique: false });
                    studentStore.createIndex('lastCalled', 'lastCalled', { unique: false });
                }

                // 创建点名记录表
                if (!db.objectStoreNames.contains('callRecords')) {
                    const recordStore = db.createObjectStore('callRecords', { keyPath: 'id', autoIncrement: true });
                    recordStore.createIndex('classId', 'classId', { unique: false });
                    recordStore.createIndex('studentId', 'studentId', { unique: false });
                    recordStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // 创建设置表
                if (!db.objectStoreNames.contains('settings')) {
                    const settingStore = db.createObjectStore('settings', { keyPath: 'key' });
                }

                // 创建系统日志表
                if (!db.objectStoreNames.contains('systemLogs')) {
                    const logStore = db.createObjectStore('systemLogs', { keyPath: 'id', autoIncrement: true });
                    logStore.createIndex('actionType', 'actionType', { unique: false });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    /**
     * 使用 localStorage 作为备用方案
     */
    useLocalStorage() {
        console.log('使用 localStorage 备用方案');
        this.fallbackMode = true;
    }

    /**
     * 获取当前数据库连接
     */
    getDB() {
        if (this.fallbackMode) {
            return null;
        }
        return this.db;
    }

    /**
     * 通用数据库操作方法
     */
    async operation(storeName, operation, data = null) {
        if (this.fallbackMode) {
            return this.localStorageOperation(storeName, operation, data);
        }

        const db = this.getDB();
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            let request;

            switch (operation) {
                case 'add':
                    request = store.add(data);
                    break;
                case 'put':
                    request = store.put(data);
                    break;
                case 'delete':
                    request = store.delete(data);
                    break;
                case 'get':
                    request = store.get(data);
                    break;
                case 'getAll':
                    request = store.getAll();
                    break;
                case 'clear':
                    request = store.clear();
                    break;
                case 'count':
                    request = store.count();
                    break;
                default:
                    reject(new Error(`不支持的操作: ${operation}`));
                    return;
            }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * localStorage 操作方法
     */
    localStorageOperation(storeName, operation, data = null) {
        const key = `${this.dbName}_${storeName}`;
        let dataList = JSON.parse(localStorage.getItem(key) || '[]');

        switch (operation) {
            case 'add':
                const newItem = { ...data, id: Date.now() };
                dataList.push(newItem);
                localStorage.setItem(key, JSON.stringify(dataList));
                return newItem.id;
            case 'put':
                const index = dataList.findIndex(item => item.id === data.id);
                if (index !== -1) {
                    dataList[index] = data;
                } else {
                    dataList.push(data);
                }
                localStorage.setItem(key, JSON.stringify(dataList));
                return data.id;
            case 'delete':
                dataList = dataList.filter(item => item.id !== data);
                localStorage.setItem(key, JSON.stringify(dataList));
                return true;
            case 'get':
                return dataList.find(item => item.id === data) || null;
            case 'getAll':
                return dataList;
            case 'clear':
                localStorage.removeItem(key);
                return true;
            case 'count':
                return dataList.length;
            default:
                throw new Error(`不支持的操作: ${operation}`);
        }
    }

    // ==================== 班级管理 ====================

    /**
     * 创建班级
     */
    async createClass(classData) {
        const newClass = {
            name: classData.name,
            description: classData.description || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            studentCount: 0,
            totalCalls: 0
        };

        return await this.operation('classes', 'add', newClass);
    }

    /**
     * 添加班级 (createClass的别名)
     */
    async addClass(classData) {
        return await this.createClass(classData);
    }

    /**
     * 获取所有班级
     */
    async getAllClasses() {
        return await this.operation('classes', 'getAll');
    }

    /**
     * 根据ID获取班级
     */
    async getClassById(id) {
        return await this.operation('classes', 'get', parseInt(id));
    }

    /**
     * 更新班级信息
     */
    async updateClass(id, classData) {
        const existingClass = await this.getClassById(id);
        if (!existingClass) {
            throw new Error('班级不存在');
        }

        const updatedClass = {
            ...existingClass,
            ...classData,
            updatedAt: new Date().toISOString()
        };

        return await this.operation('classes', 'put', updatedClass);
    }

    /**
     * 删除班级
     */
    async deleteClass(id) {
        // 先删除该班级下的所有学生
        const students = await this.getStudentsByClassId(id);
        for (const student of students) {
            await this.deleteStudent(student.id);
        }

        // 删除班级
        return await this.operation('classes', 'delete', parseInt(id));
    }

    // ==================== 学生管理 ====================

    /**
     * 添加学生
     */
    async addStudent(studentData) {
        const newStudent = {
            classId: studentData.classId,
            name: studentData.name.trim(),
            studentId: studentData.studentId || '',
            phone: studentData.phone || '',
            email: studentData.email || '',
            notes: studentData.notes || '',
            callCount: 0,
            lastCalled: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 检查是否已存在同名学生
        const existingStudents = await this.getStudentsByClassId(studentData.classId);
        const isDuplicate = existingStudents.some(s => s.name === newStudent.name);
        if (isDuplicate) {
            throw new Error('该班级中已存在同名学生');
        }

        const studentId = await this.operation('students', 'add', newStudent);

        // 更新班级学生数量
        await this.updateClassStudentCount(studentData.classId);

        return studentId;
    }

    /**
     * 批量添加学生
     */
    async addStudentsBatch(classId, studentsData) {
        const results = {
            success: [],
            errors: []
        };

        for (const studentData of studentsData) {
            try {
                const studentId = await this.addStudent({
                    ...studentData,
                    classId: classId
                });
                results.success.push(studentId);
            } catch (error) {
                results.errors.push({
                    student: studentData,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 获取班级所有学生
     */
    async getStudentsByClassId(classId) {
        if (this.fallbackMode) {
            const allStudents = await this.operation('students', 'getAll');
            return allStudents.filter(student => student.classId === classId);
        }

        const db = this.getDB();
        const transaction = db.transaction(['students'], 'readonly');
        const store = transaction.objectStore('students');
        const index = store.index('classId');

        return new Promise((resolve, reject) => {
            const range = IDBKeyRange.only(parseInt(classId));
            const request = index.getAll(range);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 根据ID获取学生
     */
    async getStudentById(id) {
        return await this.operation('students', 'get', parseInt(id));
    }

    /**
     * 更新学生信息
     */
    async updateStudent(id, studentData) {
        const existingStudent = await this.getStudentById(id);
        if (!existingStudent) {
            throw new Error('学生不存在');
        }

        const updatedStudent = {
            ...existingStudent,
            ...studentData,
            updatedAt: new Date().toISOString()
        };

        return await this.operation('students', 'put', updatedStudent);
    }









    // ==================== 系统日志功能 ====================

    /**
     * 记录系统操作日志
     * @param {string} actionType - 操作类型
     * @param {Object} details - 操作详情
     * @returns {Promise<number>} 日志ID
     */
    async logSystemAction(actionType, details) {
        const logEntry = {
            actionType,
            details: JSON.stringify(details),
            timestamp: new Date().toISOString()
        };

        try {
            return await this.operation('systemLogs', 'add', logEntry);
        } catch (error) {
            console.error('记录系统日志失败:', error);
            return null;
        }
    }

    /**
     * 获取系统日志
     * @param {number} limit - 限制返回数量
     * @param {string} actionType - 按操作类型筛选（可选）
     * @returns {Promise<Array>} 日志列表
     */
    async getSystemLogs(limit = 100, actionType = null) {
        if (this.fallbackMode) {
            const allLogs = await this.operation('systemLogs', 'getAll');
            let filteredLogs = allLogs;
            
            if (actionType) {
                filteredLogs = allLogs.filter(log => log.actionType === actionType);
            }
            
            // 按时间倒序排序
            filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return filteredLogs.slice(0, limit);
        }

        const db = this.getDB();
        const transaction = db.transaction(['systemLogs'], 'readonly');
        const store = transaction.objectStore('systemLogs');

        return new Promise((resolve, reject) => {
            let logs;
            
            if (actionType) {
                const index = store.index('actionType');
                const request = index.getAll(actionType);
                
                request.onsuccess = () => {
                    logs = request.result;
                    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(logs.slice(0, limit));
                };
                request.onerror = () => reject(request.error);
            } else {
                const request = store.getAll();
                
                request.onsuccess = () => {
                    logs = request.result;
                    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                    resolve(logs.slice(0, limit));
                };
                request.onerror = () => reject(request.error);
            }
        });
    }

    /**
     * 清空系统日志
     * @returns {Promise<boolean>} 操作结果
     */
    async clearSystemLogs() {
        return await this.operation('systemLogs', 'clear');
    }

    /**
     * 删除学生
     */
    async deleteStudent(id) {
        // 删除学生的点名记录
        await this.deleteCallRecordsByStudentId(id);

        // 删除学生
        const student = await this.getStudentById(id);
        if (student) {
            await this.operation('students', 'delete', parseInt(id));
            // 更新班级学生数量
            await this.updateClassStudentCount(student.classId);
        }

        return true;
    }

    /**
     * 更新班级学生数量
     */
    async updateClassStudentCount(classId) {
        const studentCount = await this.operation('students', 'count');
        if (this.fallbackMode) {
            const students = await this.getStudentsByClassId(classId);
            await this.updateClass(classId, { studentCount: students.length });
        } else {
            const db = this.getDB();
            const transaction = db.transaction(['students'], 'readonly');
            const store = transaction.objectStore('students');
            const index = store.index('classId');

            const request = index.getAllKeys(parseInt(classId));
            request.onsuccess = () => {
                const count = request.result.length;
                this.updateClass(classId, { studentCount: count });
            };
        }
    }

    // ==================== 点名记录管理 ====================

    /**
     * 记录点名结果
     */
    async recordCall(callData) {
        const newRecord = {
            classId: callData.classId,
            studentId: callData.studentId,
            studentName: callData.studentName,
            algorithm: callData.algorithm,
            mode: callData.mode,
            timestamp: new Date().toISOString()
        };

        const recordId = await this.operation('callRecords', 'add', newRecord);

        // 更新学生被点名次数和最后点名时间
        const student = await this.getStudentById(callData.studentId);
        if (student) {
            await this.updateStudent(callData.studentId, {
                callCount: student.callCount + 1,
                lastCalled: newRecord.timestamp
            });
        }

        // 更新班级总点名次数
        await this.updateClassTotalCalls(callData.classId);

        return recordId;
    }

    /**
     * 获取班级的点名记录
     */
    async getCallRecordsByClassId(classId, limit = null) {
        if (this.fallbackMode) {
            const allRecords = await this.operation('callRecords', 'getAll');
            let classRecords = allRecords.filter(record => record.classId === classId);
            classRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            if (limit) {
                classRecords = classRecords.slice(0, limit);
            }
            return classRecords;
        }

        const db = this.getDB();
        const transaction = db.transaction(['callRecords'], 'readonly');
        const store = transaction.objectStore('callRecords');
        const index = store.index('classId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(parseInt(classId));
            request.onsuccess = () => {
                let records = request.result;
                records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (limit) {
                    records = records.slice(0, limit);
                }
                resolve(records);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 根据时间范围获取记录
     */
    async getCallRecordsByTimeRange(classId, startDate, endDate) {
        const allRecords = await this.getCallRecordsByClassId(classId);
        return allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= new Date(startDate) && recordDate <= new Date(endDate);
        });
    }

    /**
     * 删除学生的所有记录
     */
    async deleteCallRecordsByStudentId(studentId) {
        if (this.fallbackMode) {
            const allRecords = await this.operation('callRecords', 'getAll');
            const filteredRecords = allRecords.filter(record => record.studentId !== studentId);
            localStorage.setItem(`${this.dbName}_callRecords`, JSON.stringify(filteredRecords));
            return true;
        }

        const db = this.getDB();
        const transaction = db.transaction(['callRecords'], 'readwrite');
        const store = transaction.objectStore('callRecords');
        const index = store.index('studentId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(parseInt(studentId));
            request.onsuccess = () => {
                const records = request.result;
                const deletePromises = records.map(record => {
                    return new Promise((res, rej) => {
                        const deleteRequest = store.delete(record.id);
                        deleteRequest.onsuccess = () => res();
                        deleteRequest.onerror = () => rej(deleteRequest.error);
                    });
                });

                Promise.all(deletePromises).then(() => resolve(true)).catch(reject);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 更新班级总点名次数
     */
    async updateClassTotalCalls(classId) {
        const records = await this.getCallRecordsByClassId(classId);
        await this.updateClass(classId, { totalCalls: records.length });
    }

    // ==================== 统计功能 ====================

    /**
     * 获取班级统计数据
     */
    async getClassStatistics(classId, timeRange = '30') {
        const students = await this.getStudentsByClassId(classId);
        let records = await this.getCallRecordsByClassId(classId);

        // 根据时间范围过滤记录
        if (timeRange !== 'all') {
            const days = parseInt(timeRange);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            records = records.filter(record => new Date(record.timestamp) >= startDate);
        }

        const totalCalls = records.length;
        const totalStudents = students.length;
        const avgCallsPerStudent = totalStudents > 0 ? (totalCalls / totalStudents).toFixed(1) : 0;

        // 找出被点名最多的学生
        const studentCallCounts = {};
        records.forEach(record => {
            studentCallCounts[record.studentId] = (studentCallCounts[record.studentId] || 0) + 1;
        });

        let mostCalledStudent = '-';
        let maxCalls = 0;
        let leastCalledStudent = '-';
        let minCalls = Infinity;

        Object.entries(studentCallCounts).forEach(([studentId, count]) => {
            if (count > maxCalls) {
                maxCalls = count;
                const student = students.find(s => s.id === parseInt(studentId));
                if (student) {
                    mostCalledStudent = student.name;
                }
            }
            if (count < minCalls) {
                minCalls = count;
                const student = students.find(s => s.id === parseInt(studentId));
                if (student) {
                    leastCalledStudent = student.name;
                }
            }
        });

        // 计算未被点名的学生数
        const calledStudentIds = new Set(Object.keys(studentCallCounts).map(id => parseInt(id)));
        const neverCalledCount = students.filter(student => !calledStudentIds.has(student.id)).length;

        // 计算点名出勤率
        const attendanceRate = totalStudents > 0 ? Math.round((calledStudentIds.size / totalStudents) * 100) : 0;

        // 计算最近活跃日期
        let lastActiveDate = '-';
        if (records.length > 0) {
            const sortedRecords = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            lastActiveDate = new Date(sortedRecords[0].timestamp).toLocaleDateString('zh-CN');
        }

        // 新增：时间段分布统计（按天）
        const dailyDistribution = this.calculateDailyDistribution(records, timeRange);
        
        // 新增：算法使用情况分析
        const algorithmUsage = this.calculateAlgorithmUsage(records);

        return {
            totalStudents,
            totalCalls,
            avgCallsPerStudent: parseFloat(avgCallsPerStudent),
            mostCalledStudent,
            leastCalledStudent,
            maxCalls,
            minCalls: minCalls === Infinity ? 0 : minCalls,
            neverCalledCount,
            attendanceRate,
            lastActiveDate,
            dailyDistribution,
            algorithmUsage
        };
    }

    /**
     * 获取学生点名频率数据
     */
    async getStudentFrequencyData(classId, timeRange = '30') {
        const students = await this.getStudentsByClassId(classId);
        let records = await this.getCallRecordsByClassId(classId);

        // 根据时间范围过滤记录
        if (timeRange !== 'all') {
            const days = parseInt(timeRange);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            records = records.filter(record => new Date(record.timestamp) >= startDate);
        }

        // 统计每个学生的点名次数
        const frequencyData = students.map(student => {
            const callCount = records.filter(record => record.studentId === student.id).length;
            return {
                name: student.name,
                callCount: callCount,
                percentage: records.length > 0 ? ((callCount / records.length) * 100).toFixed(1) : 0
            };
        });

        // 按点名次数排序
        frequencyData.sort((a, b) => b.callCount - a.callCount);

        return frequencyData;
    }

    // ==================== 设置管理 ====================

    /**
     * 保存设置
     */
    async saveSetting(key, value) {
        return await this.operation('settings', 'put', { key, value });
    }

    /**
     * 获取设置
     */
    async getSetting(key, defaultValue = null) {
        const result = await this.operation('settings', 'get', key);
        return result ? result.value : defaultValue;
    }

    /**
     * 获取所有设置
     */
    async getAllSettings() {
        const settings = await this.operation('settings', 'getAll');
        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });
        return settingsObj;
    }

    // ==================== 数据备份和恢复 ====================

    /**
     * 备份所有数据
     */
    async backupData() {
        const backup = {
            version: this.version,
            timestamp: new Date().toISOString(),
            classes: await this.operation('classes', 'getAll'),
            students: await this.operation('students', 'getAll'),
            callRecords: await this.operation('callRecords', 'getAll'),
            settings: await this.operation('settings', 'getAll')
        };

        return backup;
    }

    /**
     * 恢复数据
     */
    async restoreData(backupData) {
        if (!backupData.version || !backupData.classes) {
            throw new Error('无效的备份文件');
        }

        // 清空现有数据
        await this.operation('classes', 'clear');
        await this.operation('students', 'clear');
        await this.operation('callRecords', 'clear');
        await this.operation('settings', 'clear');

        // 恢复数据
        const promises = [
            this.operation('classes', 'add', backupData.classes),
            this.operation('students', 'add', backupData.students),
            this.operation('callRecords', 'add', backupData.callRecords),
            this.operation('settings', 'put', backupData.settings)
        ];

        await Promise.all(promises);
        return true;
    }

    /**
     * 清空所有数据
     */
    async clearAllData() {
        await this.operation('classes', 'clear');
        await this.operation('students', 'clear');
        await this.operation('callRecords', 'clear');
        await this.operation('settings', 'clear');
        return true;
    }

    // ==================== 搜索和筛选 ====================

    /**
     * 搜索学生
     */
    async searchStudents(classId, searchTerm) {
        const students = await this.getStudentsByClassId(classId);
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            return students;
        }

        return students.filter(student => {
            return student.name.toLowerCase().includes(term) ||
                   student.studentId.toLowerCase().includes(term) ||
                   student.phone.includes(term) ||
                   student.email.toLowerCase().includes(term);
        });
    }

    /**
     * 按指定字段排序学生
     */
    async getStudentsSorted(classId, sortBy = 'name', order = 'asc') {
        const students = await this.getStudentsByClassId(classId);

        students.sort((a, b) => {
            let valueA, valueB;

            switch (sortBy) {
                case 'name':
                    valueA = a.name;
                    valueB = b.name;
                    break;
                case 'callCount':
                    valueA = a.callCount || 0;
                    valueB = b.callCount || 0;
                    break;
                case 'lastCalled':
                    valueA = a.lastCalled ? new Date(a.lastCalled) : new Date(0);
                    valueB = b.lastCalled ? new Date(b.lastCalled) : new Date(0);
                    break;
                default:
                    valueA = a.name;
                    valueB = b.name;
            }

            if (order === 'desc') {
                return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
            } else {
                return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
            }
        });

        return students;
    }

    /**
     * 计算时间段分布统计
     * @param {Array} records - 点名记录数组
     * @param {string} timeRange - 时间范围（天数或'all'）
     * @returns {Object} 按天分布的统计数据
     */
    calculateDailyDistribution(records, timeRange) {
        const distribution = {};
        const today = new Date();
        
        // 确定起始日期
        let startDate;
        if (timeRange !== 'all') {
            startDate = new Date();
            startDate.setDate(today.getDate() - parseInt(timeRange));
        } else {
            // 如果是全部记录，找最早的记录日期
            if (records.length > 0) {
                startDate = new Date(Math.min(...records.map(r => new Date(r.timestamp))));
            } else {
                startDate = new Date();
            }
        }
        
        // 初始化日期数组
        const currentDate = new Date(startDate);
        while (currentDate <= today) {
            const dateKey = currentDate.toISOString().split('T')[0];
            distribution[dateKey] = 0;
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // 统计每天的点名次数
        records.forEach(record => {
            const recordDate = new Date(record.timestamp);
            const dateKey = recordDate.toISOString().split('T')[0];
            if (distribution[dateKey] !== undefined) {
                distribution[dateKey]++;
            }
        });
        
        // 转换为数组格式以便图表使用
        return Object.entries(distribution).map(([date, count]) => {
            return {
                date,
                count,
                formattedDate: this.formatDate(date)
            };
        });
    }
    
    /**
     * 计算算法使用情况
     * @param {Array} records - 点名记录数组
     * @returns {Object} 算法使用统计数据
     */
    calculateAlgorithmUsage(records) {
        const algorithmStats = {};
        let totalCalls = records.length;
        
        // 统计各算法使用次数
        records.forEach(record => {
            const algorithm = record.algorithm || 'default';
            algorithmStats[algorithm] = (algorithmStats[algorithm] || 0) + 1;
        });
        
        // 转换为数组格式并计算百分比
        return Object.entries(algorithmStats).map(([algorithm, count]) => {
            return {
                algorithm,
                count,
                percentage: totalCalls > 0 ? Math.round((count / totalCalls) * 100) : 0
            };
        }).sort((a, b) => b.count - a.count);
    }
    
    /**
     * 格式化日期
     * @param {string} dateString - ISO日期字符串
     * @returns {string} 格式化后的日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
}

// 创建全局实例
window.storageManager = new StorageManager();