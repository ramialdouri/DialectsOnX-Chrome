document.addEventListener("DOMContentLoaded", () => {
  if (window.DialexPad) {
    window.DialexPad.initPad();
  }

  // Gentle entrance for Pad when arriving via deep link
  if (location.hash === "#pad") {
    const pad = document.getElementById("pad");
    if (pad) {
      requestAnimationFrame(() => pad.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }
});
