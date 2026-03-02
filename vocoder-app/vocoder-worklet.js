// AudioWorklet: filter-bank vocoder
// Modulator (voice) envelopes shape a carrier (saw).

const MAX_BANDS = 16;
const LOW_FREQ = 80;
const HIGH_FREQ = 8000;

function logSpace(low, high, n) {
  const arr = [];
  if (n <= 1) return n === 1 ? [low] : [];
  const logLow = Math.log(low);
  const logHigh = Math.log(high);
  for (let i = 0; i < n; i++) {
    arr.push(Math.exp(logLow + (i / (n - 1)) * (logHigh - logLow)));
  }
  return arr;
}

function onePoleCoeff(freq, sampleRate) {
  const t = 1 / sampleRate;
  return 1 - Math.exp(-2 * Math.PI * freq * t);
}

const HIGHPASS_FREQ = 100;

class VocoderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'carrierFreq', defaultValue: 150, minValue: 50, maxValue: 500, automationRate: 'a-rate' },
      { name: 'bandCount', defaultValue: 8, minValue: 4, maxValue: 16, automationRate: 'k-rate' },
      { name: 'carrierType', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'highPass', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }

  constructor(options) {
    super();
    this.sampleRate = sampleRate;
    this.phase = 0;
    this.bandFreqs = logSpace(LOW_FREQ, HIGH_FREQ, MAX_BANDS);
    this.envCoeff = onePoleCoeff(50, sampleRate);
    this.modEnvs = new Float32Array(MAX_BANDS);
    this.modPrev = new Float32Array(MAX_BANDS * 4);
    this.carPrev = new Float32Array(MAX_BANDS * 4);
    this.bandQ = 2;
    this.hpLpPrev = 0;
    this.hpA0 = 1 - Math.exp(-2 * Math.PI * HIGHPASS_FREQ / sampleRate);
  }

  processBandpass(inVal, centerFreq, prev, q, sampleRate) {
    const w0 = 2 * Math.PI * centerFreq / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const b0 = alpha;
    const b1 = 0;
    const b2 = -alpha;
    const a0 = 1 + alpha;
    const a1 = -2 * Math.cos(w0);
    const a2 = 1 - alpha;
    const x = inVal;
    const y = (b0 / a0) * x + (b1 / a0) * prev[0] + (b2 / a0) * prev[1]
            - (a1 / a0) * prev[2] - (a2 / a0) * prev[3];
    prev[1] = prev[0]; prev[0] = x;
    prev[3] = prev[2]; prev[2] = y;
    return y;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input.length || !input[0].length || !output.length || !output[0].length) return true;

    const modChannel = input[0];
    const outCh0 = output[0];
    const outCh1 = output.length > 1 ? output[1] : null;
    const frames = modChannel.length;
    const carrierFreq = Number(parameters.carrierFreq[0]) || 150;

    const bandCount = Math.min(Math.max(1, parameters.bandCount[0] | 0), MAX_BANDS);
    const carrierType = (parameters.carrierType[0] | 0) ? 1 : 0;
    const highPassOn = (parameters.highPass[0] | 0) ? 1 : 0;

    for (let i = 0; i < frames; i++) {
      let mod = modChannel[i];
      if (highPassOn) {
        const lpOut = this.hpA0 * mod + (1 - this.hpA0) * this.hpLpPrev;
        this.hpLpPrev = lpOut;
        mod = mod - lpOut;
      }

      const inc = (2 * carrierFreq) / this.sampleRate;
      this.phase += inc;
      if (this.phase >= 1) this.phase -= 2;
      if (this.phase < -1) this.phase += 2;
      const carrier = carrierType === 1 ? (this.phase >= 0 ? 1 : -1) : this.phase;

      let out = 0;
      for (let b = 0; b < bandCount; b++) {
        const cf = this.bandFreqs[b];
        const modBand = this.processBandpass(mod, cf, this.modPrev.subarray(b * 4, b * 4 + 4), this.bandQ, this.sampleRate);
        const env = Math.abs(modBand);
        this.modEnvs[b] = this.modEnvs[b] + this.envCoeff * (env - this.modEnvs[b]);

        const carBand = this.processBandpass(carrier, cf, this.carPrev.subarray(b * 4, b * 4 + 4), this.bandQ, this.sampleRate);
        out += carBand * this.modEnvs[b];
      }
      out /= bandCount;
      out *= 1.2;
      const s = Math.max(-1, Math.min(1, out));
      outCh0[i] = s;
      if (outCh1) outCh1[i] = s;
    }
    return true;
  }
}

registerProcessor('vocoder-processor', VocoderProcessor);
