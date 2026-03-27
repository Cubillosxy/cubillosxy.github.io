window.initTriki = () => {
  const board = document.getElementById('trikiBoard');
  const cells = document.querySelectorAll('.triki-cell');
  const statusText = document.getElementById('trikiStatus');
  const resetBtn = document.getElementById('trikiReset');

  if (!board || !statusText || !resetBtn) return;

  let gameState = ["", "", "", "", "", "", "", "", ""];
  let currentPlayer = "X"; // User is X, Machine is O
  let gameActive = true;

  const winningConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  statusText.innerHTML = "Your turn";

  function handleCellPlayed(clickedCell, clickedCellIndex, player) {
    gameState[clickedCellIndex] = player;
    clickedCell.innerHTML = player;
    clickedCell.classList.add(player === 'X' ? 'playerX' : 'playerO');
  }

  function handleResultValidation() {
    let roundWon = false;
    let winningPlayer = "";
    
    for (let i = 0; i < winningConditions.length; i++) {
      const [a, b, c] = winningConditions[i];
      if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
        roundWon = true;
        winningPlayer = gameState[a];
        break;
      }
    }

    if (roundWon) {
      if (winningPlayer === "X") {
        statusText.innerHTML = "You won! 🎉";
      } else {
        statusText.innerHTML = "Machine won! 🤖";
      }
      gameActive = false;
      return true;
    }

    let roundDraw = !gameState.includes("");
    if (roundDraw) {
      statusText.innerHTML = "Game ended in a draw! 🤝";
      gameActive = false;
      return true;
    }

    return false;
  }

  function makeMachineMove() {
    if (!gameActive) return;

    statusText.innerHTML = "Machine is thinking... 💭";
    
    setTimeout(() => {
      if (!gameActive) return;

      // Find all empty cells
      let availableCells = [];
      gameState.forEach((cell, index) => {
        if (cell === "") availableCells.push(index);
      });

      if (availableCells.length > 0) {
        let moveIndex = -1;

        // Smart Move 1: Check if Machine can win
        for (let i = 0; i < winningConditions.length; i++) {
          const [a, b, c] = winningConditions[i];
          if (gameState[a] === "O" && gameState[b] === "O" && gameState[c] === "") moveIndex = c;
          else if (gameState[a] === "O" && gameState[c] === "O" && gameState[b] === "") moveIndex = b;
          else if (gameState[b] === "O" && gameState[c] === "O" && gameState[a] === "") moveIndex = a;
        }

        // Smart Move 2: Check if Machine needs to block User
        if (moveIndex === -1) {
          for (let i = 0; i < winningConditions.length; i++) {
            const [a, b, c] = winningConditions[i];
            if (gameState[a] === "X" && gameState[b] === "X" && gameState[c] === "") moveIndex = c;
            else if (gameState[a] === "X" && gameState[c] === "X" && gameState[b] === "") moveIndex = b;
            else if (gameState[b] === "X" && gameState[c] === "X" && gameState[a] === "") moveIndex = a;
          }
        }

        // Smart Move 3: Take the center if it is available
        if (moveIndex === -1 && gameState[4] === "") {
          moveIndex = 4;
        }

        // Dumb Move: Random available
        if (moveIndex === -1) {
          const randomIndex = Math.floor(Math.random() * availableCells.length);
          moveIndex = availableCells[randomIndex];
        }

        const cellElement = document.querySelector(`.triki-cell[data-index="${moveIndex}"]`);
        handleCellPlayed(cellElement, moveIndex, "O");
        
        let gameEnded = handleResultValidation();
        if (!gameEnded) {
          currentPlayer = "X";
          statusText.innerHTML = "Your turn";
        }
      }
    }, 800); // 800ms delay for realism
  }

  function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

    if (gameState[clickedCellIndex] !== "" || !gameActive || currentPlayer !== "X") {
      return;
    }

    handleCellPlayed(clickedCell, clickedCellIndex, "X");
    
    let gameEnded = handleResultValidation();
    
    if (!gameEnded) {
      currentPlayer = "O";
      makeMachineMove();
    }
  }

  function handleRestartGame() {
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    statusText.innerHTML = "Your turn";
    cells.forEach(cell => {
      cell.innerHTML = "";
      cell.classList.remove('playerX', 'playerO');
    });
  }

  cells.forEach(cell => {
    // Prevent duplicate listeners if re-initialized
    const newCell = cell.cloneNode(true);
    cell.parentNode.replaceChild(newCell, cell);
    newCell.addEventListener('click', handleCellClick);
  });
  
  const newReset = resetBtn.cloneNode(true);
  resetBtn.parentNode.replaceChild(newReset, resetBtn);
  newReset.addEventListener('click', handleRestartGame);
};

// Start immediately since it's lazy-loaded
window.initTriki();
