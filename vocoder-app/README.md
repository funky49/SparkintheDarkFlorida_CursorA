# Vocoder Web App

Record your voice and play it back with a **vocoder** effect (robot/synth-style sound). Works in the browser on desktop and mobile.

## How to run

- **Local**: Open `index.html` in a modern browser. For the worklet to load, serve the folder over HTTP (e.g. `npx serve .` or your editor’s “Live Server”) so `vocoder-worklet.js` loads from the same origin.
- **Phone**: Deploy the `vocoder-app` folder to any static host (GitHub Pages, Netlify, etc.) and open the URL on your phone. Allow microphone access when prompted.

## Usage

1. Tap **Record** and allow microphone access.
2. Speak (or make noise), then tap **Stop**.
3. Toggle **Vocoder effect** on/off and use **Carrier pitch** and **Bands** to shape the sound.
4. Tap **Play** to hear the recording (with or without vocoder).
5. Use **Download** to save the recording (raw, not vocoded).

## Tech

- **Recording**: `getUserMedia` + `MediaRecorder` (WebM/Opus or MP4 on Safari).
- **Effect**: `AudioWorklet` filter-bank vocoder (modulator = your recording, carrier = saw wave).
- No server; everything runs in the browser.

## Files

- `index.html` – UI and structure
- `vocoder.css` – Layout and styles
- `vocoder.js` – Recording, playback, and worklet wiring
- `vocoder-worklet.js` – Vocoder DSP (filter bands + carrier)
