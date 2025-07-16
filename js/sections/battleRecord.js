// js/sections/battleRecord.js

window.initBattleRecordSection = async function() {
    console.log("BattleRecord section with Replay feature initialized.");

    if (typeof browser === 'undefined') {
        var browser = chrome;
    }

    // === 新機能：リプレイ機能関連の変数 ===
    let mediaRecorder;
    let recordedChunks = [];
    let mediaStream;
    let currentReplayId = null;

    // === DOM要素の取得 ===
    const myDeckSelect = document.getElementById('my-deck-select');
    const opponentDeckSelect = document.getElementById('opponent-deck-select');
    const winLossSelect = document.getElementById('win-loss-select');
    const firstSecondSelect = document.getElementById('first-second-select');
    const notesTextarea = document.getElementById('notes-textarea');
    const saveBattleRecordButton = document.getElementById('save-battle-record-button');

    // リプレイ機能UI
    const startReplayButton = document.getElementById('start-replay-button');
    const stopReplayButton = document.getElementById('stop-replay-button');
    const recordingStatus = document.getElementById('recording-status');
    const battleRecordFormWrapper = document.getElementById('battle-record-form-wrapper');
    const replayLinkStatus = document.getElementById('replay-link-status');

    // その他のUI
    const selectedDeckForStats = document.getElementById('selected-deck-for-stats'); 
    const selectedDeckStatsDetail = document.getElementById('selected-deck-stats-detail');
    const newDeckNameInput = document.getElementById('new-deck-name');
    const newDeckTypeSelect = document.getElementById('new-deck-type');
    const registerDeckButton = document.getElementById('register-deck-button');
    let battleRecordTabButtons = document.querySelectorAll('.battle-record-tab-button');
    let battleRecordTabContents = document.querySelectorAll('.battle-record-tab-content');

    window.userBattleRecords = window.userBattleRecords || [];
    window.userRegisteredDecks = window.userRegisteredDecks || [];

    // === 新機能：IndexedDB関連のヘルパー関数 ===
    // DeepResearchレポート Section 3 の推奨に基づく
    const DB_NAME = 'TCGReplayDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'replays';
    let db;

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    console.log('IndexedDB: Object store "replays" created.');
                }
            };

            request.onsuccess = event => {
                db = event.target.result;
                console.log('IndexedDB connection successful.');
                resolve(db);
            };

            request.onerror = event => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.error);
            };
        });
    }

    function saveReplayToDB(id, blob) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('DB not initialized');
                return;
            }
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ id: id, video: blob });

            request.onsuccess = () => resolve();
            request.onerror = event => reject(event.target.error);
        });
    }

    function getReplayFromDB(id) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject('DB not initialized');
                return;
            }
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = event => resolve(event.target.result ? event.target.result.video : null);
            request.onerror = event => reject(event.target.error);
        });
    }
    
    function deleteReplayFromDB(id) {
        return new Promise((resolve, reject) => {
            if (!db) { reject('DB not initialized'); return; }
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }


    // === 新機能：リプレイ録画・再生ロジック ===

    async function handleStartReplayClick() {
        // DeepResearchレポート Section 1.2 の推奨設定を適用
        const displayMediaOptions = {
            video: true,
            audio: {
                // ゲーム音声の品質を維持するため、音声処理を無効化
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            // 現在のタブを優先的に選択させることでUXを向上
            preferCurrentTab: true, 
            systemAudio: 'include'
        };

        try {
            mediaStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
            
            // UI更新
            startReplayButton.style.display = 'none';
            stopReplayButton.style.display = 'block';
            recordingStatus.style.display = 'flex';
            battleRecordFormWrapper.classList.add('disabled');

            recordedChunks = [];
            // DeepResearchレポート Section 2.3 の推奨に基づき video/webm を使用
            const options = { mimeType: 'video/webm; codecs=vp9' };
            mediaRecorder = new MediaRecorder(mediaStream, options);

            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const replayBlob = new Blob(recordedChunks, { type: 'video/webm' });
                currentReplayId = `replay_${Date.now()}`;

                try {
                    await saveReplayToDB(currentReplayId, replayBlob);
                    replayLinkStatus.textContent = "リプレイが録画されました。記録を保存してください。";
                    replayLinkStatus.style.display = 'block';
                    await window.showCustomDialog('録画完了', 'リプレイが正常に保存されました。続けて対戦記録を入力し、保存してください。');
                } catch (error) {
                    console.error('Failed to save replay:', error);
                    window.showCustomDialog('エラー', 'リプレイの保存に失敗しました。');
                    currentReplayId = null;
                }
                
                // UIを元に戻す
                startReplayButton.style.display = 'block';
                stopReplayButton.style.display = 'none';
                recordingStatus.style.display = 'none';
                battleRecordFormWrapper.classList.remove('disabled');
            };
            
            // DeepResearchレポート Section 2.3 の推奨に基づき、5-10秒のtimesliceを設定
            mediaRecorder.start(5000); 

            // ユーザーが共有を停止した場合の処理
            mediaStream.getVideoTracks()[0].onended = () => {
                if (mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }
            };

        } catch (err) {
            console.error("Error starting recording:", err);
            window.showCustomDialog('録画エラー', '画面キャプチャの開始に失敗しました。許可されているか確認してください。');
        }
    }

    function handleStopReplayClick() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
    }

    async function playReplay(replayId) {
        try {
            const replayBlob = await getReplayFromDB(replayId);
            if (!replayBlob) {
                window.showCustomDialog('エラー', 'リプレイデータが見つかりませんでした。');
                return;
            }

            // モーダルを作成
            const modalOverlay = document.createElement('div');
            modalOverlay.id = 'replay-modal-overlay';
            modalOverlay.innerHTML = `
                <div class="replay-modal-content">
                    <h3>リプレイ再生</h3>
                    <div id="replay-video-container">
                        <video controls></video>
                    </div>
                    <div class="replay-modal-controls">
                        <button id="close-replay-modal-button">閉じる</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
            
            const videoElement = modalOverlay.querySelector('video');
            const closeButton = modalOverlay.querySelector('#close-replay-modal-button');
            
            closeButton.onclick = () => modalOverlay.remove();
            modalOverlay.onclick = (e) => {
                if (e.target === modalOverlay) modalOverlay.remove();
            };

            // DeepResearchレポート Section 4.2 の推奨に基づき、MSEを使用
            const mediaSource = new MediaSource();
            videoElement.src = URL.createObjectURL(mediaSource);

            mediaSource.addEventListener('sourceopen', async () => {
                URL.revokeObjectURL(videoElement.src);
                const sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs=vp9');
                const buffer = await replayBlob.arrayBuffer();
                
                sourceBuffer.addEventListener('updateend', () => {
                    if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
                        mediaSource.endOfStream();
                    }
                });
                
                sourceBuffer.appendBuffer(buffer);
                videoElement.play();
            });

        } catch (error) {
            console.error('Error playing replay:', error);
            window.showCustomDialog('再生エラー', 'リプレイの再生に失敗しました。');
        }
    }

    // === 既存機能の更新 ===

    const loadBattleRecords = () => {
        const battleRecordsList = document.getElementById('battle-records-list');
        if (!battleRecordsList) return;

        if (!window.currentUserId) {
            browser.storage.local.get(['battleRecordsLocal'], (result) => {
                const records = result.battleRecordsLocal || [];
                displayBattleRecords(records, false);
                calculateAndDisplayStats(records, window.userRegisteredDecks || []);
            });
            return;
        }

        const records = window.userBattleRecords || [];
        displayBattleRecords(records, true);
        calculateAndDisplayStats(records, window.userRegisteredDecks || []);
    };

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
                    <div>
                        <strong>${record.timestamp}</strong><br>
                        自分のデッキ: ${record.myDeck} (${record.myDeckType || '不明'})<br>
                        相手のデッキ: ${record.opponentDeck} (${record.opponentDeckType || '不明'})<br>
                        結果: ${record.result === 'win' ? '勝利' : '敗北'} (${record.firstSecond === 'first' ? '先攻' : record.firstSecond === 'second' ? '後攻' : '不明'})<br>
                        ${record.notes ? `メモ: ${record.notes}<br>` : ''}
                    </div>
                    <div class="actions">
                        ${record.replayId ? `<button class="play-replay-button" data-replay-id="${record.replayId}"><i class="fas fa-play"></i> 再生</button>` : ''}
                        <button class="delete-button" data-index="${originalIndex}" title="削除"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                battleRecordsList.appendChild(listItem);
            });

            battleRecordsList.querySelectorAll('.delete-button').forEach(button => {
                button.addEventListener('click', handleDeleteBattleRecordClick);
            });
            
            // 新機能：再生ボタンのイベントリスナー
            battleRecordsList.querySelectorAll('.play-replay-button').forEach(button => {
                button.addEventListener('click', (e) => playReplay(e.currentTarget.dataset.replayId));
            });
        }
    };
    
    // (calculateAndDisplayStats, loadRegisteredDecks, displayRegisteredDecks など他の関数は変更なしのため省略...
    // ただし、完全なファイルとして提供するため、以下にペーストします)

    const calculateAndDisplayStats = (records, registeredDecks) => {
        const totalGamesSpan = document.getElementById('total-games');
        const totalWinsSpan = document.getElementById('total-wins');
        const totalLossesSpan = document.getElementById('total-losses');
        const winRateSpan = document.getElementById('win-rate');
        const firstWinRateSpan = document.getElementById('first-win-rate');
        const secondWinRateSpan = document.getElementById('second-win-rate');
        const myDeckTypeWinRatesDiv = document.getElementById('my-deck-type-win-rates');
        const opponentDeckTypeWinRatesDiv = document.getElementById('opponent-deck-type-win-rates');

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

        if (totalGamesSpan) totalGamesSpan.textContent = totalGames;
        if (totalWinsSpan) totalWinsSpan.textContent = totalWins;
        if (totalLossesSpan) totalLossesSpan.textContent = totalLosses;
        if (winRateSpan) winRateSpan.textContent = totalGames > 0 ? `${(totalWins / totalGames * 100).toFixed(2)}%` : '0.00%';
        if (firstWinRateSpan) firstWinRateSpan.textContent = firstGames > 0 ? `${(firstWins / firstGames * 100).toFixed(2)}%` : '0.00%';
        if (secondWinRateSpan) secondWinRateSpan.textContent = secondGames > 0 ? `${(secondWins / secondGames * 100).toFixed(2)}%` : '0.00%';

        if(myDeckTypeWinRatesDiv) myDeckTypeWinRatesDiv.innerHTML = generateStatsHtml(myDeckTypeStats);
        if(opponentDeckTypeWinRatesDiv) opponentDeckTypeWinRatesDiv.innerHTML = generateStatsHtml(opponentDeckTypeStats, 'vs ');

        updateSelectedDeckStatsDropdown(registeredDecks);
    };
    
    function generateStatsHtml(statsData, prefix = '') {
        let html = '<ul>';
        const sortedTypes = Object.keys(statsData).sort();
        if (sortedTypes.length === 0) {
            html += '<li>データがありません。</li>';
        } else {
            sortedTypes.forEach(type => {
                const stats = statsData[type];
                const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(2) : '0.00';
                html += `<li>${prefix}${type}: ${rate}% (${stats.wins} / ${stats.total})</li>`;
            });
        }
        return html + '</ul>';
    }

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

    const saveBattleRecordsLocally = (recordsToSave) => {
        browser.storage.local.set({ battleRecordsLocal: recordsToSave }, () => {
            window.showCustomDialog('保存完了', '対戦記録をローカルに保存しました！');
            loadBattleRecords();
        });
    };

    const deleteBattleRecord = async (index) => {
        let records = window.currentUserId ? (window.userBattleRecords || []) : ((await browser.storage.local.get(['battleRecordsLocal'])).battleRecordsLocal || []);
        
        if (index > -1 && index < records.length) {
            const recordToDelete = records[index];
            records.splice(index, 1);
            
            // リプレイデータも削除
            if (recordToDelete.replayId) {
                try {
                    await deleteReplayFromDB(recordToDelete.replayId);
                    console.log(`Replay ${recordToDelete.replayId} deleted from DB.`);
                } catch(e) {
                    console.error("Failed to delete replay from DB", e);
                }
            }

            if (window.currentUserId) {
                await saveBattleRecordsToServer(records);
            } else {
                saveBattleRecordsLocally(records);
            }
            window.showCustomDialog('削除完了', '対戦記録を削除しました。');
        }
    };
    
    // (displayRegisteredDecks, saveRegisteredDecksToServer, etc. は変更なし)
    const loadRegisteredDecks = () => {
        const registeredDecksList = document.getElementById('registered-decks-list');
        const myDeckSelect = document.getElementById('my-deck-select');
        const opponentDeckSelect = document.getElementById('opponent-deck-select');

        if (!registeredDecksList || !myDeckSelect || !opponentDeckSelect) return;

        if (!window.currentUserId) {
            browser.storage.local.get(['registeredDecksLocal'], (result) => {
                const decks = result.registeredDecksLocal || [];
                displayRegisteredDecks(decks, myDeckSelect, opponentDeckSelect, false);
            });
            return;
        }

        const decks = window.userRegisteredDecks || [];
        displayRegisteredDecks(decks, myDeckSelect, opponentDeckSelect, true);
    };
    
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
                const option = `<option value="${deck.name}">${deck.name} (${deck.type})</option>`;
                myDeckSelect.innerHTML += option;
                opponentDeckSelect.innerHTML += option;
            });
            registeredDecksList.querySelectorAll('.delete-registered-deck-button').forEach(button => {
                button.addEventListener('click', handleDeleteRegisteredDeckClick);
            });
        }
        updateSelectedDeckStatsDropdown(decks);
    };

    const updateSelectedDeckStatsDropdown = (registeredDecks) => {
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
    
    const displaySelectedDeckStats = (deckName) => {
        if (!selectedDeckStatsDetail) return;
        let records = window.currentUserId ? (window.userBattleRecords || []) : []; // Local stats not implemented for simplicity
        
        let html = '';
        if (!deckName) {
            selectedDeckStatsDetail.innerHTML = '<p>デッキを選択して詳細な勝率を表示します。</p>';
            return;
        }
        
        const gamesAsMyDeck = records.filter(r => r.myDeck === deckName);
        html += `<h4>「${deckName}」使用時の統計</h4>`;
        if (gamesAsMyDeck.length > 0) {
            const wins = gamesAsMyDeck.filter(r => r.result === 'win').length;
            const winRate = (wins / gamesAsMyDeck.length * 100).toFixed(2);
            html += `<p>勝率: ${winRate}% (${wins}勝 / ${gamesAsMyDeck.length}戦)</p>`;
            // more detailed stats can go here
        } else {
            html += `<p>対戦データがありません。</p>`;
        }
        selectedDeckStatsDetail.innerHTML = html;
    };
    
    // (saveRegisteredDecksToServer, saveRegisteredDecksLocally, deleteRegisteredDeck, showBattleRecordTab は変更なし)
    const saveRegisteredDecksToServer = async (decksToSave) => {
        if (!window.currentUserId || !window.ws || window.ws.readyState !== WebSocket.OPEN) {
            await window.showCustomDialog('エラー', 'ログインしていません。'); return;
        }
        window.userRegisteredDecks = decksToSave;
        window.ws.send(JSON.stringify({ type: 'update_user_data', userId: window.currentUserId, registeredDecks: window.userRegisteredDecks }));
        await window.showCustomDialog('登録完了', 'デッキをサーバーに登録しました！');
        loadRegisteredDecks();
    };
    const saveRegisteredDecksLocally = (decksToSave) => {
        browser.storage.local.set({ registeredDecksLocal: decksToSave }, () => {
            window.showCustomDialog('登録完了', 'デッキをローカルに登録しました！');
            loadRegisteredDecks();
        });
    };
    const deleteRegisteredDeck = async (index) => {
        let decks = window.currentUserId ? (window.userRegisteredDecks || []) : ((await browser.storage.local.get(['registeredDecksLocal'])).registeredDecksLocal || []);
        if (index > -1 && index < decks.length) {
            decks.splice(index, 1);
            if (window.currentUserId) {
                await saveRegisteredDecksToServer(decks);
            } else {
                saveRegisteredDecksLocally(decks);
            }
            window.showCustomDialog('削除完了', 'デッキを削除しました。');
            loadBattleRecords();
        }
    };
    function showBattleRecordTab(tabId) {
        battleRecordTabButtons = document.querySelectorAll('.battle-record-tab-button');
        battleRecordTabContents = document.querySelectorAll('.battle-record-tab-content');
        if (!battleRecordTabButtons.length || !battleRecordTabContents.length) return;
        battleRecordTabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === tabId));
        battleRecordTabContents.forEach(content => content.classList.toggle('active', content.id === `battle-record-tab-${tabId}`));
        if (tabId === 'stats-summary' || tabId === 'deck-management' || tabId === 'new-record') {
            loadRegisteredDecks();
        }
        if (tabId === 'stats-summary' || tabId === 'past-records') {
            loadBattleRecords();
        }
    }

    // === イベントハンドラ ===
    async function handleSaveBattleRecordClick() {
        if (!myDeckSelect || !opponentDeckSelect || !winLossSelect || !firstSecondSelect || !notesTextarea) return;
        
        const newRecord = {
            timestamp: new Date().toLocaleString(),
            myDeck: myDeckSelect.value,
            myDeckType: myDeckSelect.value ? myDeckSelect.options[myDeckSelect.selectedIndex].textContent.match(/\((.*?)\)/)?.[1] || '' : '',
            opponentDeck: opponentDeckSelect.value,
            opponentDeckType: opponentDeckSelect.value ? opponentDeckSelect.options[opponentDeckSelect.selectedIndex].textContent.match(/\((.*?)\)/)?.[1] || '' : '',
            result: winLossSelect.value,
            firstSecond: firstSecondSelect.value,
            notes: notesTextarea.value.trim(),
            replayId: currentReplayId // ★リプレイIDを追加
        };

        if (!newRecord.myDeck || !newRecord.opponentDeck || !newRecord.result || !newRecord.firstSecond) {
            window.showCustomDialog('エラー', 'デッキ名、勝敗、先攻/後攻は必須です。');
            return;
        }

        let records = window.currentUserId ? (window.userBattleRecords || []) : ((await browser.storage.local.get(['battleRecordsLocal'])).battleRecordsLocal || []);
        records.push(newRecord);

        if (window.currentUserId) {
            await saveBattleRecordsToServer(records);
        } else {
            saveBattleRecordsLocally(records);
        }

        // フォームをリセット
        myDeckSelect.value = '';
        opponentDeckSelect.value = '';
        winLossSelect.value = 'win';
        firstSecondSelect.value = '';
        notesTextarea.value = '';
        currentReplayId = null; // リプレイIDをクリア
        replayLinkStatus.style.display = 'none';
        replayLinkStatus.textContent = '';
    }

    async function handleRegisterDeckClick() {
        if (!newDeckNameInput || !newDeckTypeSelect) return;
        const deckName = newDeckNameInput.value.trim();
        const deckType = newDeckTypeSelect.value;
        if (!deckName || !deckType) { window.showCustomDialog('エラー', 'デッキ名とタイプは必須です。'); return; }
        let decks = window.currentUserId ? (window.userRegisteredDecks || []) : ((await browser.storage.local.get(['registeredDecksLocal'])).registeredDecksLocal || []);
        if (decks.some(d => d.name === deckName)) { window.showCustomDialog('エラー', '同じ名前のデッキが既にあります。'); return; }
        decks.push({ name: deckName, type: deckType });
        if (window.currentUserId) { await saveRegisteredDecksToServer(decks); } else { saveRegisteredDecksLocally(decks); }
        newDeckNameInput.value = '';
        newDeckTypeSelect.value = '';
    }

    async function handleDeleteBattleRecordClick(event) {
        const indexToDelete = parseInt(event.currentTarget.dataset.index);
        const confirmed = await window.showCustomDialog('記録削除', 'この対戦記録を削除しますか？リプレイデータも完全に削除されます。', true);
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


    // === イベントリスナー設定 ===
    if(startReplayButton) startReplayButton.addEventListener('click', handleStartReplayClick);
    if(stopReplayButton) stopReplayButton.addEventListener('click', handleStopReplayClick);
    if (saveBattleRecordButton) saveBattleRecordButton.addEventListener('click', handleSaveBattleRecordClick);
    if (registerDeckButton) registerDeckButton.addEventListener('click', handleRegisterDeckClick);
    if (selectedDeckForStats) selectedDeckForStats.addEventListener('change', handleSelectedDeckForStatsChange);
    battleRecordTabButtons.forEach(button => button.addEventListener('click', handleBattleRecordTabClick));
    
    document.addEventListener('loginStateChanged', () => {
        loadRegisteredDecks();
        loadBattleRecords();
    });

    // === 初期化処理 ===
    try {
        await initDB(); // DBを初期化
        loadRegisteredDecks();
        loadBattleRecords();
        showBattleRecordTab('new-record');
    } catch (e) {
        console.error("Failed to initialize BattleRecord section with DB:", e);
        window.showCustomDialog('初期化エラー', 'リプレイ機能のデータベース初期化に失敗しました。プライベートブラウジングモードでは利用できない場合があります。');
        // DBなしでも他の機能は動くようにフォールバック
        loadRegisteredDecks();
        loadBattleRecords();
        showBattleRecordTab('new-record');
    }
};

void 0;