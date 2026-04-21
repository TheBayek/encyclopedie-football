const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'footpedia_super_secret_key_123';

// @route   POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { pseudo, email, password } = req.body;
        
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'Cet email est déjà utilisé' });

        user = await User.findOne({ pseudo });
        if (user) return res.status(400).json({ message: 'Ce pseudo est déjà pris' });

        user = new User({ pseudo, email, password });
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        await user.save();

        const token = jwt.sign({ id: user._id, pseudo: user.pseudo }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, pseudo: user.pseudo, email: user.email } });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Erreur Serveur Interne' });
    }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Compte introuvable' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Mot de passe incorrect' });

        const token = jwt.sign({ id: user._id, pseudo: user.pseudo }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, pseudo: user.pseudo, email: user.email } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Erreur Serveur');
    }
});

module.exports = router;
