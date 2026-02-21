// Authentication Manager
const AuthManager = {
    getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    async login(email, password) {
        try {
            console.log('Attempting login to backend...');
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            console.log('Login response status:', response.status);
            const data = await response.json();
            console.log('Login response data:', data);

            if (data.success) {
                // Store user data
                localStorage.setItem('user', JSON.stringify(data.user));
                this.updateUI();
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Cannot connect to server. Make sure backend is running on http://localhost:5000' };
        }
    },

    async signup(name, email, password) {
        // Validate password strength
        const validation = this.validatePasswordStrength(password);
        if (!validation.isValid) {
            return { success: false, error: validation.message };
        }

        try {
            console.log('Attempting signup to backend...');
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password })
            });

            console.log('Signup response status:', response.status);
            const data = await response.json();
            console.log('Signup response data:', data);

            if (data.success) {
                // Store user data
                localStorage.setItem('user', JSON.stringify(data.user));
                this.updateUI();
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: 'Cannot connect to server. Make sure backend is running on http://localhost:5000' };
        }
    },

    validatePasswordStrength(password) {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const failedRequirements = [];
        if (!requirements.length) failedRequirements.push('at least 8 characters');
        if (!requirements.uppercase) failedRequirements.push('one uppercase letter');
        if (!requirements.lowercase) failedRequirements.push('one lowercase letter');
        if (!requirements.number) failedRequirements.push('one number');
        if (!requirements.special) failedRequirements.push('one special character');

        const isValid = Object.values(requirements).every(req => req);

        return {
            isValid,
            requirements,
            message: isValid ? 'Strong password' : `Password must contain ${failedRequirements.join(', ')}`
        };
    },

    logout() {
        localStorage.removeItem('user');
        this.updateUI();
    },

    updateUI() {
        const user = this.getUser();
        const authButtons = document.getElementById('authButtons');
        const logoutButton = document.getElementById('logoutButton');

        if (user) {
            authButtons.style.display = 'none';
            logoutButton.style.display = 'block';
            
            // Update user info in dropdown
            const userName = document.getElementById('userNameDropdown');
            const userEmail = document.getElementById('userEmailDropdown');
            const userInitial = document.getElementById('userInitial');
            
            if (userName) userName.textContent = user.name || user.email.split('@')[0];
            if (userEmail) userEmail.textContent = user.email;
            if (userInitial) userInitial.textContent = (user.name || user.email)[0].toUpperCase();
        } else {
            authButtons.style.display = 'flex';
            logoutButton.style.display = 'none';
        }
        
        // Update history button visibility
        HistoryManager.updateHistoryButton();
    }
};

// Backend API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// History Manager - Hybrid (tries backend, falls back to localStorage)
const HistoryManager = {
    async getHistory() {
        // Only return history if user is logged in
        const user = AuthManager.getUser();
        if (!user) return [];
        
        try {
            // Get from backend using user_id
            const response = await fetch(`${API_BASE_URL}/history/${user.user_id}`);
            const data = await response.json();
            
            if (data.success) {
                return data.history;
            } else {
                throw new Error('Backend not available');
            }
        } catch (error) {
            console.log('Backend not available, using localStorage');
            // Fallback to localStorage
            const history = localStorage.getItem('ocr-history');
            return history ? JSON.parse(history) : [];
        }
    },

    async addToHistory(text, fileName) {
        // History is automatically saved by backend when OCR is processed
        // This method is kept for compatibility but doesn't need to do anything
        this.updateHistoryButton();
    },

    async clearHistory() {
        try {
            const history = await this.getHistory();
            
            // Try to delete from backend
            let backendSuccess = false;
            try {
                for (const item of history) {
                    if (item.document_id) {
                        await fetch(`${API_BASE_URL}/history/${item.document_id}`, {
                            method: 'DELETE'
                        });
                    }
                }
                backendSuccess = true;
            } catch (error) {
                console.log('Backend not available for deletion');
            }
            
            // Also clear localStorage
            localStorage.removeItem('ocr-history');
            
            this.updateHistoryButton();
            showToast('History cleared', 'success');
        } catch (error) {
            console.error('Error clearing history:', error);
            showToast('Failed to clear history', 'error');
        }
    },

    async loadFromHistory(id) {
        const history = await this.getHistory();
        const item = history.find(h => 
            h.document_id === parseInt(id) || h.id === id
        );
        if (item) {
            document.getElementById('extractedText').value = item.text || item.extracted_text;
            showToast('Loaded from history', 'success');
            toggleHistory(); // Close history panel
        }
    },

    async updateHistoryButton() {
        const historyBtn = document.querySelector('button[onclick="toggleHistory()"]');
        if (!historyBtn) return;
        
        const user = AuthManager.getUser();
        const history = await this.getHistory();
        
        // Show/hide history button based on login status
        if (user) {
            historyBtn.style.display = 'inline-flex';
            // Update button text with count
            const count = history.length;
            if (count > 0) {
                historyBtn.innerHTML = `📜 History (${count})`;
            } else {
                historyBtn.innerHTML = '📜 History';
            }
        } else {
            historyBtn.style.display = 'none';
        }
    }
};

// Theme Manager
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('ink2text-theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            this.setDarkMode();
        } else {
            this.setLightMode();
        }
    },

    setDarkMode() {
        document.documentElement.classList.add('dark');
        localStorage.setItem('ink2text-theme', 'dark');
        updateThemeIcon();
    },

    setLightMode() {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('ink2text-theme', 'light');
        updateThemeIcon();
    },

    toggle() {
        if (document.documentElement.classList.contains('dark')) {
            this.setLightMode();
        } else {
            this.setDarkMode();
        }
    }
};

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// Theme Toggle
function toggleTheme() {
    ThemeManager.toggle();
}

function updateThemeIcon() {
    const btn = document.querySelector('.theme-toggle');
    const isDark = document.documentElement.classList.contains('dark');
    const icon = btn.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
    }
}

// Mobile Menu Functions
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    navLinks.classList.toggle('show');
    menuToggle.classList.toggle('active');
}

function closeMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    
    navLinks.classList.remove('show');
    menuToggle.classList.remove('active');
}

// User Menu Functions
function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('show');
}

function closeUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.remove('show');
}

// Close user dropdown when clicking outside
document.addEventListener('click', (event) => {
    const userSection = document.querySelector('.user-section');
    const dropdown = document.getElementById('userDropdown');
    
    if (userSection && dropdown && !userSection.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Page Navigation
function goToPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    document.getElementById(pageName).classList.add('active');
    window.scrollTo(0, 0);
    
    // Update daily limit banner when going to converter page
    if (pageName === 'converter') {
        updateDailyLimitBanner();
    }
}

// Update Daily Limit Banner
function updateDailyLimitBanner() {
    const user = AuthManager.getUser();
    const banner = document.getElementById('dailyLimitBanner');
    const remainingCountEl = document.getElementById('remainingCount');
    
    if (!user) {
        // Show banner for non-logged-in users
        const info = getDailyUsageInfo();
        banner.style.display = 'block';
        remainingCountEl.textContent = info.remaining;
        
        // Change color based on remaining count
        if (info.remaining === 0) {
            banner.style.background = 'linear-gradient(135deg, rgba(220, 38, 38, 0.1), rgba(239, 68, 68, 0.1))';
            banner.querySelector('p').innerHTML = '<strong>Daily Limit Reached!</strong> Login to continue converting images';
        } else if (info.remaining <= 2) {
            banner.style.background = 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(251, 191, 36, 0.1))';
        }
    } else {
        // Hide banner for logged-in users
        banner.style.display = 'none';
    }
}

// Authentication Forms
function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }

    // Validate password strength for login as well
    const validation = AuthManager.validatePasswordStrength(password);
    if (!validation.isValid) {
        showToast('Invalid Password', 'Password does not meet security requirements. ' + validation.message, 'error');
        return;
    }

    // Call async login
    AuthManager.login(email, password).then(result => {
        if (result.success) {
            showToast('Login successful!', 'success');
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
            
            // Update daily limit banner
            updateDailyLimitBanner();
            
            goToPage('home');
        } else {
            showToast('Login failed', result.error, 'error');
        }
    });
}

// Password Strength Validator for Login
function validateLoginPassword() {
    const password = document.getElementById('loginPassword').value;
    const strengthBar = document.getElementById('loginPasswordStrength');
    const requirementsDiv = document.getElementById('loginPasswordRequirements');
    
    if (!password) {
        strengthBar.className = 'password-strength';
        requirementsDiv.style.display = 'none';
        resetLoginPasswordRequirements();
        return;
    }

    // Show requirements when user starts typing
    requirementsDiv.style.display = 'block';

    const validation = AuthManager.validatePasswordStrength(password);
    const requirements = validation.requirements;

    // Update requirement checkmarks
    document.getElementById('login-req-length').className = requirements.length ? 'valid' : '';
    document.getElementById('login-req-uppercase').className = requirements.uppercase ? 'valid' : '';
    document.getElementById('login-req-lowercase').className = requirements.lowercase ? 'valid' : '';
    document.getElementById('login-req-number').className = requirements.number ? 'valid' : '';
    document.getElementById('login-req-special').className = requirements.special ? 'valid' : '';

    // Calculate strength
    const validCount = Object.values(requirements).filter(Boolean).length;
    
    if (validCount <= 2) {
        strengthBar.className = 'password-strength weak';
    } else if (validCount <= 4) {
        strengthBar.className = 'password-strength medium';
    } else {
        strengthBar.className = 'password-strength strong';
    }
}

function resetLoginPasswordRequirements() {
    document.getElementById('login-req-length').className = '';
    document.getElementById('login-req-uppercase').className = '';
    document.getElementById('login-req-lowercase').className = '';
    document.getElementById('login-req-number').className = '';
    document.getElementById('login-req-special').className = '';
}

function handleSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('signupConfirm').value;

    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }

    // Validate password strength
    const validation = AuthManager.validatePasswordStrength(password);
    if (!validation.isValid) {
        showToast('Weak Password', validation.message, 'error');
        return;
    }

    // Call async signup
    AuthManager.signup(name, email, password).then(result => {
        if (result.success) {
            showToast('Account created successfully!', 'success');
            document.getElementById('signupName').value = '';
            document.getElementById('signupEmail').value = '';
            document.getElementById('signupPassword').value = '';
            document.getElementById('signupConfirm').value = '';
            
            // Update daily limit banner
            updateDailyLimitBanner();
            
            goToPage('home');
        } else {
            showToast('Signup failed', result.error, 'error');
        }
    });
}

// Password Strength Validator
function validatePassword() {
    const password = document.getElementById('signupPassword').value;
    const strengthBar = document.getElementById('passwordStrength');
    
    if (!password) {
        strengthBar.className = 'password-strength';
        resetPasswordRequirements();
        return;
    }

    const validation = AuthManager.validatePasswordStrength(password);
    const requirements = validation.requirements;

    // Update requirement checkmarks
    document.getElementById('req-length').className = requirements.length ? 'valid' : '';
    document.getElementById('req-uppercase').className = requirements.uppercase ? 'valid' : '';
    document.getElementById('req-lowercase').className = requirements.lowercase ? 'valid' : '';
    document.getElementById('req-number').className = requirements.number ? 'valid' : '';
    document.getElementById('req-special').className = requirements.special ? 'valid' : '';

    // Calculate strength
    const validCount = Object.values(requirements).filter(Boolean).length;
    
    if (validCount <= 2) {
        strengthBar.className = 'password-strength weak';
    } else if (validCount <= 4) {
        strengthBar.className = 'password-strength medium';
    } else {
        strengthBar.className = 'password-strength strong';
    }
}

function resetPasswordRequirements() {
    document.getElementById('req-length').className = '';
    document.getElementById('req-uppercase').className = '';
    document.getElementById('req-lowercase').className = '';
    document.getElementById('req-number').className = '';
    document.getElementById('req-special').className = '';
}

function logout() {
    // Clear history when logging out (no need to clear from DB, just local state)
    AuthManager.logout();
    showToast('Logged out successfully', 'success');
    
    // Update daily limit banner if on converter page
    updateDailyLimitBanner();
    
    goToPage('home');
}

// OCR Converter
const converterState = {
    imageFile: null,
    imageData: null
};

const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');

uploadArea.addEventListener('click', () => imageInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleImageSelect(file);
});

function handleImageSelect(file) {
    if (!file.type.match(/image\/(jpeg|png|jpg|webp)/)) {
        showToast('Please upload JPG, PNG, or WebP images', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be smaller than 5MB', 'error');
        return;
    }

    converterState.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        converterState.imageData = e.target.result;
        imagePreview.src = converterState.imageData;
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function processImage() {
    if (!converterState.imageData) {
        showToast('Please upload an image first', 'error');
        return;
    }

    const user = AuthManager.getUser();
    
    // Check daily limit for non-logged-in users
    if (!user) {
        const canConvert = checkDailyLimit();
        if (!canConvert) {
            showToast('Daily limit reached!', 'You have used all 5 free conversions today. Please login to continue.', 'error');
            setTimeout(() => {
                showLoginModal();
            }, 1500);
            return;
        }
    }

    const btn = document.getElementById('processBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Processing...';

    try {
        if (user) {
            // Logged-in user - use BACKEND OCR and save to database
            console.log('Using backend OCR for logged-in user');
            
            const formData = new FormData();
            formData.append('image', converterState.imageFile);
            formData.append('user_id', user.user_id);
            
            const response = await fetch(`${API_BASE_URL}/ocr`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            console.log('Backend response:', data);
            
            if (response.ok && data.success) {
                document.getElementById('extractedText').value = data.text;
                await HistoryManager.updateHistoryButton();
                showToast('Text extracted and saved to database!', 'success');
            } else {
                throw new Error(data.error || 'Backend processing failed');
            }
        } else {
            // Non-logged-in user - use CLIENT-SIDE OCR (no database save)
            console.log('Using client-side OCR for guest user');
            
            const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/+esm');
            const worker = await createWorker('eng');
            const { data: { text } } = await worker.recognize(converterState.imageData);
            await worker.terminate();

            document.getElementById('extractedText').value = text;
            
            // Increment usage count
            incrementDailyUsage();
            updateDailyLimitBanner();
            const remaining = getRemainingConversions();
            
            if (remaining > 0) {
                showToast('Text extracted!', `${remaining} free conversion${remaining > 1 ? 's' : ''} remaining today. Login for unlimited access.`, 'success');
            } else {
                showToast('Text extracted!', 'This was your last free conversion today. Login for unlimited access.', 'success');
                setTimeout(() => {
                    showLoginModal();
                }, 2000);
            }
        }
    } catch (error) {
        console.error('OCR Error:', error);
        
        // Fallback to client-side OCR if backend fails
        if (user) {
            console.log('Backend failed, falling back to client-side OCR');
            try {
                const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/+esm');
                const worker = await createWorker('eng');
                const { data: { text } } = await worker.recognize(converterState.imageData);
                await worker.terminate();

                document.getElementById('extractedText').value = text;
                
                // Save to localStorage as fallback
                const item = {
                    id: Date.now().toString(),
                    text: text,
                    fileName: converterState.imageFile?.name || 'Untitled',
                    timestamp: Date.now()
                };
                
                const history = JSON.parse(localStorage.getItem('ocr-history') || '[]');
                const updated = [item, ...history].slice(0, 20);
                localStorage.setItem('ocr-history', JSON.stringify(updated));
                
                await HistoryManager.updateHistoryButton();
                showToast('Text extracted!', 'Saved locally - backend not connected', 'success');
            } catch (fallbackError) {
                showToast('Failed to process image', fallbackError.message, 'error');
            }
        } else {
            showToast('Failed to process image', error.message, 'error');
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 Process';
    }
}

// Daily Limit Functions for Non-Logged-In Users
function checkDailyLimit() {
    const today = new Date().toDateString();
    const usageData = JSON.parse(localStorage.getItem('daily-usage') || '{}');
    
    // Reset if it's a new day
    if (usageData.date !== today) {
        return true;
    }
    
    // Check if limit reached
    return (usageData.count || 0) < 5;
}

function incrementDailyUsage() {
    const today = new Date().toDateString();
    const usageData = JSON.parse(localStorage.getItem('daily-usage') || '{}');
    
    if (usageData.date !== today) {
        // New day, reset count
        localStorage.setItem('daily-usage', JSON.stringify({
            date: today,
            count: 1
        }));
    } else {
        // Increment count
        usageData.count = (usageData.count || 0) + 1;
        localStorage.setItem('daily-usage', JSON.stringify(usageData));
    }
}

function getRemainingConversions() {
    const today = new Date().toDateString();
    const usageData = JSON.parse(localStorage.getItem('daily-usage') || '{}');
    
    if (usageData.date !== today) {
        return 5;
    }
    
    return Math.max(0, 5 - (usageData.count || 0));
}

function getDailyUsageInfo() {
    const today = new Date().toDateString();
    const usageData = JSON.parse(localStorage.getItem('daily-usage') || '{}');
    
    if (usageData.date !== today) {
        return { used: 0, remaining: 5, total: 5 };
    }
    
    const used = usageData.count || 0;
    return {
        used: used,
        remaining: Math.max(0, 5 - used),
        total: 5
    };
}

function copyText() {
    const text = document.getElementById('extractedText').value;
    if (!text) {
        showToast('No text to copy', 'error');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        showToast('Text copied to clipboard!', 'success');
    });
}

function saveAs() {
    const text = document.getElementById('extractedText').value;
    if (!text) {
        showToast('No text to save', 'error');
        return;
    }

    if (window.showSaveFilePicker) {
        window.showSaveFilePicker({
            suggestedName: `ink2text-${new Date().toISOString().slice(0, 10)}.txt`,
            types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }]
        }).then(async (handle) => {
            const writable = await handle.createWritable();
            await writable.write(text);
            await writable.close();
            showToast('File saved successfully!', 'success');
        }).catch(err => {
            if (err.name !== 'AbortError') {
                downloadText();
            }
        });
    } else {
        downloadText();
    }
}

function downloadText() {
    const text = document.getElementById('extractedText').value;
    if (!text) {
        showToast('No text to download', 'error');
        return;
    }

    const element = document.createElement('a');
    element.href = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
    element.download = `ink2text-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast('Text downloaded!', 'success');
}

function resetConverter() {
    converterState.imageFile = null;
    converterState.imageData = null;
    imageInput.value = '';
    imagePreview.style.display = 'none';
    document.getElementById('extractedText').value = '';
}

async function toggleHistory() {
    const user = AuthManager.getUser();
    if (!user) {
        showLoginModal();
        return;
    }
    
    const historyPanel = document.getElementById('historyPanel');
    historyPanel.classList.toggle('show');

    if (historyPanel.classList.contains('show')) {
        // Show loading
        historyPanel.innerHTML = '<p style="text-align: center; color: var(--muted-foreground); padding: 20px;">Loading history...</p>';
        
        const history = await HistoryManager.getHistory();
        
        if (history.length === 0) {
            historyPanel.innerHTML = '<p style="text-align: center; color: var(--muted-foreground); padding: 20px;">No history yet. Start converting images!</p>';
            return;
        }

        historyPanel.innerHTML = history.map(item => {
            const itemId = item.document_id || item.id;
            const fileName = item.file_name || item.fileName;
            const text = item.text || item.extracted_text || '';
            const timestamp = item.uploaded_at || new Date(item.timestamp).toLocaleDateString();
            
            return `
                <div class="history-item" onclick="HistoryManager.loadFromHistory('${itemId}')">
                    <div class="history-item-name">${escapeHtml(fileName)}</div>
                    <div class="history-item-preview">${escapeHtml(text.slice(0, 50))}...</div>
                    <div class="history-item-time">${timestamp}</div>
                </div>
            `;
        }).join('') + '<button onclick="HistoryManager.clearHistory(); toggleHistory()" style="width: 100%; margin-top: 10px; background: #ff6b6b; color: white; border: none; padding: 10px; border-radius: 6px; cursor: pointer;">Clear All History</button>';
    }
}

// Login Modal Functions
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.add('show');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('show');
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('loginModal');
    if (event.target === modal) {
        closeLoginModal();
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setActiveNav(link) {
    document.querySelectorAll('.nav-links a')
        .forEach(a => a.classList.remove('active'));
    link.classList.add('active');
}


// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    AuthManager.updateUI();
    HistoryManager.updateHistoryButton(); // Initialize history button state
    
    // Update daily limit banner if on converter page
    const converterPage = document.getElementById('converter');
    if (converterPage && converterPage.classList.contains('active')) {
        updateDailyLimitBanner();
    }
});
