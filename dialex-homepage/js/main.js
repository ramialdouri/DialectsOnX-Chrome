document.addEventListener("DOMContentLoaded", () => {
  window.DialexPad?.initPad();
  if (location.hash === "#pad") {
    document.getElementById("pad")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
