// js/sections/battleRecord.js

// グローバルなallCardsとshowCustomDialog関数を受け取るための初期化関数
window.initBattleRecordSection = async function() {
    console.log("BattleRecord section initialized for web version.");

    // === 戦いの記録セクションのロジック ===
    // 各要素を関数内で取得
    const myDeckSelect = document.getElementById('my-deck-select');
    const opponentDeckSelect = document.getElementById('opponent-deck-select');
    const winLossSelect = document.getElementById('win-loss-select');
    const firstSecondSelect = document.getElementById('first-second-select');
    const notesTextarea = document.getElementById('notes-textarea');
    const saveBattleRecordButton = document.getElementById('save-battle-record-button');

    const selectedDeckForStats = document.getElementById('selected-deck-for-stats'); 
    const selectedDeckStatsDetail = document.getElementById('selected-deck-stats-detail');

    const newDeckNameInput = document.getElementById('new-deck-name');
    const newDeckTypeSelect = document.getElementById('new-deck-type');
    const registerDeckButton = document.getElementById('register-deck-button');

    let battleRecordTabButtons = document.querySelectorAll('.battle-record-tab-button');
    let battleRecordTabContents = document.querySelectorAll('.battle-record-tab-content');

    // ユーザーのデータ (rateMatch.jsからログイン時にセットされることを期待)
    window.userBattleRecords = window.userBattleRecords || [];
    window.userRegisteredDecks = window.userRegisteredDecks || [];

    /**
     * 戦績をロードして集計を更新する関数
     */
    const loadBattleRecords = () => {
        // ログインしていない場合はローカルストレージから読み込む
        if (!window.currentUserId) {
            console.log("BattleRecord: Not logged in. Displaying local data from localStorage.");
            const recordsJSON = localStorage.getItem('battleRecordsLocal');
            const records = recordsJSON ? JSON.parse(recordsJSON) : [];
            const decksJSON = localStorage.getItem('registeredDecksLocal');
            const decks = decksJSON ? JSON.parse(decksJSON) : [];
            
            displayBattleRecords(records, false);
            calculateAndDisplayStats(records, decks);
            return;
        }

        // ログインしている場合はサーバーから取得したデータを使用
        console.log("BattleRecord: Logged in. Loading battle records from server data.");
        const records = window.userBattleRecords || [];
        const decks = window.userRegisteredDecks || [];
        displayBattleRecords(records, true);
        calculateAndDisplayStats(records, decks);
    };

    /**
     * 戦績をUIに表示するヘルパー関数
     * @param {Array} records - 表示する戦績の配列
     * @param {boolean} isServerData - データがサーバーからのものか
     */
    const displayBattleRecords = (records, isServerData) => {
        const battleRecordsList = document.getElementById('battle-records-list');
        if (!battleRecordsList) return;

        battleRecordsList.innerHTML = '';

        if (records.length === 0) {
            battleRecordsList.innerHTML = `<li>まだ対戦記録がありません。${isServerData ? '(ログイン済み)' : '(ローカル)'}</li>`;
        } else {
            [...records].reverse().forEach((record, reverseIndex) => {
                const originalIndex = records.length - 1 - reverseIndex;
                const listItem = document.createElement('li');
                listItem.className = 'battle-record-item';
                listItem.innerHTML = `
                        <strong>${record.timestamp}</strong><br>
                        自分のデッキ: ${record.myDeck} (${record.myDeckType || '不明'})<br>
                        相手のデッキ: ${record.opponentDeck} (${record.opponentDeckType || '不明'})<br>
                        結果: ${record.result === 'win' ? '勝利' : '敗北'} (${record.firstSecond === 'first' ? '先攻' : record.firstSecond === 'second' ? '後攻' : '不明'})<br>
                        ${record.notes ? `メモ: ${record.notes}<br>` : ''}
                        <button class="delete-button" data-index="${originalIndex}" title="削除"><i class="fas fa-trash-alt"></i></button>
                    `;
                battleRecordsList.appendChild(listItem);
            });

            battleRecordsList.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', handleDeleteBattleRecordClick);
            });
        }
    };
    
    /**
     * 統計情報を計算して表示する関数
     * @param {Array} records - 戦績データの配列
     * @param {Array} registeredDecks - 登録済みデッキの配列
     */
    const calculateAndDisplayStats = (records, registeredDecks) => {
        const totalGamesSpan = document.getElementById('total-games');
        const totalWinsSpan = document.getElementById('total-wins');
        const totalLossesSpan = document.getElementById('total-losses');
        const winRateSpan = document.getElementById('win-rate');
        const firstWinRateSpan = document.getElementById('first-win-rate');
        const secondWinRateSpan = document.getElementById('second-win-rate');
        const myDeckTypeWinRatesDiv = document.getElementById('my-deck-type-win-rates');
        const opponentDeckTypeWinRatesDiv = document.getElementById('opponent-deck-type-win-rates');

        if (!totalGamesSpan) return;

        let totalGames = records.length;
        let totalWins = records.filter(r => r.result === 'win').length;
        let totalLosses = totalGames - totalWins;
        
        let firstGames = records.filter(r => r.firstSecond === 'first').length;
        let firstWins = records.filter(r => r.firstSecond === 'first' && r.result === 'win').length;
        
        let secondGames = records.filter(r => r.firstSecond === 'second').length;
        let secondWins = records.filter(r => r.firstSecond === 'second' && r.result === 'win').length;

        const myDeckTypeStats = {};
        const opponentDeckTypeStats = {};

        records.forEach(record => {
            if (record.myDeckType) {
                if (!myDeckTypeStats[record.myDeckType]) myDeckTypeStats[record.myDeckType] = { total: 0, wins: 0 };
                myDeckTypeStats[record.myDeckType].total++;
                if (record.result === 'win') myDeckTypeStats[record.myDeckType].wins++;
            }
            if (record.opponentDeckType) {
                if (!opponentDeckTypeStats[record.opponentDeckType]) opponentDeckTypeStats[record.opponentDeckType] = { total: 0, wins: 0 };
                opponentDeckTypeStats[record.opponentDeckType].total++;
                if (record.result === 'win') opponentDeckTypeStats[record.opponentDeckType].wins++;
            }
        });

        totalGamesSpan.textContent = totalGames;
        totalWinsSpan.textContent = totalWins;
        totalLossesSpan.textContent = totalLosses;
        winRateSpan.textContent = totalGames > 0 ? `${(totalWins / totalGames * 100).toFixed(2)}%` : '0.00%';
        firstWinRateSpan.textContent = firstGames > 0 ? `${(firstWins / firstGames * 100).toFixed(2)}%` : '0.00%';
        secondWinRateSpan.textContent = secondGames > 0 ? `${(secondWins / secondGames * 100).toFixed(2)}%` : '0.00%';

        const generateStatsHtml = (statsData) => {
            let html = '<ul>';
            const sortedTypes = Object.keys(statsData).sort();
            if (sortedTypes.length === 0) {
                html += '<li>データがありません。</li>';
            } else {
                sortedTypes.forEach(type => {
                    const stats = statsData[type];
                    const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(2) : '0.00';
                    html += `<li>${type}: ${rate}% (${stats.wins} / ${stats.total})</li>`;
                });
            }
            return html + '</ul>';
        };

        if(myDeckTypeWinRatesDiv) myDeckTypeWinRatesDiv.innerHTML = generateStatsHtml(myDeckTypeStats);
        if(opponentDeckTypeWinRatesDiv) opponentDeckTypeWinRatesDiv.innerHTML = generateStatsHtml(opponentDeckTypeStats);
        
        updateSelectedDeckStatsDropdown(registeredDecks);
    };

    /**
     * 戦績をサーバーに保存する関数
     * @param {Array} recordsToSave - 保存する戦績の配列
     */
    const saveBattleRecordsToServer = async (recordsToSave) => {
        if (!window.currentUserId || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            await window.showCustomDialog('エラー', 'ログインしていないか、サーバーに接続していません。');
            return;
        }
        window.userBattleRecords = recordsToSave;
        window.ws.send(JSON.stringify({
            type: 'update_user_data',
            userId: window.currentUserId,
            battleRecords: window.userBattleRecords
        }));
        await window.showCustomDialog('保存完了', '対戦記録をサーバーに保存しました！');
        loadBattleRecords();
    };

    /**
     * 戦績をローカルストレージに保存する関数
     * @param {Array} recordsToSave - 保存する戦績の配列
     */
    const saveBattleRecordsLocally = (recordsToSave) => {
        localStorage.setItem('battleRecordsLocal', JSON.stringify(recordsToSave));
        window.showCustomDialog('保存完了', '対戦記録をローカルに保存しました！');
        loadBattleRecords();
    };
    
    /**
     * 戦績を削除する関数
     * @param {number} index - 削除する戦績のインデックス
     */
    const deleteBattleRecord = async (index) => {
        let records = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            records = window.userBattleRecords || [];
        } else {
            const recordsJSON = localStorage.getItem('battleRecordsLocal');
            records = recordsJSON ? JSON.parse(recordsJSON) : [];
        }

        if (index > -1 && index < records.length) {
            records.splice(index, 1);
            if (isUserLoggedIn) {
                await saveBattleRecordsToServer(records);
            } else {
                saveBattleRecordsLocally(records);
            }
            window.showCustomDialog('削除完了', '対戦記録を削除しました。');
        }
    };
    
    /**
     * 登録済みデッキをロードして表示する関数
     */
    const loadRegisteredDecks = () => {
        const registeredDecksList = document.getElementById('registered-decks-list');
        const myDeckSelect = document.getElementById('my-deck-select');
        const opponentDeckSelect = document.getElementById('opponent-deck-select');

        if (!registeredDecksList || !myDeckSelect || !opponentDeckSelect) return;

        let decks = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            decks = window.userRegisteredDecks || [];
        } else {
            const decksJSON = localStorage.getItem('registeredDecksLocal');
            decks = decksJSON ? JSON.parse(decksJSON) : [];
        }
        displayRegisteredDecks(decks, myDeckSelect, opponentDeckSelect, isUserLoggedIn);
    };

    /**
     * 登録済みデッキをUIに表示するヘルパー関数
     * @param {Array} decks - 表示するデッキの配列
     * @param {HTMLElement} myDeckSelect - 自分のデッキ選択用select要素
     * @param {HTMLElement} opponentDeckSelect - 相手のデッキ選択用select要素
     * @param {boolean} isServerData - データがサーバーからのものか
     */
    const displayRegisteredDecks = (decks, myDeckSelect, opponentDeckSelect, isServerData) => {
        const registeredDecksList = document.getElementById('registered-decks-list');
        if (!registeredDecksList || !myDeckSelect || !opponentDeckSelect) return;

        registeredDecksList.innerHTML = '';
        myDeckSelect.innerHTML = '<option value="">登録済みデッキから選択</option>';
        opponentDeckSelect.innerHTML = '<option value="">登録済みデッキから選択</option>';

        if (decks.length === 0) {
            registeredDecksList.innerHTML = `<li>まだ登録されたデッキがありません。${isServerData ? '(ログイン済み)' : '(ローカル)'}</li>`;
        } else {
            decks.sort((a, b) => a.name.localeCompare(b.name)).forEach((deck, index) => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    ${deck.name} (${deck.type}) 
                    <button class="delete-registered-deck-button" data-index="${index}" title="削除"><i class="fas fa-trash-alt"></i></button>
                `;
                registeredDecksList.appendChild(listItem);

                const optionMy = document.createElement('option');
                optionMy.value = deck.name;
                optionMy.textContent = `${deck.name} (${deck.type})`;
                myDeckSelect.appendChild(optionMy);

                const optionOpponent = document.createElement('option');
                optionOpponent.value = deck.name;
                optionOpponent.textContent = `${deck.name} (${deck.type})`;
                opponentDeckSelect.appendChild(optionOpponent);
            });

            registeredDecksList.querySelectorAll('.delete-registered-deck-button').forEach(button => {
                button.addEventListener('click', handleDeleteRegisteredDeckClick);
            });
        }
        updateSelectedDeckStatsDropdown(decks);
    };
    
    /**
     * 登録済みデッキをサーバーに保存する関数
     * @param {Array} decksToSave - 保存するデッキの配列
     */
    const saveRegisteredDecksToServer = async (decksToSave) => {
        if (!window.currentUserId || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            await window.showCustomDialog('エラー', 'ログインしていないか、サーバーに接続していません。');
            return;
        }
        window.userRegisteredDecks = decksToSave;
        window.ws.send(JSON.stringify({
            type: 'update_user_data',
            userId: window.currentUserId,
            registeredDecks: window.userRegisteredDecks
        }));
        await window.showCustomDialog('登録完了', 'デッキをサーバーに登録しました！');
        loadRegisteredDecks();
    };

    /**
     * 登録済みデッキをローカルストレージに保存する関数
     * @param {Array} decksToSave - 保存するデッキの配列
     */
    const saveRegisteredDecksLocally = (decksToSave) => {
        localStorage.setItem('registeredDecksLocal', JSON.stringify(decksToSave));
        window.showCustomDialog('登録完了', 'デッキをローカルに登録しました！');
        loadRegisteredDecks();
    };

    /**
     * 登録済みデッキを削除する関数
     * @param {number} index - 削除するデッキのインデックス
     */
    const deleteRegisteredDeck = async (index) => {
        let decks = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            decks = window.userRegisteredDecks || [];
        } else {
            const decksJSON = localStorage.getItem('registeredDecksLocal');
            decks = decksJSON ? JSON.parse(decksJSON) : [];
        }

        if (index > -1 && index < decks.length) {
            decks.splice(index, 1);
            if (isUserLoggedIn) {
                await saveRegisteredDecksToServer(decks);
            } else {
                saveRegisteredDecksLocally(decks);
            }
            window.showCustomDialog('削除完了', 'デッキを削除しました。');
            loadBattleRecords(); // 統計情報も更新
        }
    };

    /**
     * デッキ別詳細分析のドロップダウンを更新
     * @param {Array} registeredDecks - 登録済みデッキの配列
     */
    const updateSelectedDeckStatsDropdown = (registeredDecks) => {
        const selectedDeckForStats = document.getElementById('selected-deck-for-stats');
        if (!selectedDeckForStats) return;

        const currentVal = selectedDeckForStats.value;
        selectedDeckForStats.innerHTML = '<option value="">全てのデッキ</option>';
        registeredDecks.sort((a, b) => a.name.localeCompare(b.name)).forEach(deck => {
            const option = document.createElement('option');
            option.value = deck.name;
            option.textContent = `${deck.name} (${deck.type})`;
            selectedDeckForStats.appendChild(option);
        });
        selectedDeckForStats.value = currentVal;
        displaySelectedDeckStats(selectedDeckForStats.value);
    };

    /**
     * 選択されたデッキの詳細な勝率を表示
     * @param {string} deckName - 分析対象のデッキ名
     */
    const displaySelectedDeckStats = (deckName) => {
        let records = [];
        const isUserLoggedIn = !!window.currentUserId;

        if (isUserLoggedIn) {
            records = window.userBattleRecords || [];
        } else {
            const recordsJSON = localStorage.getItem('battleRecordsLocal');
            records = recordsJSON ? JSON.parse(recordsJSON) : [];
        }

        const selectedDeckStatsDetail = document.getElementById('selected-deck-stats-detail');
        if (!selectedDeckStatsDetail) return;

        if (!deckName) {
            selectedDeckStatsDetail.innerHTML = '<p>デッキを選択して詳細な勝率を表示します。</p>';
            return;
        }

        const gamesAsMyDeck = records.filter(record => record.myDeck === deckName);
        
        let myDeckTotal = gamesAsMyDeck.length;
        let myDeckWins = gamesAsMyDeck.filter(record => record.result === 'win').length;
        let myDeckWinRate = myDeckTotal > 0 ? ((myDeckWins / myDeckTotal) * 100).toFixed(2) : '0.00';

        let html = `<h4>「${deckName}」の統計 (自分のデッキとして使用時)</h4>`;
        html += `<p>総対戦数: ${myDeckTotal}, 勝利数: ${myDeckWins}, 勝率: <strong>${myDeckWinRate}%</strong></p>`;

        if (myDeckTotal > 0) {
            html += `<h5>相手デッキタイプ別勝率</h5><ul>`;
            const opponentTypes = {};
            gamesAsMyDeck.forEach(record => {
                const type = record.opponentDeckType || 'タイプ不明';
                if (!opponentTypes[type]) {
                    opponentTypes[type] = { total: 0, wins: 0 };
                }
                opponentTypes[type].total++;
                if (record.result === 'win') {
                    opponentTypes[type].wins++;
                }
            });
            for (const type in opponentTypes) {
                const stats = opponentTypes[type];
                const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(2) : '0.00';
                html += `<li>vs ${type}: ${rate}% (${stats.wins}勝 / ${stats.total}戦)</li>`;
            }
            html += `</ul>`;
        }
        
        selectedDeckStatsDetail.innerHTML = html;
    };

    /**
     * タブ切り替え関数
     * @param {string} tabId - 表示するタブのID
     */
    function showBattleRecordTab(tabId) {
        battleRecordTabButtons = document.querySelectorAll('.battle-record-tab-button');
        battleRecordTabContents = document.querySelectorAll('.battle-record-tab-content');

        if (!battleRecordTabButtons.length || !battleRecordTabContents.length) return;

        battleRecordTabButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.tab === tabId);
        });
        battleRecordTabContents.forEach(content => {
            content.classList.toggle('active', content.id === `battle-record-tab-${tabId}`);
        });

        if (tabId === 'stats-summary' || tabId === 'past-records') {
            loadBattleRecords();
        } else if (tabId === 'deck-management' || tabId === 'new-record') {
            loadRegisteredDecks();
        }
    }

    // === イベントハンドラ ===

    async function handleSaveBattleRecordClick() {
        const myDeck = myDeckSelect.value;
        const opponentDeck = opponentDeckSelect.value;
        const myDeckType = myDeckSelect.options[myDeckSelect.selectedIndex]?.textContent.match(/\((.*?)\)/)?.[1] || '';
        const opponentDeckType = opponentDeckSelect.options[opponentDeckSelect.selectedIndex]?.textContent.match(/\((.*?)\)/)?.[1] || '';
        
        const result = winLossSelect.value;
        const firstSecond = firstSecondSelect.value;
        const notes = notesTextarea.value.trim();

        if (!myDeck || !opponentDeck || !result || !firstSecond) {
            window.showCustomDialog('エラー', '自分のデッキ名、相手のデッキ名、勝敗、先攻/後攻は必須です。');
            return;
        }

        const newRecord = {
            timestamp: new Date().toLocaleString(),
            myDeck, myDeckType, opponentDeck, opponentDeckType, result, firstSecond, notes
        };

        let records = [];
        const isUserLoggedIn = !!window.currentUserId;
        if (isUserLoggedIn) {
            records = window.userBattleRecords || [];
        } else {
            const recordsJSON = localStorage.getItem('battleRecordsLocal');
            records = recordsJSON ? JSON.parse(recordsJSON) : [];
        }
        records.push(newRecord);

        if (isUserLoggedIn) {
            await saveBattleRecordsToServer(records);
        } else {
            saveBattleRecordsLocally(records);
        }

        myDeckSelect.value = '';
        opponentDeckSelect.value = '';
        winLossSelect.value = 'win';
        firstSecondSelect.value = '';
        notesTextarea.value = '';
    }

    async function handleRegisterDeckClick() {
        const deckName = newDeckNameInput.value.trim();
        const deckType = newDeckTypeSelect.value;

        if (!deckName || !deckType) {
            window.showCustomDialog('エラー', 'デッキ名とデッキタイプは必須です。');
            return;
        }

        let decks = [];
        const isUserLoggedIn = !!window.currentUserId;
        if (isUserLoggedIn) {
            decks = window.userRegisteredDecks || [];
        } else {
            const decksJSON = localStorage.getItem('registeredDecksLocal');
            decks = decksJSON ? JSON.parse(decksJSON) : [];
        }

        if (decks.some(deck => deck.name === deckName)) {
            window.showCustomDialog('エラー', '同じ名前のデッキが既に登録されています。');
            return;
        }

        decks.push({ name: deckName, type: deckType });

        if (isUserLoggedIn) {
            await saveRegisteredDecksToServer(decks);
        } else {
            saveRegisteredDecksLocally(decks);
        }

        newDeckNameInput.value = '';
        newDeckTypeSelect.value = '';
    }

    async function handleDeleteBattleRecordClick(event) {
        const indexToDelete = parseInt(event.currentTarget.dataset.index);
        const confirmed = await window.showCustomDialog('記録削除', 'この対戦記録を削除しますか？', true);
        if (confirmed) {
            await deleteBattleRecord(indexToDelete);
        }
    }

    async function handleDeleteRegisteredDeckClick(event) {
        const indexToDelete = parseInt(event.currentTarget.dataset.index);
        const confirmed = await window.showCustomDialog('デッキ削除', 'このデッキを登録リストから削除しますか？', true);
        if (confirmed) {
            await deleteRegisteredDeck(indexToDelete);
        }
    }

    function handleSelectedDeckForStatsChange(event) {
        displaySelectedDeckStats(event.target.value);
    }
    
    function handleBattleRecordTabClick(event) {
        showBattleRecordTab(event.currentTarget.dataset.tab);
    }

    // === イベントリスナーの再アタッチ ===
    if (saveBattleRecordButton) saveBattleRecordButton.addEventListener('click', handleSaveBattleRecordClick);
    if (registerDeckButton) registerDeckButton.addEventListener('click', handleRegisterDeckClick);
    if (selectedDeckForStats) selectedDeckForStats.addEventListener('change', handleSelectedDeckForStatsChange);
    battleRecordTabButtons.forEach(button => button.addEventListener('click', handleBattleRecordTabClick));

    // ログイン状態が変更されたときにデータを再ロード
    document.addEventListener('loginStateChanged', () => {
        loadRegisteredDecks();
        loadBattleRecords();
    });

    // 初回ロード
    loadRegisteredDecks();
    loadBattleRecords();
    showBattleRecordTab('new-record');
};
