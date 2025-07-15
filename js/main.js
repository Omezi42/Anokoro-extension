// js/main.js

console.log("main.js: Script loaded for web version.");

// グローバル変数定義
window.allCards = []; // 全カードデータ
let isSidebarOpen = true; // サイドバーの開閉状態

// ログイン関連のグローバル変数
window.currentRate = 1500;
window.currentUsername = null;
window.currentUserId = null;
window.userMatchHistory = [];
window.userMemos = [];
window.userBattleRecords = [];
window.userRegisteredDecks = [];
window.ws = null;

// スクリプト注入追跡用
if (!window._injectedSectionScripts) {
    window._injectedSectionScripts = new Set();
}

/**
 * カスタムアラート/確認ダイアログを表示します。
 * （省略）
 */
window.showCustomDialog = function(title, message, isConfirm = false) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('tcg-custom-dialog-overlay');
        const dialogTitle = document.getElementById('tcg-dialog-title');
        const dialogMessage = document.getElementById('tcg-dialog-message');
        const buttonsWrapper = document.getElementById('tcg-dialog-buttons');

        if (!overlay || !dialogTitle || !dialogMessage || !buttonsWrapper) {
            console.error("Custom dialog elements not found.");
            return resolve(false);
        }

        dialogTitle.textContent = title;
        dialogMessage.innerHTML = message;
        buttonsWrapper.innerHTML = '';

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.addEventListener('click', () => {
            overlay.classList.remove('show');
            resolve(true);
        });
        buttonsWrapper.appendChild(okButton);

        if (isConfirm) {
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'キャンセル';
            cancelButton.addEventListener('click', () => {
                overlay.classList.remove('show');
                resolve(false);
            });
            buttonsWrapper.appendChild(cancelButton);
        }

        overlay.classList.add('show');
    });
};

/**
 * カード詳細モーダルを表示します。
 * （省略）
 */
window.showCardDetailModal = function(card, currentIndex, searchResults) {
    // この関数の内容は変更なしのため省略
};

/**
 * コンテンツエリア（サイドバー）の表示/非表示を切り替えます。
 * （省略）
 */
window.toggleContentArea = function(sectionId, forceOpen = false) {
    const contentArea = document.getElementById('tcg-content-area');
    if (!contentArea) {
        console.error("toggleContentArea: UI elements not found.");
        return;
    }

    const isCurrentlyOpen = !contentArea.classList.contains('closed');
    const currentActiveSection = document.querySelector('.tcg-menu-icon.active')?.dataset.section;
    
    if (forceOpen) {
        if (!isCurrentlyOpen) {
            contentArea.classList.remove('closed');
            isSidebarOpen = true;
        }
        if(sectionId) window.showSection(sectionId);
    } else {
        if (isCurrentlyOpen && currentActiveSection === sectionId) {
            contentArea.classList.add('closed');
            isSidebarOpen = false;
        } else if (isCurrentlyOpen && sectionId) {
            window.showSection(sectionId);
        } else if (!isCurrentlyOpen) {
            contentArea.classList.remove('closed');
            isSidebarOpen = true;
            const targetSection = sectionId || currentActiveSection || 'home';
            window.showSection(targetSection);
        } else if (isCurrentlyOpen && !sectionId) {
             contentArea.classList.add('closed');
             isSidebarOpen = false;
        }
    }
    
    localStorage.setItem('isSidebarOpen', isSidebarOpen);
};


/**
 * 指定されたセクションを表示し、他のセクションを非表示にします。
 * @param {string} sectionId - 表示するセクションのID。
 */
window.showSection = async function(sectionId) {
    if (!sectionId) {
        console.error("showSection called with null or undefined sectionId. Aborting.");
        return;
    }
    console.log(`showSection: Attempting to show section: ${sectionId}`);
    
    document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
        icon.classList.toggle('active', icon.dataset.section === sectionId);
    });

    document.querySelectorAll('.tcg-section').forEach(section => {
        section.classList.remove('active');
    });

    const sectionsWrapper = document.getElementById('tcg-sections-wrapper');
    let targetSection = document.getElementById(`tcg-${sectionId}-section`);

    if (!targetSection) {
        targetSection = document.createElement('div');
        targetSection.id = `tcg-${sectionId}-section`;
        targetSection.className = 'tcg-section';
        sectionsWrapper.appendChild(targetSection);
    }

    if (targetSection.innerHTML.trim() === '') {
        try {
            // ★★★ エラー修正箇所 ★★★
            // パスを `./` から始めることで、現在のHTMLからの相対パスであることを明示します。
            // これにより、GitHub Pagesのようなサブディレクトリでのホスティングでも安定して動作します。
            const htmlPath = `./html/sections/${sectionId}.html`;
            const response = await fetch(htmlPath);
            if (!response.ok) {
                throw new Error(`HTML fetch failed: ${response.statusText}`);
            }
            targetSection.innerHTML = await response.text();
        } catch (error) {
            console.error(`Error loading HTML for section ${sectionId}:`, error);
            targetSection.innerHTML = `<p style="color: red;">セクションの読み込みに失敗しました: ${error.message}</p>`;
            targetSection.classList.add('active');
            return;
        }
    }

    targetSection.classList.add('active');
    localStorage.setItem('activeSection', sectionId);

    const initFunctionName = `init${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}Section`;
    const jsPath = `js/sections/${sectionId}.js`;
    
    if (window._injectedSectionScripts.has(jsPath)) {
        if (typeof window[initFunctionName] === 'function') {
            console.log(`Re-initializing section ${sectionId}`);
            window[initFunctionName]();
        }
    } else {
        const script = document.createElement('script');
        script.src = jsPath;
        script.onload = () => {
            console.log(`Script ${jsPath} loaded.`);
            window._injectedSectionScripts.add(jsPath);
            if (typeof window[initFunctionName] === 'function') {
                window[initFunctionName]();
            }
        };
        script.onerror = () => console.error(`Failed to load script: ${jsPath}`);
        document.body.appendChild(script);
    }
};

/**
 * イベントリスナーを設定します。
 * （省略）
 */
function attachEventListeners() {
    document.getElementById('tcg-menu-toggle-bird').addEventListener('click', () => {
        window.toggleContentArea(null, false);
    });

    document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            window.toggleContentArea(sectionId, false);
        });
    });
}

/**
 * 拡張機能のコア機能を初期化します。
 * （省略）
 */
async function initializeExtensionFeatures() {
    console.log("main.js: Initializing extension features...");
    try {
        const response = await fetch('json/cards.json');
        window.allCards = await response.json();
        console.log(`main.js: ${window.allCards.length} cards loaded.`);
    } catch (error) {
        console.error("main.js: Failed to load card data:", error);
        window.showCustomDialog('エラー', `カードデータの読み込みに失敗しました: ${error.message}`);
    }

    const lastSection = localStorage.getItem('activeSection') || 'home';
    const isSidebarOpen = localStorage.getItem('isSidebarOpen') !== 'false';

    if (isSidebarOpen) {
        window.toggleContentArea(lastSection, true);
    } else {
        const contentArea = document.getElementById('tcg-content-area');
        contentArea.classList.add('closed');
        document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
            icon.classList.toggle('active', icon.dataset.section === lastSection);
        });
    }
}

// --- 実行開始 ---
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    initializeExtensionFeatures();
});
