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
const WORLD_W = 1200;
const WORLD_H = 1800;
let camX = 0, camY = 0;
const GOAL_WIDTH = 150;

// Entités
let ball = { x: 0, y: 0, vx: 0, vy: 0, owner: null };
let myTeam = [];
let enemyTeam = [];
let controlledPlayer = null;
let enemyGoalie = null;

// Inputs
let keys = { w:false, a:false, s:false, d:false, z:false, q:false, ArrowUp:false, ArrowLeft:false, ArrowDown:false, ArrowRight:false };
let joyX = 0, joyY = 0;

// Fetch DB Progress
async function fetchProgress() {
    const token = localStorage.getItem('token');
    if(!token) return maxLevelUnlocked;
    try {
        const res = await fetch('/api/stats/me', { headers: { 'x-auth-token': token } });
        if(res.ok) {
            const data = await res.json();
            let dbLevel = (data.fifa !== undefined) ? data.fifa + 1 : 1;
            return Math.max(dbLevel, maxLevelUnlocked); 
        }
    } catch(e) { console.error(e); }
    return maxLevelUnlocked;
}

// Envoyer progression API
async function unlockNextLevel() {
    if(currentLevel >= maxLevelUnlocked) {
        maxLevelUnlocked = currentLevel + 1;
        const token = localStorage.getItem('token');
        if(token) {
            await fetch('/api/stats/update', {
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

// Tirs et Passes (Système de Charge)
let chargeStartTime = 0;
let isCharging = false;
let chargeX = 0, chargeY = 0;

canvas.addEventListener("mousedown", startCharge);
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); startCharge(e.touches[0] || e); }, {passive: false});

function startCharge(e) {
    if(!isPlaying || !controlledPlayer) return;
    
    // Tacle direct (sans charge) si pas la balle
    if(ball.owner !== controlledPlayer) {
        let rect = canvas.getBoundingClientRect();
        let cx = e.clientX - rect.left + camX;
        let cy = e.clientY - rect.top + camY;
        
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
                    clickedEnemy.speed = 0;
                    setTimeout(() => { clickedEnemy.speed = 2 + currentLevel * 0.5; }, 2000);
                }
            }
        }
        return;
    }

    // Sinon, on démarre la charge pour une passe/tir
    chargeStartTime = Date.now();
    isCharging = true;
}

canvas.addEventListener("mouseup", endCharge);
canvas.addEventListener("touchend", (e) => { e.preventDefault(); endCharge(e.changedTouches[0] || e); }, {passive: false});

function endCharge(e) {
    if(!isPlaying || !controlledPlayer || !isCharging) return;
    isCharging = false;

    let rect = canvas.getBoundingClientRect();
    let cx = e.clientX - rect.left + camX;
    let cy = e.clientY - rect.top + camY;

    if(ball.owner === controlledPlayer) {
        let duration = Date.now() - chargeStartTime;
        let dx = cx - controlledPlayer.x;
        let dy = cy - controlledPlayer.y;
        let dist = Math.hypot(dx, dy);
        let dirX = dx/dist; let dirY = dy/dist;

        if(duration > 400) {
            // FRAPPE Puissante (Charge)
            // ex: 5 secondes (5000ms) = Vitesse 25
            let speed = 8 + (duration / 5000) * 20; 
            if(speed > 28) speed = 28; // Max limit
            
            ball.owner = null;
            ball.vx = dirX * speed;
            ball.vy = dirY * speed;
        } else {
            // PASSE Douce (Clic rapide)
            let bestMate = null;
            let minDist = 9999;
            for(let p of myTeam) {
                if(p === controlledPlayer) continue;
                let d = Math.hypot(p.x - cx, p.y - cy);
                if(d < minDist) { minDist = d; bestMate = p; }
            }
            if(bestMate) {
                ball.owner = null;
                let px = bestMate.x - controlledPlayer.x;
                let py = bestMate.y - controlledPlayer.y;
                let pd = Math.hypot(px, py);
                ball.vx = (px/pd) * 8;
                ball.vy = (py/pd) * 8;
                controlledPlayer = bestMate; 
            }
        }
    }
}

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
    myTeam.push({ x: WORLD_W/2, y: WORLD_H - 200, color: "blue", speed: 5 });
    myTeam.push({ x: WORLD_W/2 - 100, y: WORLD_H - 350, color: "blue", speed: 4.5 });
    myTeam.push({ x: WORLD_W/2 + 100, y: WORLD_H - 350, color: "blue", speed: 4.5 });
    controlledPlayer = myTeam[0];

    // Spawn Team Rouge en fonction du niveau
    for(let i=0; i<currentLevel + 1; i++) {
        enemyTeam.push({ x: WORLD_W/2 + (Math.random()-0.5)*WORLD_W*0.6, y: 150 + Math.random()*WORLD_H*0.4, color: "red", speed: 2 + currentLevel*0.5 });
    }
    enemyGoalie = { x: WORLD_W/2, y: 50, color: "yellow", speed: 3 + currentLevel };

    ball.x = WORLD_W/2; ball.y = WORLD_H/2 + 200; ball.vx = 0; ball.vy = 0; ball.owner = null;

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
    ctx.fillRect(0,0,WORLD_W,WORLD_H);
    // Lignes blanches
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    // Ligne médiane
    ctx.beginPath(); ctx.moveTo(0, WORLD_H/2); ctx.lineTo(WORLD_W, WORLD_H/2); ctx.stroke();
    // Rond central
    ctx.beginPath(); ctx.arc(WORLD_W/2, WORLD_H/2, 60, 0, Math.PI*2); ctx.stroke();
    // Surface réparation Ennemie
    ctx.strokeRect(WORLD_W/2 - 150, 0, 300, 150);
    // But Ennemi
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(WORLD_W/2 - GOAL_WIDTH/2, 0, GOAL_WIDTH, 20);

    // Surface réparation Alliée
    ctx.strokeRect(WORLD_W/2 - 150, WORLD_H - 150, 300, 150);
    // But Allié
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fillRect(WORLD_W/2 - GOAL_WIDTH/2, WORLD_H - 20, GOAL_WIDTH, 20);
}

function gameLoop() {
    if(!isPlaying) return;
    
    // Remplir le fond hors monde
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,CW,CH);

    // Calcul de la caméra
    let targetCamX, targetCamY;
    if(controlledPlayer) {
        targetCamX = controlledPlayer.x - CW/2;
        targetCamY = controlledPlayer.y - CH/2;
    } else {
        targetCamX = ball.x - CW/2;
        targetCamY = ball.y - CH/2;
    }
    
    camX += (targetCamX - camX) * 0.1; // Smooth camera
    camY += (targetCamY - camY) * 0.1;
    
    let maxCamX = Math.max(0, WORLD_W - CW);
    let maxCamY = Math.max(0, WORLD_H - CH);

    camX = Math.max(0, Math.min(maxCamX, camX));
    camY = Math.max(0, Math.min(maxCamY, camY));

    // Si l'écran est plus grand que le terrain, on centre
    if(CW > WORLD_W) camX = -(CW - WORLD_W)/2;
    if(CH > WORLD_H) camY = -(CH - WORLD_H)/2;

    ctx.save();
    ctx.translate(-camX, -camY);

    drawPitch();

    // Mouvements Joueur Actif
    let dx = 0, dy = 0;
    if(keys.w || keys.z || keys.ArrowUp) dy -= 1;
    if(keys.s || keys.ArrowDown) dy += 1;
    if(keys.a || keys.q || keys.ArrowLeft) dx -= 1;
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
        controlledPlayer.x = Math.max(15, Math.min(WORLD_W-15, controlledPlayer.x));
        controlledPlayer.y = Math.max(15, Math.min(WORLD_H-15, controlledPlayer.y));
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
        p.x = Math.max(15, Math.min(WORLD_W-15, p.x));
        p.y = Math.max(15, Math.min(WORLD_H-15, p.y));
    }

    // IA Défenseurs
    // 1. Trouver qui est le plus proche de la balle
    let closestEnemy = null;
    let minDistEnemy = Infinity;
    for(let e of enemyTeam) {
        if(e.stunned > 0) { e.stunned--; continue; }
        if(ball.owner === e) {
            closestEnemy = e;
            minDistEnemy = 0;
            break;
        }
        let d = Math.hypot(ball.x - e.x, ball.y - e.y);
        if(d < minDistEnemy) { minDistEnemy = d; closestEnemy = e; }
    }

    // 2. Comportement des défenseurs
    for(let i=0; i<enemyTeam.length; i++) {
        let e = enemyTeam[i];
        if(e.stunned > 0) continue;
        
        let tx = e.x, ty = e.y;
        if(e === closestEnemy) {
            if (ball.owner === e) {
                // Fonce vers notre ligne de fond
                tx = e.x; ty = CH;
            } else {
                // Le plus proche fonce sur la balle
                tx = ball.x; ty = ball.y;
            }
        } else {
            // Les autres se placent en retrait (ligne défensive)
            tx = CW/2 + (i - enemyTeam.length/2)*80;
            ty = ball.y - 150; // couvrent la profondeur
            if(ty < 150) ty = 150;
        }

        let ex = tx - e.x; let ey = ty - e.y;
        let dist = Math.hypot(ex, ey);
        if(dist > 5) {
            e.x += (ex/dist) * e.speed;
            e.y += (ey/dist) * e.speed;
        }

        // Si l'ennemi touche le porteur du ballon (Nous) -> Vol de balle (ou Perdu direct)
        // Laissons le vol de balle pour créer un vrai jeu de possession
        if(ball.owner && myTeam.includes(ball.owner)) {
            let pDist = Math.hypot(ball.owner.x - e.x, ball.owner.y - e.y);
            if(pDist < 20) {
                ball.owner.stunned = 30; // On est assommé
                controlledPlayer = null;
                ball.owner = e; // L'ennemi prend la balle !
            }
        }
    }
    
    // Si l'ennemi porte la balle, il décide de la dégager vers le bas
    if(ball.owner && enemyTeam.includes(ball.owner)) {
        if(Math.random() < 0.05) { // Un peu de hasard
            ball.owner = null;
            ball.vx = (Math.random()-0.5)*10;
            ball.vy = 15; // Dégagement vers l'arrière
        }
    }

    // IA Gardien
    if(Math.abs(ball.x - enemyGoalie.x) > 5) {
        enemyGoalie.x += Math.sign(ball.x - enemyGoalie.x) * enemyGoalie.speed;
    }
    // Collisions gardien (arrêts)
    if(!enemyTeam.includes(ball.owner) && Math.hypot(ball.x - enemyGoalie.x, ball.y - enemyGoalie.y) < 30) {
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
        if(ball.x < 10 || ball.x > WORLD_W-10) ball.vx *= -1;
        // Rebond ligne de fond alliée (Si la balle descend trop, on a perdu)
        if(ball.y > WORLD_H-10) {
            endGame(false);
            return;
        }

        // Ramassage Balle
        let claimed = false;
        // On vérifie le joueur contrôlé d'abord
        if(controlledPlayer && !(controlledPlayer.stunned > 0) && Math.hypot(controlledPlayer.x - ball.x, controlledPlayer.y - ball.y) < 25) {
            ball.owner = controlledPlayer;
            claimed = true;
        }
        if(!claimed) {
            for(let p of myTeam) {
                if(!(p.stunned > 0) && Math.hypot(p.x - ball.x, p.y - ball.y) < 25) {
                    ball.owner = p;
                    controlledPlayer = p; // Switch automatique
                    claimed = true;
                    break;
                }
            }
        }
        if(!claimed) {
            for(let e of enemyTeam) {
                if(!(e.stunned > 0) && Math.hypot(e.x - ball.x, e.y - ball.y) < 25) {
                    ball.owner = e;
                    break;
                }
            }
        }
    }
    
    // Tacle Automatique par joueur contrôlé sur ennemi porteur
    if(controlledPlayer && ball.owner && enemyTeam.includes(ball.owner)) {
        if(Math.hypot(controlledPlayer.x - ball.owner.x, controlledPlayer.y - ball.owner.y) < 30) {
            ball.owner.stunned = 30; // Et bim !
            ball.owner = controlledPlayer;
        }
    }

    // Condition Victoire (BUT)
    if(ball.y <= 20 && ball.x > WORLD_W/2 - GOAL_WIDTH/2 && ball.x < WORLD_W/2 + GOAL_WIDTH/2) {
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

    // Dessin de la jauge de charge (si on charge)
    if(isCharging && controlledPlayer) {
        let duration = Date.now() - chargeStartTime;
        let powerRatio = Math.min(1, duration / 5000); // Max 5s
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(controlledPlayer.x - 20, controlledPlayer.y - 30, 40, 6);
        ctx.fillStyle = powerRatio < 0.3 ? "cyan" : (powerRatio < 0.7 ? "yellow" : "red");
        ctx.fillRect(controlledPlayer.x - 20, controlledPlayer.y - 30, 40 * powerRatio, 6);
    }
    
    ctx.restore();

    gameLoopId = requestAnimationFrame(gameLoop);
}

// Lancement au chargement
initMenu();
