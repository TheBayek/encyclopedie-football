const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    pseudo: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    scores: {
        dribble: { type: Number, default: 0 },
        penalty: { type: Number, default: 0 },
        jongles: { type: Number, default: 0 },
        gardien: { type: Number, default: 0 },
        flappy: { type: Number, default: 0 },
        pong: { type: Number, default: 0 },
        fifa: { type: Number, default: 0 }
    },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
