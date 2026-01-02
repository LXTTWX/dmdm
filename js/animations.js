/**
 * 动画效果系统
 * 提供点名系统所需的各种动画效果
 */

class AnimationSystem {
    constructor() {
        this.currentAnimation = null;
        this.animationSettings = {
            duration: 2000, // 动画持续时间(ms)
            speed: 50,      // 滚动速度(数值越大越快)
            effect: 'default', // 动画效果类型
        };
        
        // 获取动画元素
        this.studentScroll = document.getElementById('studentScroll');
        this.currentNameElement = document.getElementById('currentName');
        this.displayContainer = document.querySelector('.display-container');
    }

    /**
     * 初始化动画系统
     */
    init() {
        this.setupEventListeners();
        this.updateSettingsFromUI();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 设置滑块事件监听器
        const durationSlider = document.getElementById('animationDuration');
        const speedSlider = document.getElementById('scrollSpeed');
        
        if (durationSlider) {
            durationSlider.addEventListener('input', (e) => {
                this.animationSettings.duration = parseInt(e.target.value);
                document.getElementById('durationValue').textContent = 
                    `${this.animationSettings.duration / 1000}秒`;
            });
        }
        
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.animationSettings.speed = parseInt(e.target.value);
                let speedText = '慢';
                if (this.animationSettings.speed > 70) {
                    speedText = '快';
                } else if (this.animationSettings.speed > 40) {
                    speedText = '中等';
                }
                document.getElementById('speedValue').textContent = speedText;
            });
        }

        // 设置主题颜色事件监听器
        document.querySelectorAll('.theme-color').forEach(button => {
            button.addEventListener('click', (e) => {
                document.querySelectorAll('.theme-color').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                document.documentElement.setAttribute('data-theme', e.target.dataset.theme);
            });
        });
    }

    /**
     * 从UI界面更新设置
     */
    updateSettingsFromUI() {
        const durationSlider = document.getElementById('animationDuration');
        const speedSlider = document.getElementById('scrollSpeed');
        
        if (durationSlider) {
            this.animationSettings.duration = parseInt(durationSlider.value);
        }
        
        if (speedSlider) {
            this.animationSettings.speed = parseInt(speedSlider.value);
        }
    }

    /**
     * 开始随机滚动动画
     * @param {Array} students - 学生数组
     * @param {number} duration - 动画持续时间(ms)
     * @returns {Promise} 动画完成的Promise
     */
    startRandomScroll(students, duration = null) {
        return new Promise((resolve) => {
            if (!students || students.length === 0) {
                resolve(null);
                return;
            }

            // 更新持续时间设置
            if (duration !== null) {
                this.animationSettings.duration = duration;
            }

            // 添加滚动类
            this.studentScroll.classList.add('rolling');
            
            // 创建滚动内容
            this.createScrollContent(students);
            
            // 设置滚动动画参数
            this.setupScrollAnimation();
            
            // 添加视觉特效
            this.createAudioVisualization();
            
            // 动画定时器
            const animationTimer = setTimeout(async () => {
                await this.slowDownAnimation();
                this.stopRandomScroll();
                resolve();
            }, this.animationSettings.duration);
            
            // 保存当前动画信息
            this.currentAnimation = {
                type: 'randomScroll',
                timer: animationTimer,
                startTime: Date.now()
            };
        });
    }

    /**
     * 减速动画效果
     */
    async slowDownAnimation() {
        return new Promise((resolve) => {
            // 添加减速类
            this.studentScroll.classList.add('slowing');
            this.studentScroll.classList.remove('rolling');
            
            // 移除音频可视化
            this.removeAudioVisualization();
            
            // 添加彩虹光谱效果
            this.createRainbowSpectrum();
            
            // 延迟解决Promise以匹配动画时间
            setTimeout(() => {
                this.studentScroll.classList.remove('slowing');
                resolve();
            }, 3000);
        });
    }

    /**
     * 创建音频可视化效果
     */
    createAudioVisualization() {
        const audioWave = document.createElement('div');
        audioWave.className = 'audio-wave';
        
        // 创建8个音频条
        for (let i = 0; i < 8; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';
            audioWave.appendChild(bar);
        }
        
        this.studentScroll.appendChild(audioWave);
    }

    /**
     * 移除音频可视化效果
     */
    removeAudioVisualization() {
        const audioWave = this.studentScroll.querySelector('.audio-wave');
        if (audioWave) {
            audioWave.remove();
        }
    }

    /**
     * 创建彩虹光谱效果
     */
    createRainbowSpectrum() {
        const spectrum = document.createElement('div');
        spectrum.className = 'rainbow-spectrum';
        
        // 添加粒子效果
        this.createParticleEffect();
        
        this.studentScroll.appendChild(spectrum);
        
        // 2秒后移除效果
        setTimeout(() => {
            spectrum.remove();
            this.removeParticleEffect();
        }, 2000);
    }

    /**
     * 创建粒子效果
     */
    createParticleEffect() {
        const particleContainer = document.createElement('div');
        particleContainer.className = 'particle-effect';
        
        // 创建20个粒子
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particle.style.animationDuration = (Math.random() * 1 + 1.5) + 's';
            particleContainer.appendChild(particle);
        }
        
        this.studentScroll.appendChild(particleContainer);
    }

    /**
     * 移除粒子效果
     */
    removeParticleEffect() {
        const particleContainer = this.studentScroll.querySelector('.particle-effect');
        if (particleContainer) {
            particleContainer.remove();
        }
    }

    /**
     * 创建滚动内容
     * @param {Array} students - 学生数组
     */
    createScrollContent(students) {
        // 清空现有内容
        const scrollContent = this.studentScroll.querySelector('.scroll-content');
        scrollContent.innerHTML = '';
        
        // 添加多个学生名字，确保滚动效果持续
        const nameHeight = 40; // 名字元素高度(px)
        const scrollContentHeight = this.studentScroll.clientHeight;
        const namesPerScreen = Math.ceil(scrollContentHeight / nameHeight);
        
        // 重复添加学生名字
        const namesToShow = [...students];
        while (namesToShow.length < namesPerScreen * 3) {
            namesToShow.push(...students);
        }
        
        // 创建名字元素
        namesToShow.forEach((student, index) => {
            const nameElement = document.createElement('div');
            nameElement.className = 'student-name';
            nameElement.textContent = student.name || '未命名学生';
            nameElement.dataset.index = index;
            scrollContent.appendChild(nameElement);
        });
        
        // 随机显示学生名字
        this.randomizeNameDisplay();
    }

    /**
     * 随机显示学生名字
     */
    randomizeNameDisplay() {
        const nameElements = this.studentScroll.querySelectorAll('.student-name');
        const displayInterval = Math.max(50, 200 - this.animationSettings.speed * 3);
        
        // 使用定时器随机切换显示的学生名字
        let displayCount = 0;
        const maxDisplays = Math.floor(this.animationSettings.duration / displayInterval);
        
        const displayTimer = setInterval(() => {
            if (displayCount >= maxDisplays) {
                clearInterval(displayTimer);
                return;
            }
            
            // 随机选择一个名字元素进行高亮
            const randomIndex = Math.floor(Math.random() * nameElements.length);
            nameElements.forEach(el => el.classList.remove('highlighted'));
            
            if (nameElements[randomIndex]) {
                nameElements[randomIndex].classList.add('highlighted');
            }
            
            displayCount++;
        }, displayInterval);
        
        // 保存显示定时器
        if (this.currentAnimation) {
            this.currentAnimation.displayTimer = displayTimer;
        }
    }

    /**
     * 设置滚动动画
     */
    setupScrollAnimation() {
        // 动态设置动画持续时间，基于速度和持续时间设置
        const baseDuration = Math.max(100, 2000 - this.animationSettings.speed * 20);
        const scrollContent = this.studentScroll.querySelector('.scroll-content');
        
        // 设置CSS变量
        scrollContent.style.setProperty('--scroll-animation-duration', `${baseDuration}ms`);
        
        // 添加随机滚动的CSS类
        this.studentScroll.classList.add('student-scroll');
        
        // 设置随机滚动动画 - 使用新的智能动画
        scrollContent.style.animation = `smartRollNames 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite`;
        
        // 为名字元素设置增强的动画
        const nameElements = this.studentScroll.querySelectorAll('.student-name');
        nameElements.forEach(el => {
            el.style.animation = `enhancedNameShuffle 0.8s ease-in-out infinite`;
        });
    }

    /**
     * 显示选中的学生
     * @param {Object} student - 选中的学生对象
     */
    showSelectedStudent(student) {
        return new Promise((resolve) => {
            // 清除所有高亮
            this.clearAllHighlights();
            
            // 找到对应的名字元素
            const nameElements = this.studentScroll.querySelectorAll('.student-name');
            let selectedElement = null;
            
            // 查找匹配的学生名字
            nameElements.forEach(el => {
                if (el.textContent === student.name) {
                    selectedElement = el;
                }
            });
            
            // 如果没找到，创建一个新的元素
            if (!selectedElement) {
                selectedElement = document.createElement('div');
                selectedElement.className = 'student-name selected';
                selectedElement.textContent = student.name;
                selectedElement.style.fontSize = '2rem';
                selectedElement.style.fontWeight = 'bold';
                selectedElement.style.textAlign = 'center';
                selectedElement.style.color = 'var(--primary-color)';
                selectedElement.style.margin = '2rem 0';
                
                // 添加到显示容器
                this.currentNameElement.innerHTML = '';
                this.currentNameElement.appendChild(selectedElement);
            } else {
                selectedElement.classList.add('selected');
            }
            
            // 添加戏剧性揭晓动画类
            selectedElement.classList.add('bounce-effect');
            
            // 添加容器揭示效果
            if (this.displayContainer) {
                this.displayContainer.classList.add('revealing');
                
                // 移除revealing类，动画完成后
                setTimeout(() => {
                    this.displayContainer.classList.remove('revealing');
                }, 1200);
            }
            
            // 添加震动效果增强戏剧性
            setTimeout(() => {
                selectedElement.classList.add('shake-effect');
                
                setTimeout(() => {
                    selectedElement.classList.remove('shake-effect');
                }, 500);
            }, 800);
            
            // 3秒后解决Promise
            setTimeout(() => {
                resolve(student);
            }, 3000);
        });
    }

    /**
     * 清除所有高亮
     */
    clearAllHighlights() {
        const nameElements = this.studentScroll.querySelectorAll('.student-name');
        nameElements.forEach(el => {
            el.classList.remove('highlighted', 'selected', 'bounce-effect', 'shake-effect');
        });
        
        // 清除容器效果
        if (this.displayContainer) {
            this.displayContainer.classList.remove('revealing');
        }
    }

    /**
     * 停止随机滚动动画
     */
    stopRandomScroll() {
        // 清除定时器
        if (this.currentAnimation && this.currentAnimation.displayTimer) {
            clearInterval(this.currentAnimation.displayTimer);
        }
        
        // 移除滚动类
        this.studentScroll.classList.remove('rolling');
        this.studentScroll.classList.remove('student-scroll');
        
        // 重置滚动内容
        const scrollContent = this.studentScroll.querySelector('.scroll-content');
        if (scrollContent) {
            scrollContent.style.animation = '';
            // 清空名字元素动画
            this.studentScroll.querySelectorAll('.student-name').forEach(el => {
                el.style.animation = '';
            });
        }
        
        // 清除当前动画信息
        this.currentAnimation = null;
    }

    /**
     * 高亮显示选中的学生
     * @param {Object} student - 选中的学生对象
     */
    highlightSelectedStudent(student) {
        if (!student) return;
        
        // 移除之前的高亮
        this.studentScroll.querySelectorAll('.student-name').forEach(el => {
            el.classList.remove('selected');
        });
        
        // 添加新的高亮
        const scrollContent = this.studentScroll.querySelector('.scroll-content');
        if (scrollContent) {
            const selectedElement = document.createElement('div');
            selectedElement.className = 'student-name selected';
            selectedElement.textContent = student.name || '未命名学生';
            
            // 添加到滚动内容的前面
            scrollContent.innerHTML = '';
            scrollContent.appendChild(selectedElement);
            
            // 添加到主显示区域
            this.currentNameElement.textContent = student.name || '未命名学生';
            this.currentNameElement.classList.add('selected');
            
            // 添加高亮动画
            this.applyHighlightAnimation(selectedElement);
        }
    }

    /**
     * 应用高亮动画
     * @param {HTMLElement} element - 要添加动画的元素
     */
    applyHighlightAnimation(element) {
        // 添加淡入动画
        element.classList.add('fade-in');
        
        // 添加缩放动画
        setTimeout(() => {
            element.classList.add('scale-in');
        }, 100);
        
        // 添加弹跳动画
        setTimeout(() => {
            element.classList.add('bounce');
        }, 300);
    }

    /**
     * 执行结果揭晓特效
     * @param {Object} student - 选中的学生对象
     * @returns {Promise} 动画完成的Promise
     */
    revealResult(student) {
        return new Promise((resolve) => {
            if (!student) {
                resolve(null);
                return;
            }
            
            // 高亮选中的学生
            this.highlightSelectedStudent(student);
            
            // 添加背景特效
            this.displayContainer.classList.add('revealing');
            
            // 添加庆祝动画效果
            this.addCelebrationEffect();
            
            // 添加名字揭晓动画
            const nameElement = this.currentNameElement;
            nameElement.classList.add('selected');
            
            // 等待动画完成
            setTimeout(() => {
                // 清理特效
                this.cleanupCelebrationEffect();
                resolve(student);
            }, 1500);
        });
    }

    /**
     * 添加庆祝动画效果
     */
    addCelebrationEffect() {
        // 创建庆祝容器
        const celebrationContainer = document.createElement('div');
        celebrationContainer.className = 'celebration';
        celebrationContainer.id = 'celebrationContainer';
        
        // 添加烟花效果
        for (let i = 0; i < 5; i++) {
            const firework = document.createElement('div');
            firework.className = 'firework';
            celebrationContainer.appendChild(firework);
        }
        
        // 添加星星粒子效果
        for (let i = 0; i < 10; i++) {
            const star = document.createElement('div');
            star.className = 'star-particle';
            star.textContent = '⭐';
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.animationDelay = `${Math.random() * 1.5}s`;
            celebrationContainer.appendChild(star);
        }
        
        // 添加到显示容器
        this.displayContainer.appendChild(celebrationContainer);
    }

    /**
     * 清理庆祝动画效果
     */
    cleanupCelebrationEffect() {
        // 移除背景特效
        this.displayContainer.classList.remove('revealing');
        
        // 移除庆祝容器
        const celebrationContainer = document.getElementById('celebrationContainer');
        if (celebrationContainer) {
            celebrationContainer.remove();
        }
    }

    /**
     * 应用主题效果
     * @param {string} theme - 主题名称
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        // 更新活跃主题按钮
        document.querySelectorAll('.theme-color').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.theme === theme) {
                button.classList.add('active');
            }
        });
    }

    /**
     * 停止所有动画
     */
    stopAllAnimations() {
        // 停止随机滚动
        if (this.currentAnimation && this.currentAnimation.type === 'randomScroll') {
            this.stopRandomScroll();
        }
        
        // 清理庆祝效果
        this.cleanupCelebrationEffect();
        
        // 重置学生名字显示
        this.currentNameElement.textContent = '点击开始点名';
        this.currentNameElement.classList.remove('selected', 'bounce', 'scale-in', 'fade-in');
    }

    /**
     * 检查用户是否偏好减少动画
     * @returns {boolean} 是否偏好减少动画
     */
    prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /**
     * 获取动画设置
     * @returns {Object} 动画设置对象
     */
    getAnimationSettings() {
        return { ...this.animationSettings };
    }

    /**
     * 更新动画设置
     * @param {Object} settings - 新的设置对象
     */
    updateAnimationSettings(settings) {
        this.animationSettings = { ...this.animationSettings, ...settings };
    }
}

// 创建全局实例
window.animationSystem = new AnimationSystem();

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.animationSystem.init();
});