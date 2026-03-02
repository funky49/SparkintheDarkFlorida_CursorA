/**
 * Realistic Vocoder Mixer - record, vocode, mix, reverb, delay.
 */

(function () {
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const playBtn = document.getElementById('playBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const statusEl = document.getElementById('status');
  const vocoderToggle = document.getElementById('vocoderToggle');
  const carrierFreqInput = document.getElementById('carrierFreq');
  const carrierFreqVal = document.getElementById('carrierFreqVal');
  const bandsInput = document.getElementById('bands');
  const bandsVal = document.getElementById('bandsVal');
  const presetKnob = document.getElementById('presetKnob');
  const knobContainer = document.getElementById('knobContainer');
  const presetClassicBtn = document.querySelector('.knob-label.knob-classic');
  const presetVp330Btn = document.querySelector('.knob-label.knob-vp330');
  const presetRobotBtn = document.querySelector('.knob-label.knob-robot');
  const mixFader = document.getElementById('mixFader');
  const mixFaderVal = document.getElementById('mixFaderVal');
  const reverbFader = document.getElementById('reverbFader');
  const reverbFaderVal = document.getElementById('reverbFaderVal');
  const delayFader = document.getElementById('delayFader');
  const delayFaderVal = document.getElementById('delayFaderVal');

  const PRESETS = {
    classic: { carrierFreq: 150, bands: 8, carrierType: 0, highPass: 0 },
    vp330: { carrierFreq: 120, bands: 10, carrierType: 0, highPass: 0 },
    robot: { carrierFreq: 70, bands: 12, carrierType: 1, highPass: 1 }
  };
  // VP-330: Roland Vocoder Plus (1979–80). 10-band vocoder, single VCO (saw), no HP. See https://en.wikipedia.org/wiki/Roland_VP-330

  const PRESET_KEYS = ['classic', 'vp330', 'robot'];

  function getPresetKey() {
    return PRESET_KEYS[Number(presetKnob.value)] || 'classic';
  }

  function updatePresetUI() {
    const v = Number(presetKnob.value);
    const key = getPresetKey();
    knobContainer.classList.remove('knob-vp330', 'knob-robot');
    if (v === 1) knobContainer.classList.add('knob-vp330');
    if (v === 2) knobContainer.classList.add('knob-robot');
    presetClassicBtn.classList.toggle('active', v === 0);
    presetClassicBtn.setAttribute('aria-pressed', v === 0);
    presetVp330Btn.classList.toggle('active', v === 1);
    presetVp330Btn.setAttribute('aria-pressed', v === 1);
    presetRobotBtn.classList.toggle('active', v === 2);
    presetRobotBtn.setAttribute('aria-pressed', v === 2);
    if (key !== 'classic') {
      const p = PRESETS[key];
      carrierFreqInput.value = p.carrierFreq;
      carrierFreqVal.textContent = p.carrierFreq + ' Hz';
      bandsInput.value = p.bands;
      bandsVal.textContent = p.bands;
    }
    updateKnobRotation(carrierFreqInput, 80, 400);
    updateKnobRotation(bandsInput, 4, 16);
  }

  function updateKnobRotation(input, min, max) {
    const val = Number(input.value);
    const pct = (val - min) / (max - min);
    const deg = -135 + pct * 270;
    const knob = input.closest('.knob');
    if (knob) {
      const dial = knob.querySelector('.knob-dial');
      if (dial) dial.style.transform = 'rotate(' + deg + 'deg)';
    }
  }

  function createReverbIR(ctx, duration, decay) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(2, length, sampleRate);
    const L = buffer.getChannelData(0);
    const R = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const d = Math.exp(-t / decay);
      L[i] = (Math.random() * 2 - 1) * d;
      R[i] = (Math.random() * 2 - 1) * d;
    }
    return buffer;
  }

  let audioContext = null;
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedBlob = null;
  let vocoderNode = null;
  let workletLoaded = false;

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function enableAudioContext() {
    if (audioContext) return audioContext;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  async function loadWorklet() {
    if (workletLoaded) return;
    const ctx = enableAudioContext();
    await ctx.audioWorklet.addModule('vocoder-worklet.js');
    workletLoaded = true;
  }

  recordBtn.addEventListener('click', async function () {
    try {
      enableAudioContext();
      setStatus('Requesting mic…');
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType: mime });
      mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = function () {
        if (recordedChunks.length) {
          recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
          playBtn.disabled = false;
          downloadBtn.disabled = false;
          setStatus('Ready. Set mix/reverb/delay and PLAY.');
        } else {
          setStatus('Empty. Try again.');
        }
      };
      mediaRecorder.start();
      recordBtn.disabled = true;
      recordBtn.classList.add('recording');
      stopBtn.disabled = false;
      setStatus('Recording…');
    } catch (err) {
      setStatus('Error: ' + (err.message || 'No mic'));
      console.error(err);
    }
  });

  stopBtn.addEventListener('click', function () {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(function (t) { t.stop(); });
    }
    recordBtn.disabled = false;
    recordBtn.classList.remove('recording');
    stopBtn.disabled = true;
    setStatus('Processing…');
  });

  playBtn.addEventListener('click', async function () {
    if (!recordedBlob) return;
    try {
      const ctx = enableAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = decoded;

      const useVocoder = vocoderToggle.checked;
      const carrierFreq = Number(carrierFreqInput.value);
      const bandCount = Number(bandsInput.value);
      const mixPct = Number(mixFader.value) / 100;
      const reverbPct = Number(reverbFader.value) / 100;
      const delayPct = Number(delayFader.value) / 100;

      const masterMix = ctx.createGain();
      masterMix.gain.value = 1;
      masterMix.connect(ctx.destination);

      if (useVocoder && bandCount > 0) {
        await loadWorklet();
        const key = getPresetKey();
        const preset = PRESETS[key];
        const usePresetParams = key !== 'classic';
        const freq = usePresetParams ? preset.carrierFreq : carrierFreq;
        const bands = usePresetParams ? preset.bands : bandCount;
        vocoderNode = new AudioWorkletNode(ctx, 'vocoder-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          parameterData: {
            carrierFreq: freq,
            bandCount: bands,
            carrierType: preset.carrierType,
            highPass: preset.highPass
          }
        });
        const dryGain = ctx.createGain();
        const vocodedGain = ctx.createGain();
        dryGain.gain.value = mixPct;
        vocodedGain.gain.value = 1 - mixPct;
        source.connect(dryGain);
        source.connect(vocoderNode);
        vocoderNode.connect(vocodedGain);
        dryGain.connect(masterMix);
        vocodedGain.connect(masterMix);
      } else {
        const dryGain = ctx.createGain();
        dryGain.gain.value = 1;
        source.connect(dryGain);
        dryGain.connect(masterMix);
      }

      if (reverbPct > 0.001) {
        const ir = createReverbIR(ctx, 1.2, 0.4);
        const convolver = ctx.createConvolver();
        convolver.buffer = ir;
        const reverbGain = ctx.createGain();
        reverbGain.gain.value = reverbPct * 0.45;
        masterMix.connect(convolver);
        convolver.connect(reverbGain);
        reverbGain.connect(ctx.destination);
      }

      if (delayPct > 0.001) {
        const delayTime = 0.3;
        const delay = ctx.createDelay(2);
        delay.delayTime.value = delayTime;
        const delayInput = ctx.createGain();
        delayInput.gain.value = 1;
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.value = 0.45;
        const delayWetGain = ctx.createGain();
        delayWetGain.gain.value = delayPct * 0.5;
        masterMix.connect(delayInput);
        feedbackGain.connect(delayInput);
        delayInput.connect(delay);
        delay.connect(delayWetGain);
        delayWetGain.connect(ctx.destination);
        delay.connect(feedbackGain);
      }

      source.onended = function () {
        setStatus('Playback finished.');
      };
      source.start(0);
      setStatus('Playing…');
    } catch (err) {
      setStatus('Playback error: ' + (err.message || 'Unknown'));
      console.error(err);
    }
  });

  downloadBtn.addEventListener('click', function () {
    if (!recordedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(recordedBlob);
    a.download = 'vocoder-recording.webm';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('Saved.');
  });

  carrierFreqInput.addEventListener('input', function () {
    carrierFreqVal.textContent = this.value + ' Hz';
    updateKnobRotation(this, 80, 400);
  });

  bandsInput.addEventListener('input', function () {
    bandsVal.textContent = this.value;
    updateKnobRotation(this, 4, 16);
  });

  mixFader.addEventListener('input', function () {
    mixFaderVal.textContent = this.value + '%';
  });

  reverbFader.addEventListener('input', function () {
    reverbFaderVal.textContent = this.value;
  });

  delayFader.addEventListener('input', function () {
    delayFaderVal.textContent = this.value;
  });

  presetKnob.addEventListener('input', updatePresetUI);
  knobContainer.addEventListener('click', function (e) {
    e.preventDefault();
    const next = (Number(presetKnob.value) + 1) % 3;
    presetKnob.value = String(next);
    updatePresetUI();
  });
  presetClassicBtn.addEventListener('click', function () {
    presetKnob.value = '0';
    updatePresetUI();
  });
  presetVp330Btn.addEventListener('click', function () {
    presetKnob.value = '1';
    updatePresetUI();
  });
  presetRobotBtn.addEventListener('click', function () {
    presetKnob.value = '2';
    updatePresetUI();
  });

  updatePresetUI();
  updateKnobRotation(carrierFreqInput, 80, 400);
  updateKnobRotation(bandsInput, 4, 16);
  setStatus('REC to start. Allow mic.');
})();
