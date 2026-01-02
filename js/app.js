/**
 * 主应用逻辑
 * 整合存储管理、算法和动画系统，实现点名功能
 */

class RollCallApp {
    constructor() {
        this.currentClassId = null;
        this.currentStudents = [];
        this.isRolling = false;
        this.currentMode = 'single'; // 单次点名 or 连续点名
        this.currentAlgorithm = 'fair';
        this.avoidImmediateRepeat = false;
        this.selectedStudent = null;
        this.autoStopTimer = null;
        this.isAnimating = false;
        this.callAlgorithm = null; // 将在这里初始化点名算法实例
        // 操作历史管理
        this.operationHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50; // 最大历史记录数量
    }

    /**
     * 记录操作到历史记录
     * @param {Object} operation - 操作对象，包含type、data、undoData等信息
     */
    recordOperation(operation) {
        // 如果当前不是在历史记录的末尾，清除后面的历史
        if (this.historyIndex < this.operationHistory.length - 1) {
            this.operationHistory = this.operationHistory.slice(0, this.historyIndex + 1);
        }
        
        // 添加新操作
        this.operationHistory.push(operation);
        
        // 限制历史记录数量
        if (this.operationHistory.length > this.maxHistorySize) {
            this.operationHistory.shift();
        } else {
            this.historyIndex++;
        }
        
        // 更新撤销/重做按钮状态
        this.updateUndoRedoButtons();
    }

    /**
     * 撤销上一步操作
     */
    async undo() {
        if (this.historyIndex < 0) return;
        
        const operation = this.operationHistory[this.historyIndex];
        
        try {
            switch (operation.type) {
                case 'addClass':
                    await window.storageManager.deleteClass(operation.data.id);
                    break;
                case 'editClass':
                    await window.storageManager.updateClass(operation.undoData);
                    break;
                case 'deleteClass':
                    await window.storageManager.createClass(operation.undoData);
                    break;
                case 'addStudent':
                    await window.storageManager.deleteStudent(operation.data.id);
                    break;
                case 'editStudent':
                    await window.storageManager.updateStudent(operation.undoData);
                    break;
                case 'deleteStudent':
                    await window.storageManager.addStudent(operation.undoData);
                    break;
            }
            
            // 更新界面
            await this.loadClasses();
            if (this.currentClassId) {
                await this.loadStudents();
            }
            
            // 移动历史索引
            this.historyIndex--;
            this.updateUndoRedoButtons();
            this.showNotification('操作已撤销', 'success');
        } catch (error) {
            console.error('撤销操作失败:', error);
            this.showNotification('撤销操作失败', 'error');
        }
    }

    /**
     * 重做下一步操作
     */
    async redo() {
        if (this.historyIndex >= this.operationHistory.length - 1) return;
        
        const operation = this.operationHistory[this.historyIndex + 1];
        
        try {
            switch (operation.type) {
                case 'addClass':
                    await window.storageManager.createClass(operation.data);
                    break;
                case 'editClass':
                    await window.storageManager.updateClass(operation.data);
                    break;
                case 'deleteClass':
                    await window.storageManager.deleteClass(operation.data.id);
                    break;
                case 'addStudent':
                    await window.storageManager.addStudent(operation.data);
                    break;
                case 'editStudent':
                    await window.storageManager.updateStudent(operation.data);
                    break;
                case 'deleteStudent':
                    await window.storageManager.deleteStudent(operation.data.id);
                    break;
            }
            
            // 更新界面
            await this.loadClasses();
            if (this.currentClassId) {
                await this.loadStudents();
            }
            
            // 移动历史索引
            this.historyIndex++;
            this.updateUndoRedoButtons();
            this.showNotification('操作已重做', 'success');
        } catch (error) {
            console.error('重做操作失败:', error);
            this.showNotification('重做操作失败', 'error');
        }
    }

    /**
     * 更新撤销/重做按钮状态
     */
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex < 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.operationHistory.length - 1;
        }
    }
    
    /**
     * 更新班级操作按钮状态
     */
    updateClassButtons() {
        const editBtn = document.getElementById('editClassBtn');
        const deleteBtn = document.getElementById('deleteClassBtn');
        
        if (editBtn && deleteBtn) {
            const hasClass = !!this.currentClassId;
            editBtn.disabled = !hasClass;
            deleteBtn.disabled = !hasClass;
        }
    }

    /**
     * 初始化应用
     */
    async init() {
        try {
            // 等待存储管理器初始化完成
            if (window.storageManager && !window.storageManager.db) {
                // 等待数据库初始化
                await new Promise(resolve => {
                    const checkInit = () => {
                        if (window.storageManager.db) {
                            resolve();
                        } else {
                            setTimeout(checkInit, 100);
                        }
                    };
                    checkInit();
                });
            }

            // 初始化点名算法
            this.initCallAlgorithm();

            // 加载设置
            await this.loadSettings();

            // 设置事件监听器
            this.setupEventListeners();

            // 加载班级列表（会自动选择最近使用的班级）
            await this.loadClasses();

            // 初始化界面
            this.initializeUI();

            console.log('应用初始化完成');
        } catch (error) {
            console.error('应用初始化失败:', error);
            this.showNotification('应用初始化失败，请刷新页面重试', 'error');
        }
    }

    /**
     * 初始化点名算法
     */
    initCallAlgorithm() {
        // 创建算法实例，传入存储管理器
        if (window.storageManager) {
            this.callAlgorithm = new CallAlgorithm(window.storageManager);
            window.callAlgorithm = this.callAlgorithm; // 全局暴露
        } else {
            console.error('存储管理器未初始化，无法创建算法实例');
        }
    }

    /**
     * 加载应用设置
     */
    async loadSettings() {
        try {
            // 从存储管理器获取设置
            const settings = await window.storageManager.getAllSettings();
            
            // 更新动画设置
            if (settings.animationDuration) {
                window.animationSystem.updateAnimationSettings({ duration: settings.animationDuration });
                const durationSlider = document.getElementById('animationDuration');
                if (durationSlider) {
                    durationSlider.value = settings.animationDuration;
                    document.getElementById('durationValue').textContent = 
                        `${settings.animationDuration / 1000}秒`;
                }
            }
            
            if (settings.scrollSpeed) {
                window.animationSystem.updateAnimationSettings({ speed: settings.scrollSpeed });
                const speedSlider = document.getElementById('scrollSpeed');
                if (speedSlider) {
                    speedSlider.value = settings.scrollSpeed;
                    let speedText = '慢';
                    if (settings.scrollSpeed > 70) {
                        speedText = '快';
                    } else if (settings.scrollSpeed > 40) {
                        speedText = '中等';
                    }
                    document.getElementById('speedValue').textContent = speedText;
                }
            }
            
            // 更新避免立即重复设置
            this.avoidImmediateRepeat = settings.avoidImmediateRepeat || false;
            const avoidRepeatCheckbox = document.getElementById('avoidImmediateRepeat');
            if (avoidRepeatCheckbox) {
                avoidRepeatCheckbox.checked = this.avoidImmediateRepeat;
            }
            
            // 更新主题
            if (settings.theme) {
                window.animationSystem.applyTheme(settings.theme);
            }
            
            // 获取最近使用的班级ID
            this.recentClassId = settings.recentClassId || null;
            
            console.log('设置加载完成');
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    /**
     * 加载班级列表
     */
    async loadClasses() {
        try {
            const classes = await window.storageManager.getAllClasses();
            const classSelector = document.getElementById('classSelector');
            
            // 清空现有选项
            classSelector.innerHTML = '<option value="">选择班级</option>';
            
            // 添加班级选项
            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.id;
                option.textContent = cls.name;
                classSelector.appendChild(option);
            });
            
            // 自动选择最近使用的班级
            if (this.recentClassId) {
                const recentOption = classSelector.querySelector(`option[value="${this.recentClassId}"]`);
                if (recentOption) {
                    recentOption.selected = true;
                    this.currentClassId = this.recentClassId;
                    await this.loadStudents();
                }
            }
            
            console.log(`已加载 ${classes.length} 个班级`);
        } catch (error) {
            console.error('加载班级失败:', error);
            this.showNotification('加载班级列表失败', 'error');
        }
    }

    /**
     * 加载当前班级的学生列表
     */
    async loadStudents() {
        if (!this.currentClassId) {
            this.currentStudents = [];
            this.renderStudentsList();
            return;
        }
        
        try {
            this.currentStudents = await window.storageManager.getStudentsByClassId(this.currentClassId);
            this.renderStudentsList();
            
            // 更新统计信息
            await this.updateStatistics();
            
            console.log(`已加载 ${this.currentStudents.length} 个学生`);
        } catch (error) {
            console.error('加载学生列表失败:', error);
            this.showNotification('加载学生列表失败', 'error');
        }
    }

    /**
     * 渲染学生列表
     */
    renderStudentsList() {
        const studentsList = document.getElementById('studentsList');
        if (!studentsList) return;
        
        // 清空现有内容
        studentsList.innerHTML = '';
        
        // 排序学生
        const sortBy = document.getElementById('sortBy')?.value || 'name';
        let sortedStudents = [...this.currentStudents];
        
        switch (sortBy) {
            case 'callCount':
                sortedStudents.sort((a, b) => (b.callCount || 0) - (a.callCount || 0));
                break;
            case 'lastCalled':
                sortedStudents.sort((a, b) => {
                    const dateA = a.lastCalled ? new Date(a.lastCalled) : new Date(0);
                    const dateB = b.lastCalled ? new Date(b.lastCalled) : new Date(0);
                    return dateB - dateA;
                });
                break;
            default:
                sortedStudents.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        }
        
        // 创建学生卡片
        sortedStudents.forEach(student => {
            const studentCard = this.createStudentCard(student);
            studentsList.appendChild(studentCard);
        });
        
        // 添加空状态
        if (sortedStudents.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <i class="fas fa-users"></i>
                <p>暂无学生信息</p>
                <button class="btn btn-primary" onclick="app.showAddStudentModal()">
                    <i class="fas fa-plus"></i> 添加学生
                </button>
            `;
            studentsList.appendChild(emptyState);
        }
    }

    /**
     * 创建学生卡片元素
     * @param {Object} student - 学生对象
     * @returns {HTMLElement} 学生卡片元素
     */
    createStudentCard(student) {
        const card = document.createElement('div');
        card.className = 'student-card';
        card.dataset.studentId = student.id;
        
        const lastCalledDate = student.lastCalled ? 
            new Date(student.lastCalled).toLocaleDateString('zh-CN') : 
            '从未';
        
        // 获取学生特殊状态
        const specialStatus = student.specialStatus || 'normal';
        const statusText = specialStatus === 'special_excluded' ? '特殊排除' : '正常状态';
        const statusClass = specialStatus === 'special_excluded' ? 'status-excluded' : 'status-normal';
        const statusIcon = specialStatus === 'special_excluded' ? 'fas fa-user-shield' : 'fas fa-user';
        
        card.innerHTML = `
            <div class="student-card-header">
                <h3 class="student-name">${student.name}</h3>
                <div class="student-actions">
                    <button class="btn-icon" title="编辑" onclick="app.showEditStudentModal(${student.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="删除" onclick="app.confirmDeleteStudent(${student.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="student-card-body">
                <div class="student-info">
                    <div class="info-item">
                        <span class="info-label">学号:</span>
                        <span class="info-value">${student.studentId || '未设置'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">电话:</span>
                        <span class="info-value">${student.phone || '未设置'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">邮箱:</span>
                        <span class="info-value">${student.email || '未设置'}</span>
                    </div>
                </div>
                <div class="student-special-status">
                    <div class="status-indicator ${statusClass}">
                        <i class="${statusIcon}"></i>
                        <span>${statusText}</span>
                    </div>
                    <button class="btn btn-small btn-outline" onclick="app.showSpecialRuleModal(${student.id})" title="管理特殊规则">
                        <i class="fas fa-cog"></i>
                        特殊规则
                    </button>
                </div>
                <div class="student-stats">
                    <div class="stat">
                        <i class="fas fa-hand-pointer"></i>
                        <span>点名次数: ${student.callCount || 0}</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-clock"></i>
                        <span>最后点名: ${lastCalledDate}</span>
                    </div>
                </div>
            </div>
        `;
        
        return card;
    }

    /**
     * 更新统计数据
     */
    async updateStatistics() {
        if (!this.currentClassId) return;
        
        try {
            const timeRange = document.getElementById('timeRange')?.value || '30';
            const stats = await window.storageManager.getClassStatistics(this.currentClassId, timeRange);
            
            // 更新统计卡片
            document.getElementById('totalStudents').textContent = stats.totalStudents;
            document.getElementById('totalCalls').textContent = stats.totalCalls;
            document.getElementById('avgCallsPerStudent').textContent = stats.avgCallsPerStudent;
            document.getElementById('mostCalledStudent').textContent = stats.mostCalledStudent;
            
            // 更新频率图表
            await this.updateFrequencyChart();
        } catch (error) {
            console.error('更新统计数据失败:', error);
        }
    }

    /**
     * 更新频率图表
     */
    async updateFrequencyChart() {
        if (!this.currentClassId) return;
        
        try {
            const timeRange = document.getElementById('timeRange')?.value || '30';
            const frequencyData = await window.storageManager.getStudentFrequencyData(this.currentClassId, timeRange);
            
            const chartContainer = document.getElementById('frequencyChart');
            if (!chartContainer) return;
            
            // 清空现有内容
            chartContainer.innerHTML = '';
            
            // 创建简单的条形图
            const maxCount = Math.max(...frequencyData.map(d => d.callCount), 1);
            
            frequencyData.forEach(data => {
                const bar = document.createElement('div');
                bar.className = 'chart-bar';
                bar.innerHTML = `
                    <div class="bar-label">${data.name}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(data.callCount / maxCount * 100)}%"></div>
                        <div class="bar-value">${data.callCount}次</div>
                    </div>
                `;
                chartContainer.appendChild(bar);
            });
            
            // 添加空状态
            if (frequencyData.length === 0) {
                chartContainer.innerHTML = '<div class="empty-state">暂无数据</div>';
            }
        } catch (error) {
            console.error('更新频率图表失败:', error);
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 班级选择
        document.getElementById('classSelector').addEventListener('change', (e) => {
            this.currentClassId = e.target.value ? parseInt(e.target.value) : null;
            this.loadStudents();
            
            // 更新编辑和删除按钮状态
            this.updateClassButtons();
            
            // 保存最近使用的班级ID
            if (this.currentClassId) {
                window.storageManager.saveSetting('recentClassId', this.currentClassId);
            }
        });
        
        // 编辑班级按钮
        document.getElementById('editClassBtn').addEventListener('click', () => {
            this.showEditClassModal();
        });
        
        // 删除班级按钮
        document.getElementById('deleteClassBtn').addEventListener('click', () => {
            this.confirmDeleteClass();
        });
        
        // 导航标签
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // 点名模式
        document.querySelectorAll('input[name="callMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentMode = e.target.value;
            });
        });
        
        // 算法选择
        document.getElementById('algorithmSelect').addEventListener('change', (e) => {
            this.currentAlgorithm = e.target.value;
        });
        
        // 开始点名按钮
        document.getElementById('startCallBtn').addEventListener('click', () => {
            this.startRollCall();
        });
        
        // 停止点名按钮
        document.getElementById('stopCallBtn').addEventListener('click', () => {
            this.stopRollCall();
        });
        
        // 重置点名按钮
        document.getElementById('resetCallBtn').addEventListener('click', () => {
            this.resetRollCall();
        });
        
        // 添加班级按钮
        document.getElementById('addClassBtn').addEventListener('click', () => {
            this.showAddClassModal();
        });
        
        // 添加学生按钮
        document.getElementById('addStudentBtn').addEventListener('click', () => {
            this.showAddStudentModal();
        });
        
        // 批量导入按钮
        document.getElementById('importStudentsBtn').addEventListener('click', async () => {
            if (!this.currentClassId) {
                this.showNotification('请先选择班级', 'warning');
                return;
            }
            await window.importExportManager.loadLibraries();
            showImportStudentsModal();
        });
        
        // 导出学生按钮
        document.getElementById('exportStudentsBtn').addEventListener('click', async () => {
            if (!this.currentClassId) {
                this.showNotification('请先选择班级', 'warning');
                return;
            }
            if (this.currentStudents.length === 0) {
                this.showNotification('当前班级没有学生', 'warning');
                return;
            }
            await window.importExportManager.loadLibraries();
            showExportStudentsModal();
        });
        
        // 排序选择
        document.getElementById('sortBy').addEventListener('change', () => {
            this.renderStudentsList();
        });
        
        // 时间范围选择
        document.getElementById('timeRange').addEventListener('change', () => {
            this.updateStatistics();
        });
        
        // 学生搜索
        document.getElementById('studentSearch').addEventListener('input', (e) => {
            this.searchStudents(e.target.value);
        });
        
        // 避免立即重复复选框
        document.getElementById('avoidImmediateRepeat').addEventListener('change', (e) => {
            this.avoidImmediateRepeat = e.target.checked;
            window.storageManager.saveSetting('avoidImmediateRepeat', this.avoidImmediateRepeat);
        });
        
        // 主题颜色选择
        document.querySelectorAll('.theme-color').forEach(button => {
            button.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                window.animationSystem.applyTheme(theme);
                window.storageManager.saveSetting('theme', theme);
            });
        });
        
        // 备份数据按钮
        document.getElementById('backupDataBtn').addEventListener('click', () => {
            this.backupData();
        });
        
        // 恢复数据按钮
        document.getElementById('restoreDataBtn').addEventListener('click', () => {
            this.restoreData();
        });
        
        // 清空数据按钮
        document.getElementById('clearDataBtn').addEventListener('click', () => {
            this.confirmClearData();
        });
        
        // 模态框关闭
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modalCancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('modalConfirm').addEventListener('click', () => {
            this.confirmModalAction();
        });
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        // 设置默认选项
        document.querySelector('input[name="callMode"][value="single"]').checked = true;
        document.getElementById('algorithmSelect').value = 'fair';
        
        // 初始化动画系统
        if (window.animationSystem) {
            window.animationSystem.init();
        }
        
        // 设置默认主题
        const defaultTheme = document.querySelector('.theme-color.active')?.dataset.theme || 'blue';
        window.animationSystem.applyTheme(defaultTheme);
    }

    /**
     * 切换标签页
     * @param {string} tab - 标签名称
     */
    switchTab(tab) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tab);
        });
        
        // 更新标签内容显示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-tab`);
        });
        
        // 根据标签加载数据
        if (tab === 'students' || tab === 'statistics') {
            this.loadStudents();
        }
    }

    /**
     * 开始点名
     */
    async startRollCall() {
        if (this.isRolling || this.isAnimating) return;
        
        if (!this.currentClassId) {
            this.showNotification('请先选择班级', 'warning');
            return;
        }
        
        if (this.currentStudents.length === 0) {
            this.showNotification('当前班级没有学生', 'warning');
            return;
        }
        
        this.isRolling = true;
        this.updateRollCallButtons();
        
        // 开始滚动动画
        try {
            this.isAnimating = true;
            await window.animationSystem.startRandomScroll(this.currentStudents);
            this.isAnimating = false;
            
            // 选择学生
            const selectedStudent = await window.callAlgorithm.selectStudent(
                this.currentStudents,
                this.currentAlgorithm,
                { avoidImmediateRepeat: this.avoidImmediateRepeat }
            );
            
            if (!selectedStudent) {
                this.showNotification('没有可选的学生', 'warning');
                this.stopRollCall();
                return;
            }
            
            this.selectedStudent = selectedStudent;
            
            // 显示结果
            await window.animationSystem.revealResult(selectedStudent);
            
            // 记录点名结果
            await this.recordRollCall(selectedStudent);
            
            // 检查是否连续点名模式
            if (this.currentMode === 'continuous') {
                // 继续点名
                setTimeout(() => {
                    this.startRollCall();
                }, 2000);
            } else {
                // 单次点名结束
                this.stopRollCall();
            }
        } catch (error) {
            console.error('点名过程出错:', error);
            this.showNotification('点名过程出错', 'error');
            this.stopRollCall();
        }
    }

    /**
     * 停止点名
     */
    stopRollCall() {
        this.isRolling = false;
        this.updateRollCallButtons();
        
        // 停止动画
        window.animationSystem.stopAllAnimations();
    }

    /**
     * 重置点名
     */
    resetRollCall() {
        this.stopRollCall();
        window.animationSystem.stopAllAnimations();
        document.getElementById('currentName').textContent = '点击开始点名';
    }

    /**
     * 更新点名按钮状态
     */
    updateRollCallButtons() {
        const startBtn = document.getElementById('startCallBtn');
        const stopBtn = document.getElementById('stopCallBtn');
        
        // 检查是否有选择班级和学生
        const hasClass = !!this.currentClassId;
        const hasStudents = this.currentStudents.length > 0;
        const canStart = hasClass && hasStudents;
        
        if (this.isRolling) {
            // 点名进行中状态
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // 视觉反馈类
            startBtn.classList.add('btn-disabled', 'btn-rolling');
            stopBtn.classList.add('btn-active', 'btn-stop');
            
            // 添加加载动画和状态文本
            if (this.isAnimating) {
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 滚动中...';
                stopBtn.innerHTML = '<i class="fas fa-stop"></i> 停止滚动';
            } else {
                startBtn.innerHTML = '<i class="fas fa-pause"></i> 等待中...';
                stopBtn.innerHTML = '<i class="fas fa-check"></i> 确认结果';
            }
            
            // 添加焦点到停止按钮
            stopBtn.focus();
        } else {
            // 点名停止状态
            startBtn.disabled = !canStart;
            stopBtn.disabled = true;
            
            // 移除视觉反馈类
            startBtn.classList.remove('btn-disabled', 'btn-rolling');
            stopBtn.classList.remove('btn-active', 'btn-stop');
            
            // 根据是否可以开始点名显示不同文本
            if (canStart) {
                startBtn.innerHTML = '<i class="fas fa-play"></i> 开始点名';
                startBtn.title = '开始随机点名';
                startBtn.classList.remove('btn-warning');
            } else if (!hasClass) {
                startBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 请选择班级';
                startBtn.title = '请先选择一个班级';
                startBtn.classList.add('btn-warning');
            } else if (!hasStudents) {
                startBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 无学生数据';
                startBtn.title = '当前班级没有学生';
                startBtn.classList.add('btn-warning');
            }
            
            stopBtn.innerHTML = '<i class="fas fa-stop"></i> 停止点名';
            stopBtn.title = '停止当前点名';
        }
    }

    /**
     * 记录点名结果
     * @param {Object} student - 选中的学生
     */
    async recordRollCall(student) {
        try {
            await window.storageManager.recordCall({
                classId: this.currentClassId,
                studentId: student.id,
                studentName: student.name,
                algorithm: this.currentAlgorithm,
                mode: this.currentMode
            });
            
            // 更新学生列表显示
            await this.loadStudents();
            
            console.log(`已记录点名结果: ${student.name}`);
        } catch (error) {
            console.error('记录点名结果失败:', error);
        }
    }

    /**
     * 显示添加班级模态框
     */
    showAddClassModal() {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '添加班级';
        
        body.innerHTML = `
            <form id="classForm">
                <div class="form-group">
                    <label for="className">班级名称 <span class="required">*</span></label>
                    <input type="text" id="className" required>
                </div>
                <div class="form-group">
                    <label for="classDescription">班级描述</label>
                    <textarea id="classDescription" rows="3"></textarea>
                </div>
            </form>
        `;
        
        confirm.textContent = '添加';
        confirm.onclick = () => {
            this.addClass();
        };
        
        modal.style.display = 'flex';
    }
    
    /**
     * 显示编辑班级模态框
     */
    async showEditClassModal() {
        if (!this.currentClassId) {
            this.showNotification('请先选择班级', 'warning');
            return;
        }
        
        try {
            const modal = document.getElementById('modalOverlay');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');
            const confirm = document.getElementById('modalConfirm');
            
            // 获取当前班级信息
            const currentClass = await window.storageManager.getClassById(this.currentClassId);
            
            title.textContent = '编辑班级';
            
            body.innerHTML = `
                <form id="classForm">
                    <div class="form-group">
                        <label for="className">班级名称 <span class="required">*</span></label>
                        <input type="text" id="className" value="${currentClass.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="classDescription">班级描述</label>
                        <textarea id="classDescription" rows="3">${currentClass.description || ''}</textarea>
                    </div>
                </form>
            `;
            
            confirm.textContent = '保存';
            confirm.onclick = () => {
                this.updateClass();
            };
            
            modal.style.display = 'flex';
        } catch (error) {
            console.error('获取班级信息失败:', error);
            this.showNotification('获取班级信息失败', 'error');
        }
    }

    /**
     * 添加班级
     */
    async addClass() {
        const name = document.getElementById('className').value.trim();
        const description = document.getElementById('classDescription').value.trim();
        
        if (!name) {
            this.showNotification('请输入班级名称', 'warning');
            return;
        }
        
        try {
            const newClass = await window.storageManager.createClass({ name, description });
            await this.loadClasses();
            this.closeModal();
            this.showNotification('班级添加成功', 'success');
            
            // 记录操作
            this.recordOperation({
                type: 'addClass',
                data: newClass,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('添加班级失败:', error);
            this.showNotification('添加班级失败', 'error');
        }
    }
    
    /**
     * 更新班级信息
     */
    async updateClass() {
        if (!this.currentClassId) {
            this.showNotification('请先选择班级', 'warning');
            return;
        }
        
        const name = document.getElementById('className').value.trim();
        const description = document.getElementById('classDescription').value.trim();
        
        if (!name) {
            this.showNotification('请输入班级名称', 'warning');
            return;
        }
        
        try {
            // 获取原始班级信息用于撤销
            const originalClass = await window.storageManager.getClassById(this.currentClassId);
            
            // 更新班级
            const updatedClass = await window.storageManager.updateClass({
                id: this.currentClassId,
                name,
                description
            });
            
            await this.loadClasses();
            this.closeModal();
            this.showNotification('班级更新成功', 'success');
            
            // 记录操作
            this.recordOperation({
                type: 'editClass',
                data: updatedClass,
                undoData: originalClass,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('更新班级失败:', error);
            this.showNotification('更新班级失败', 'error');
        }
    }

    /**
     * 显示添加学生模态框
     */
    showAddStudentModal() {
        if (!this.currentClassId) {
            this.showNotification('请先选择班级', 'warning');
            return;
        }
        
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '添加学生';
        
        body.innerHTML = `
            <form id="studentForm">
                <div class="form-group">
                    <label for="studentName">学生姓名 <span class="required">*</span></label>
                    <input type="text" id="studentName" required>
                </div>
                <div class="form-group">
                    <label for="studentId">学号</label>
                    <input type="text" id="studentId">
                </div>
                <div class="form-group">
                    <label for="studentPhone">电话</label>
                    <input type="tel" id="studentPhone">
                </div>
                <div class="form-group">
                    <label for="studentEmail">邮箱</label>
                    <input type="email" id="studentEmail">
                </div>
                <div class="form-group">
                    <label for="studentNotes">备注</label>
                    <textarea id="studentNotes" rows="2"></textarea>
                </div>
            </form>
        `;
        
        confirm.textContent = '添加';
        confirm.onclick = () => {
            this.addStudent();
        };
        
        modal.style.display = 'flex';
    }

    /**
     * 添加学生
     */
    async addStudent() {
        const name = document.getElementById('studentName').value.trim();
        const studentId = document.getElementById('studentId').value.trim();
        const phone = document.getElementById('studentPhone').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const notes = document.getElementById('studentNotes').value.trim();
        
        if (!name) {
            this.showNotification('请输入学生姓名', 'warning');
            return;
        }
        
        try {
            const studentData = {
                classId: this.currentClassId,
                name,
                studentId,
                phone,
                email,
                notes
            };
            
            const newStudent = await window.storageManager.addStudent(studentData);
            
            await this.loadStudents();
            this.closeModal();
            this.showNotification('学生添加成功', 'success');
            
            // 记录操作
            this.recordOperation({
                type: 'addStudent',
                data: newStudent,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('添加学生失败:', error);
            this.showNotification(error.message || '添加学生失败', 'error');
        }
    }

    /**
     * 显示编辑学生模态框
     * @param {number} studentId - 学生ID
     */
    async showEditStudentModal(studentId) {
        try {
            const student = await window.storageManager.getStudentById(studentId);
            if (!student) {
                this.showNotification('学生不存在', 'error');
                return;
            }
            
            const modal = document.getElementById('modalOverlay');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');
            const confirm = document.getElementById('modalConfirm');
            
            title.textContent = '编辑学生';
            
            body.innerHTML = `
                <form id="studentForm">
                    <div class="form-group">
                        <label for="studentName">学生姓名 <span class="required">*</span></label>
                        <input type="text" id="studentName" value="${student.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="studentId">学号</label>
                        <input type="text" id="studentId" value="${student.studentId || ''}">
                    </div>
                    <div class="form-group">
                        <label for="studentPhone">电话</label>
                        <input type="tel" id="studentPhone" value="${student.phone || ''}">
                    </div>
                    <div class="form-group">
                        <label for="studentEmail">邮箱</label>
                        <input type="email" id="studentEmail" value="${student.email || ''}">
                    </div>
                    <div class="form-group">
                        <label for="studentNotes">备注</label>
                        <textarea id="studentNotes" rows="2">${student.notes || ''}</textarea>
                    </div>
                </form>
            `;
            
            confirm.textContent = '保存';
            confirm.onclick = () => {
                this.updateStudent(studentId);
            };
            
            modal.style.display = 'flex';
        } catch (error) {
            console.error('获取学生信息失败:', error);
            this.showNotification('获取学生信息失败', 'error');
        }
    }

    /**
     * 更新学生信息
     * @param {number} studentId - 学生ID
     */
    async updateStudent(studentId) {
        const name = document.getElementById('studentName').value.trim();
        const studentIdValue = document.getElementById('studentId').value.trim();
        const phone = document.getElementById('studentPhone').value.trim();
        const email = document.getElementById('studentEmail').value.trim();
        const notes = document.getElementById('studentNotes').value.trim();
        
        if (!name) {
            this.showNotification('请输入学生姓名', 'warning');
            return;
        }
        
        try {
            // 获取原始学生数据用于撤销
            const originalStudent = await window.storageManager.getStudentById(studentId);
            
            const updatedStudent = {
                name,
                studentId: studentIdValue,
                phone,
                email,
                notes
            };
            
            await window.storageManager.updateStudent(studentId, updatedStudent);
            
            await this.loadStudents();
            this.closeModal();
            this.showNotification('学生信息更新成功', 'success');
            
            // 记录操作
            this.recordOperation({
                type: 'editStudent',
                data: { id: studentId, ...updatedStudent },
                undoData: originalStudent,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('更新学生信息失败:', error);
            this.showNotification(error.message || '更新学生信息失败', 'error');
        }
    }

    /**
     * 确认删除学生
     * @param {number} studentId - 学生ID
     */
    async confirmDeleteStudent(studentId) {
        const student = await window.storageManager.getStudentById(studentId);
        if (!student) return;
        
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '确认删除';
        
        body.innerHTML = `
            <p>确定要删除学生 "${student.name}" 吗？</p>
            <p class="text-warning">此操作不可恢复，学生的点名记录也将被删除。</p>
        `;
        
        confirm.textContent = '删除';
        confirm.className = 'btn btn-danger';
        confirm.onclick = () => {
            this.deleteStudent(studentId);
        };
        
        modal.style.display = 'flex';
    }

    /**
     * 删除学生
     * @param {number} studentId - 学生ID
     */
    async deleteStudent(studentId) {
        try {
            // 获取删除的学生数据用于撤销
            const deletedStudent = await window.storageManager.getStudentById(studentId);
            
            await window.storageManager.deleteStudent(studentId);
            await this.loadStudents();
            this.closeModal();
            this.showNotification('学生删除成功', 'success');
            
            // 记录操作
            this.recordOperation({
                type: 'deleteStudent',
                data: { id: studentId },
                undoData: deletedStudent,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('删除学生失败:', error);
            this.showNotification('删除学生失败', 'error');
        }
    }

    /**
     * 显示批量导入学生模态框
     */
    showImportStudentsModal() {
        if (!this.currentClassId) {
            this.showNotification('请先选择班级', 'warning');
            return;
        }
        
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '批量导入学生';
        
        body.innerHTML = `
            <div class="import-instructions">
                <p>请选择要导入的学生名单文件（CSV格式）：</p>
                <p class="text-muted">CSV文件格式：第一列为学生姓名，第二列为学号（可选），第三列为电话（可选）</p>
            </div>
            <div class="form-group">
                <input type="file" id="importFile" accept=".csv" />
            </div>
            <div id="importPreview" class="import-preview"></div>
        `;
        
        confirm.textContent = '导入';
        confirm.onclick = () => {
            this.importStudents();
        };
        
        modal.style.display = 'flex';
        
        // 文件选择监听
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.previewImportFile(e.target.files[0]);
        });
    }

    /**
     * 预览导入文件
     * @param {File} file - 要导入的文件
     */
    previewImportFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split('\n').filter(line => line.trim());
            
            const preview = document.getElementById('importPreview');
            if (lines.length > 0) {
                preview.innerHTML = `
                    <h4>预览（前5行）：</h4>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>姓名</th>
                                    <th>学号</th>
                                    <th>电话</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${lines.slice(0, 5).map(line => {
                                    const [name, studentId, phone] = line.split(',');
                                    return `
                                        <tr>
                                            <td>${name || ''}</td>
                                            <td>${studentId || ''}</td>
                                            <td>${phone || ''}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <p>总共 ${lines.length} 行数据</p>
                `;
                preview.style.display = 'block';
            } else {
                preview.innerHTML = '<p class="text-warning">文件中没有有效数据</p>';
                preview.style.display = 'block';
            }
        };
        reader.readAsText(file);
    }

    /**
     * 导入学生
     */
    async importStudents() {
        const fileInput = document.getElementById('importFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('请选择要导入的文件', 'warning');
            return;
        }
        
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target.result;
                const lines = content.split('\n').filter(line => line.trim());
                
                // 解析CSV数据
                const studentsData = lines.map(line => {
                    const [name, studentId, phone] = line.split(',');
                    return {
                        name: name?.trim(),
                        studentId: studentId?.trim(),
                        phone: phone?.trim()
                    };
                });
                
                // 批量导入
                this.showLoading('正在导入学生...');
                const results = await window.storageManager.addStudentsBatch(this.currentClassId, studentsData);
                this.hideLoading();
                
                // 显示结果
                let message = `导入完成：成功 ${results.success.length} 个`;
                if (results.errors.length > 0) {
                    message += `，失败 ${results.errors.length} 个`;
                    console.error('导入错误:', results.errors);
                }
                
                this.showNotification(message, results.errors.length > 0 ? 'warning' : 'success');
                
                await this.loadStudents();
                this.closeModal();
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('导入学生失败:', error);
            this.showNotification('导入学生失败', 'error');
            this.hideLoading();
        }
    }

    /**
     * 导出学生
     */
    async exportStudents() {
        if (!this.currentStudents.length) {
            this.showNotification('没有学生数据可导出', 'warning');
            return;
        }
        
        try {
            // 创建CSV内容
            const headers = ['姓名', '学号', '电话', '邮箱', '点名次数', '最后点名时间'];
            const rows = this.currentStudents.map(student => [
                student.name,
                student.studentId || '',
                student.phone || '',
                student.email || '',
                student.callCount || 0,
                student.lastCalled ? new Date(student.lastCalled).toLocaleString('zh-CN') : '从未'
            ]);
            
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');
            
            // 创建并下载文件
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `学生名单_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('学生名单导出成功', 'success');
        } catch (error) {
            console.error('导出学生失败:', error);
            this.showNotification('导出学生失败', 'error');
        }
    }

    /**
     * 搜索学生
     * @param {string} query - 搜索关键词
     */
    searchStudents(query) {
        const studentsList = document.getElementById('studentsList');
        const cards = studentsList.querySelectorAll('.student-card');
        
        if (!query) {
            // 显示所有学生
            cards.forEach(card => card.style.display = 'block');
            this.hideAutoComplete();
            return;
        }
        
        // 过滤显示匹配的学生
        const lowerQuery = query.toLowerCase();
        let hasMatches = false;
        
        cards.forEach(card => {
            const name = card.querySelector('.student-name').textContent.toLowerCase();
            const studentId = card.querySelector('.info-value').textContent.toLowerCase();
            const phone = card.querySelectorAll('.info-value')[1]?.textContent.toLowerCase();
            const email = card.querySelectorAll('.info-value')[2]?.textContent.toLowerCase();
            
            // 搜索多个字段
            const isMatch = name.includes(lowerQuery) || 
                           studentId.includes(lowerQuery) || 
                           (phone && phone.includes(lowerQuery)) || 
                           (email && email.includes(lowerQuery));
            
            card.style.display = isMatch ? 'block' : 'none';
            if (isMatch) hasMatches = true;
        });
        
        // 显示自动完成建议
        this.showAutoComplete(query);
    }
    
    /**
     * 显示自动完成建议
     * @param {string} query - 搜索关键词
     */
    showAutoComplete(query) {
        // 创建自动完成容器（如果不存在）
        let autoCompleteContainer = document.getElementById('autoCompleteContainer');
        if (!autoCompleteContainer) {
            autoCompleteContainer = document.createElement('div');
            autoCompleteContainer.id = 'autoCompleteContainer';
            autoCompleteContainer.className = 'autocomplete-container';
            document.querySelector('.search-container').appendChild(autoCompleteContainer);
        }
        
        // 过滤匹配的学生
        const lowerQuery = query.toLowerCase();
        const matchingStudents = this.currentStudents.filter(student => 
            student.name.toLowerCase().includes(lowerQuery) ||
            (student.studentId && student.studentId.toLowerCase().includes(lowerQuery))
        );
        
        // 清空现有建议
        autoCompleteContainer.innerHTML = '';
        
        // 显示最多5个建议
        matchingStudents.slice(0, 5).forEach(student => {
            const suggestionItem = document.createElement('div');
            suggestionItem.className = 'autocomplete-item';
            suggestionItem.innerHTML = `
                <div class="suggestion-name">${student.name}</div>
                <div class="suggestion-id">${student.studentId || ''}</div>
            `;
            
            // 点击建议项时选择学生
            suggestionItem.addEventListener('click', () => {
                document.getElementById('studentSearch').value = student.name;
                this.searchStudents(student.name);
                this.hideAutoComplete();
            });
            
            autoCompleteContainer.appendChild(suggestionItem);
        });
        
        // 显示容器
        if (matchingStudents.length > 0) {
            autoCompleteContainer.style.display = 'block';
        } else {
            autoCompleteContainer.style.display = 'none';
        }
    }
    
    /**
     * 隐藏自动完成建议
     */
    hideAutoComplete() {
        const autoCompleteContainer = document.getElementById('autoCompleteContainer');
        if (autoCompleteContainer) {
            autoCompleteContainer.style.display = 'none';
        }
    }

    /**
     * 备份数据
     */
    async backupData() {
        try {
            this.showLoading('正在备份数据...');
            const backupData = await window.storageManager.backupData();
            this.hideLoading();
            
            // 创建并下载备份文件
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', `随机点名系统备份_${new Date().toISOString().split('T')[0]}.json`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('数据备份成功', 'success');
        } catch (error) {
            console.error('备份数据失败:', error);
            this.showNotification('备份数据失败', 'error');
            this.hideLoading();
        }
    }

    /**
     * 恢复数据
     */
    restoreData() {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '恢复数据';
        
        body.innerHTML = `
            <p>选择要恢复的备份文件：</p>
            <input type="file" id="restoreFile" accept=".json" />
            <p class="text-warning">警告：恢复数据将覆盖当前所有数据，此操作不可恢复！</p>
        `;
        
        confirm.textContent = '恢复';
        confirm.className = 'btn btn-danger';
        confirm.onclick = () => {
            this.doRestoreData();
        };
        
        modal.style.display = 'flex';
    }

    /**
     * 执行数据恢复
     */
    async doRestoreData() {
        const fileInput = document.getElementById('restoreFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('请选择要恢复的备份文件', 'warning');
            return;
        }
        
        try {
            this.showLoading('正在恢复数据...');
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    await window.storageManager.restoreData(backupData);
                    this.hideLoading();
                    
                    await this.loadClasses();
                    await this.loadStudents();
                    this.closeModal();
                    this.showNotification('数据恢复成功，页面将刷新', 'success');
                    
                    // 刷新页面以重新加载数据
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (error) {
                    console.error('恢复数据失败:', error);
                    this.showNotification('恢复数据失败：文件格式不正确', 'error');
                    this.hideLoading();
                }
            };
            reader.readAsText(file);
        } catch (error) {
            console.error('恢复数据失败:', error);
            this.showNotification('恢复数据失败', 'error');
            this.hideLoading();
        }
    }

    /**
     * 确认清空数据
     */
    confirmClearData() {
        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const body = document.getElementById('modalBody');
        const confirm = document.getElementById('modalConfirm');
        
        title.textContent = '确认清空数据';
        
        body.innerHTML = `
            <p>确定要清空所有数据吗？</p>
            <p class="text-warning">此操作不可恢复，将删除所有班级、学生和点名记录！</p>
        `;
        
        confirm.textContent = '清空';
        confirm.className = 'btn btn-danger';
        confirm.onclick = () => {
            this.clearData();
        };
        
        modal.style.display = 'flex';
    }

    /**
     * 清空数据
     */
    async clearData() {
        try {
            this.showLoading('正在清空数据...');
            await window.storageManager.clearAllData();
            this.hideLoading();
            
            await this.loadClasses();
            await this.loadStudents();
            this.closeModal();
            this.showNotification('数据清空成功', 'success');
        } catch (error) {
            console.error('清空数据失败:', error);
            this.showNotification('清空数据失败', 'error');
            this.hideLoading();
        }
    }

    /**
     * 显示模态框
     */
    showModal() {
        const modal = document.getElementById('modalOverlay');
        modal.style.display = 'flex';
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        const modal = document.getElementById('modalOverlay');
        modal.style.display = 'none';
        
        // 重置确认按钮样式
        const confirm = document.getElementById('modalConfirm');
        confirm.className = 'btn btn-primary';
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        this.hideModal();
    }

    /**
     * 确认模态框操作
     */
    confirmModalAction() {
        // 由各个具体方法设置
    }

    /**
     * 显示通知
     * @param {string} message - 通知内容
     * @param {string} type - 通知类型 (success, error, warning, info)
     * @param {number} duration - 显示时长(ms)
     */
    showNotification(message, type = 'info', duration = 3000) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(notification);
        
        // 自动关闭
        const autoCloseTimer = setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        // 手动关闭
        notification.querySelector('.notification-close').addEventListener('click', () => {
            clearTimeout(autoCloseTimer);
            this.removeNotification(notification);
        });
    }

    /**
     * 获取通知图标
     * @param {string} type - 通知类型
     * @returns {string} 图标类名
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    /**
     * 移除通知
     * @param {HTMLElement} notification - 通知元素
     */
    removeNotification(notification) {
        notification.classList.add('removing');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }

    /**
     * 显示加载状态
     * @param {string} message - 加载消息
     */
    showLoading(message = '加载中...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay.querySelector('p');
        
        if (text) {
            text.textContent = message;
        }
        
        overlay.style.display = 'flex';
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }

    /**
     * 显示特殊规则配置模态框
     * @param {number} studentId - 学生ID
     */
    async showSpecialRuleModal(studentId) {
        try {
            const student = this.currentStudents.find(s => s.id === studentId);
            if (!student) {
                this.showNotification('学生信息不存在', 'error');
                return;
            }

            const modal = document.getElementById('modalOverlay');
            const modalTitle = document.getElementById('modalTitle');
            const modalBody = document.getElementById('modalBody');
            const modalConfirm = document.getElementById('modalConfirm');
            const modalCancel = document.getElementById('modalCancel');

            // 设置模态框标题
            modalTitle.textContent = `特殊规则配置 - ${student.name}`;
            
            // 渲染特殊规则配置界面
            modalBody.innerHTML = this.renderSpecialRuleModal(student);

            // 绑定确认按钮事件
            modalConfirm.onclick = async () => {
                const status = document.querySelector('input[name="specialStatus"]:checked')?.value;
                const operator = document.getElementById('operatorInput')?.value || 'system';
                
                if (!status) {
                    this.showNotification('请选择特殊状态', 'warning');
                    return;
                }

                try {
                    await this.configureSpecialRule(studentId, status, operator);
                    this.hideModal();
                    this.showNotification('特殊规则配置成功', 'success');
                    this.renderStudentsList(); // 刷新学生列表
                } catch (error) {
                    console.error('配置特殊规则失败:', error);
                    this.showNotification('配置特殊规则失败', 'error');
                }
            };

            // 绑定取消按钮事件
            modalCancel.onclick = () => this.hideModal();

            this.showModal();

        } catch (error) {
            console.error('显示特殊规则模态框失败:', error);
            this.showNotification('显示特殊规则配置失败', 'error');
        }
    }

    /**
     * 渲染特殊规则配置模态框内容
     * @param {Object} student - 学生对象
     * @returns {string} HTML内容
     */
    renderSpecialRuleModal(student) {
        const currentStatus = student.specialStatus || 'normal';
        const isExcluded = currentStatus === 'special_excluded';
        
        return `
            <div class="special-rule-config">
                <div class="config-section">
                    <h4>学生信息</h4>
                    <div class="student-info-display">
                        <div class="info-row">
                            <span class="label">姓名:</span>
                            <span class="value">${student.name}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">学号:</span>
                            <span class="value">${student.studentId || '未设置'}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">当前状态:</span>
                            <span class="value ${isExcluded ? 'status-excluded' : 'status-normal'}">
                                <i class="${isExcluded ? 'fas fa-user-shield' : 'fas fa-user'}"></i>
                                ${isExcluded ? '特殊排除' : '正常状态'}
                            </span>
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h4>特殊状态配置</h4>
                    <div class="status-options">
                        <label class="status-option">
                            <input type="radio" name="specialStatus" value="normal" ${!isExcluded ? 'checked' : ''}>
                            <div class="option-content">
                                <i class="fas fa-user"></i>
                                <div class="option-text">
                                    <div class="option-title">正常状态</div>
                                    <div class="option-desc">该学生参与所有点名模式</div>
                                </div>
                            </div>
                        </label>
                        
                        <label class="status-option">
                            <input type="radio" name="specialStatus" value="special_excluded" ${isExcluded ? 'checked' : ''}>
                            <div class="option-content">
                                <i class="fas fa-user-shield"></i>
                                <div class="option-text">
                                    <div class="option-title">特殊排除</div>
                                    <div class="option-desc">该学生仅在"公平随机"模式下被选中，其他模式下自动排除</div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="config-section">
                    <h4>操作信息</h4>
                    <div class="operator-input">
                        <label>操作人员:</label>
                        <input type="text" id="operatorInput" placeholder="请输入操作人员姓名" value="system">
                    </div>
                    <div class="config-note">
                        <i class="fas fa-info-circle"></i>
                        <span>配置变更将记录在系统日志中，包含操作时间和操作人员信息</span>
                    </div>
                </div>

                <div class="config-section">
                    <h4>影响说明</h4>
                    <div class="impact-info">
                        <div class="impact-item">
                            <i class="fas fa-check-circle text-success"></i>
                            <span>正常状态：参与所有点名算法</span>
                        </div>
                        <div class="impact-item">
                            <i class="fas fa-shield-alt text-warning"></i>
                            <span>特殊排除：仅参与公平随机算法，其他算法自动排除</span>
                        </div>
                        <div class="impact-item">
                            <i class="fas fa-database text-info"></i>
                            <span>配置数据持久化保存，重启后仍然有效</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 配置学生特殊规则
     * @param {number} studentId - 学生ID
     * @param {string} status - 特殊状态
     * @param {string} operator - 操作人员
     * @returns {Promise<boolean>} 配置结果
     */
    async configureSpecialRule(studentId, status, operator = 'system') {
        try {
            if (!window.storageManager) {
                throw new Error('存储管理器未初始化');
            }

            // 调用存储管理器设置学生特殊状态
            const result = await window.storageManager.setStudentSpecialStatus(studentId, status, operator);
            
            if (result) {
                // 更新本地学生数据
                const studentIndex = this.currentStudents.findIndex(s => s.id === studentId);
                if (studentIndex !== -1) {
                    this.currentStudents[studentIndex].specialStatus = status;
                }
                
                // 记录操作日志
                console.log(`学生 ${studentId} 的特殊状态已设置为: ${status}, 操作人员: ${operator}`);
                
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('配置学生特殊规则失败:', error);
            throw error;
        }
    }
}

// 创建应用实例
window.app = new RollCallApp();

// 在DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});