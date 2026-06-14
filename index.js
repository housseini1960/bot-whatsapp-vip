const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Bot is running'); }).listen(process.env.PORT || 10000);

const { default: makeWASocket, useSnapshotAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const firebaseConfig = {
    projectId: "vip-pronos",
    databaseURL: "https://vip-pronos-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function startBot() {
    // Utilisation de useSnapshotAuthState pour éviter les erreurs d'écriture sur Render
    const state = useSnapshotAuthState();
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log("👉 Scanne ce QR Code avec ton WhatsApp pour activer le Bot !");
        }
        if (connection === 'open') {
            console.log('🚀 Le Bot WhatsApp VIP est connecté et prêt à travailler !');
        }
        if (connection === 'close') {
            console.log('🔄 Reconnexion en cours...');
            setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const remoteJid = msg.key.remoteJid;
            const userMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().toLowerCase();

            if (userMessage.includes("voici ma preuve dmmd7") || userMessage === "vip" || userMessage === "bonjour") {
                await sock.sendMessage(remoteJid, { text: "👋 *Bienvenue chez VIP PRONOS !*\n\nPour recevoir ton code d'accès unique, envoie-moi ton *ID Bookmaker* (uniquement les chiffres) pour vérification." });
                return;
            }

            if (/^\d+$/.test(userMessage)) {
                await sock.sendMessage(remoteJid, { text: "🔍 *Vérification de ton inscription en cours...*" });

                const promoRef = ref(db, 'codes_promos');
                get(promoRef).then(async (snapshot) => {
                    if (!snapshot.exists()) return;
                    let codeAttribue = null;
                    snapshot.forEach((childSnapshot) => {
                        if (childSnapshot.val() === false && !codeAttribue) {
                            codeAttribue = childSnapshot.key;
                        }
                    });

                    if (codeAttribue) {
                        await set(ref(db, 'codes_promos/' + codeAttribue), true);
                        await sock.sendMessage(remoteJid, { text: `✅ *Inscription vérifiée avec succès !*\n\nVoici ton code d'accès VIP unique et personnel :\n🔑 *${codeAttribue}*\n\n👉 Entre-le vite sur notre site pour débloquer tes tickets VIP.` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "⚠️ *Désolé, tous nos codes VIP ont été distribués.*" });
                    }
                });
            }
        } catch (e) {
            console.log("Erreur message: ", e);
        }
    });
}

// Gestion globale des erreurs pour empêcher Render de crasher
process.on('uncaughtException', (err) => { console.log('Erreur ignorée : ', err.message); });

startBot();
