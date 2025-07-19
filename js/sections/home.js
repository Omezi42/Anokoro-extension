// js/sections/home.js
export function initialize() {
    // 初期化済みフラグをチェック
    if (document.body.dataset.homeInitialized === 'true') return;
    document.body.dataset.homeInitialized = 'true';

    console.log("Home section initialized.");

    // ブラウザAPIの互換性を確保
    // const a = (typeof browser !== "undefined") ? browser : chrome; // 削除

    // DOM要素を取得
    const homeLoginStatus = document.getElementById('home-login-status');
    const homeLoginButton = document.getElementById('home-login-button');
    const homeLogoutButton = document.getElementById('home-logout-button');

    // ログイン状態に応じてUIを更新する関数
    const updateLoginStatusUI = () => {
        // window.tcgAssistantはmain.jsでグローバルに定義されていると仮定
        const { currentUserId, currentUsername } = window.tcgAssistant;
        if (currentUserId && currentUsername) {
            if (homeLoginStatus) homeLoginStatus.innerHTML = `現在、<strong>${currentUsername}</strong> としてログイン中。`;
            if (homeLoginButton) homeLoginButton.style.display = 'none';
            if (homeLogoutButton) homeLogoutButton.style.display = 'inline-block';
        } else {
            if (homeLoginStatus) homeLoginStatus.innerHTML = 'ログインしていません。レート戦機能を利用するにはログインが必要です。';
            if (homeLoginButton) homeLoginButton.style.display = 'inline-block';
            if (homeLogoutButton) homeLogoutButton.style.display = 'none';
        }
    };

    // イベントリスナーを設定
    if (homeLoginButton) {
        // window.toggleSidebar は main.js でグローバルに定義されているためそのまま使用
        homeLoginButton.addEventListener('click', () => window.toggleSidebar('rateMatch', true));
    }
    if (homeLogoutButton) {
        homeLogoutButton.addEventListener('click', () => {
            // rateMatch.jsで定義されたグローバル関数を呼び出す
            // window.handleRateMatchLogout は rateMatch.js がロードされたときにグローバルに設定されると仮定
            if (window.handleRateMatchLogout) {
                window.handleRateMatchLogout();
            }
        });
    }

    // ログイン状態の変更を監視
    // loginStateChanged イベントは main.js や rateMatch.js からディスパッチされると仮定
    document.addEventListener('loginStateChanged', updateLoginStatusUI);
    // 初期表示を更新
    updateLoginStatusUI();
}