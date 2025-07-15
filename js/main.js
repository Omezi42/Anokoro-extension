// js/main.js

console.log("main.js: Script loaded for web version.");

// グローバル変数定義
window.allCards = [];
let isSidebarOpen = true; 
window.currentRate = 1500;
window.currentUsername = null;
window.currentUserId = null;
window.userMatchHistory = [];
window.userMemos = [];
window.userBattleRecords = [];
window.userRegisteredDecks = [];
window.ws = null;
if (!window._injectedSectionScripts) {
    window._injectedSectionScripts = new Set();
}

/**
 * カスタムアラート/確認ダイアログを表示します。
 * @param {string} title - ダイアログのタイトル。
 * @param {string} message - ダイアログに表示するメッセージ。
 * @param {boolean} isConfirm - 確認ダイアログかどうか (trueの場合、OKとキャンセルボタンが表示されます)。
 * @returns {Promise<boolean>} - OKがクリックされた場合はtrue、キャンセルがクリックされた場合はfalseを解決するPromise。
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
        buttonsWrapper.innerHTML = ''; // ボタンをクリア

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
 * @param {object} card - 表示するカードのオブジェクト。
 * @param {number} currentIndex - 現在のカードの検索結果内でのインデックス。
 * @param {Array} searchResults - 現在の検索結果の全カード配列。
 */
window.showCardDetailModal = function(card, currentIndex, searchResults) {
    if (!card) {
        window.showCustomDialog('エラー', 'カード情報が見つかりません。');
        return;
    }

    const existingModal = document.getElementById('tcg-card-detail-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const cardImageUrl = `https://omezi42.github.io/tcg-assistant-images/cards/${encodeURIComponent(card.name)}.png`;
    
    const getInfo = (prefix) => card.info.find(i => i.startsWith(prefix))?.replace(prefix, '').replace('です。', '') || 'N/A';
    const getEffect = () => card.info.find(i => i.startsWith("このカードの効果は、「"))?.replace("このカードの効果は、「", "").replace("」です。", "") || '（効果なし）';
    const getLore = () => card.info.find(i => i.startsWith("このカードの世界観は、「"))?.replace("このカードの世界観は、「", "").replace("」です。", "");

    const cost = getInfo("このカードのコストは");
    const effect = getEffect();
    const lore = getLore();

    const modalHtml = `
        <div class="tcg-card-detail-modal-content">
            <div class="card-preview-pane">
                 <img src="${cardImageUrl}" alt="${card.name}" onerror="this.src='https://placehold.co/200x280/eee/333?text=No+Image'">
            </div>
            <div class="card-info-pane">
                <div class="card-info-header">
                    <div class="card-info-cost">${cost}</div>
                    <h2>${card.name}</h2>
                </div>
                <div class="card-info-body">
                    <p class="card-info-effect">${effect}</p>
                </div>
                <div class="card-info-footer">
                    <button id="lore-button" ${lore ? '' : 'style="display:none;"'}>世界観</button>
                    <div class="nav-buttons">
                        <button id="prev-card-button">前</button>
                        <button id="next-card-button">次</button>
                    </div>
                </div>
            </div>
            <button id="tcg-card-detail-close-button" title="閉じる">&times;</button>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.id = 'tcg-card-detail-modal-overlay';
    overlay.innerHTML = modalHtml;
    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.classList.remove('show');
        overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    };

    overlay.querySelector('#tcg-card-detail-close-button').addEventListener('click', closeModal);
    
    const loreButton = overlay.querySelector('#lore-button');
    const effectDisplay = overlay.querySelector('.card-info-effect');
    let isShowingLore = false;

    if (lore) {
        loreButton.addEventListener('click', () => {
            isShowingLore = !isShowingLore;
            effectDisplay.textContent = isShowingLore ? lore : effect;
            loreButton.textContent = isShowingLore ? '効果' : '世界観';
        });
    }

    const prevButton = overlay.querySelector('#prev-card-button');
    const nextButton = overlay.querySelector('#next-card-button');

    if (currentIndex > 0) {
        prevButton.addEventListener('click', () => {
            window.showCardDetailModal(searchResults[currentIndex - 1], currentIndex - 1, searchResults);
        });
    } else {
        prevButton.disabled = true;
    }

    if (currentIndex < searchResults.length - 1) {
        nextButton.addEventListener('click', () => {
            window.showCardDetailModal(searchResults[currentIndex + 1], currentIndex + 1, searchResults);
        });
    } else {
        nextButton.disabled = true;
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModal();
        }
    });

    setTimeout(() => overlay.classList.add('show'), 10);
};

/**
 * コンテンツエリア（サイドバー）の表示/非表示を切り替えます。
 */
window.toggleContentArea = function(sectionId, forceOpen = false) {
    const contentArea = document.getElementById('tcg-content-area');
    if (!contentArea) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
        // --- スマホ用のロジック ---
        const isCurrentlyOpen = contentArea.classList.contains('open');
        if (sectionId) {
            // セクションが指定された場合は、メニューを開いてセクションを表示
            if (!isCurrentlyOpen) {
                contentArea.classList.add('open');
            }
            window.showSection(sectionId);
        } else {
            // セクション指定なし（トグル操作）
            contentArea.classList.toggle('open');
        }
        isSidebarOpen = contentArea.classList.contains('open');
    } else {
        // --- PC用のロジック ---
        const isCurrentlyOpen = !contentArea.classList.contains('closed');
        const currentActiveSection = document.querySelector('.tcg-menu-icon.active')?.dataset.section;
        if (forceOpen) {
            if (!isCurrentlyOpen) contentArea.classList.remove('closed');
            if(sectionId) window.showSection(sectionId);
        } else {
            if (isCurrentlyOpen && currentActiveSection === sectionId) contentArea.classList.add('closed');
            else if (isCurrentlyOpen && sectionId) window.showSection(sectionId);
            else if (!isCurrentlyOpen) {
                contentArea.classList.remove('closed');
                window.showSection(sectionId || currentActiveSection || 'home');
            } 
            else if (isCurrentlyOpen && !sectionId) contentArea.classList.add('closed');
        }
        isSidebarOpen = !contentArea.classList.contains('closed');
        localStorage.setItem('isSidebarOpen', isSidebarOpen);
    }
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
 */
function attachEventListeners() {
    // PC用トグルボタン
    document.getElementById('tcg-menu-toggle-bird').addEventListener('click', () => {
        window.toggleContentArea(null, false);
    });

    // スマホ用ハンバーガーメニュー
    document.getElementById('hamburger-menu-button').addEventListener('click', () => {
        window.toggleContentArea(null, false);
    });
    
    // スマホ用閉じるボタン
    document.getElementById('close-menu-button').addEventListener('click', () => {
        window.toggleContentArea(null, false);
    });

    // 共通のメニューアイコン
    document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const sectionId = e.currentTarget.dataset.section;
            window.showSection(sectionId);
            // スマホ表示の場合、セクション選択後にメニューを閉じる
            if (window.innerWidth <= 768) {
                document.getElementById('tcg-content-area').classList.remove('open');
            }
        });
    });
}

/**
 * 拡張機能のコア機能を初期化します。
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
    const isSidebarOpen = localStorage.getItem('isSidebarOpen') !== 'false'; // デフォルトはtrue

    if (window.innerWidth > 768) {
        // PC表示の場合のみ、保存された状態を復元
        if (isSidebarOpen) {
            window.toggleContentArea(lastSection, true);
        } else {
            const contentArea = document.getElementById('tcg-content-area');
            contentArea.classList.add('closed');
            document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
                icon.classList.toggle('active', icon.dataset.section === lastSection);
            });
        }
    } else {
        // スマホ表示の場合は、常に閉じた状態で開始し、ホームを表示
        window.showSection('home');
    }
}

// --- 実行開始 ---
document.addEventListener('DOMContentLoaded', () => {
    attachEventListeners();
    initializeExtensionFeatures();
});
