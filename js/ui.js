// All DOM/HUD manipulation lives here — game.js never touches the DOM directly.

const UI = {
  els: {},
  toastTimer: null,

  init() {
    this.els = {
      stressFill: document.getElementById('stress-fill'),
      stressWrap: document.getElementById('stress-wrap'),
      tissueCount: document.getElementById('tissue-count'),
      foodStatus: document.getElementById('food-status'),
      tableIndicator: document.getElementById('table-indicator'),
      toast: document.getElementById('toast'),
      prompt: document.getElementById('interact-prompt'),
      actionTimerWrap: document.getElementById('action-timer-wrap'),
      actionTimerFill: document.getElementById('action-timer-fill'),
      throwIndicator: document.getElementById('throw-indicator'),
      throwBtn: document.getElementById('btn-throw'),
      screens: {
        charSelect: document.getElementById('screen-char-select'),
        start: document.getElementById('screen-start'),
        win: document.getElementById('screen-win'),
        lose: document.getElementById('screen-lose'),
      },
      winStats: document.getElementById('win-stats'),
      loseReason: document.getElementById('lose-reason'),
    };
  },

  setTissueCount(n) {
    this.els.tissueCount.textContent = String(n);
    this.els.tissueCount.classList.toggle('warn', n === 0);
  },

  setFoodStatus(text) {
    this.els.foodStatus.textContent = text;
  },

  setTableIndicator(tableId) {
    if (tableId === null || tableId === undefined) {
      this.els.tableIndicator.textContent = 'no table choped yet';
      this.els.tableIndicator.classList.remove('active');
    } else {
      this.els.tableIndicator.textContent = `Table #${tableId + 1}`;
      this.els.tableIndicator.classList.add('active');
    }
  },

  setStress(fraction) {
    const pct = clamp(fraction, 0, 1) * 100;
    this.els.stressFill.style.width = `${pct}%`;
    this.els.stressWrap.classList.toggle('danger', fraction > 0.7);
  },

  setActionTimer(fraction, urgent) {
    if (fraction === null) {
      this.els.actionTimerWrap.classList.add('hidden');
      return;
    }
    this.els.actionTimerWrap.classList.remove('hidden');
    this.els.actionTimerFill.style.width = `${clamp(fraction, 0, 1) * 100}%`;
    this.els.actionTimerFill.classList.toggle('urgent', !!urgent);
  },

  setThrowIndicator(remaining) {
    if (remaining === null || remaining === undefined) {
      this.els.throwIndicator.classList.add('hidden');
      return;
    }
    this.els.throwIndicator.textContent = `🥿 x${remaining}`;
    this.els.throwIndicator.classList.remove('hidden');
  },

  setThrowButtonVisible(visible) {
    this.els.throwBtn.classList.toggle('hidden', !visible);
  },

  toast(message, duration = 2600) {
    const el = this.els.toast;
    el.textContent = message;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, duration);
  },

  setPrompt(text) {
    if (!text) {
      this.els.prompt.classList.add('hidden');
      return;
    }
    this.els.prompt.textContent = text;
    this.els.prompt.classList.remove('hidden');
  },

  hideAllScreens() {
    Object.values(this.els.screens).forEach((s) => s.classList.add('hidden'));
  },

  showCharacterSelect() {
    this.hideAllScreens();
    this.els.screens.charSelect.classList.remove('hidden');
  },

  showStart() {
    this.hideAllScreens();
    this.els.screens.start.classList.remove('hidden');
  },

  showWin(stats) {
    this.hideAllScreens();
    document.getElementById('win-message').textContent = `${stats.characterName} enjoyed their meal in peace.`;
    this.els.winStats.innerHTML = `
      <div>⏱️ Meal finished in <strong>${stats.timeSec}s</strong></div>
      <div>🧻 Tissue packets used: <strong>${stats.tissueUsed}</strong></div>
      <div>😅 Close calls survived: <strong>${stats.closeCalls}</strong></div>
    `;
    this.els.screens.win.classList.remove('hidden');
  },

  showLose(reason) {
    this.hideAllScreens();
    this.els.loseReason.textContent = reason;
    this.els.screens.lose.classList.remove('hidden');
  },
};
