if (!document.getElementById("hires-style")) {
    const style = document.createElement("style");
    style.id = "hires-style";
    style.innerHTML = `
        canvas { width: 100%; max-width: 600px; height: auto; }
        canvas:fullscreen { max-width: none !important; width: 100vw !important; height: 100vh !important; }
    `;
    document.head.appendChild(style);
}

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') {
        const canvas = document.querySelector('canvas');
        if (canvas) {
            if (!document.fullscreenElement) {
                canvas.requestFullscreen().catch(err => console.log(err));
            } else {
                document.exitFullscreen();
            }
        }
    }
});

// -- LOGIQUE DU JEU "DRIBBLE DE LA MORT" --
const dribbleCanvas = document.getElementById("dribbleCanvas");
if(dribbleCanvas) {
    const ctx = dribbleCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 500;
    dribbleCanvas.width = LOGICAL_W * 3;
    dribbleCanvas.height = LOGICAL_H * 3;
    ctx.scale(3, 3);

    let player = { x: 300, y: 400, radius: 15 };
    let defenders = [];
    let frame = 0;
    let score = 0;
    let isGameOver = false;
    let isVictory = false;
    let hasStarted = false;
    
    function showStartScreen() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
        ctx.fillStyle = "white";
        ctx.font = "bold 30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("CLIQUE ICI POUR DÉMARRER", 300, 250);
    }
    
    // Mouse movement
    dribbleCanvas.addEventListener("mousemove", (e) => {
        const rect = dribbleCanvas.getBoundingClientRect();
        const scaleX = LOGICAL_W / rect.width;
        const scaleY = LOGICAL_H / rect.height;
        player.x = (e.clientX - rect.left) * scaleX;
        player.y = (e.clientY - rect.top) * scaleY;
    });

    function spawnDefender() {
        let x = Math.random() * dribbleCanvas.width;
        defenders.push({ x: x, y: -30, speed: Math.random() * 4 + 3 });
    }

    function drawPlayer() {
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚽", player.x, player.y);
    }

    function drawDefenders() {
        for(let d of defenders) {
            ctx.font = "28px Arial";
            ctx.fillText("🛡️", d.x, d.y);
        }
    }
    
    function drawGoal() {
        // Draw green zone at top
        ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
        ctx.fillRect(150, 0, 300, 50);
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.fillText("BUT !", 300, 25);
    }

    function detectCollision() {
        for(let d of defenders) {
            let dx = player.x - d.x;
            let dy = player.y - d.y;
            let distance = Math.sqrt(dx*dx + dy*dy);
            if(distance < 25) {
                if(!isGameOver && typeof submitScoreAPI !== 'undefined') submitScoreAPI('dribble', score);
                isGameOver = true;
            }
        }
        
        // Victory if touching the goal zone (after score > 600 frames, ~10 seconds)
        if(score > 600 && player.y < 50 && player.x > 150 && player.x < 450) {
            isVictory = true;
        }
    }

    function updateGame() {
        if(isGameOver) {
            ctx.fillStyle = "rgba(200, 0, 0, 0.8)";
            ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.fillText("TACCLÉ ! T'as perdu le ballon.", 300, 200);
            ctx.font = "20px Arial";
            ctx.fillText("Clique sur le terrain pour réessayer.", 300, 260);
            return;
        }
        if(isVictory) {
            ctx.fillStyle = "rgba(0, 200, 0, 0.8)";
            ctx.fillRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 50px Arial";
            ctx.fillText("GOOOOOAAAL !!", 300, 200);
            ctx.font = "20px Arial";
            ctx.fillText("Magnifique but ! Clique pour rejouer.", 300, 260);
            return;
        }

        ctx.clearRect(0,0, dribbleCanvas.width, dribbleCanvas.height);
        
        frame++;
        score++;
        
        if(frame % 15 === 0) spawnDefender();
        
        for(let i=0; i<defenders.length; i++){
            defenders[i].y += defenders[i].speed;
            if(defenders[i].y > dribbleCanvas.height) {
                defenders.splice(i, 1);
                i--;
            }
        }
        
        drawGoalZone();
        drawDefenders();
        drawPlayer();
        
        detectCollision();
        requestAnimationFrame(updateGame);
    }
    
    function drawGoalZone() {
        if(score > 600) {
            drawGoal();
        } else {
             ctx.fillStyle = "rgba(255,255,255,0.8)";
             ctx.font = "bold 18px Arial";
             ctx.fillText("Survis " + Math.ceil((600 - score)/60) + " s pour ouvrir le but !", 300, 30);
        }
    }

    dribbleCanvas.addEventListener("click", () => {
        if(!hasStarted) {
            hasStarted = true;
            updateGame();
        } else if(isGameOver || isVictory) {
            isGameOver = false;
            isVictory = false;
            defenders = [];
            score = 0;
            frame = 0;
            player = { x: 300, y: 400, radius: 15 };
            updateGame();
        }
    });

    showStartScreen();
}

// -- LOGIQUE DU JEU "TIRS AU BUT" --
const penaltyCanvas = document.getElementById("penaltyCanvas");
if(penaltyCanvas) {
    const ctx2 = penaltyCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 300;
    penaltyCanvas.width = LOGICAL_W * 3;
    penaltyCanvas.height = LOGICAL_H * 3;
    ctx2.scale(3, 3);

    let targetX = 0;
    let targetSpeed = 8;
    let targetWidth = 60;
    
    let ballY = 250;
    let ballX = 300;
    let isShooting = false;
    let isGoal = false;
    let isMissed = false;
    let hasStartedPenalty = false;

    function showStartScreenPenalty() {
        ctx2.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
        ctx2.fillStyle = "white";
        ctx2.font = "bold 30px Arial";
        ctx2.textAlign = "center";
        ctx2.fillText("CLIQUE ICI POUR DÉMARRER", 300, 150);
    }

    function resetPenalty() {
        isShooting = false;
        ballY = 250;
        isGoal = false;
        isMissed = false;
    }

    function updatePenaltyGame() {
        ctx2.clearRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
        
        // Draw moving target if not resolved
        if(!isShooting || ballY > 40) {
            targetX += targetSpeed;
            if(targetX > LOGICAL_W - targetWidth || targetX < 0) {
                targetSpeed = -targetSpeed;
            }
        }
        
        ctx2.fillStyle = "#ff4444"; // Default goal is red (miss)
        ctx2.fillRect(0, 0, LOGICAL_W, 40);
        
        ctx2.fillStyle = "#00ff00"; // The valid green target area
        ctx2.fillRect(targetX, 0, targetWidth, 40);

        // Draw ball
        if(isShooting) {
            ballY -= 15;
            if(ballY <= 20) {
                // Check if hit
                if(ballX >= targetX && ballX <= targetX + targetWidth) {
                    isGoal = true;
                } else {
                    isMissed = true;
                }
                isShooting = false; // stop moving upwards
            }
        }
        
        ctx2.font = "30px Arial";
        ctx2.textAlign = "center";
        ctx2.textBaseline = "middle";
        ctx2.fillText("⚽", ballX, ballY);
        
        if(isGoal) {
            ctx2.fillStyle = "rgba(0, 255, 0, 0.8)";
            ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
            ctx2.fillStyle = "black";
            ctx2.font = "bold 50px Arial";
            ctx2.fillText("GOOOOOAAL !!", 300, 150);
            ctx2.font = "20px Arial";
            ctx2.fillText("Parfaitement dans la lucarne. Clique pour rejouer.", 300, 200);
        } else if (isMissed) {
             ctx2.fillStyle = "rgba(255, 0, 0, 0.8)";
            ctx2.fillRect(0,0, penaltyCanvas.width, penaltyCanvas.height);
            ctx2.fillStyle = "white";
            ctx2.font = "bold 40px Arial";
            ctx2.fillText("POTEAU... RATÉ !", 300, 150);
            ctx2.font = "20px Arial";
            ctx2.fillText("Une occasion gâchée. Clique pour réessayer.", 300, 200);
        } else if (!isShooting) {
             ctx2.fillStyle = "rgba(255, 255, 255, 0.8)";
             ctx2.font = "bold 20px Arial";
             ctx2.fillText("CLIQUE POUR TIRER", 300, 280);
        }

        requestAnimationFrame(updatePenaltyGame);
    }
    
    penaltyCanvas.addEventListener("click", () => {
        if(!hasStartedPenalty) {
            hasStartedPenalty = true;
            updatePenaltyGame();
        } else if(isGoal || isMissed) {
            resetPenalty();
        } else if (!isShooting) {
            isShooting = true;
        }
    });

    showStartScreenPenalty();
}

// -- LOGIQUE DU JEU "JONGLES" --
const jonglesCanvas = document.getElementById("jonglesCanvas");
if(jonglesCanvas) {
    const ctx = jonglesCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 400;
    jonglesCanvas.width = LOGICAL_W * 3;
    jonglesCanvas.height = LOGICAL_H * 3;
    ctx.scale(3, 3);

    let ball = { x: 300, y: 50, vy: 0, radius: 25 };
    let gravity = 0.5;
    let score = 0;
    let isGameOver = false;
    let hasStarted = false;

    function resetJongles() {
        ball = { x: 300, y: 50, vy: 0, radius: 25 };
        score = 0;
        isGameOver = false;
    }

    function drawJongles() {
        ctx.clearRect(0,0, jonglesCanvas.width, jonglesCanvas.height);
        if(isGameOver) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
            ctx.fillRect(0,0, jonglesCanvas.width, jonglesCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("Tombé... Score: " + score, 300, 150);
            return;
        }

        // update physics
        ball.vy += gravity;
        ball.y += ball.vy;

        if (ball.y >= jonglesCanvas.height - ball.radius) {
            if(!isGameOver && typeof submitScoreAPI !== 'undefined') submitScoreAPI('jongles', score);
            isGameOver = true;
        }

        // draw ball
        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚽", ball.x, ball.y);

        // draw score
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.fillText("Score: " + score, 300, 30);

        requestAnimationFrame(drawJongles);
    }

    jonglesCanvas.addEventListener("mousedown", (e) => {
        if(!hasStarted) {
            hasStarted = true;
            drawJongles();
            return;
        }
        if(isGameOver) {
            resetJongles();
            drawJongles();
            return;
        }
        const rect = jonglesCanvas.getBoundingClientRect();
        const scaleX = LOGICAL_W / rect.width;
        const scaleY = LOGICAL_H / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        const dist = Math.hypot(ball.x - mx, ball.y - my);
        if(dist < ball.radius * 2) { // Give a nice hit box
            ball.vy = -12; // upward bump
            // Add some horizontal randomness
            ball.x += (Math.random() - 0.5) * 40;
            // keep inside bounds
            ball.x = Math.max(50, Math.min(550, ball.x));
            score++;
        }
    });

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0,0, jonglesCanvas.width, jonglesCanvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CLIQUE SUR LA BALLE POUR JONGLER", 300, 200);
}

// -- LOGIQUE DU JEU "GARDIEN" --
const gardienCanvas = document.getElementById("gardienCanvas");
if(gardienCanvas) {
    const ctx = gardienCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 400;
    gardienCanvas.width = LOGICAL_W * 3;
    gardienCanvas.height = LOGICAL_H * 3;
    ctx.scale(3, 3);

    let balls = [];
    let score = 0;
    let isGameOver = false;
    let hasStarted = false;
    let frameRate = 0;

    function resetGardien() {
        balls = [];
        score = 0;
        frameRate = 0;
        isGameOver = false;
    }

    function drawGardien() {
        ctx.clearRect(0,0, gardienCanvas.width, gardienCanvas.height);
        if(isGameOver) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
            ctx.fillRect(0,0, gardienCanvas.width, gardienCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("But encaissé ! Arrêts : " + score, 300, 200);
            return;
        }

        frameRate++;
        // Spawn interval gets faster as score increases
        let spawnRate = Math.max(30, 80 - score * 2);
        if(frameRate > spawnRate) {
            frameRate = 0;
            balls.push({
                x: Math.random() * 500 + 50,
                y: Math.random() * 300 + 50,
                timer: 0,
                maxTimer: 100 // frames before it enters goal
            });
        }

        ctx.font = "50px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for(let i=0; i<balls.length; i++) {
            let b = balls[i];
            b.timer++;
            // draw ball getting larger (coming closer)
            let size = 20 + (b.timer/b.maxTimer)*40;
            ctx.font = size + "px Arial";
            ctx.fillText("⚽", b.x, b.y);

            if(b.timer > b.maxTimer) {
                if(!isGameOver && typeof submitScoreAPI !== 'undefined') submitScoreAPI('gardien', score);
                isGameOver = true;
            }
        }

        ctx.fillStyle = "white";
        ctx.font = "20px Arial";
        ctx.fillText("Arrêts : " + score, 80, 30);

        requestAnimationFrame(drawGardien);
    }

    gardienCanvas.addEventListener("mousedown", (e) => {
        if(!hasStarted) {
            hasStarted = true;
            drawGardien();
            return;
        }
        if(isGameOver) {
            resetGardien();
            drawGardien();
            return;
        }
        const rect = gardienCanvas.getBoundingClientRect();
        const scaleX = LOGICAL_W / rect.width;
        const scaleY = LOGICAL_H / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        for(let i=balls.length-1; i>=0; i--) {
            let b = balls[i];
            let dist = Math.hypot(b.x - mx, b.y - my);
            if(dist < 50) {
                balls.splice(i, 1);
                score++;
                break; // only catch one per click
            }
        }
    });

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0,0, gardienCanvas.width, gardienCanvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CLIQUE SUR LES BALLONS RAPIDEMENT", 300, 200);
}

// -- LOGIQUE DU JEU "FLAPPY" --
const flappyCanvas = document.getElementById("flappyCanvas");
if(flappyCanvas) {
    const ctx = flappyCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 400;
    flappyCanvas.width = LOGICAL_W * 3;
    flappyCanvas.height = LOGICAL_H * 3;
    ctx.scale(3, 3);

    let ballY = 200;
    let ballV = 0;
    let pipes = [];
    let score = 0;
    let isGameOver = false;
    let hasStarted = false;

    function resetFlappy() {
        ballY = 200;
        ballV = 0;
        pipes = [];
        score = 0;
        isGameOver = false;
    }

    function createPipe() {
        let gapY = Math.random() * 200 + 100;
        pipes.push({ x: 600, gapY: gapY, passed: false });
    }

    function drawFlappy() {
        ctx.clearRect(0,0, flappyCanvas.width, flappyCanvas.height);
        if(isGameOver) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
            ctx.fillRect(0,0, flappyCanvas.width, flappyCanvas.height);
            ctx.fillStyle = "white";
            ctx.font = "bold 40px Arial";
            ctx.textAlign = "center";
            ctx.fillText("CRASH ! Score: " + score, 300, 200);
            return;
        }

        ballV += 0.4; // gravity
        ballY += ballV;

        if(pipes.length === 0 || pipes[pipes.length-1].x < 400) {
            createPipe();
        }

        ctx.fillStyle = "#2ecc71"; // pipe green
        for(let i=0; i<pipes.length; i++) {
            let p = pipes[i];
            p.x -= 3;
            // Draw top pipe
            ctx.fillRect(p.x, 0, 50, p.gapY - 60);
            // Draw bot pipe
            ctx.fillRect(p.x, p.gapY + 60, 50, flappyCanvas.height);

            // Collision
            let bx = 100, by = ballY;
            if(bx + 15 > p.x && bx - 15 < p.x + 50) {
                if(by - 15 < p.gapY - 60 || by + 15 > p.gapY + 60) {
                    if(!isGameOver && typeof submitScoreAPI !== 'undefined') submitScoreAPI('flappy', score);
                    isGameOver = true;
                }
            }
            // Score
            if (!p.passed && p.x + 50 < 100) {
                p.passed = true;
                score++;
            }
        }

        if(pipes.length > 0 && pipes[0].x < -50) pipes.shift();

        if(ballY > flappyCanvas.height || ballY < 0) {
            if(!isGameOver && typeof submitScoreAPI !== 'undefined') submitScoreAPI('flappy', score);
            isGameOver = true;
        }

        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚽", 100, ballY);

        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.fillText(score, 300, 30);

        requestAnimationFrame(drawFlappy);
    }

    flappyCanvas.addEventListener("mousedown", () => {
        if(!hasStarted) {
            hasStarted = true;
            drawFlappy();
        } else if(isGameOver) {
            resetFlappy();
            drawFlappy();
        } else {
            ballV = -7;
        }
    });

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0,0, flappyCanvas.width, flappyCanvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("CLIQUE POUR VOLER", 300, 200);
}

// -- LOGIQUE DU JEU "PONG" --
const pongCanvas = document.getElementById("pongCanvas");
if(pongCanvas) {
    const ctx = pongCanvas.getContext("2d");
    const LOGICAL_W = 600;
    const LOGICAL_H = 400;
    pongCanvas.width = LOGICAL_W * 3;
    pongCanvas.height = LOGICAL_H * 3;
    ctx.scale(3, 3);

    let playerY = 150;
    let aiY = 150;
    let ball = {x: 300, y: 200, vx: 5, vy: 5, r: 15};
    let scoreP = 0;
    let scoreA = 0;
    let hasStarted = false;

    function drawPong() {
        // Remplir de gazon (vert) à chaque image au lieu de clearRect pour éviter le fond noir
        ctx.fillStyle = "#1B5E20";
        ctx.fillRect(0, 0, pongCanvas.width, pongCanvas.height);

        // draw center line
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(298, 0, 4, 400);

        // move ai
        let targetY = ball.y - 40;
        aiY += (targetY - aiY) * 0.1;

        // update ball
        ball.x += ball.vx * 1.2;
        ball.y += ball.vy * 1.2;

        if(ball.y <= 0 || ball.y >= 400 - ball.r) ball.vy *= -1;

        // collision player
        if(ball.x - ball.r < 30 && ball.y > playerY && ball.y < playerY + 80) {
            ball.vx = Math.abs(ball.vx);
        }
        // collision AI
        if(ball.x + ball.r > 570 && ball.y > aiY && ball.y < aiY + 80) {
            ball.vx = -Math.abs(ball.vx);
        }

        // goal
        if(ball.x < 0) { scoreA++; ball = {x: 300, y: 200, vx: 5, vy: (Math.random()>0.5?5:-5), r: 15}; }
        if(ball.x > 600) { scoreP++; if(typeof submitScoreAPI !== 'undefined') submitScoreAPI('pong', scoreP); ball = {x: 300, y: 200, vx: -5, vy: (Math.random()>0.5?5:-5), r: 15}; }

        // draw paddles
        ctx.fillStyle = "white";
        ctx.fillRect(10, playerY, 20, 80);
        ctx.fillRect(570, aiY, 20, 80);

        // draw ball
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚽", ball.x, ball.y);

        // score
        ctx.font = "bold 40px Arial";
        ctx.fillText(scoreP, 150, 50);
        ctx.fillText(scoreA, 450, 50);

        requestAnimationFrame(drawPong);
    }

    pongCanvas.addEventListener("mousemove", (e) => {
        const rect = pongCanvas.getBoundingClientRect();
        const scaleY = LOGICAL_H / rect.height;
        playerY = (e.clientY - rect.top) * scaleY - 40; // center paddle
        playerY = Math.max(0, Math.min(320, playerY));
    });

    pongCanvas.addEventListener("mousedown", () => {
        if(!hasStarted) {
            hasStarted = true;
            drawPong();
        }
    });

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0,0, pongCanvas.width, pongCanvas.height);
    ctx.fillStyle = "white";
    ctx.font = "bold 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BOUGE LA SOURIS ET CLIQUE", 300, 200);
}

// --- LEADERBOARD & STATS API ---
async function submitScoreAPI(game, finalScore) {
    const token = localStorage.getItem('token');
    if(!token) return;
    try {
        await fetch('/api/stats/update', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ game: game, score: finalScore })
        });
    } catch(err) {
        console.error("Score setup err: ", err);
    }
}
