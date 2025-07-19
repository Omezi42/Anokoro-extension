// js/main.js

(async () => {
    // スクリプトが複数回実行されるのを防ぐ
    if (window.tcgAssistantInitialized) {
        return;
    }
    window.tcgAssistantInitialized = true;

    console.log("main.js: Script loaded and initializing.");

    // --- グローバルスコープのセットアップ ---
    window.tcgAssistant = {
        allCards: [],
        trivia: [],
        isSidebarOpen: false,
        uiInjected: false,
        currentRate: 1500,
        currentUsername: null,
        currentUserId: null,
        userMatchHistory: [],
        userMemos: [],
        userBattleRecords: [],
        userRegisteredDecks: [],
        ws: null,
        activeSection: 'home',
        // 画像取得用のヘルパー関数をWeb互換に修正
        fetchImage: async (url) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    try {
                        resolve(canvas.toDataURL());
                    } catch (e) {
                        console.error(`Failed to convert image to Data URL: ${url}`, e);
                        resolve(url);
                    }
                };
                img.onerror = (e) => {
                    console.error(`Failed to load image: ${url}`, e);
                    reject(new Error(`Failed to load image: ${url}`));
                };
                img.src = url;
                img.crossOrigin = "Anonymous";
            });
        }
    };

    // --- 共通関数の定義 ---
    const injectResources = () => { /* CSSが直接リンクされるため内容は空 */ };

    window.showCustomDialog = (title, message, isConfirm = false) => {
        return new Promise((resolve) => {
            const overlay = document.getElementById('tcg-custom-dialog-overlay');
            if (!overlay) return resolve(false);
            const dialogTitle = overlay.querySelector('#tcg-dialog-title');
            const dialogMessage = overlay.querySelector('#tcg-dialog-message');
            const buttonsWrapper = overlay.querySelector('#tcg-dialog-buttons');
            dialogTitle.textContent = title;
            dialogMessage.innerHTML = message;
            buttonsWrapper.innerHTML = '';
            const okButton = document.createElement('button');
            okButton.textContent = isConfirm ? 'はい' : 'OK';
            okButton.onclick = () => { overlay.classList.remove('show'); resolve(true); };
            buttonsWrapper.appendChild(okButton);
            if (isConfirm) {
                const cancelButton = document.createElement('button');
                cancelButton.textContent = 'キャンセル';
                cancelButton.onclick = () => { overlay.classList.remove('show'); resolve(false); };
                buttonsWrapper.appendChild(cancelButton);
            }
            overlay.classList.add('show');
        });
    };

    window.showCardDetailModal = async (card, currentIndex, searchResults) => {
        if (!card) return;
        const existingModal = document.getElementById('tcg-card-detail-modal-overlay');
        if (existingModal) existingModal.remove();

        const cardImageUrl = await window.tcgAssistant.fetchImage(`https://omezi42.github.io/tcg-assistant-images/cards/${encodeURIComponent(card.name)}.png`) || 'https://placehold.co/200x280/eee/333?text=No+Image';

        const getInfo = (prefix) => card.info.find(i => i.startsWith(prefix))?.replace(prefix, '').replace('です。', '') || 'N/A';
        const getEffect = () => card.info.find(i => i.startsWith("このカードの効果は、「"))?.replace("このカードの効果は、「", "").replace("」です。", "") || '（効果なし）';
        const getLore = () => card.info.find(i => i.startsWith("このカードの世界観は、「"))?.replace("このカードの世界観は、「", "").replace("」です。", "");

        const modalHtml = `
            <div class="tcg-card-detail-modal-content">
                <button id="tcg-card-detail-close-button" title="閉じる">&times;</button>
                <div class="card-preview-pane">
                     <img src="${cardImageUrl}" alt="${card.name}">
                </div>
                <div class="card-info-pane">
                    <div class="card-info-header">
                        <div class="card-info-cost">${getInfo("このカードのコストは")}</div>
                        <h2>${card.name}</h2>
                    </div>
                    <div class="card-info-body">
                        <p class="card-info-effect">${getEffect()}</p>
                    </div>
                    <div class="card-info-footer">
                        <button id="lore-button" ${getLore() ? '' : 'style="display:none;"'}>世界観</button>
                        <div class="nav-buttons">
                            <button id="prev-card-button" ${currentIndex > 0 ? '' : 'disabled'}>前</button>
                            <button id="next-card-button" ${currentIndex < searchResults.length - 1 ? '' : 'disabled'}>次</button>
                        </div>
                    </div>
                </div>
            </div>`;

        const overlay = document.createElement('div');
        overlay.id = 'tcg-card-detail-modal-overlay';
        overlay.innerHTML = modalHtml;
        document.body.appendChild(overlay);

        const closeModal = () => overlay.remove();
        overlay.querySelector('#tcg-card-detail-close-button').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

        const loreButton = overlay.querySelector('#lore-button');
        if (loreButton) {
            loreButton.addEventListener('click', () => {
                const effectDisplay = overlay.querySelector('.card-info-effect');
                const isShowingEffect = loreButton.textContent === '世界観';
                effectDisplay.textContent = isShowingEffect ? getLore() : getEffect();
                loreButton.textContent = isShowingEffect ? '効果' : '世界観';
            });
        }

        const prevButton = overlay.querySelector('#prev-card-button');
        if (prevButton && !prevButton.disabled) {
            prevButton.addEventListener('click', () => window.showCardDetailModal(searchResults[currentIndex - 1], currentIndex - 1, searchResults));
        }

        const nextButton = overlay.querySelector('#next-card-button');
        if (nextButton && !nextButton.disabled) {
            nextButton.addEventListener('click', () => window.showCardDetailModal(searchResults[currentIndex + 1], currentIndex + 1, searchResults));
        }

        setTimeout(() => overlay.classList.add('show'), 10);
    };

    window.showSection = async (sectionId) => {
        if (!sectionId) return;
        window.tcgAssistant.activeSection = sectionId;
        localStorage.setItem('activeSection', sectionId);

        document.querySelectorAll('.tcg-menu-icon').forEach(icon => icon.classList.toggle('active', icon.dataset.section === sectionId));
        document.querySelectorAll('.tcg-section').forEach(section => section.classList.remove('active'));

        const sectionsWrapper = document.getElementById('tcg-sections-wrapper');
        let targetSection = document.getElementById(`tcg-${sectionId}-section`);

        if (!targetSection) {
            targetSection = document.createElement('div');
            targetSection.id = `tcg-${sectionId}-section`;
            targetSection.className = 'tcg-section';
            sectionsWrapper.appendChild(targetSection);
        }

        const loadAndInit = async () => {
            try {
                const modulePath = `./sections/${sectionId}.js`;
                const htmlPath = `./html/sections/${sectionId}.html`;

                const htmlResponse = await fetch(htmlPath);
                if (!htmlResponse.ok) throw new Error(`HTML fetch failed: ${htmlResponse.statusText}`);
                targetSection.innerHTML = await htmlResponse.text();

                try {
                    const sectionModule = await import(modulePath);
                    if (sectionModule && typeof sectionModule.initialize === 'function') {
                        sectionModule.initialize();
                    }
                } catch (moduleError) {
                    if (moduleError instanceof TypeError && moduleError.message.includes('Failed to fetch dynamically imported module')) {
                        console.warn(`No JS module found for section: ${sectionId}. This might be intended.`);
                    } else {
                        console.error(`Error loading JS module for ${sectionId}:`, moduleError);
                    }
                }

            } catch (error) {
                targetSection.innerHTML = `<p style="color: red;">セクションの読み込みに失敗しました。</p>`;
                console.error(`Error loading section ${sectionId}:`, error);
            }
        };

        if (targetSection.innerHTML.trim() === '') {
            await loadAndInit();
        } else {
            const modulePath = `./sections/${sectionId}.js`;
            try {
                const sectionModule = await import(modulePath);
                if (sectionModule && typeof sectionModule.initialize === 'function') {
                    sectionModule.initialize();
                }
            } catch (moduleError) {
                if (moduleError instanceof TypeError && moduleError.message.includes('Failed to fetch dynamically imported module')) {
                    // 想定される挙動
                } else {
                    console.error(`Error re-initializing JS module for ${sectionId}:`, moduleError);
                }
            }
        }

        targetSection.classList.add('active');
    };

    window.toggleSidebar = (sectionId = null, forceOpen = false) => {
        const contentArea = document.getElementById('tcg-content-area');
        const birdToggle = document.getElementById('tcg-menu-toggle-bird');
        if (!contentArea || !birdToggle) return;
        
        const shouldOpen = forceOpen || !window.tcgAssistant.isSidebarOpen;
        window.tcgAssistant.isSidebarOpen = shouldOpen;
        
        contentArea.classList.toggle('active', shouldOpen);
        birdToggle.classList.toggle('open', shouldOpen);
        
        // bodyにsidebar-openクラスを付与/削除して背景スクロールを制御
        document.body.classList.toggle('sidebar-open', shouldOpen);

        localStorage.setItem('isSidebarOpen', shouldOpen.toString());
        if (shouldOpen) {
            window.showSection(sectionId || window.tcgAssistant.activeSection);
        }
    };

    window.applyTheme = (themeName) => {
        document.body.classList.remove('theme-default', 'theme-dark');
        document.body.classList.add(`theme-${themeName}`);
        console.log(`Applied theme: ${themeName}`);
    };

    const injectUI = async () => {
        if (window.tcgAssistant.uiInjected) return;
        const uiRoot = document.getElementById('tcg-extension-root') || document.body;

        const birdImageUrl = './images/illust_桜小鳥.png';
        const uiHtml = `
            <div id="tcg-content-area">
                <div id="tcg-sidebar-header">
                    <button class="tcg-menu-icon" data-section="home" title="ホーム"><i class="fas fa-home"></i></button>
                    <button class="tcg-menu-icon" data-section="rateMatch" title="レート戦"><i class="fas fa-fist-raised"></i></button>
                    <button class="tcg-menu-icon" data-section="battleRecord" title="戦いの記録"><i class="fas fa-trophy"></i></button>
                    <button class="tcg-menu-icon" data-section="memo" title="メモ"><i class="fas fa-clipboard"></i></button>
                    <button class="tcg-menu-icon" data-section="search" title="検索"><i class="fas fa-search"></i></button>
                    <button class="tcg-menu-icon" data-section="minigames" title="ミニゲーム"><i class="fas fa-gamepad"></i></button>
                    <button class="tcg-menu-icon" data-section="options" title="設定"><i class="fas fa-cog"></i></button>
                </div>
                <div id="tcg-sections-wrapper"></div>
            </div>
            <div id="tcg-bird-container">
                <div id="tcg-menu-toggle-bird" style="background-image: url('${birdImageUrl}')" title="アシスタントメニュー"></div>
                <div id="tcg-bird-speech-bubble" class="hidden"></div>
            </div>
            <div id="tcg-custom-dialog-overlay">
                <div class="tcg-modal-content">
                    <h3 id="tcg-dialog-title"></h3>
                    <p id="tcg-dialog-message"></p>
                    <div class="dialog-buttons" id="tcg-dialog-buttons"></div>
                </div>
            </div>`;
        uiRoot.insertAdjacentHTML('beforeend', uiHtml);
        window.tcgAssistant.uiInjected = true;
        attachEventListeners();
        await initializeFeatures();

        const savedTheme = localStorage.getItem('selectedTheme') || 'default';
        console.log("Applying initial theme from storage:", savedTheme);
        window.applyTheme(savedTheme);
    };

    const attachEventListeners = () => {
        const birdContainer = document.getElementById('tcg-bird-container');
        const birdToggle = document.getElementById('tcg-menu-toggle-bird');
        let isDragging = false, wasDragged = false;
        let offsetX, offsetY;
        let clickTimer = null;
        const DBLCLICK_DELAY = 300;

        birdToggle.addEventListener('mousedown', (e) => {
            isDragging = true;
            wasDragged = false;
            birdToggle.classList.add('is-dragging');
            const rect = birdContainer.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                wasDragged = true;
                let newX = e.clientX - offsetX;
                let newY = e.clientY - offsetY;

                newX = Math.max(0, Math.min(newX, window.innerWidth - birdContainer.offsetWidth));
                newY = Math.max(0, Math.min(newY, window.innerHeight - birdContainer.offsetHeight));

                birdContainer.style.left = `${newX}px`;
                birdContainer.style.top = `${newY}px`;
                birdContainer.style.right = 'auto';
                birdContainer.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                birdToggle.classList.remove('is-dragging');
                localStorage.setItem('birdPosition', JSON.stringify({ top: birdContainer.style.top, left: birdContainer.style.left }));
            }
        });

        birdToggle.addEventListener('click', (e) => {
            if (wasDragged) {
                e.stopPropagation();
                wasDragged = false;
                return;
            }

            if (clickTimer === null) {
                clickTimer = setTimeout(() => {
                    window.toggleSidebar();
                    clickTimer = null;
                }, DBLCLICK_DELAY);
            } else {
                clearTimeout(clickTimer);
                clickTimer = null;
                showRandomChatter();
            }
        });

        document.querySelectorAll('.tcg-menu-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const sectionId = e.currentTarget.dataset.section;
                const contentArea = document.getElementById('tcg-content-area');
                if (contentArea.classList.contains('active') && window.tcgAssistant.activeSection === sectionId) {
                    window.toggleSidebar();
                } else {
                    window.toggleSidebar(sectionId, true);
                }
            });
        });

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SHOW_SECTION') {
                window.showSection(event.data.section, event.data.forceOpenSidebar);
            } else if (event.data && event.data.type === 'APPLY_THEME') {
                window.applyTheme(event.data.theme);
            }
        });
    };

    const showChatter = (html, answerCardName = null) => {
        const bubble = document.getElementById('tcg-bird-speech-bubble');
        if (!bubble) return;
        const container = document.getElementById('tcg-bird-container');
        const containerRect = container.getBoundingClientRect();
        
        bubble.classList.remove('align-left', 'align-right'); // 毎回リセットしてから適用
        if (containerRect.left + (containerRect.width / 2) < window.innerWidth / 2) {
            bubble.classList.add('align-left');
        } else {
            bubble.classList.add('align-right');
        }

        bubble.innerHTML = html;
        bubble.classList.remove('hidden');
        const hideBubble = () => { bubble.classList.add('hidden'); bubble.onclick = null; };
        if (answerCardName) {
            bubble.onclick = () => {
                bubble.innerHTML = `正解は「<strong>${answerCardName}</strong>」でした！<small>（クリックで閉じる）</small>`;
                bubble.onclick = hideBubble;
                setTimeout(hideBubble, 5000);
            };
        } else {
            bubble.onclick = hideBubble;
            setTimeout(hideBubble, 7000);
        }
    };

    const showLoreQuiz = () => {
        const cardsWithLore = window.tcgAssistant.allCards?.filter(c => c.info.some(i => i.startsWith("このカードの世界観は、「") && i.length > 20));
        if (!cardsWithLore || cardsWithLore.length === 0) return;
        const card = cardsWithLore[Math.floor(Math.random() * cardsWithLore.length)];
        const lore = card.info.find(i => i.startsWith("このカードの世界観は、「")).replace("このカードの世界観は、「", "").replace("」です。", "");
        showChatter(`「${lore}」<br>このカードはな～んだ？<small>（クリックで答えを見る）</small>`, card.name);
    };

    const showRandomChatter = () => {
        const { trivia, allCards } = window.tcgAssistant;
        if ((!allCards || allCards.length === 0) && (!trivia || trivia.length === 0)) return;
        if (Math.random() < 0.5 && trivia?.length > 0) {
            showChatter(trivia[Math.floor(Math.random() * trivia.length)]);
        } else if (allCards?.length > 0) {
            showLoreQuiz();
        }
    };

    const initializeFeatures = async () => {
        try {
            const cardResponse = await fetch('./json/cards.json');
            window.tcgAssistant.allCards = await cardResponse.json();
            const triviaResponse = await fetch('./json/trivia.json');
            window.tcgAssistant.trivia = await triviaResponse.json();
            document.dispatchEvent(new CustomEvent('cardsLoaded'));
        } catch (error) {
            window.showCustomDialog('エラー', `データ読み込みエラー: ${error.message}`);
        }

        const isSidebarOpen = localStorage.getItem('isSidebarOpen') === 'true';
        const activeSection = localStorage.getItem('activeSection') || 'home';
        const birdPosition = JSON.parse(localStorage.getItem('birdPosition') || '{}');

        window.tcgAssistant.activeSection = activeSection;
        const birdContainer = document.getElementById('tcg-bird-container');
        if (birdPosition?.top && birdPosition?.left) {
            birdContainer.style.top = birdPosition.top;
            birdContainer.style.left = birdPosition.left;
            birdContainer.style.right = 'auto';
            birdContainer.style.bottom = 'auto';
        } else {
            // デフォルト位置 (CSSで指定されているrightとbottomが適用される)
        }
        // 初期ロード時にsidebar-openクラスを適用しないように修正
        // body.classList.toggle('sidebar-open', isSidebarOpen); // ここは削除またはコメントアウト
        
        if (isSidebarOpen) {
            window.toggleSidebar(null, true);
        } else {
            document.querySelectorAll('.tcg-menu-icon').forEach(icon => icon.classList.toggle('active', icon.dataset.section === window.tcgAssistant.activeSection));
        }
        setInterval(showRandomChatter, 90000);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI);
    } else {
        injectUI();
    }
})();