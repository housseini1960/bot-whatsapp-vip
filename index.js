const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('Bot is running'); }).listen(process.env.PORT || 10000);

const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const firebaseConfig = {
    projectId: "vip-pronos",
    databaseURL: "https://firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function startBot() {
    // Utilisation de useMultiFileAuthState pour stabiliser Baileys
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Demande du code après 10 secondes
    setTimeout(async () => {
        try {
            const monNumero = "22774126709"; 
            let code = await sock.requestPairingCode(monNumero);
            console.log(`🔑 TON CODE D'ACTIVATION WHATSAPP EST : ${code}`);
        } catch (e) {
            console.log("Erreur code appairage : ", e);
        }
    }, 10000);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('🚀 Le Bot WhatsApp VIP est connecté et prêt à travailler !');
        }
        if (connection === 'close') {
            setTimeout(startBot, 5000);
        }
    });

    sock.ev.on('messages.upsert', async m => {
        try {
            const msg = m.messages;
            if (!msg.message || msg.key.fromMe) return;
            const remoteJid = msg.key.remoteJid;
            const userMessage = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim().toLowerCase();

            if (userMessage.includes("voici ma preuve dmmd7") || userMessage === "vip" || userMessage === "bonjour") {
                await sock.sendMessage(remoteJid, { text: "👋 *Bienvenue chez VIP PRONOS !*\n\nPour recevoir ton code d'accès unique, envoie-moi ton *ID Bookmaker* pour vérification." });
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
                        await sock.sendMessage(remoteJid, { text: `✅ *Inscription vérifiée avec succès !*\n\nVoici ton code d'accès VIP unique :🔑 *${codeAttribue}*` });
                    }
                });
            }
        } catch (e) { console.log(e); }
    });
}
process.on('uncaughtException', (err) => { console.log("Erreur capturée : ", err.message); });
startBot();
