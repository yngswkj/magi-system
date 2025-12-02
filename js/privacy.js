// データエクスポート
function exportAllData() {
    const exportData = {
        exported_at: new Date().toISOString(),
        version: '1.0',
        data: {
            history: JSON.parse(localStorage.getItem('magi_history') || '[]'),
            personas: JSON.parse(localStorage.getItem('magi_custom_personas') || '[]'),
            settings: JSON.parse(localStorage.getItem('magi_settings') || '{}')
        },
        warning: 'このファイルには機密情報が含まれる可能性があります。安全な場所に保管してください。'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magi-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('データをエクスポートしました', 'success');
}

// 通知表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// グローバルスコープに関数を公開（HTMLのonclick属性で使用するため）
window.exportAllData = exportAllData;

