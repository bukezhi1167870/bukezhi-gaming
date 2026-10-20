/* Versioned checkpoints for normal and endless modes. */
window.createDownSave = function (options) {
  const key = 'chenni_below_run_v1'; // Keep existing normal-mode checkpoints readable.
  const n = gameSave.integer, die = v => n(v,1,6);
  function valid(d) {
    const s = d && d.state;
    return !!(d && [1,2].includes(d.version) && n(d.cardSeq,1,Number.MAX_SAFE_INTEGER) && s
      && ['easy','hard','endless'].includes(s.mode) && s.over === false && typeof s.resultRecorded === 'boolean'
      && ['idle','rolled','settling'].includes(s.phase)
      && n(s.maxHp,1,10) && n(s.hp,1,s.maxHp) && n(s.maxSanity,1,10) && n(s.sanity,0,s.maxSanity)
      && n(s.completed,0,s.mode === 'endless' ? Number.MAX_SAFE_INTEGER : 5)
      && s.maxTurns === 5 && n(s.turn,1,5) && n(s.maxCards,1,2)
      && Array.isArray(s.cards) && s.cards.length > 0 && s.cards.length <= s.maxCards
      && s.cards.every(c=>n(c.id,1,d.cardSeq) && Array.isArray(c.slots) && c.slots.length > 0 && c.slots.length <= 12 && c.slots.every(v=>die(v.face) && (v.die === null || v.die === v.face)))
      && new Set(s.cards.map(c=>c.id)).size === s.cards.length
      && Array.isArray(s.risk) && s.risk.length <= 1000 && s.risk.every(die)
      && Array.isArray(s.pending) && s.pending.length <= 1000 && s.pending.every(die)
      && Array.isArray(s.usedActions) && s.usedActions.every(options.actionExists)
      && Array.isArray(s.log) && s.log.length <= 40 && s.log.every(l=>gameSave.text(l.text) && gameSave.text(l.cls,30))
      && (!s.resumeStage || ['command','contract','finish'].includes(s.resumeStage)
        && Array.isArray(s.commandFaces) && s.commandFaces.length <= 1000 && s.commandFaces.every(die)
        && (d.version === 1 ? typeof s.commandCardCompleted === 'boolean' : s.resumeResult
          && typeof s.resumeResult.anyCompleted === 'boolean'
          && ['completedCount','flipGain','auditCount','auditGain'].every(k=>n(s.resumeResult[k],0,1000))))
      && (s.phase !== 'settling' || !!s.resumeStage)
      && (s.phase !== 'rolled' || s.pending.length > 0 || !!s.resumeStage));
  }
  function read() { return gameSave.read(key,valid); }
  function persist(state = options.state()) {
    if (!state) return;
    if (state.over) { gameSave.remove(key); return; }
    if (state.phase === 'rolling') return;
    const d = {version:2,savedAt:Date.now(),cardSeq:options.sequence(),state:{...state,usedActions:[...state.usedActions]}};
    if (valid(d)) gameSave.write(key,d);
  }
  function attach(startOverlay) {
    const saved = read(); if (!saved) return;
    const button = document.createElement('button'); button.className = 'restart';
    button.textContent = '继续游戏';
    startOverlay.querySelector('.modes').before(button);
    button.onclick = () => {
      startOverlay.remove();
      const state = saved.state;
      state.usedActions = new Set(state.usedActions);
      if (saved.version === 1 && state.resumeStage) {
        state.resumeResult = {anyCompleted:state.commandCardCompleted,completedCount:0,flipGain:0,auditCount:0,auditGain:0};
      }
      options.restore(state,saved.cardSeq);
    };
  }
  window.addEventListener('pagehide',()=>persist());
  return {persist,attach,clear:()=>gameSave.remove(key),valid};
};
