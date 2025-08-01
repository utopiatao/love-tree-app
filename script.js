// 预设用户信息
const USERS = {
    'Hu': { password: 'Hu1998', partner: 'partner1', displayName: 'Hu' },
    'Tu': { password: 'Tu1987', partner: 'partner2', displayName: 'Tu' }
};

// 用户管理类
class UserManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // 检查是否已登录
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
        }
    }

    login(username, password) {
        const user = USERS[username];
        if (user && user.password === password) {
            this.currentUser = {
                username: username,
                partner: user.partner,
                displayName: user.displayName
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            return true;
        }
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getPartnerType() {
        return this.currentUser ? this.currentUser.partner : null;
    }
}

// 应用状态管理
class LoveTreeApp {
    constructor() {
        this.userManager = new UserManager();
        this.data = {
            partner1: { name: 'Hu', avatar: '', checkedToday: false },
            partner2: { name: 'Tu', avatar: '', checkedToday: false },
            relationshipStart: '',
            waterDrops: 0,
            tree: { level: 1, exp: 0, maxExp: 10 },
            diaries: [],
            photos: []
        };
        
        this.treeStages = [
            '🌱', '🌿', '🌳', '🌲', '🎄', '🌸', '🌺', '🌻', '🌹', '💝'
        ];
        
        // Supabase配置 (从配置文件读取)
        this.supabaseUrl = window.APP_CONFIG?.SUPABASE_URL || '';
        this.supabaseKey = window.APP_CONFIG?.SUPABASE_ANON_KEY || '';
        this.supabaseClient = null;
        this.coupleId = localStorage.getItem('coupleId') || this.generateCoupleId();
        
        this.init();
    }

    init() {
        // 检查登录状态
        if (!this.userManager.isLoggedIn()) {
            this.showLoginModal();
            return;
        }

        this.loadData();
        this.setupEventListeners();
        this.updateUI();
        this.calculateDaysTogether();
        this.checkDailyReset();
        this.setupCloudSync();
        this.updateUserInterface();
    }

    // 显示登录界面
    showLoginModal() {
        document.querySelector('.container').style.display = 'none';
        this.createLoginModal();
    }

    // 创建登录弹窗
    createLoginModal() {
        const loginHTML = `
            <div class="login-overlay">
                <div class="login-modal">
                    <div class="login-header">
                        <h2>💕 欢迎来到爱情小树</h2>
                        <p>请选择你的身份登录</p>
                    </div>
                    <div class="login-body">
                        <div class="user-selection">
                            <button class="user-btn" data-user="Hu">
                                <div class="user-avatar">👨</div>
                                <span>Hu</span>
                            </button>
                            <button class="user-btn" data-user="Tu">
                                <div class="user-avatar">👩</div>
                                <span>Tu</span>
                            </button>
                        </div>
                        <div class="login-form" style="display: none;">
                            <h3 id="selected-user">用户登录</h3>
                            <input type="password" id="login-password" placeholder="请输入密码">
                            <div class="login-buttons">
                                <button id="back-to-selection">返回</button>
                                <button id="login-submit">登录</button>
                            </div>
                        </div>
                        <div class="login-error" id="login-error" style="display: none;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', loginHTML);
        this.setupLoginEvents();
    }

    // 设置登录事件
    setupLoginEvents() {
        const userBtns = document.querySelectorAll('.user-btn');
        const loginForm = document.querySelector('.login-form');
        const userSelection = document.querySelector('.user-selection');
        const selectedUserElement = document.getElementById('selected-user');
        const passwordInput = document.getElementById('login-password');
        const loginError = document.getElementById('login-error');
        let selectedUsername = '';

        // 用户选择
        userBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                selectedUsername = btn.getAttribute('data-user');
                selectedUserElement.textContent = `${selectedUsername} 登录`;
                userSelection.style.display = 'none';
                loginForm.style.display = 'block';
                passwordInput.focus();
            });
        });

        // 返回选择
        document.getElementById('back-to-selection').addEventListener('click', () => {
            loginForm.style.display = 'none';
            userSelection.style.display = 'block';
            passwordInput.value = '';
            loginError.style.display = 'none';
        });

        // 登录提交
        document.getElementById('login-submit').addEventListener('click', () => {
            this.handleLogin(selectedUsername, passwordInput.value);
        });

        // 回车键登录
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleLogin(selectedUsername, passwordInput.value);
            }
        });
    }

    // 处理登录
    handleLogin(username, password) {
        const loginError = document.getElementById('login-error');
        
        if (this.userManager.login(username, password)) {
            // 登录成功
            document.querySelector('.login-overlay').remove();
            document.querySelector('.container').style.display = 'block';
            
            // 重新初始化应用
            this.loadData();
            this.setupEventListeners();
            this.updateUI();
            this.calculateDaysTogether();
            this.checkDailyReset();
            this.setupCloudSync();
            this.updateUserInterface();
            
            this.showNotification(`🎉 欢迎 ${username}！`);
        } else {
            // 登录失败
            loginError.textContent = '密码错误，请重试';
            loginError.style.display = 'block';
            document.getElementById('login-password').value = '';
        }
    }

    // 更新用户界面
    updateUserInterface() {
        const user = this.userManager.getCurrentUser();
        if (!user) return;

        // 更新导航栏显示当前用户
        const logo = document.querySelector('.logo');
        logo.innerHTML = `💕 爱情小树 <small style="font-size: 0.8em; opacity: 0.8;">(${user.displayName})</small>`;

        // 根据用户类型更新打卡按钮可见性
        this.updateCheckInVisibility();
    }

    // 更新打卡按钮可见性
    updateCheckInVisibility() {
        const user = this.userManager.getCurrentUser();
        if (!user) return;

        const checkin1 = document.getElementById('checkin1');
        const checkin2 = document.getElementById('checkin2');
        
        if (user.partner === 'partner1') {
            // Hu用户只能看到自己的打卡按钮
            checkin1.style.display = 'flex';
            checkin2.style.opacity = '0.5';
            checkin2.style.pointerEvents = 'none';
        } else {
            // Tu用户只能看到自己的打卡按钮
            checkin2.style.display = 'flex';
            checkin1.style.opacity = '0.5';
            checkin1.style.pointerEvents = 'none';
        }
    }

    // 生成情侣唯一ID
    generateCoupleId() {
        const id = 'couple_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('coupleId', id);
        return id;
    }

    // 云端同步设置
    setupCloudSync() {
        // 直接使用硬编码的Supabase配置，自动初始化云端同步
        this.initSupabase();
    }

    // 初始化Supabase客户端
    initSupabase() {
        if (this.supabaseUrl && this.supabaseKey && window.supabase) {
            this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
            this.loadFromCloud();
            this.showNotification('☁️ 云端同步已连接');
        }
    }

    // 数据管理 - 优先本地存储，云端作为同步备份
    loadData() {
        const savedData = localStorage.getItem('loveTreeData');
        if (savedData) {
            this.data = { ...this.data, ...JSON.parse(savedData) };
        }
    }

    async saveData() {
        // 本地存储
        localStorage.setItem('loveTreeData', JSON.stringify(this.data));
        
        // 云端同步
        if (this.supabaseClient) {
            try {
                await this.saveToCloud();
            } catch (error) {
                console.warn('云端同步失败，数据已保存到本地:', error);
            }
        }
    }

    // 云端数据操作
    async saveToCloud() {
        if (!this.supabaseClient) return;
        
        const dataToSave = {
            couple_id: this.coupleId,
            data: this.data,
            updated_at: new Date().toISOString()
        };

        const { error } = await this.supabaseClient
            .from('love_tree_data')
            .upsert(dataToSave);

        if (error) {
            throw error;
        }
    }

    async loadFromCloud() {
        if (!this.supabaseClient) return;

        try {
            const { data, error } = await this.supabaseClient
                .from('love_tree_data')
                .select('*')
                .eq('couple_id', this.coupleId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data && data.data) {
                // 合并云端数据与本地数据
                this.data = { ...this.data, ...data.data };
                this.saveData(); // 更新本地存储
                this.updateUI();
                this.showNotification('☁️ 已从云端加载数据');
            }
        } catch (error) {
            console.warn('从云端加载数据失败:', error);
            this.showNotification('⚠️ 云端连接失败，使用本地数据');
        }
    }

    // 事件监听器设置
    setupEventListeners() {
        // 标签页切换
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // 情侣信息
        document.getElementById('name1').addEventListener('input', (e) => {
            this.data.partner1.name = e.target.value;
            this.updatePartnerNames();
            this.saveData();
        });

        document.getElementById('name2').addEventListener('input', (e) => {
            this.data.partner2.name = e.target.value;
            this.updatePartnerNames();
            this.saveData();
        });

        document.getElementById('relationship-start').addEventListener('change', (e) => {
            this.data.relationshipStart = e.target.value;
            this.calculateDaysTogether();
            this.saveData();
        });

        // 头像上传
        document.getElementById('avatar1').addEventListener('click', () => {
            document.getElementById('avatar-upload1').click();
        });

        document.getElementById('avatar2').addEventListener('click', () => {
            document.getElementById('avatar-upload2').click();
        });

        document.getElementById('avatar-upload1').addEventListener('change', (e) => {
            this.handleAvatarUpload(e, 'partner1');
        });

        document.getElementById('avatar-upload2').addEventListener('change', (e) => {
            this.handleAvatarUpload(e, 'partner2');
        });

        // 打卡功能 - 只允许当前用户为自己打卡
        document.getElementById('checkin1').addEventListener('click', () => {
            const user = this.userManager.getCurrentUser();
            if (user && user.partner === 'partner1') {
                this.checkIn('partner1');
            } else {
                this.showNotification('❌ 你只能为自己打卡！');
            }
        });

        document.getElementById('checkin2').addEventListener('click', () => {
            const user = this.userManager.getCurrentUser();
            if (user && user.partner === 'partner2') {
                this.checkIn('partner2');
            } else {
                this.showNotification('❌ 你只能为自己打卡！');
            }
        });

        // 浇水功能
        document.getElementById('water-tree').addEventListener('click', () => {
            this.waterTree();
        });

        // 日记功能
        document.getElementById('add-diary').addEventListener('click', () => {
            this.openDiaryModal();
        });

        document.getElementById('close-diary-modal').addEventListener('click', () => {
            this.closeDiaryModal();
        });

        document.getElementById('cancel-diary').addEventListener('click', () => {
            this.closeDiaryModal();
        });

        document.getElementById('save-diary').addEventListener('click', () => {
            this.saveDiary();
        });

        // 照片功能
        document.getElementById('add-photo').addEventListener('click', () => {
            this.openPhotoModal();
        });

        document.getElementById('close-photo-modal').addEventListener('click', () => {
            this.closePhotoModal();
        });

        document.getElementById('cancel-photo').addEventListener('click', () => {
            this.closePhotoModal();
        });

        document.getElementById('save-photo').addEventListener('click', () => {
            this.savePhoto();
        });

        // 设置功能
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('reset-data').addEventListener('click', () => {
            this.resetData();
        });

        // 云端同步设置
        document.getElementById('setup-cloud').addEventListener('click', () => {
            this.setupCloudModal();
        });

        document.getElementById('sync-from-cloud').addEventListener('click', () => {
            this.loadFromCloud();
        });

        document.getElementById('get-couple-id').addEventListener('click', () => {
            this.showCoupleId();
        });

        // 登出功能
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // 模态框外部点击关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    // 登出功能
    logout() {
        if (confirm('确定要登出吗？')) {
            this.userManager.logout();
            location.reload();
        }
    }

    // UI更新
    updateUI() {
        this.updatePartnerInfo();
        this.updateWaterDrops();
        this.updateTree();
        this.updateCheckInStatus();
        this.renderDiaries();
        this.renderPhotos();
        this.updateCloudStatus();
        this.updateCheckInVisibility(); // 添加这行
    }

    updatePartnerInfo() {
        if (this.data.partner1.name) {
            document.getElementById('name1').value = this.data.partner1.name;
        }
        if (this.data.partner2.name) {
            document.getElementById('name2').value = this.data.partner2.name;
        }
        if (this.data.relationshipStart) {
            document.getElementById('relationship-start').value = this.data.relationshipStart;
        }
        if (this.data.partner1.avatar) {
            document.getElementById('avatar1').src = this.data.partner1.avatar;
        }
        if (this.data.partner2.avatar) {
            document.getElementById('avatar2').src = this.data.partner2.avatar;
        }
        this.updatePartnerNames();
    }

    updatePartnerNames() {
        const name1 = this.data.partner1.name || 'Hu';
        const name2 = this.data.partner2.name || 'Tu';
        
        document.getElementById('name1-display').textContent = name1;
        document.getElementById('name2-display').textContent = name2;
        
        // 更新日记作者选项，默认选择当前用户
        const authorSelect = document.getElementById('diary-author-select');
        if (authorSelect) {
            const currentUser = this.userManager.getCurrentUser();
            authorSelect.innerHTML = `
                <option value="partner1" ${currentUser && currentUser.partner === 'partner1' ? 'selected' : ''}>${name1}</option>
                <option value="partner2" ${currentUser && currentUser.partner === 'partner2' ? 'selected' : ''}>${name2}</option>
            `;
        }
    }

    updateWaterDrops() {
        document.getElementById('water-count').textContent = this.data.waterDrops;
        
        // 更新浇水按钮状态
        const waterBtn = document.getElementById('water-tree');
        if (this.data.waterDrops >= 1) {
            waterBtn.disabled = false;
        } else {
            waterBtn.disabled = true;
        }
    }

    updateTree() {
        const treeElement = document.getElementById('love-tree');
        const currentStage = Math.min(this.data.tree.level - 1, this.treeStages.length - 1);
        
        treeElement.innerHTML = `<div class="tree-level" data-level="${this.data.tree.level}">${this.treeStages[currentStage]}</div>`;
        
        document.getElementById('tree-level').textContent = this.data.tree.level;
        document.getElementById('tree-exp').textContent = `${this.data.tree.exp}/${this.data.tree.maxExp}`;
        
        // 更新进度条
        const progressFill = document.getElementById('tree-progress');
        const progressPercent = (this.data.tree.exp / this.data.tree.maxExp) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

    updateCheckInStatus() {
        // 更新打卡按钮状态
        const checkin1 = document.getElementById('checkin1');
        const checkin2 = document.getElementById('checkin2');
        const status1 = document.getElementById('status1');
        const status2 = document.getElementById('status2');
        const status1Text = document.getElementById('name1-status');
        const status2Text = document.getElementById('name2-status');

        if (this.data.partner1.checkedToday) {
            checkin1.disabled = true;
            status1.className = 'status-icon fas fa-check-circle checked';
            status1Text.textContent = '今日已打卡';
        } else {
            checkin1.disabled = false;
            status1.className = 'status-icon fas fa-clock unchecked';
            status1Text.textContent = '今日未打卡';
        }

        if (this.data.partner2.checkedToday) {
            checkin2.disabled = true;
            status2.className = 'status-icon fas fa-check-circle checked';
            status2Text.textContent = '今日已打卡';
        } else {
            checkin2.disabled = false;
            status2.className = 'status-icon fas fa-clock unchecked';
            status2Text.textContent = '今日未打卡';
        }
    }

    updateCloudStatus() {
        const statusElement = document.getElementById('cloud-status');
        if (statusElement) {
            if (this.supabaseClient) {
                statusElement.innerHTML = '☁️ 已连接云端';
                statusElement.style.color = '#00b894';
            } else {
                statusElement.innerHTML = '📱 仅本地存储';
                statusElement.style.color = '#fdcb6e';
            }
        }
    }

    // 核心功能实现
    switchTab(tabName) {
        // 更新导航按钮状态
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');
    }

    handleAvatarUpload(event, partner) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.data[partner].avatar = e.target.result;
                document.getElementById(partner === 'partner1' ? 'avatar1' : 'avatar2').src = e.target.result;
                this.saveData();
            };
            reader.readAsDataURL(file);
        }
    }

    checkIn(partner) {
        if (!this.data[partner].checkedToday) {
            this.data[partner].checkedToday = true;
            this.data.waterDrops += 1;
            
            // 动画效果
            const waterElement = document.getElementById('water-count');
            waterElement.classList.add('water-drop-animation');
            setTimeout(() => {
                waterElement.classList.remove('water-drop-animation');
            }, 800);

            this.updateUI();
            this.saveData();
            this.showNotification(`✅ ${this.data[partner].name || partner}打卡成功！获得1个水滴💧`);
        }
    }

    waterTree() {
        if (this.data.waterDrops >= 1) {
            this.data.waterDrops -= 1;
            this.data.tree.exp += 1;

            // 检查是否升级
            if (this.data.tree.exp >= this.data.tree.maxExp) {
                this.data.tree.level += 1;
                this.data.tree.exp = 0;
                this.data.tree.maxExp = Math.floor(this.data.tree.maxExp * 1.5);
                
                const treeElement = document.getElementById('love-tree');
                treeElement.classList.add('tree-grow');
                setTimeout(() => {
                    treeElement.classList.remove('tree-grow');
                }, 1000);

                this.showNotification(`🎉 恭喜！爱情树升级到${this.data.tree.level}级！`);
            } else {
                this.showNotification(`💧 浇水成功！小树正在茁壮成长～`);
            }

            this.updateUI();
            this.saveData();
        }
    }

    calculateDaysTogether() {
        if (this.data.relationshipStart) {
            const startDate = new Date(this.data.relationshipStart);
            const today = new Date();
            const timeDiff = today.getTime() - startDate.getTime();
            const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
            document.getElementById('days-count').textContent = daysDiff >= 0 ? daysDiff : 0;
        }
    }

    checkDailyReset() {
        const lastCheck = localStorage.getItem('lastCheckDate');
        const today = new Date().toDateString();
        
        if (lastCheck !== today) {
            this.data.partner1.checkedToday = false;
            this.data.partner2.checkedToday = false;
            localStorage.setItem('lastCheckDate', today);
            this.saveData();
        }
    }

    // 日记功能
    openDiaryModal() {
        document.getElementById('diary-modal').classList.add('active');
        document.getElementById('diary-title').value = '';
        document.getElementById('diary-content').value = '';
        
        // 自动选择当前用户作为作者
        const currentUser = this.userManager.getCurrentUser();
        const authorSelect = document.getElementById('diary-author-select');
        if (currentUser && authorSelect) {
            authorSelect.value = currentUser.partner;
        }
    }

    closeDiaryModal() {
        document.getElementById('diary-modal').classList.remove('active');
    }

    saveDiary() {
        const title = document.getElementById('diary-title').value.trim();
        const content = document.getElementById('diary-content').value.trim();
        const author = document.getElementById('diary-author-select').value;

        if (title && content) {
            const diary = {
                id: Date.now(),
                title: title,
                content: content,
                author: author,
                authorName: this.data[author].name || (author === 'partner1' ? 'Hu' : 'Tu'),
                date: new Date().toLocaleString('zh-CN')
            };

            this.data.diaries.unshift(diary);
            this.saveData();
            this.renderDiaries();
            this.closeDiaryModal();
            this.showNotification('📝 日记保存成功！');
        } else {
            this.showNotification('❌ 请填写标题和内容');
        }
    }

    renderDiaries() {
        const diaryList = document.getElementById('diary-list');
        
        if (this.data.diaries.length === 0) {
            diaryList.innerHTML = '<div style="text-align: center; color: #999; padding: 40px;">还没有日记，快来写下你们的第一篇日记吧！💕</div>';
            return;
        }

        diaryList.innerHTML = this.data.diaries.map(diary => `
            <div class="diary-item">
                <div class="diary-meta">
                    <span>作者: ${diary.authorName}</span>
                    <span>${diary.date}</span>
                </div>
                <div class="diary-title">${diary.title}</div>
                <div class="diary-content">${diary.content}</div>
                <button class="delete-diary" onclick="app.deleteDiary(${diary.id})" style="
                    background: #e17055;
                    color: white;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    margin-top: 10px;
                ">删除</button>
            </div>
        `).join('');
    }

    deleteDiary(id) {
        if (confirm('确定要删除这篇日记吗？')) {
            this.data.diaries = this.data.diaries.filter(diary => diary.id !== id);
            this.saveData();
            this.renderDiaries();
            this.showNotification('🗑️ 日记已删除');
        }
    }

    // 照片功能
    openPhotoModal() {
        document.getElementById('photo-modal').classList.add('active');
        document.getElementById('photo-upload').value = '';
        document.getElementById('photo-caption').value = '';
    }

    closePhotoModal() {
        document.getElementById('photo-modal').classList.remove('active');
    }

    savePhoto() {
        const fileInput = document.getElementById('photo-upload');
        const caption = document.getElementById('photo-caption').value.trim();

        if (fileInput.files.length > 0) {
            Array.from(fileInput.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const photo = {
                        id: Date.now() + Math.random(),
                        src: e.target.result,
                        caption: caption || '美好回忆',
                        date: new Date().toLocaleString('zh-CN')
                    };

                    this.data.photos.unshift(photo);
                    this.saveData();
                    this.renderPhotos();
                };
                reader.readAsDataURL(file);
            });

            this.closePhotoModal();
            this.showNotification('📷 照片上传成功！');
        } else {
            this.showNotification('❌ 请选择照片');
        }
    }

    renderPhotos() {
        const photosGrid = document.getElementById('photos-grid');
        
        if (this.data.photos.length === 0) {
            photosGrid.innerHTML = '<div style="text-align: center; color: #999; padding: 40px; grid-column: 1/-1;">还没有照片，快来上传你们的美好回忆吧！📸</div>';
            return;
        }

        photosGrid.innerHTML = this.data.photos.map(photo => `
            <div class="photo-item">
                <img src="${photo.src}" alt="${photo.caption}" loading="lazy">
                <div class="photo-caption">${photo.caption}</div>
                <button onclick="app.deletePhoto(${photo.id})" style="
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: rgba(225, 112, 85, 0.8);
                    color: white;
                    border: none;
                    width: 25px;
                    height: 25px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 12px;
                ">×</button>
            </div>
        `).join('');
    }

    deletePhoto(id) {
        if (confirm('确定要删除这张照片吗？')) {
            this.data.photos = this.data.photos.filter(photo => photo.id !== id);
            this.saveData();
            this.renderPhotos();
            this.showNotification('🗑️ 照片已删除');
        }
    }

    // 云端同步功能
    setupCloudModal() {
        const url = prompt('请输入Supabase项目URL:');
        const key = prompt('请输入Supabase匿名密钥:');
        
        if (url && key) {
            this.supabaseUrl = url;
            this.supabaseKey = key;
            
            // 保存配置
            localStorage.setItem('supabaseConfig', JSON.stringify({ url, key }));
            
            this.initSupabase();
        }
    }

    showCoupleId() {
        const message = `你们的情侣ID是: ${this.coupleId}\n\n请将此ID分享给TA，这样你们就可以共享同一个爱情小树了！\n\n使用方法：\n1. TA也打开这个网页\n2. 在设置中输入相同的情侣ID\n3. 配置相同的云端数据库\n4. 即可同步数据！`;
        
        alert(message);
        
        // 复制到剪贴板
        if (navigator.clipboard) {
            navigator.clipboard.writeText(this.coupleId);
            this.showNotification('📋 情侣ID已复制到剪贴板');
        }
    }

    // 设置功能
    exportData() {
        const dataStr = JSON.stringify(this.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `love-tree-data-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('💾 数据导出成功！');
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        this.data = { ...this.data, ...importedData };
                        this.saveData();
                        this.updateUI();
                        this.showNotification('📂 数据导入成功！');
                    } catch (error) {
                        this.showNotification('❌ 文件格式错误');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    resetData() {
        if (confirm('确定要重置所有数据吗？这个操作不可恢复！')) {
            localStorage.clear();
            location.reload();
        }
    }

    // 通知系统
    showNotification(message) {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 自动移除
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LoveTreeApp();
});

// 添加一些有趣的交互效果
document.addEventListener('DOMContentLoaded', () => {
    // 心跳动画
    setInterval(() => {
        const hearts = document.querySelectorAll('.love-heart i');
        hearts.forEach(heart => {
            heart.classList.add('sparkle');
            setTimeout(() => {
                heart.classList.remove('sparkle');
            }, 1000);
        });
    }, 5000);

    // 随机樱花飘落效果
    function createSakura() {
        const sakura = document.createElement('div');
        sakura.innerHTML = '🌸';
        sakura.style.cssText = `
            position: fixed;
            top: -50px;
            left: ${Math.random() * window.innerWidth}px;
            font-size: ${Math.random() * 20 + 10}px;
            z-index: -1;
            pointer-events: none;
            animation: fall ${Math.random() * 3 + 2}s linear infinite;
            opacity: ${Math.random() * 0.8 + 0.2};
        `;

        document.body.appendChild(sakura);

        setTimeout(() => {
            if (sakura.parentNode) {
                sakura.parentNode.removeChild(sakura);
            }
        }, 5000);
    }

    // 添加下落动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fall {
            to {
                transform: translateY(${window.innerHeight + 50}px) rotate(360deg);
            }
        }
    `;
    document.head.appendChild(style);

    // 每隔一段时间创建樱花
    setInterval(createSakura, 3000);
}); 