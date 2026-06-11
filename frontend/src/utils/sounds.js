/**
 * CoDraw Sound Effects — Web Audio API only, no external files.
 * All sounds are generated programmatically so the game is fully self-contained.
 */

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if browser suspended it (requires user gesture first)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a tone/chord sequence.
 * @param {Array<{freq, start, dur, type, vol}>} notes
 */
function playNotes(notes) {
  try {
    const ctx = getCtx();
    notes.forEach(({ freq, start, dur, type = 'sine', vol = 0.3 }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch (_) {
    // Silently fail if AudioContext is unavailable
  }
}

// ─────────────────────────────────────────────
// 🎵 Sound Definitions
// ─────────────────────────────────────────────

/** Cheerful 3-note ascending chime for correct guess */
export function playCorrectGuess() {
  playNotes([
    { freq: 523, start: 0,    dur: 0.15, type: 'sine', vol: 0.35 },  // C5
    { freq: 659, start: 0.12, dur: 0.15, type: 'sine', vol: 0.35 },  // E5
    { freq: 784, start: 0.24, dur: 0.3,  type: 'sine', vol: 0.4  },  // G5
  ]);
}

/** Quick pop for a normal chat message received */
export function playChatMessage() {
  playNotes([
    { freq: 880, start: 0, dur: 0.06, type: 'sine', vol: 0.12 },
  ]);
}

/** Sad descending tones for round end without correct answer */
export function playRoundEnd() {
  playNotes([
    { freq: 523, start: 0,    dur: 0.2, type: 'triangle', vol: 0.25 },  // C5
    { freq: 440, start: 0.18, dur: 0.2, type: 'triangle', vol: 0.25 },  // A4
    { freq: 349, start: 0.36, dur: 0.4, type: 'triangle', vol: 0.25 },  // F4
  ]);
}

/** Energetic fanfare for game over / winner */
export function playGameOver() {
  playNotes([
    { freq: 523, start: 0,    dur: 0.12, type: 'square', vol: 0.2 },  // C5
    { freq: 659, start: 0.1,  dur: 0.12, type: 'square', vol: 0.2 },  // E5
    { freq: 784, start: 0.2,  dur: 0.12, type: 'square', vol: 0.2 },  // G5
    { freq: 1047,start: 0.3,  dur: 0.35, type: 'square', vol: 0.25 }, // C6
  ]);
}

/** Tick sound for timer below 10 seconds */
export function playTimerTick() {
  playNotes([
    { freq: 1200, start: 0, dur: 0.04, type: 'square', vol: 0.1 },
  ]);
}

/** Sci-fi blip for AI thinking/response */
export function playAiBlip() {
  playNotes([
    { freq: 440,  start: 0,    dur: 0.06, type: 'sawtooth', vol: 0.08 },
    { freq: 880,  start: 0.06, dur: 0.06, type: 'sawtooth', vol: 0.08 },
    { freq: 1320, start: 0.12, dur: 0.1,  type: 'sawtooth', vol: 0.1  },
  ]);
}

/** Soft warm chime for a new round starting */
export function playRoundStart() {
  playNotes([
    { freq: 392, start: 0,    dur: 0.15, type: 'sine', vol: 0.2 },  // G4
    { freq: 523, start: 0.14, dur: 0.25, type: 'sine', vol: 0.25 }, // C5
  ]);
}

/** Brief error buzz */
export function playError() {
  playNotes([
    { freq: 150, start: 0,    dur: 0.08, type: 'square', vol: 0.15 },
    { freq: 130, start: 0.08, dur: 0.12, type: 'square', vol: 0.15 },
  ]);
}
