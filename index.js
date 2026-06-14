const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const admin = require('firebase-admin');

// 1. Connexion automatique à ta base Firebase VIP Pronos
const firebaseConfig = {
    projectId: "vip-pronos",
    databaseURL: "https://vip-pronos-default-rtdb.firebaseio.com"
};

if (admin.apps.length === 0) {
    admin.initializeApp(firebaseConfig);
}
const db = admin.database();

// 2. Initialisation du client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Affichage du QR Code dans le terminal pour l'activation
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log("👉 Scanne ce QR Code avec ton WhatsApp pour activer le Bot !");
});

client.on('ready', () => {
    console.log('🚀 Le Bot WhatsApp VIP est connecté et prêt à travailler !');
});

// 3. Logique de réponse automatique aux messages des clients
client.on('message', async (msg) => {
    const chat = await msg.getChat();
    const userMessage = msg.body.trim().toLowerCase();

    // Détection du premier message provenant de ton site de pronostics
    if (userMessage.includes("voici ma preuve dmmd7") || userMessage === "vip" || userMessage === "bonjour") {
        await chat.sendMessage("👋 *Bienvenue chez VIP PRONOS !*\n\nPour recevoir ton code d'accès unique, envoie-moi ton *ID Bookmaker* (uniquement les chiffres) pour vérification.");
        return;
    }

    // Si le client envoie des chiffres (son ID), on lui distribue son code VIP
    if (/^\d+$/.test(userMessage)) {
        await chat.sendMessage("🔍 *Vérification de ton inscription en cours...*");

        // Connexion à Firebase pour chercher un code VIP promo disponible ('false')
        const promoRef = db.ref('codes_promos');
        
        promoRef.once('value', async (snapshot) => {
            if (!snapshot.exists()) {
                await chat.sendMessage("❌ Aucun code VIP n'est configuré pour le moment.");
                return;
            }

            let codeAttribue = null;

            // On cherche le premier code de ta base qui est à 'false' (non utilisé)
            snapshot.forEach((childSnapshot) => {
                if (childSnapshot.val() === false && !codeAttribue) {
                    codeAttribue = childSnapshot.key;
                }
            });

            if (codeAttribue) {
                // On donne le code au client et on le marque instantanément à true pour le griller
                await promoRef.child(codeAttribue).set(true);
                
                await chat.sendMessage(`✅ *Inscription vérifiée avec succès !*\n\nVoici ton code d'accès VIP unique et personnel :\n🔑 *${codeAttribue}*\n\n👉 Entre-le vite sur notre site pour débloquer tes tickets VIP. (Attention, il ne marche que sur un seul téléphone !)`);
            } else {
                await chat.sendMessage("⚠️ *Désolé, tous nos codes VIP pour cette session ont déjà été distribués.* Contacte l'administrateur.");
            }
        }).catch(async (error) => {
            await chat.sendMessage("❌ Une erreur technique est survenue. Réessaie plus tard.");
        });
    }
});

client.initialize();

