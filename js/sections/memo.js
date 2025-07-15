// js/sections/memo.js

// グローバルなallCardsとshowCustomDialog関数を受け取るための初期化関数
window.initMemoSection = async function() {
    console.log("Memo section initialized for web version.");

    // === メモセクションのロジック ===
    const saveMemoButton = document.getElementById('save-memo-button');
    const memoTextArea = document.getElementById('memo-text-area');
    const savedMemosList = document.getElementById('saved-memos-list');
    const screenshotArea = document.getElementById('screenshot-area');
    const memoSearchInput = document.getElementById('memo-search-input');
    const memoSearchButton = document.getElementById('memo-search-button');
    let editingMemoIndex = -1; // 編集中のメモのインデックス

    // ユーザーのメモデータを保持するグローバル変数
    // rateMatch.jsからログイン時にセットされることを期待
    window.userMemos = window.userMemos || [];

    /**
     * 保存されたメモを読み込む関数 (サーバーまたはローカルストレージから)
     * @param {string} filterQuery - 検索フィルターのクエリ
     */
    const loadMemos = (filterQuery = '') => {
        if (!savedMemosList) return;

        // ログインしていない場合はローカルストレージから読み込む
        if (!window.currentUserId) {
            console.log("Memo: Not logged in. Displaying local memo data from localStorage.");
            // ★変更点: browser.storage.local.get を localStorage.getItem に変更
            const memosJSON = localStorage.getItem('savedMemosLocal');
            const memos = memosJSON ? JSON.parse(memosJSON) : [];
            displayMemos(memos, filterQuery, false); // ローカルストレージからの表示
            return;
        }

        // ログインしている場合はサーバーから取得したデータを使用
        console.log("Memo: Logged in. Loading memos from server data.");
        const memos = window.userMemos || []; // ログイン時にrateMatch.jsからセットされたデータを使用
        displayMemos(memos, filterQuery, true); // サーバーからの表示
    };

    /**
     * メモをUIに表示するヘルパー関数
     * @param {Array} memos - 表示するメモの配列
     * @param {string} filterQuery - 検索フィルターのクエリ
     * @param {boolean} isServerData - データがサーバーからのものか
     */
    const displayMemos = (memos, filterQuery, isServerData) => {
        if (!savedMemosList) return;
        savedMemosList.innerHTML = ''; // リストをクリア

        const filteredMemos = memos.filter(memo =>
            (memo.content && memo.content.toLowerCase().includes(filterQuery.toLowerCase())) ||
            (memo.timestamp && memo.timestamp.includes(filterQuery))
        );

        if (filteredMemos.length === 0) {
            savedMemosList.innerHTML = `<li>まだメモがありません。${isServerData ? '(ログイン済み)' : '(ローカル)'}</li>`;
        } else {
            // 新しいメモが常に先頭に来るように逆順に表示
            [...filteredMemos].reverse().forEach((memo) => {
                const originalIndex = memos.findIndex(m => m.timestamp === memo.timestamp && m.content === memo.content);
                const memoItem = document.createElement('li');
                memoItem.className = 'saved-memo-item';

                memoItem.innerHTML = `
                    <strong>${memo.timestamp}</strong>: ${memo.content}
                    <button class="delete-memo-button" data-original-index="${originalIndex}" title="削除"><i class="fas fa-trash-alt"></i></button>
                    <button class="edit-memo-button" data-original-index="${originalIndex}" title="編集"><i class="fas fa-edit"></i></button>
                    ${memo.screenshotUrl ? `<br><img src="${memo.screenshotUrl}" alt="スクリーンショット" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 5px;">` : ''}
                `;
                savedMemosList.appendChild(memoItem);
            });
            // イベントリスナーを設定
            savedMemosList.querySelectorAll('.delete-memo-button').forEach(button => {
                button.addEventListener('click', handleDeleteMemoClick);
            });
            savedMemosList.querySelectorAll('.edit-memo-button').forEach(button => {
                button.addEventListener('click', handleEditMemoClick);
            });
        }
    };

    /**
     * メモをサーバーに保存する関数
     * @param {Array} memosToSave - 保存するメモの配列
     */
    const saveMemosToServer = async (memosToSave) => {
        if (!window.currentUserId || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            console.warn("Memo: Not logged in or WebSocket not open. Cannot save memos to server.");
            await window.showCustomDialog('エラー', 'ログインしていないか、サーバーに接続していません。メモは保存されませんでした。');
            return;
        }
        window.userMemos = memosToSave; // グローバルデータを更新
        window.ws.send(JSON.stringify({
            type: 'update_user_data',
            userId: window.currentUserId,
            memos: window.userMemos
        }));
        await window.showCustomDialog('保存完了', 'メモをサーバーに保存しました！');
        loadMemos(memoSearchInput ? memoSearchInput.value.trim() : ''); // UIを再ロード
    };

    /**
     * メモをローカルストレージに保存する関数 (未ログイン時用)
     * @param {Array} memosToSave - 保存するメモの配列
     */
    const saveMemosLocally = (memosToSave) => {
        // ★変更点: browser.storage.local.set を localStorage.setItem に変更
        // オブジェクトはJSON文字列に変換して保存
        localStorage.setItem('savedMemosLocal', JSON.stringify(memosToSave));
        window.showCustomDialog('保存完了', 'メモをローカルに保存しました！');
        loadMemos(memoSearchInput ? memoSearchInput.value.trim() : '');
    };

    /**
     * メモを削除する関数 (サーバーまたはローカル)
     * @param {number} originalIndex - 削除するメモの元のインデックス
     */
    const deleteMemo = async (originalIndex) => {
        let memos = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            memos = window.userMemos || [];
        } else {
            // ★変更点: browser.storage.local.get を localStorage.getItem に変更
            const memosJSON = localStorage.getItem('savedMemosLocal');
            memos = memosJSON ? JSON.parse(memosJSON) : [];
        }

        if (originalIndex > -1 && originalIndex < memos.length) {
            memos.splice(originalIndex, 1);
            if (isUserLoggedIn) {
                await saveMemosToServer(memos);
            } else {
                saveMemosLocally(memos);
            }
            window.showCustomDialog('削除完了', 'メモを削除しました。');
        }
    };

    /**
     * メモを編集モードにする関数
     * @param {number} originalIndex - 編集するメモの元のインデックス
     */
    const editMemo = (originalIndex) => {
        if (!memoTextArea) return;

        let memos = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            memos = window.userMemos || [];
        } else {
            const memosJSON = localStorage.getItem('savedMemosLocal');
            memos = memosJSON ? JSON.parse(memosJSON) : [];
        }
        
        if (originalIndex > -1 && originalIndex < memos.length) {
            const memoToEdit = memos[originalIndex];
            memoTextArea.value = memoToEdit.content;
            if (memoToEdit.screenshotUrl && screenshotArea) {
                screenshotArea.innerHTML = `<img src="${memoToEdit.screenshotUrl}" alt="Screenshot">`;
            } else if (screenshotArea) {
                screenshotArea.innerHTML = '<p>スクリーンショットがここに表示されます。（画像をここに貼り付けることもできます - Ctrl+V / Cmd+V）</p>';
            }
            editingMemoIndex = originalIndex;
            window.showCustomDialog('メモ編集', 'メモを編集モードにしました。内容を変更して「メモを保存」ボタンを押してください。');
        }
    };

    // === イベントハンドラ関数 ===

    async function handleDeleteMemoClick(event) {
        const originalIndexToDelete = parseInt(event.currentTarget.dataset.originalIndex);
        const confirmed = await window.showCustomDialog('メモ削除', 'このメモを削除しますか？', true);
        if (confirmed) {
            await deleteMemo(originalIndexToDelete);
        }
    }

    function handleEditMemoClick(event) {
        const originalIndexToEdit = parseInt(event.currentTarget.dataset.originalIndex);
        editMemo(originalIndexToEdit);
    }

    async function handleSaveMemoButtonClick() {
        if (!memoTextArea || !screenshotArea) return;
        const memoContent = memoTextArea.value.trim();
        const currentScreenshot = screenshotArea.querySelector('img');
        const screenshotUrl = currentScreenshot ? currentScreenshot.src : null;

        if (!memoContent && !screenshotUrl) {
            window.showCustomDialog('エラー', 'メモ内容が空か、スクリーンショットがありません。');
            return;
        }

        let memos = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            memos = window.userMemos || [];
        } else {
            // ★変更点: browser.storage.local.get を localStorage.getItem に変更
            const memosJSON = localStorage.getItem('savedMemosLocal');
            memos = memosJSON ? JSON.parse(memosJSON) : [];
        }

        const timestamp = new Date().toLocaleString();
        if (editingMemoIndex !== -1) {
            // 編集モード
            memos[editingMemoIndex].content = memoContent;
            memos[editingMemoIndex].timestamp = timestamp;
            memos[editingMemoIndex].screenshotUrl = screenshotUrl;
            editingMemoIndex = -1;
        } else {
            // 新規保存
            memos.push({ timestamp, content: memoContent, screenshotUrl });
        }

        if (isUserLoggedIn) {
            await saveMemosToServer(memos);
        } else {
            saveMemosLocally(memos);
        }

        if (memoTextArea) memoTextArea.value = '';
        if (screenshotArea) screenshotArea.innerHTML = '<p>スクリーンショットがここに表示されます。（画像をここに貼り付けることもできます - Ctrl+V / Cmd+V）</p>';
    }

    function handleMemoSearchButtonClick() {
        if (memoSearchInput) {
            const query = memoSearchInput.value.trim();
            loadMemos(query);
        }
    }

    function handleMemoSearchInputKeypress(e) {
        if (e.key === 'Enter') {
            if (memoSearchButton) memoSearchButton.click();
        }
    }
    
    function handleImagePaste(event) {
        const items = event.clipboardData.items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageUrl = e.target.result;
                    if (screenshotArea) {
                        screenshotArea.innerHTML = `<img src="${imageUrl}" alt="Pasted Image">`;
                        window.showCustomDialog('貼り付け完了', '画像をメモエリアに貼り付けました。');
                    }
                };
                reader.readAsDataURL(blob);
                return;
            }
        }
        window.showCustomDialog('貼り付け失敗', 'クリップボードに画像がありませんでした。');
    }

    // === イベントリスナーの再アタッチ ===
    if (saveMemoButton) {
        saveMemoButton.removeEventListener('click', handleSaveMemoButtonClick);
        saveMemoButton.addEventListener('click', handleSaveMemoButtonClick);
    }
    if (memoSearchButton) {
        memoSearchButton.removeEventListener('click', handleMemoSearchButtonClick);
        memoSearchButton.addEventListener('click', handleMemoSearchButtonClick);
    }
    if (memoSearchInput) {
        memoSearchInput.removeEventListener('keypress', handleMemoSearchInputKeypress);
        memoSearchInput.addEventListener('keypress', handleMemoSearchInputKeypress);
    }
    if (screenshotArea) {
        screenshotArea.removeEventListener('paste', handleImagePaste);
        screenshotArea.addEventListener('paste', handleImagePaste);
    }
    
    // ログイン状態が変更されたときにメモを再ロード
    document.removeEventListener('loginStateChanged', loadMemos);
    document.addEventListener('loginStateChanged', loadMemos);

    loadMemos(); // 初期ロード
};
