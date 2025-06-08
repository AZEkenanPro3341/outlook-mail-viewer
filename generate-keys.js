// generate-keys.js (YAYINA HAZIR HALİ)
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

// Render'ın kalıcı disk yolu (RENDER_DISK_MOUNT_PATH) varsa onu, yoksa mevcut klasörü kullan.
const dbPath = path.join(process.env.RENDER_DISK_MOUNT_PATH || '.', 'keys.db');
const db = new sqlite3.Database(dbPath);

console.log(`Veritabanı şu yolda oluşturulacak/kontrol edilecek: ${dbPath}`);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS access_keys (id INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, first_used_at DATETIME DEFAULT NULL)`);
    db.run(`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY, setting_key TEXT NOT NULL UNIQUE, setting_value TEXT)`);
    
    // Sadece ayarlar tablosu boşsa başlangıç değerini ekle
    db.get("SELECT count(*) as count FROM settings", (err, row) => {
        if (row.count === 0) {
            const settings = [
                ['copy_text', 'Lütfen kopyalanacak metni admin panelinden ayarlayın.'], ['tenant_id', ''], ['client_id', ''],
                ['client_secret', ''], ['target_user_id', '']
            ];
            const settingStmt = db.prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)");
            for (const setting of settings) { settingStmt.run(setting[0], setting[1]); }
            settingStmt.finalize();
            console.log("Başlangıç ayarları eklendi.");
        }
    });

    // Sadece anahtar tablosu boşsa yeni anahtar üret
    db.get("SELECT count(*) as count FROM access_keys", (err, row) => {
        if (row.count === 0) {
            const keyStmt = db.prepare("INSERT INTO access_keys (key) VALUES (?)");
            console.log("1000 adet yeni anahtar oluşturuluyor...");
            for (let i = 0; i < 1000; i++) { keyStmt.run(crypto.randomUUID()); }
            keyStmt.finalize();
            console.log("Anahtarlar başarıyla oluşturuldu.");
        } else {
            console.log("Veritabanında zaten anahtarlar mevcut, yeni anahtar üretilmedi.");
        }
    });
});
db.close();