// Moteur de jeu de FIFA Pixel (Pro)

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mainMenu = document.getElementById("mainMenu");
const levelsGrid = document.getElementById("levelsGrid");
const hudLevel = document.getElementById("hudLevel");

let maxLevelUnlocked = 1;
let currentLevel = 1;
let gameLoopId = null;
let isPlaying = false;

// Config Terrain
let CW, CH;
const GOAL_WIDTH = 150;

// Entités
let ball = { x: 0, y: 0, vx: 0, vy: 0, owner: null };
let myTeam = [];
let enemyTeam = [];
let controlledPlayer = null;
let enemyGoalie = null;

// Inputs
let keys = { w:false, a:false, s:false, d:false, ArrowUp:false, ArrowLeft:false, ArrowDown:false, ArrowRight:false };
let joyX = 0, joyY = 0;

// Fetch DB Progress
async function fetchProgress() {
    const token = localStorage.getItem('token');
    if(!token) return 1;
    try {
        const res = await fetch('/api/auth/me', { headers: { 'x-auth-token': token } });
        if(res.ok) {
            const data = await res.json();
            return (data.scores && data.scores.fifa) ? data.scores.fifa + 1 : 1; 
        }
    } catch(e) { console.error(e); }
    return 1;
}

// Envoyer progression API
async function unlockNextLevel() {
    if(currentLevel >= maxLevelUnlocked) {
        maxLevelUnlocked = currentLevel + 1;
        const token = localStorage.getItem('token');
        if(token) {
            fetch('/api/stats/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
                body: JSON.stringify({ game: 'fifa', score: currentLevel })
            }).catch(e=>console.log(e));
        }
    }
}

// Initialisation Menu
async function initMenu() {
    maxLevelUnlocked = await fetchProgress();
    // Limite max level 5
    if(maxLevelUnlocked > 5) maxLevelUnlocked = 5;
    
    levelsGrid.innerHTML = "";
    for(let i=1; i<=5; i++) {
        let btn = document.createElement("button");
        btn.className = "level-btn " + (i <= maxLevelUnlocked ? "unlocked" : "locked");
        btn.innerHTML = i <= maxLevelUnlocked ? `Niveau ${i}` : `🔒 Niv ${i}`;
        
        if(i <= maxLevelUnlocked) {
            btn.onclick = () => launchGame(i);
        }
        levelsGrid.appendChild(btn);
    }
    mainMenu.style.display = "flex";
}

// Joystick Logique Mobile
const stick = document.getElementById("stick");
const joyZone = document.getElementById("joystickZone");
let joyActive = false, joyCenterX = 0, joyCenterY = 0;

joyZone.addEventListener("touchstart", (e) => {
    e.preventDefault();
    joyActive = true;
    let rect = joyZone.getBoundingClientRect();
    joyCenterX = rect.left + rect.width / 2;
    joyCenterY = rect.top + rect.height / 2;
    updateJoystick(e.touches[0]);
}, {passive: false});

joyZone.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if(joyActive) updateJoystick(e.touches[0]);
}, {passive: false});

joyZone.addEventListener("touchend", (e) => {
    e.preventDefault();
    joyActive = false;
    stick.style.transform = `translate(0px, 0px)`;
    joyX = 0; joyY = 0;
});

function updateJoystick(touch) {
    let dx = touch.clientX - joyCenterX;
    let dy = touch.clientY - joyCenterY;
    let distance = Math.hypot(dx, dy);
    let maxDist = 40;
    
    if(distance > maxDist) {
        dx = (dx / distance) * maxDist;
        dy = (dy / distance) * maxDist;
    }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    
    // Normalize entre -1 et 1
    joyX = dx / maxDist;
    joyY = dy / maxDist;
}

// Clavier
window.addEventListener("keydown", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = true; });
window.addEventListener("keyup", e => { if(keys.hasOwnProperty(e.key)) keys[e.key] = false; });

// Tirs et Passes (Double clic = Frappe)
let lastClickTime = 0;
canvas.addEventListener("click", (e) => {
    if(!isPlaying || !controlledPlayer) return;
    let rect = canvas.getBoundingClientRect();
    let cx = e.clientX - rect.left;
    let cy = e.clientY - rect.top;
    
    let now = Date.now();
    let isDoubleClick = (now - lastClickTime < 300);
    lastClickTime = now;

    // Si on a la balle
    if(ball.owner === controlledPlayer) {
        let dx = cx - controlledPlayer.x;
        let dy = cy - controlledPlayer.y;
        let dist = Math.hypot(dx, dy);
        let dirX = dx/dist; let dirY = dy/dist;

        if(isDoubleClick) {
            // FRAPPE Puissante
            ball.owner = null;
            ball.vx = dirX * 15;
            ball.vy = dirY * 15;
        } else {
            // PASSE
            // Chercher le coéquipier le plus proche du clic
            let bestMate = null;
            let minDist = 9999;
            for(let p of myTeam) {
                if(p === controlledPlayer) continue;
                let d = Math.hypot(p.x - cx, p.y - cy);
                if(d < minDist) { minDist = d; bestMate = p; }
            }
            if(bestMate) {
                ball.owner = null;
                // Calcul direction vers coéquipier
                let px = bestMate.x - controlledPlayer.x;
                let py = bestMate.y - controlledPlayer.y;
                let pd = Math.hypot(px, py);
                ball.vx = (px/pd) * 10;
                ball.vy = (py/pd) * 10;
                controlledPlayer = bestMate; // Switch auto
            }
        }
    } else {
        // Tacle manuel
        let clickedEnemy = null;
        for(let e of enemyTeam) {
            if(Math.hypot(e.x - cx, e.y - cy) < 40) {
               clickedEnemy = e; break; 
            }
        }
        if(clickedEnemy) {
            let distToEnemy = Math.hypot(controlledPlayer.x - clickedEnemy.x, controlledPlayer.y - clickedEnemy.y);
            if(distToEnemy < 60) {
                // Tacle réussi
                if(ball.owner === clickedEnemy) {
                    ball.owner = controlledPlayer;
                } else {
                    // Stun l'ennemi temporairement
                    clickedEnemy.speed = 0;
                    setTimeout(() => { clickedEnemy.speed = 2 + currentLevel * 0.5; }, 2000);
                }
            }
        }
    }
});

// Pour les boutons mobiles
document.getElementById("btnShoot").addEventListener("touchstart", (e) => {
    e.preventDefault();
    if(ball.owner === controlledPlayer) {
        ball.owner = null;
        // Frappe vers le haut (but ennemi)
        ball.vx = 0; ball.vy = -15;
    }
});
document.getElementById("btnPass").addEventListener("touchstart", (e) => {
    e.preventDefault();
    if(ball.owner === controlledPlayer) {
        let bestMate = null; let minDist = 9999;
        for(let p of myTeam) {
            if(p === controlledPlayer) continue;
            let d = Math.hypot(p.x - controlledPlayer.x, p.y - controlledPlayer.y);
            if(d < minDist && p.y < controlledPlayer.y) { minDist = d; bestMate = p; } // Passe en avant
        }
        if(bestMate) {
            ball.owner = null;
            let px = bestMate.x - controlledPlayer.x;
            let py = bestMate.y - controlledPlayer.y;
            let pd = Math.hypot(px, py);
            ball.vx = (px/pd) * 10; ball.vy = (py/pd) * 10;
            controlledPlayer = bestMate; 
        }
    }
});


// Moteur Physique
function launchGame(level) {
    currentLevel = level;
    mainMenu.style.display = "none";
    hudLevel.innerText = currentLevel;
    isPlaying = true;
    
    CW = window.innerWidth;
    CH = window.innerHeight;
    canvas.width = CW;
    canvas.height = CH;

    myTeam = [];
    enemyTeam = [];
    
    // Spawn Team Bleue (3 joueurs)
    myTeam.push({ x: CW/2, y: CH - 100, color: "blue", speed: 5 });
    myTeam.push({ x: CW/2 - 100, y: CH - 200, color: "blue", speed: 4.5 });
    myTeam.push({ x: CW/2 + 100, y: CH - 200, color: "blue", speed: 4.5 });
    controlledPlayer = myTeam[0];

    // Spawn Team Rouge en fonction du niveau
    for(let i=0; i<currentLevel + 1; i++) {
        enemyTeam.push({ x: CW/2 + (Math.random()-0.5)*CW*0.8, y: 150 + Math.random()*CH/2, color: "red", speed: 2 + currentLevel*0.5 });
    }
    enemyGoalie = { x: CW/2, y: 50, color: "yellow", speed: 3 + currentLevel };

    ball.x = CW/2; ball.y = CH/2; ball.vx = 0; ball.vy = 0; ball.owner = null;

    if(gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoop();
}

function endGame(win) {
    isPlaying = false;
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0,0,CW,CH);
    ctx.fillStyle = "white";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    
    if(win) {
        ctx.fillStyle = "gold";
        ctx.fillText("BUT ! NIVEAU TERMINÉ 🏆", CW/2, CH/2);
        unlockNextLevel();
    } else {
        ctx.fillStyle = "red";
        ctx.fillText("TACCLÉ ! PERDU 💥", CW/2, CH/2);
    }
    
    setTimeout(() => {
        initMenu();
    }, 2000);
}

function drawPitch() {
    ctx.fillStyle = "#27ae60"; // Gazon
    ctx.fillRect(0,0,CW,CH);
    // Lignes blanches
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    // Ligne médiane
    ctx.beginPath(); ctx.moveTo(0, CH/2); ctx.lineTo(CW, CH/2); ctx.stroke();
    // Rond central
    ctx.beginPath(); ctx.arc(CW/2, CH/2, 60, 0, Math.PI*2); ctx.stroke();
    // Surface réparation Ennemie
    ctx.strokeRect(CW/2 - 150, 0, 300, 150);
    // But Ennemi
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(CW/2 - GOAL_WIDTH/2, 0, GOAL_WIDTH, 20);
}

function gameLoop() {
    if(!isPlaying) return;
    
    drawPitch();

    // Mouvements Joueur Actif
    let dx = 0, dy = 0;
    if(keys.w || keys.ArrowUp) dy -= 1;
    if(keys.s || keys.ArrowDown) dy += 1;
    if(keys.a || keys.ArrowLeft) dx -= 1;
    if(keys.d || keys.ArrowRight) dx += 1;
    
    // Combinaison clavier + joystick
    dx += joyX; dy += joyY;
    
    // Normalisation si clavier diagonal
    if(dx !== 0 && dy !== 0 && joyX === 0) {
        let mag = Math.hypot(dx, dy);
        dx /= mag; dy /= mag;
    }

    if(controlledPlayer) {
        controlledPlayer.x += dx * controlledPlayer.speed;
        controlledPlayer.y += dy * controlledPlayer.speed;

        // Frontières
        controlledPlayer.x = Math.max(15, Math.min(CW-15, controlledPlayer.x));
        controlledPlayer.y = Math.max(15, Math.min(CH-15, controlledPlayer.y));
    }

    // Dessin Joueurs AI Bleus
    for(let p of myTeam) {
        if(p === controlledPlayer) continue;
        let tx = p.x; let ty = p.y;
        // IA basique : monter avec le porteur
        if(ball.owner) {
            if(p === myTeam[0]) { tx = ball.x + 80; ty = ball.y; }
            if(p === myTeam[1]) { tx = ball.x - 80; ty = ball.y; }
            if(p === myTeam[2]) { tx = ball.x; ty = ball.y + 100; }
        }
        let dxAI = tx - p.x; let dyAI = ty - p.y;
        let dAI = Math.hypot(dxAI, dyAI);
        if(dAI > 5) {
            p.x += (dxAI/dAI) * (p.speed * 0.5);
            p.y += (dyAI/dAI) * (p.speed * 0.5);
        }
        p.x = Math.max(15, Math.min(CW-15, p.x));
        p.y = Math.max(15, Math.min(CH-15, p.y));
    }

    // IA Défenseurs (poursuivent la balle ou son porteur)
    for(let e of enemyTeam) {
        let tx = ball.x; let ty = ball.y;
        let ex = tx - e.x; let ey = ty - e.y;
        let dist = Math.hypot(ex, ey);
        if(dist > 5) {
            e.x += (ex/dist) * e.speed;
            e.y += (ey/dist) * e.speed;
        }

        // Tacle ?
        if(controlledPlayer && ball.owner === controlledPlayer) {
            let pDist = Math.hypot(controlledPlayer.x - e.x, controlledPlayer.y - e.y);
            if(pDist < 20) {
                endGame(false);
                return;
            }
        }
    }

    // IA Gardien
    if(Math.abs(ball.x - enemyGoalie.x) > 5) {
        enemyGoalie.x += Math.sign(ball.x - enemyGoalie.x) * enemyGoalie.speed;
    }
    // Collisions gardien (arrêts)
    if(Math.hypot(ball.x - enemyGoalie.x, ball.y - enemyGoalie.y) < 30) {
        ball.vx *= -1; ball.vy *= -1; ball.owner = null;
    }

    // Mouvement Balle
    if(ball.owner) {
        ball.x = ball.owner.x;
        ball.y = ball.owner.y - 15; // Balle devant au pied
    } else {
        ball.x += ball.vx;
        ball.y += ball.vy;
        ball.vx *= 0.96; // Friction herbe
        ball.vy *= 0.96;

        // Rebond murs latéraux
        if(ball.x < 10 || ball.x > CW-10) ball.vx *= -1;
        // Rebond ligne de fond alliée
        if(ball.y > CH-10) ball.vy *= -1;

        // Ramassage Balle
        for(let p of myTeam) {
            if(Math.hypot(p.x - ball.x, p.y - ball.y) < 25) {
                ball.owner = p;
                controlledPlayer = p; // Switch automatique au porteur
                break;
            }
        }
    }

    // Condition Victoire (BUT)
    if(ball.y <= 20 && ball.x > CW/2 - GOAL_WIDTH/2 && ball.x < CW/2 + GOAL_WIDTH/2) {
        endGame(true);
        return;
    }

    // Dessin Joueurs
    ctx.font = "25px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for(let p of myTeam) {
        ctx.fillStyle = p === controlledPlayer ? "cyan" : "rgba(0,0,255,0.7)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill();
        // Halo de possession/contrôle
        if(p === controlledPlayer) {
            ctx.strokeStyle = "white"; ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    for(let e of enemyTeam) {
        ctx.fillStyle = "red";
        ctx.beginPath(); ctx.arc(e.x, e.y, 15, 0, Math.PI*2); ctx.fill();
    }

    // Gardien
    ctx.fillStyle = "yellow";
    ctx.fillRect(enemyGoalie.x - 15, enemyGoalie.y - 15, 30, 30);

    // Dessin Balle
    ctx.fillText("⚽", ball.x, ball.y);

    gameLoopId = requestAnimationFrame(gameLoop);
}

// Lancement au chargement
initMenu();
