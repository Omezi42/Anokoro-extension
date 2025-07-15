// app.js (Webアプリ版)

document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');
    const mainNav = document.getElementById('main-nav');

    // グローバルなカードデータを保持
    window.allCards = [];

    /**
     * 指定されたセクションのHTMLとJSを読み込んで表示する
     * @param {string} sectionName - ロードするセクション名
     */
    const loadSection = async (sectionName) => {
        // ナビゲーションのアクティブ状態を更新
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionName);
        });

        try {
            // HTMLをフェッチしてコンテンツエリアに挿入
            const response = await fetch(`./html/${sectionName}.html`);
            if (!response.ok) throw new Error('HTMLの読み込みに失敗しました。');
            contentArea.innerHTML = await response.text();

            // 対応するJSの初期化関数を呼び出す
            const initFunctionName = `init${sectionName.charAt(0).toUpperCase() + sectionId.slice(1)}Section`;
            if (typeof window[initFunctionName] === 'function') {
                window[initFunctionName]();
            }

        } catch (error) {
            console.error(`Error loading section ${sectionName}:`, error);
            contentArea.innerHTML = `<h2 class="section-title">エラー</h2><p>コンテンツの読み込みに失敗しました。</p>`;
        }
    };

    /**
     * ナビゲーションのクリックイベントを処理
     */
    mainNav.addEventListener('click', (e) => {
        const navLink = e.target.closest('.nav-link');
        if (navLink) {
            e.preventDefault();
            const sectionName = navLink.dataset.section;
            window.location.hash = sectionName; // URLのハッシュを更新
        }
    });

    /**
     * URLハッシュの変更を監視してセクションを切り替える
     */
    const handleHashChange = () => {
        const sectionName = window.location.hash.substring(1) || 'home';
        loadSection(sectionName);
    };

    /**
     * アプリケーションの初期化
     */
    const initializeApp = async () => {
        try {
            const response = await fetch('cards.json');
            if (!response.ok) throw new Error('cards.jsonの読み込みに失敗しました。');
            window.allCards = await response.json();
            console.log(`${window.allCards.length} cards loaded.`);
            
            // URLハッシュに基づいて初期セクションをロード
            handleHashChange();
        } catch (error) {
            console.error("Failed to initialize app:", error);
            contentArea.innerHTML = `<h2 class="section-title">重大なエラー</h2><p>アプリケーションの初期化に失敗しました。cards.jsonが正しく配置されているか確認してください。</p>`;
        }
    };

    // イベントリスナーを設定
    window.addEventListener('hashchange', handleHashChange);

    // アプリケーションを初期化
    initializeApp();
});

// グローバルなヘルパー関数 (各セクションのJSから呼び出される)
// (showCustomDialog, showCardDetailModal などをここに配置)
