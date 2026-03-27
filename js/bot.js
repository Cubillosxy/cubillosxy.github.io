window.initBotGame = () => {
  const container = document.getElementById("botChallengeContainer");
  const input1 = document.getElementById("botAnswer1");
  const input2 = document.getElementById("botAnswer2");
  let submitBtn = document.getElementById("botSubmitBtn");
  const feedback = document.getElementById("botFeedback");
  let restartBtn = document.getElementById("botRestartBtn");

  if (!container || !input1 || !input2 || !submitBtn || !feedback || !restartBtn) return;

  // Clone buttons and replace to remove ANY previous detached listeners
  const newSubmit = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
  submitBtn = newSubmit;

  const newRestart = restartBtn.cloneNode(true);
  restartBtn.parentNode.replaceChild(newRestart, restartBtn);
  restartBtn = newRestart;

  // Clone inputs to clear listeners
  const newInput1 = input1.cloneNode(true);
  input1.parentNode.replaceChild(newInput1, input1);
  
  const newInput2 = input2.cloneNode(true);
  input2.parentNode.replaceChild(newInput2, input2);

  let botAnswer1 = 0;
  let humanAnswer1 = 0;
  let botAnswer2 = 0;
  let humanAnswer2 = 0;

  function generateChallenge() {
    newInput1.value = "";
    newInput2.value = "";
    feedback.innerText = "";
    feedback.style.color = "var(--text-primary)";
    restartBtn.style.display = "none";
    submitBtn.style.display = "block";
    newInput1.disabled = false;
    newInput2.disabled = false;
    newInput1.focus({ preventScroll: true });

    // Challenge 1: Hidden Span (+C is physically in the span)
    const A1 = Math.floor(Math.random() * 10) + 1;
    const B1 = Math.floor(Math.random() * 10) + 1;
    const C1 = Math.floor(Math.random() * 10) + 1;
    humanAnswer1 = A1 + B1;
    botAnswer1 = A1 + B1 + C1;

    // Challenge 2: Data Attribute (Answer is C2)
    const A2 = Math.floor(Math.random() * 10) + 1;
    const B2 = Math.floor(Math.random() * 10) + 1;
    const C2 = Math.floor(Math.random() * 10) + 1;
    humanAnswer2 = A2 + B2;
    botAnswer2 = C2;

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <span style="font-size: 14px; color: var(--text-secondary); font-weight: normal; letter-spacing: normal;">Challenge 1:</span>
        <div id="challenge1" style="font-size: 2rem; color: var(--accent-1); margin-top: 4px; font-weight: bold;">${A1} + ${B1}<span style="display:none"> + ${C1}</span></div>
      </div>
      <div>
        <span style="font-size: 14px; color: var(--text-secondary); font-weight: normal; letter-spacing: normal;">Challenge 2: think out the bot ... 👀</span>
        <div id="challenge2" data-real="${botAnswer2}" style="font-size: 2rem; color: var(--accent-2); margin-top: 4px; font-weight: bold;">${A2} + ${B2}</div>
      </div>
    `;
  }

  function checkAnswer() {
    const val1 = parseInt(newInput1.value);
    const val2 = parseInt(newInput2.value);
    
    if (isNaN(val1) || isNaN(val2)) {
      feedback.innerText = "Please answer both challenges.";
      return;
    }

    const isBot1 = (val1 === botAnswer1);
    const isBot2 = (val2 === botAnswer2);
    
    const isHumanObviously1 = (val1 === humanAnswer1 && val1 !== botAnswer1);
    const isHumanObviously2 = (val2 === humanAnswer2 && val2 !== botAnswer2);

    if (isBot1 && isBot2) {
      // Both correct for a bot
      feedback.innerHTML = `
        <div style="color: #10b981; margin-bottom: 12px;">✅ Success Bot Detect! 🤖</div>
        <div style="background: #000; padding: 12px; border-radius: 4px; border: 1px solid #333; font-family: 'Courier New', monospace; color: #0f0; text-align: left; font-size: 14px; position: relative;">
          C:\\&gt; loading Skynet<span style="animation: blink 1s step-end infinite;">_</span>
          <style>@keyframes blink { 50% { opacity: 0; } }</style>
        </div>
      `;
      submitBtn.style.display = "none";
      restartBtn.style.display = "block";
      newInput1.disabled = true;
      newInput2.disabled = true;
    } else if (isHumanObviously1 || isHumanObviously2) {
      // If ANY is obviously human
      feedback.innerText = "❌ Nice try, but Skynet has detected you 🔫";
      feedback.style.color = "#ef4444"; // red
      submitBtn.style.display = "none";
      restartBtn.style.display = "block";
      newInput1.disabled = true;
      newInput2.disabled = true;
    } else {
      // Just terrible math / random numbers
      feedback.innerText = "👁️ Your response is usually that of a human.";
      feedback.style.color = "#ef4444";
      submitBtn.style.display = "none";
      restartBtn.style.display = "block";
      newInput1.disabled = true;
      newInput2.disabled = true;
    }
  }

  submitBtn.addEventListener("click", checkAnswer);
  restartBtn.addEventListener("click", generateChallenge);

  newInput1.addEventListener("keydown", (e) => {
    if (e.key === "Enter") newInput2.focus();
  });
  
  newInput2.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkAnswer();
  });

  generateChallenge();
};

window.initBotGame();
