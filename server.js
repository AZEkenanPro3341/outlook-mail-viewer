// server.js (YAYINA HAZIR FİNAL SÜRÜM)
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8000; // Render portu için
const ADMIN_KEY = 'BDaP5924';

// Ayarları ve veritabanı bağlantısını global olarak tanımlıyoruz
const dbPath = path.join(process.env.RENDER_DISK_MOUNT_PATH || '.', 'keys.db');
let db = new sqlite3.Database(dbPath, (err) => {
    if (err) { console.error("Veritabanı bağlantı hatası:", err.message); } 
    else { console.log(`Veritabanı bağlantısı başarılı: ${dbPath}`); }
});

// --- AYARLAR ---
const TENANT_ID = '1f41c8bc-949a-4a82-ab21-56254e55e704';
const CLIENT_ID = 'd9b0588f-2081-4247-9f87-12d2ea0ef489';
const CLIENT_SECRET = 'cjS8Q~PK1D8lR2O6GUIg4cdKtptYDJ9~4XUf1cPB';
const TARGET_USER_ID = 'capcapcut@capcut.onmicrosoft.com';


// ... (Tüm diğer fonksiyonlar ve rotalar önceki mesajdakiyle birebir aynı) ...
// Karışıklık olmasın diye kodun tamamını tekrar yapıştırıyorum:
let msGraphToken = { accessToken: null, expiresAt: 0 };
async function getMsGraphToken() { if (msGraphToken.accessToken && Date.now() < msGraphToken.expiresAt) { return msGraphToken.accessToken; } const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`; const params = new URLSearchParams(); params.append('grant_type', 'client_credentials'); params.append('client_id', CLIENT_ID); params.append('client_secret', CLIENT_SECRET); params.append('scope', 'https://graph.microsoft.com/.default'); try { const response = await axios.post(tokenUrl, params); const tokenData = response.data; msGraphToken.accessToken = tokenData.access_token; msGraphToken.expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000; console.log("Yeni bir Microsoft Graph API token'ı alındı."); return msGraphToken.accessToken; } catch (error) { console.error("HATA: Microsoft'tan token alınamadı.", error.response?.data); return null; } }
async function getLatestEmail() { const accessToken = await getMsGraphToken(); if (!accessToken) return { error: 'API token alınamadı.' }; const graphUrl = `https://graph.microsoft.com/v1.0/users/${TARGET_USER_ID}/messages?$filter=from/emailAddress/address eq 'no-reply@account.capcut.com'&$top=20&$select=subject,from,receivedDateTime,body`; try { const response = await axios.get(graphUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } }); const messages = response.data.value; if (messages && messages.length > 0) { messages.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime)); return messages[0]; } else { return null; } } catch (error) { const errorMessage = error.response?.data?.error?.message || error.message; return { error: `Mail çekilemedi: ${errorMessage}` }; } }
app.set('view engine', 'ejs'); app.use(express.urlencoded({ extended: true })); app.use(session({ secret: 'klavyemden-cıkan-cok-gizli-kelimeler', resave: false, saveUninitialized: true, }));
app.get('/', (req, res) => { res.render('login', { error: null }); });
app.post('/login', (req, res) => { const userKey = req.body.key; if (userKey === ADMIN_KEY) { req.session.isLoggedIn = true; req.session.isAdmin = true; return res.redirect('/viewer'); } const loginDb = new sqlite3.Database(dbPath); loginDb.serialize(() => { loginDb.get("SELECT first_used_at FROM access_keys WHERE key = ?", [userKey], (err, row) => { if (err) { res.render('login', { error: 'Bir veritabanı hatası oluştu.' }); loginDb.close(); return; } if (row) { req.session.isAdmin = false; if (row.first_used_at === null) { const now = new Date().toISOString(); loginDb.run("UPDATE access_keys SET first_used_at = ? WHERE key = ?", [now, userKey], (updateErr) => { if (updateErr) { res.render('login', { error: 'Veritabanı güncellenirken bir hata oluştu.' }); } else { req.session.isLoggedIn = true; res.redirect('/viewer'); } loginDb.close(); }); } else { const firstUsedDate = new Date(row.first_used_at); const expiryDate = new Date(firstUsedDate); expiryDate.setDate(firstUsedDate.getDate() + 30); if (expiryDate > new Date()) { req.session.isLoggedIn = true; res.redirect('/viewer'); } else { res.render('login', { error: 'Girdiğiniz anahtarın 1 aylık kullanım süresi dolmuş.' }); } loginDb.close(); } } else { res.render('login', { error: 'Geçersiz anahtar.' }); loginDb.close(); } }); }); });
app.get('/viewer', async (req, res) => { if (!req.session.isLoggedIn) { return res.redirect('/'); } const viewDb = new sqlite3.Database(dbPath); viewDb.get("SELECT setting_value FROM settings WHERE setting_key = 'copy_text'", [], async (err, row) => { if (err) { res.status(500).send("Ayar okuma hatası"); viewDb.close(); return; } const copyText = row ? row.setting_value : ''; const latestEmail = await getLatestEmail(); res.render('viewer', { email: latestEmail, isAdmin: req.session.isAdmin, copyText: copyText }); viewDb.close(); }); });
app.post('/update-copy-text', (req, res) => { if (!req.session.isAdmin) { return res.status(403).send("Yetkiniz yok."); } const newText = req.body.new_text; const updateDb = new sqlite3.Database(dbPath); updateDb.run("UPDATE settings SET setting_value = ? WHERE setting_key = 'copy_text'", [newText], (err) => { if (err) { res.status(500).send("Ayar kaydetme hatası"); } else { res.redirect('/viewer'); } updateDb.close(); }); });
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });
app.listen(PORT, () => { console.log(`Sunucu ${PORT} numaralı portta başarıyla başlatıldı.`); });