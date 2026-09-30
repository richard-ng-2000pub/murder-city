(() => {
  'use strict';

  const CASE = window.MURDER_CITY_CASE;
  const CELL_DATA = window.MURDER_CITY_CELL_LEGENDS || { mode: 'demo-fallback', cells: {} };
  const LEGEND_COUNT = CASE.legendCount || 35;

  const el = {
    form: document.getElementById('searchForm'),
    district: document.getElementById('district'),
    avenue: document.getElementById('avenue'),
    street: document.getElementById('street'),
    breachBtn: document.getElementById('breachBtn'),
    error: document.getElementById('formError'),
    scanner: document.getElementById('scanner'),
    legendCard: document.getElementById('legendCard'),
    legendImage: document.getElementById('legendImage'),
    legendNumber: document.getElementById('legendNumber'),
    scanStatus: document.getElementById('scanStatus'),
    dataNotice: document.getElementById('dataModeNotice'),
    policeFlash: document.getElementById('policeFlash'),
    resultPanel: document.getElementById('resultPanel'),
    resultStamp: document.getElementById('resultStamp'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    correctDetails: document.getElementById('correctDetails'),
    finalAddress: document.getElementById('finalAddress'),
    finalDeduction: document.getElementById('finalDeduction'),
    evidenceGrid: document.getElementById('evidenceGrid'),
    tryAgain: document.getElementById('tryAgainBtn'),
    soundBtn: document.getElementById('soundBtn'),
    confetti: document.getElementById('confettiCanvas')
  };

  let soundOn = false;
  let audioCtx = null;
  const legendPaths = Array.from({ length: LEGEND_COUNT }, (_, i) => `assets/legends/legend-${String(i + 1).padStart(2, '0')}.png`);

  // Preload all legend art so the roulette stays smooth even on mobile.
  legendPaths.forEach(src => { const img = new Image(); img.src = src; });

  if (CELL_DATA.mode !== 'exact') el.dataNotice.hidden = false;

  function normalizeAddress(district, avenue, street) {
    const d = String(district).trim().replace(/^0+/, '') || '0';
    const a = String(avenue).trim().toUpperCase().replace(/[^A-Z]/g, '');
    const s = String(street).trim().replace(/^0+/, '') || '0';
    return `${d}|${a}|${s}`;
  }

  function validateInput() {
    const district = el.district.value.trim();
    const avenue = el.avenue.value.trim().toUpperCase();
    const street = el.street.value.trim();
    if (!/^\d+$/.test(district) || Number(district) < 1) return 'Enter a valid District number.';
    if (!/^[A-Z]{1,3}$/.test(avenue)) return 'Enter a valid Avenue letter, for example B.';
    if (!/^\d+$/.test(street) || Number(street) < 1) return 'Enter a valid Street number.';
    return '';
  }

  async function sha256Hex(text) {
    if (!window.crypto?.subtle) throw new Error('Web Crypto requires HTTPS or localhost.');
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function b64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
  }

  async function decryptCorrectPayload(answerKey) {
    const cfg = CASE.crypto;
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(answerKey), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: b64ToBytes(cfg.salt), iterations: cfg.iterations, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(cfg.iv) }, key, b64ToBytes(cfg.ciphertext));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function deterministicLegend(addressKey) {
    // Demo-only fallback. Exact builds use the Excel-generated cell map.
    let h = 2166136261;
    for (let i = 0; i < addressKey.length; i++) {
      h ^= addressKey.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (Math.abs(h >>> 0) % LEGEND_COUNT) + 1;
  }

  function getLegendForCell(addressKey) {
    const mapped = CELL_DATA.cells?.[addressKey];
    const n = Number(mapped);
    return Number.isInteger(n) && n >= 1 && n <= LEGEND_COUNT ? n : deterministicLegend(addressKey);
  }

  function setLegend(n) {
    const safe = Math.max(1, Math.min(LEGEND_COUNT, Number(n) || 1));
    el.legendImage.src = legendPaths[safe - 1];
    el.legendImage.alt = `Legend image ${String(safe).padStart(2, '0')}`;
    el.legendNumber.textContent = `LEGEND ${String(safe).padStart(2, '0')}`;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async function spinLegend(stopAt) {
    el.scanner.classList.add('scanning');
    el.scanStatus.lastChild.textContent = ' SCANNING CITY LEGENDS...';
    let current = 1 + Math.floor(Math.random() * LEGEND_COUNT);
    const steps = 30 + Math.floor(Math.random() * 8);
    for (let i = 0; i < steps; i++) {
      current = ((current + 3 + Math.floor(Math.random() * 8) - 1) % LEGEND_COUNT) + 1;
      setLegend(current);
      beep(210 + i * 7, 0.025, 0.018);
      const t = i / Math.max(1, steps - 1);
      const delay = 38 + Math.pow(t, 3.15) * 260;
      await sleep(delay);
    }
    setLegend(stopAt);
    await sleep(220);
    el.scanner.classList.remove('scanning');
    el.scanStatus.lastChild.textContent = ' VISUAL MATCH LOCKED';
    beep(520, 0.09, 0.035);
  }

  function policeEffect() {
    document.body.classList.remove('breach-shake');
    el.policeFlash.classList.remove('active');
    void document.body.offsetWidth;
    document.body.classList.add('breach-shake');
    el.policeFlash.classList.add('active');
    setTimeout(() => document.body.classList.remove('breach-shake'), 650);
    setTimeout(() => el.policeFlash.classList.remove('active'), 1100);
  }

  function beep(freq, duration, volume) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }

  function renderWrong(district, avenue, street) {
    el.resultPanel.hidden = false;
    el.resultPanel.className = 'result-panel wrong';
    el.resultStamp.innerHTML = 'NOT<br>HERE';
    el.resultKicker.textContent = 'SEARCH RESULT / NO MATCH';
    el.resultTitle.textContent = 'The killer is not hiding here.';
    el.resultMessage.textContent = `District ${district}, Avenue ${avenue}, Street ${street} does not survive every clue. Recheck your eliminations and keep hunting.`;
    el.correctDetails.hidden = true;
    el.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderCorrect(payload) {
    el.resultPanel.hidden = false;
    el.resultPanel.className = 'result-panel correct';
    el.resultStamp.innerHTML = 'CASE<br>CLOSED';
    el.resultKicker.textContent = 'SEARCH RESULT / POSITIVE MATCH';
    el.resultTitle.textContent = payload.headline || 'TARGET CONFIRMED';
    el.resultMessage.textContent = payload.subheadline || 'The final hideout has been found.';
    el.finalAddress.textContent = payload.addressLabel;
    el.finalDeduction.textContent = payload.finalDeduction;
    el.evidenceGrid.innerHTML = '';
    (payload.evidence || []).forEach(item => {
      const card = document.createElement('article');
      card.className = 'evidence-card';
      const h = document.createElement('h4');
      h.textContent = item.title;
      const p = document.createElement('p');
      p.textContent = item.text;
      card.append(h, p);
      el.evidenceGrid.append(card);
    });
    el.correctDetails.hidden = false;
    launchConfetti();
    victorySound();
    el.resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function victorySound() {
    if (!soundOn) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => beep(f, .2, .045), i * 105));
  }

  function launchConfetti() {
    const canvas = el.confetti;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    const colors = ['#e33a2f','#f4bc38','#71d6e9','#0b2b39','#fff8e8'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * .25,
      vx: -2.4 + Math.random() * 4.8,
      vy: 2.5 + Math.random() * 4.8,
      r: 3 + Math.random() * 6,
      a: Math.random() * Math.PI * 2,
      va: -.16 + Math.random() * .32,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    let frame = 0;
    function draw() {
      ctx.clearRect(0,0,w,h);
      pieces.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += .045; p.a += p.va;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r/2, p.r*2, p.r);
        ctx.restore();
      });
      frame++;
      if (frame < 230) requestAnimationFrame(draw); else ctx.clearRect(0,0,w,h);
    }
    requestAnimationFrame(draw);
  }

  el.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    el.error.textContent = '';
    const error = validateInput();
    if (error) { el.error.textContent = error; return; }

    const district = String(Number(el.district.value));
    const avenue = el.avenue.value.trim().toUpperCase();
    const street = String(Number(el.street.value));
    const key = normalizeAddress(district, avenue, street);

    el.breachBtn.disabled = true;
    el.resultPanel.hidden = true;
    el.scanStatus.lastChild.textContent = ' BREACHING ADDRESS...';
    policeEffect();
    beep(120, .12, .04);

    try {
      const [hash] = await Promise.all([sha256Hex(key), spinLegend(getLegendForCell(key))]);
      const isCorrect = hash === CASE.answerHash;
      if (!isCorrect) {
        renderWrong(district, avenue, street);
      } else {
        el.scanStatus.lastChild.textContent = ' POSITIVE MATCH — TARGET FOUND';
        const payload = await decryptCorrectPayload(key);
        renderCorrect(payload);
      }
    } catch (err) {
      console.error(err);
      el.error.textContent = 'This checker needs to run on HTTPS (GitHub Pages) or localhost. If you opened index.html directly, start a local server or publish the folder to GitHub Pages.';
    } finally {
      el.breachBtn.disabled = false;
    }
  });

  el.tryAgain.addEventListener('click', () => {
    el.resultPanel.hidden = true;
    el.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.district.focus();
  });

  el.soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    el.soundBtn.setAttribute('aria-pressed', String(soundOn));
    el.soundBtn.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
    if (soundOn) beep(420, .08, .03);
  });

  el.avenue.addEventListener('input', () => {
    el.avenue.value = el.avenue.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  });
})();
