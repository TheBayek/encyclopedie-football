const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Middleware Serverless pour MongoDB
app.use(async (req, res, next) => {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('ERREUR CRITIQUE: MONGODB_URI est manquant (undefined) ! Vérifie tes Vercel Environment Variables.');
        return res.status(500).json({ message: 'Configuration Base de Données manquante.' });
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('⏳ Connexion à MongoDB en cours (Serverless cold start)...');
            await mongoose.connect(MONGODB_URI, {
                serverSelectionTimeoutMS: 8000 // 8 secondes de timeout max
            });
            console.log('✅ MongoDB connecté !');
        }
        next();
    } catch (err) {
        console.error('❌ ECHEC DE CONNEXION MONGODB:', err.message);
        res.status(500).json({ message: 'Impossible de se connecter à la DB.' });
    }
});

// Routes
app.get('/api/ping', (req, res) => res.json({ message: 'API fonctionne parfaitement sur Vercel !' }));
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);

// Pour lancer localement facilement avec `node api/index.js` (hors Vercel)
if (process.env.NODE_ENV !== 'production') {
    const path = require('path');
    app.use(express.static(path.join(__dirname, '../'))); // Sert les fichiers HTML/CSS/JS

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Serveur local et Site Web lancés sur http://localhost:${PORT}`);
    });
}

// Export pour Vercel Serverless
module.exports = app;
