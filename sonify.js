/*
 * sonify.js: audio graphs for Stargazer.
 *
 * Adapted from athersharif/sonifier (src/index.js and src/getSynth.js),
 * Copyright (c) 2023, Ather Sharif. BSD 3-Clause License, full text in
 * licenses/sonifier.txt and NOTICE.
 *
 * CHANGED from the original: rewritten for the plain Web Audio API instead of
 * Tone.js (Tone.js is not in the starred list, so it is not used), lodash
 * removed, and an onNote callback added so the page can show which bar is
 * playing. Kept from the original: the linear value-to-frequency mapping
 * (toFrequency), the default 130 to 650 Hz range, the 0.5 second interval per
 * data point, the AM square oscillator with 8 partials and the envelope.
 */

const defaultSettings = {
  frequency: { minimum: 130, maximum: 650 },
  interval: 0.5,
  partialCount: 8,
  envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
  volume: 0.18,
};

// Same formula as sonifier's toFrequency.
export const toFrequency = (value, minimumDataValue, maximumDataValue, minimumFrequency, maximumFrequency) =>
  maximumDataValue === minimumDataValue
    ? (minimumFrequency + maximumFrequency) / 2
    : ((value - minimumDataValue) * (maximumFrequency - minimumFrequency)) /
        (maximumDataValue - minimumDataValue) +
      minimumFrequency;

const waveCache = new WeakMap();
function squareWave(ctx, partialCount) {
  let byCount = waveCache.get(ctx);
  if (!byCount) { byCount = {}; waveCache.set(ctx, byCount); }
  if (byCount[partialCount]) return byCount[partialCount];
  // A square wave built from its first `partialCount` partials, like Tone's "square8".
  const real = new Float32Array(partialCount + 1);
  const imag = new Float32Array(partialCount + 1);
  for (let n = 1; n <= partialCount; n++) imag[n] = n % 2 ? 4 / (Math.PI * n) : 0;
  byCount[partialCount] = ctx.createPeriodicWave(real, imag);
  return byCount[partialCount];
}

/**
 * Plays data.y as a sequence of notes. Returns a handle with stop().
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {{x: string[], y: number[]}} data
 */
export function sonify(ctx, destination, data, settings = {}, onNote = () => {}, onEnd = () => {}) {
  const s = {
    ...defaultSettings,
    ...settings,
    frequency: { ...defaultSettings.frequency, ...(settings.frequency || {}) },
    envelope: { ...defaultSettings.envelope, ...(settings.envelope || {}) },
  };
  const sorted = [...data.y].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const nodes = [];
  const timers = [];
  const t0 = ctx.currentTime + 0.05;
  data.y.forEach((value, i) => {
    const f = toFrequency(value, min, max, s.frequency.minimum, s.frequency.maximum);
    const start = t0 + i * s.interval;
    const stop = start + s.interval;
    const carrier = ctx.createOscillator();
    carrier.setPeriodicWave(squareWave(ctx, s.partialCount));
    carrier.frequency.value = f;
    // Amplitude modulation, as in Tone's AMOscillator (harmonicity 1).
    const mod = ctx.createOscillator();
    mod.frequency.value = f;
    const modGain = ctx.createGain();
    modGain.gain.value = 0.5;
    const amp = ctx.createGain();
    amp.gain.value = 0.5;
    mod.connect(modGain).connect(amp.gain);
    const env = ctx.createGain();
    const { attack, decay, sustain } = s.envelope;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(s.volume, start + attack);
    env.gain.linearRampToValueAtTime(s.volume * sustain, start + attack + decay);
    env.gain.setValueAtTime(s.volume * sustain, stop - 0.06);
    env.gain.linearRampToValueAtTime(0, stop - 0.01);
    carrier.connect(amp).connect(env).connect(destination);
    carrier.start(start); mod.start(start);
    carrier.stop(stop); mod.stop(stop);
    nodes.push(carrier, mod);
    timers.push(setTimeout(() => onNote(i), Math.max(0, (start - ctx.currentTime) * 1000)));
  });
  timers.push(setTimeout(onEnd, Math.max(0, (t0 + data.y.length * s.interval - ctx.currentTime) * 1000)));
  return {
    stop() {
      timers.forEach(clearTimeout);
      nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
    },
  };
}
