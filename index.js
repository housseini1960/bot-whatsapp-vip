const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, once, child, set, get } = require('firebase/database');

// Configuration Firebase identique à ton site web
const firebaseConfig = {
    projectId: "vip-pronos",
    databaseURL: "https://firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log("👉 Scanne ce QR Code avec ton WhatsApp pour activer le Bot !");
        }
        if (connection === 'open') {
            console.log('🚀 Le Bot WhatsApp VIP est connecté et prêt à travailler !');
        }
    });

    sock.ev.on('messages.upsert', async m => {
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
    });
}

startBot();
