const fs = require('fs');

let b = fs.readFileSync('js/jeux.js', 'utf8');

// Dribble click
b = b.replace(/dribbleCanvas\.addEventListener\("click", \(\) => {([\s\S]*?)}\);/, 'dribbleCanvas.addEventListener("click", () => {$1});\n\n    dribbleCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); $1}, {passive: false});');

// Penalty click
b = b.replace(/penaltyCanvas\.addEventListener\("click", \(\) => {([\s\S]*?)}\);/, 'penaltyCanvas.addEventListener("click", () => {$1});\n\n    penaltyCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); $1}, {passive: false});');

// Jongles mousedown
b = b.replace(/jonglesCanvas\.addEventListener\("mousedown", \(e\) => {([\s\S]*?)}\);/, 'jonglesCanvas.addEventListener("mousedown", (e) => {$1});\n\n    jonglesCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); let ev = e.touches[0]; Object.defineProperty(ev, \'offsetX\', {get: () => ev.clientX - jonglesCanvas.getBoundingClientRect().left}); Object.defineProperty(ev, \'offsetY\', {get: () => ev.clientY - jonglesCanvas.getBoundingClientRect().top}); let originalE = e; e = ev; $1}, {passive: false});');

// Gardien mousedown
b = b.replace(/gardienCanvas\.addEventListener\("mousedown", \(e\) => {([\s\S]*?)}\);/, 'gardienCanvas.addEventListener("mousedown", (e) => {$1});\n\n    gardienCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); let ev = e.touches[0]; Object.defineProperty(ev, \'offsetX\', {get: () => ev.clientX - gardienCanvas.getBoundingClientRect().left}); Object.defineProperty(ev, \'offsetY\', {get: () => ev.clientY - gardienCanvas.getBoundingClientRect().top}); let originalE = e; e = ev; $1}, {passive: false});');

// Flappy mousedown
b = b.replace(/flappyCanvas\.addEventListener\("mousedown", \(\) => {([\s\S]*?)}\);/, 'flappyCanvas.addEventListener("mousedown", () => {$1});\n\n    flappyCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); $1}, {passive: false});');

// Pong mousemove
b = b.replace(/pongCanvas\.addEventListener\("mousemove", \(e\) => {([\s\S]*?)}\);/, 'pongCanvas.addEventListener("mousemove", (e) => {$1});\n\n    pongCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); let ev = e.touches[0]; ev.clientY = ev.clientY; let originalE = e; e = ev; $1}, {passive: false});');

// Pong mousedown
b = b.replace(/pongCanvas\.addEventListener\("mousedown", \(\) => {([\s\S]*?)}\);/, 'pongCanvas.addEventListener("mousedown", () => {$1});\n\n    pongCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); $1}, {passive: false});');

fs.writeFileSync('js/jeux.js', b);
console.log("Patched js/jeux.js for touch events");
