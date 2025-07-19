// js/popup.js

document.addEventListener('DOMContentLoaded', () => {
    // FirefoxとChromeのAPI名前空間の互換性を確保
    // const a = (typeof browser !== "undefined") ? browser : chrome; // 削除
    // if (typeof a === "undefined" || typeof a.runtime === "undefined") { // 削除
    //     console.error("TCG Assistant Popup: Could not find browser/chrome runtime API."); // 削除
    //     return; // 削除
    // } // 削除

    const rateDisplay = document.getElementById('rate-display');
    const matchingCountDisplay = document.getElementById('matching-count-display');
    const goToGameButton = document.getElementById('go-to-game-button');
    const buttons = document.querySelectorAll('.popup-button');
    const optionsButton = document.getElementById('options-button');

    // レートとマッチング人数をストレージから取得して表示
    const updatePopupInfo = () => {
        // a.storage.local.get の代わりに localStorage を使用
        const currentRate = localStorage.getItem('currentRate') || '----';
        const matchingCount = localStorage.getItem('matchingCount');
        
        if (rateDisplay) {
            rateDisplay.textContent = currentRate;
        }
        if (matchingCountDisplay) {
            matchingCountDisplay.textContent = matchingCount !== null ? matchingCount : '--';
        }
    };

    // ストレージの変更を監視してUIをリアルタイムで更新
    // Web Storage API には onChanged リスナーがないため、カスタムイベントなどで代用が必要ですが、
    // ポップアップは通常、開かれるたびに情報を取得すれば十分なので、ここでは削除します。
    // a.storage.local.onChanged.addListener((changes, areaName) => { // 削除
    //     if (areaName === 'local' && (changes.currentRate || changes.matchingCount)) { // 削除
    //         updatePopupInfo(); // 削除
    //     } // 削除
    // }); // 削除

    // backgroundにメッセージを送るヘルパー
    const sendMessageToActiveTab = (message) => {
    console.log("Simulating message to active tab:", message);
    if (message.action === "noop") {
        // window.open の呼び出しを親ウィンドウが実行するように変更
        // Webページでは tabs.create の代わりに window.open を使う
        window.open("https://unityroom.com/games/anokorotcg", "_blank"); // 新しいタブでゲームページを開く
    } else if (message.action === "showSection") {
        // 親ウィンドウ (index.html) の showSection 関数を呼び出すために postMessage を使用
        window.parent.postMessage({ type: 'SHOW_SECTION', section: message.section, forceOpenSidebar: message.forceOpenSidebar }, '*');
    }
    // window.close(); // ポップアップを閉じる (GitHub Pagesでは実際にはタブを閉じないが、意図として残す)
};

    // 「ゲームへ」ボタン
    if (goToGameButton) {
        goToGameButton.addEventListener('click', () => {
            sendMessageToActiveTab({ action: "noop" });
            // window.close(); // ポップアップを閉じる
        });
    }

    // 各セクションボタン
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            sendMessageToActiveTab({ action: "showSection", section: section, forceOpenSidebar: true });
            // window.close(); // ポップアップを閉じる
        });
    });

    // 設定ボタン
    if (optionsButton) {
        optionsButton.addEventListener('click', () => {
            // a.runtime.openOptionsPage(); の代わりに新しいタブでオプションページを開く
            window.open("options.html", "_blank");
        });
    }

    // 初回表示時の情報更新
    updatePopupInfo();
});