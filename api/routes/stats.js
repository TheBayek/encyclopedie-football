const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_arcade_key_2026';

const verifyToken = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ message: 'Non autorisé' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token invalide' });
    }
};

router.post('/update', verifyToken, async (req, res) => {
    try {
        const { game, score } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.scores[game] === undefined) { user.scores[game] = 0; }

        if (score > user.scores[game]) {
            user.scores[game] = score;
            await user.save();
            return res.json({ message: 'Nouveau Record !', scores: user.scores });
        }
        res.json({ message: 'Score enregistré', scores: user.scores });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Erreur Serveur Interne' });
    }
});

router.get('/leaderboard/:game', async (req, res) => {
    try {
        const game = req.params.game;
        const sortQuery = {};
        sortQuery[`scores.${game}`] = -1;

        const topUsers = await User.find({ [`scores.${game}`]: { $gt: 0 } })
            .sort(sortQuery)
            .limit(5)
            .select(`pseudo scores.${game}`);
        
        const leaderboard = topUsers.map(u => ({ pseudo: u.pseudo, score: u.scores[game] || 0 }));
        res.json(leaderboard);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Erreur Serveur Interne' });
    }
});

router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if(!user) return res.status(404).json({ message: "Compte non trouvé" });
        res.json(user.scores || {});
    } catch(err) {
        res.status(500).json({ message: 'Erreur Serveur Interne' });
    }
});

module.exports = router;
