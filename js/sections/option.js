// js/options.js

document.addEventListener('DOMContentLoaded', () => {
    const notificationToggle = document.getElementById('notification-toggle');
    const queueNotificationToggle = document.getElementById('queue-notification-toggle');
    const themeSelect = document.getElementById('theme-select');
    const saveButton = document.getElementById('save-button');
    const saveStatus = document.getElementById('save-status');

    const restoreOptions = () => {
        const notifications = localStorage.getItem('notifications') === 'true';
        const queueNotifications = localStorage.getItem('queueNotifications') === 'true';
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

    const saveOptions = () => {
        const notifications = notificationToggle ? notificationToggle.checked : true;
        const queueNotifications = queueNotificationToggle ? queueNotificationToggle.checked : false;
        const selectedTheme = themeSelect ? themeSelect.value : 'default';

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

        // テーマ変更をmain.jsに通知するために直接関数を呼び出す
        // main.jsが同じウィンドウのグローバルスコープでロードされていると仮定
        if (typeof window.applyTheme === 'function') {
            window.applyTheme(selectedTheme);
            console.log("Called window.applyTheme from options.js");
        } else {
            console.warn("window.applyTheme is not available. Cannot apply theme directly.");
            // オプションページがポップアップ/別タブで開かれている場合、
            // メインページにメッセージを送る代替手段も残す
            if (window.opener && typeof window.opener.applyTheme === 'function') {
                window.opener.applyTheme(selectedTheme);
                console.log("Called window.opener.applyTheme from options.js");
            }
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