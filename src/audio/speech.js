// Thin wrapper around the Web Speech API for pronouncing banked words.

class Speech {
  constructor() {
    this.enabled = true;
    this.voice = null;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.supported) {
      this.pickVoice();
      try {
        window.speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
      } catch (e) {
        /* older browsers */
      }
    }
  }

  pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices();
      const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
      // Prefer friendly, natural-sounding voices when present
      this.voice =
        english.find((v) => /samantha|google us english|karen|daniel|aria|jenny/i.test(v.name)) ||
        english.find((v) => v.default) ||
        english[0] ||
        null;
    } catch (e) {
      this.voice = null;
    }
  }

  say(text, { rate = 0.9, pitch = 1.1, force = false } = {}) {
    if (!this.supported || (!this.enabled && !force) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice ? this.voice.lang : 'en-US';
      u.rate = rate;
      u.pitch = pitch;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* speech unavailable */
    }
  }

  cancel() {
    if (!this.supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      /* ignore */
    }
  }
}

export const speech = new Speech();
