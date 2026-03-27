// DOOM Logic (JS-DOS)
// Not integrated into index.html yet as requested by user.
// This requires: <script type="text/javascript" src="https://js-dos.com/6.22/current/js-dos.js"></script>

window.startDoom = () => {
  const container = document.getElementById('dosbox');
  if (!container) return;
  
  container.innerHTML = ""; // Prepare container
  window.doomDosbox = new window.Dosbox({
    id: "dosbox",
    onload: function (dosbox) {
      dosbox.run("https://js-dos.com/6.22/current/test/doom-shareware.zip", "./DOOM/DOOM.EXE");
    },
    onrun: function (dosbox, app) {
      console.log("App '" + app + "' is running natively!");
    }
  });
};

/*
// Suggested integration for later:
let doomLoaded = false;
window.openGameTab = (gameId) => {
  // ... tab switching logic ...
  if (gameId === 'doom' && !doomLoaded) {
    doomLoaded = true;
    window.startDoom();
  }
};
*/
