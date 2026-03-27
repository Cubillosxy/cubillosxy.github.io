window.initPingPong = () => {
    const canvas = document.getElementById("pingpongCanvas");
    const ctx = canvas.getContext("2d");
    const startBtn = document.getElementById("pingpongStart");
    const statusText = document.getElementById("pingpongStatus");
    
    if (!canvas || !ctx || !startBtn || !statusText) return;

    // Game variables
    let gameLoop;
    let isPlaying = false;
    let hitCount = 0;
    
    // Settings
    const paddleWidth = 10;
    const paddleHeight = 80;
    const netWidth = 2;
    const ballRadius = 8;
    
    // Paddle Objects
    const user = {
        x: 0,
        y: canvas.height/2 - paddleHeight/2,
        width: paddleWidth,
        height: paddleHeight,
        color: "#6366f1", // primary accent
        score: 0
    };
    
    const computer = {
        x: canvas.width - paddleWidth,
        y: canvas.height/2 - paddleHeight/2,
        width: paddleWidth,
        height: paddleHeight,
        color: "#ec4899", // secondary accent
        score: 0,
        speed: 4 // initial computer speed
    };
    
    // Ball Object
    const ball = {
        x: canvas.width/2,
        y: canvas.height/2,
        radius: ballRadius,
        speed: 6,
        velocityX: 6,
        velocityY: 6,
        color: "#fff"
    };
    
    // Listen to mouse movement
    canvas.addEventListener("mousemove", getMousePos);
    canvas.addEventListener("touchmove", getTouchPos, {passive: true});
    
    function getMousePos(evt) {
        let rect = canvas.getBoundingClientRect();
        // Calculate scale since canvas might be resized by CSS
        let scaleY = canvas.height / rect.height;
        let newY = (evt.clientY - rect.top) * scaleY - user.height/2;
        // Keep paddle inside canvas
        if (newY < 0) newY = 0;
        if (newY + paddleHeight > canvas.height) newY = canvas.height - paddleHeight;
        user.y = newY;
    }
    
    function getTouchPos(evt) {
        let rect = canvas.getBoundingClientRect();
        let scaleY = canvas.height / rect.height;
        let newY = (evt.touches[0].clientY - rect.top) * scaleY - user.height/2;
        if (newY < 0) newY = 0;
        if (newY + paddleHeight > canvas.height) newY = canvas.height - paddleHeight;
        user.y = newY;
    }
    
    // Draw functions
    function drawRect(x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }
    
    function drawArc(x, y, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI*2, false);
        ctx.closePath();
        ctx.fill();
    }
    
    function drawNet() {
        for(let i=0; i<=canvas.height; i+=15) {
            drawRect(canvas.width/2 - netWidth/2, i, netWidth, 10, "rgba(255,255,255,0.2)");
        }
    }
    
    function drawText(text, x, y) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "45px 'Inter', sans-serif";
        ctx.fillText(text, x, y);
    }
    
    function render() {
        // Clear canvas
        drawRect(0, 0, canvas.width, canvas.height, "rgba(18, 18, 26, 1)");
        
        drawNet();
        
        // Draw Scores
        drawText(user.score, canvas.width/4, canvas.height/5);
        drawText(computer.score, 3*canvas.width/4, canvas.height/5);
        
        // Draw Paddles
        drawRect(user.x, user.y, user.width, user.height, user.color);
        drawRect(computer.x, computer.y, computer.width, computer.height, computer.color);
        
        // Draw Ball
        drawArc(ball.x, ball.y, ball.radius, ball.color);
    }
    
    function collision(b, p) {
        p.top = p.y;
        p.bottom = p.y + p.height;
        p.left = p.x;
        p.right = p.x + p.width;
        
        b.top = b.y - b.radius;
        b.bottom = b.y + b.radius;
        b.left = b.x - b.radius;
        b.right = b.x + b.radius;
        
        return p.left < b.right && p.top < b.bottom && p.right > b.left && p.bottom > b.top;
    }
    
    function resetBall() {
        ball.x = canvas.width/2;
        ball.y = canvas.height/2;
        ball.speed = 6;
        computer.speed = 4;
        ball.velocityX = -ball.velocityX; // Send to the one who scored
        hitCount = 0;
        updateStatus();
    }
    
    function updateStatus() {
        statusText.innerText = `Rally: ${hitCount} | Speed Level: ${ball.speed.toFixed(1)}`;
    }
    
    function update() {
        // Move ball
        ball.x += ball.velocityX;
        ball.y += ball.velocityY;
        
        // Simple AI for computer
        // Computer moves its center towards the ball y
        let computerLevel = computer.speed;
        let destY = ball.y - (computer.height/2);
        
        // Only track if ball is moving towards computer
        if (ball.velocityX > 0) {
            if (computer.y < destY - 10) {
                computer.y += computerLevel;
            } else if (computer.y > destY + 10) {
                computer.y -= computerLevel;
            }
        } else {
            // Return to center slowly
            let centerY = canvas.height/2 - computer.height/2;
            if (computer.y > centerY + 5) computer.y -= 2;
            else if (computer.y < centerY - 5) computer.y += 2;
        }

        // Keep computer paddle inside canvas
        if (computer.y < 0) computer.y = 0;
        if (computer.y + paddleHeight > canvas.height) computer.y = canvas.height - paddleHeight;
        
        // Wall collision (top and bottom)
        if(ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
            ball.velocityY = -ball.velocityY;
        }
        
        // Paddle collision
        let player = (ball.x + ball.radius < canvas.width/2) ? user : computer;
        
        if (collision(ball, player)) {
            // Calculate hit point
            let collidePoint = (ball.y - (player.y + player.height/2));
            collidePoint = collidePoint / (player.height/2); // Normalize from -1 to 1
            
            // Calculate angle in Radian (max ~45 deg)
            let angleRad = (Math.PI/4) * collidePoint;
            
            // X direction depends on who hit it
            let direction = (ball.x + ball.radius < canvas.width/2) ? 1 : -1;
            
            // Adjust velocity vector
            ball.velocityX = direction * ball.speed * Math.cos(angleRad);
            ball.velocityY = ball.speed * Math.sin(angleRad);
            
            // Progressive difficulty: speed up every 3 hits!
            hitCount++;
            if (hitCount % 3 === 0) {
                ball.speed += 1.0;
                computer.speed += 0.8; // Computer gets faster as ball speed increases
            }
            updateStatus();
        }
        
        // Score logic
        if (ball.x - ball.radius < 0) {
            computer.score++;
            resetBall();
        } else if (ball.x + ball.radius > canvas.width) {
            user.score++;
            resetBall();
        }
    }
    
    function game() {
        update();
        render();
        if (isPlaying) {
            gameLoop = requestAnimationFrame(game);
        }
    }
    
    // Prevent duplicate listeners if re-initialized
    const newStartBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newStartBtn, startBtn);
    
    newStartBtn.addEventListener("click", () => {
        if (!isPlaying) {
            isPlaying = true;
            newStartBtn.innerText = "Pause Game";
            game();
        } else {
            isPlaying = false;
            newStartBtn.innerText = "Resume Match";
            cancelAnimationFrame(gameLoop);
        }
    });

    const restartBtn = document.getElementById("pingpongRestart");
    if (restartBtn) {
        const newRestartBtn = restartBtn.cloneNode(true);
        restartBtn.parentNode.replaceChild(newRestartBtn, restartBtn);
        newRestartBtn.addEventListener("click", () => {
            user.score = 0;
            computer.score = 0;
            hitCount = 0;
            ball.speed = 6;
            computer.speed = 4;
            ball.x = canvas.width/2;
            ball.y = canvas.height/2;
            
            // Randomize serve direction
            ball.velocityX = (Math.random() > 0.5 ? 1 : -1) * 6;
            ball.velocityY = (Math.random() > 0.5 ? 1 : -1) * 6;
            
            updateStatus();
            render();

            if (!isPlaying) {
                isPlaying = true;
                newStartBtn.innerText = "Pause Game";
                game();
            }
        });
    }

    // Initial render
    render();
};

// Start immediately since it's lazy-loaded
window.initPingPong();
