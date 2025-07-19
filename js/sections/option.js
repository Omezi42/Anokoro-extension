// js/options.js

document.addEventListener('DOMContentLoaded', () => {
    // const a = (typeof browser !== "undefined") ? browser : chrome; // 削除
    // if (typeof a === "undefined" || typeof a.runtime === "undefined") { // 削除
    //     console.error("TCG Assistant Options: Could not find browser/chrome runtime API."); // 削除
    //     return; // 削除
    // } // 削除

    const notificationToggle = document.getElementById('notification-toggle');
    const queueNotificationToggle = document.getElementById('queue-notification-toggle');
    const themeSelect = document.getElementById('theme-select');
    const saveButton = document.getElementById('save-button');
    const saveStatus = document.getElementById('save-status');

    // 設定を読み込んでUIに反映
    const restoreOptions = () => {
        // localStorage から設定を読み込む
        const notifications = localStorage.getItem('notifications') === 'true'; // デフォルトはfalseとして扱うか、明示的な初期値を設定
        const queueNotifications = localStorage.getItem('queueNotifications') === 'true'; // デフォルトはfalse
        const selectedTheme = localStorage.getItem('selectedTheme') || 'default';

        console.log("Options restored:", { notifications, queueNotifications, selectedTheme });
        if (notificationToggle) {
            notificationToggle.checked = notifications;
        }
        if (queueNotificationToggle) {
            queueNotificationToggle.checked = queueNotifications;
        }
        if (themeSelect) {
            themeSelect.value = selectedTheme;
        }
    };

    // 設定を保存
    const saveOptions = () => {
        const notifications = notificationToggle ? notificationToggle.checked : true;
        const queueNotifications = queueNotificationToggle ? queueNotificationToggle.checked : false;
        const selectedTheme = themeSelect ? themeSelect.value : 'default';

        // localStorage に設定を保存
        localStorage.setItem('notifications', notifications.toString());
        localStorage.setItem('queueNotifications', queueNotifications.toString());
        localStorage.setItem('selectedTheme', selectedTheme);

        console.log("Options saved:", { notifications, queueNotifications, selectedTheme });
        if (saveStatus) {
            saveStatus.textContent = '設定を保存しました！';
            setTimeout(() => {
                saveStatus.textContent = '';
            }, 1500);
        }
        // テーマ変更をメインUIに通知するために postMessage を使用
        // main.js が iframe 内で動作している場合、window.parent を使用
        // あるいは、main.js が直接ページにある場合は window.applyTheme() を呼び出す
        if (window.parent && window.parent.applyTheme) { // main.js で applyTheme がグローバルに定義されている場合
             window.parent.applyTheme(selectedTheme);
        } else if (window.opener && window.opener.applyTheme) { // options.html が popup から開かれた場合
             window.opener.applyTheme(selectedTheme);
        } else {
             console.warn("Could not find a way to apply theme to main UI.");
        }
    };

    restoreOptions();
    if (saveButton) {
        saveButton.addEventListener('click', saveOptions);
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', saveOptions);
    }
});