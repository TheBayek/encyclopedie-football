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

// Database connection
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI && MONGODB_URI !== 'ton_lien_mongodb_ici') {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ MongoDB connecté avec succès !'))
        .catch(err => console.error('❌ Erreur de connexion MongoDB:', err));
} else {
    console.log('⚠️ ATTENTION: MONGODB_URI est manquant dans le fichier .env ! Insère-le pour lier la Base de Données.');
}

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
