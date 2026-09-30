(() => {
  'use strict';

  const CASE = window.MURDER_CITY_CASE;
  const LEGENDS = window.MURDER_CITY_LEGENDS;
  const PACKS = window.MURDER_CITY_CELL_PACKS || {};
  const LANDMARK_MAP = window.MURDER_CITY_LANDMARK_MAP || { mode: 'none', cells: {} };
  const SECRET = window.MURDER_CITY_SECRET;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const el = {
    entryView: document.getElementById('entryView'),
    scanView: document.getElementById('scanView'),
    resultView: document.getElementById('resultView'),
    form: document.getElementById('searchForm'),
    district: document.getElementById('district'),
    districtName: document.getElementById('districtName'),
    districtStrip: document.querySelector('.district-strip'),
    avenue: document.getElementById('avenue'),
    street: document.getElementById('street'),
    breachBtn: document.getElementById('breachBtn'),
    error: document.getElementById('formError'),
    scanAddress: document.getElementById('scanAddress'),
    scanner: document.getElementById('scanner'),
    scanShell: document.querySelector('.scan-shell'),
    legendImage: document.getElementById('legendImage'),
    legendNumber: document.getElementById('legendNumber'),
    scanStatusText: document.getElementById('scanStatusText'),
    policeFlash: document.getElementById('policeFlash'),
    resultPanel: document.getElementById('resultPanel'),
    resultScroll: document.getElementById('resultScroll'),
    resultStamp: document.getElementById('resultStamp'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    wrongDetails: document.getElementById('wrongDetails'),
    eliminationBadge: document.getElementById('eliminationBadge'),
    eliminationClue: document.getElementById('eliminationClue'),
    eliminationReason: document.getElementById('eliminationReason'),
    correctDetails: document.getElementById('correctDetails'),
    finalAddress: document.getElementById('finalAddress'),
    finalDeduction: document.getElementById('finalDeduction'),
    evidenceGrid: document.getElementById('evidenceGrid'),
    proofList: document.getElementById('proofList'),
    tryAgain: document.getElementById('tryAgainBtn'),
    soundBtn: document.getElementById('soundBtn'),
    soundLabel: document.getElementById('soundLabel'),
    confetti: document.getElementById('confettiCanvas')
  };

  // Sound is ON by default. Modern browsers still require a user gesture before
  // Web Audio can actually play; the first tap/click (including BREACH ADDRESS)
  // unlocks the audio context automatically.
  let soundOn = true;
  let audioCtx = null;
  let searchInProgress = false;

  const imagesById = new Map(LEGENDS.images.map(x => [Number(x.id), x]));
  const legendPaths = LEGENDS.images.map(x => `assets/legends/${x.file}`);
  const nonApartmentPath = 'assets/ui/non-apartment.svg';

  [...legendPaths, nonApartmentPath].forEach(src => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const b64ToBytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

  function showView(name) {
    const views = { entry: el.entryView, scan: el.scanView, result: el.resultView };
    Object.entries(views).forEach(([key, node]) => { node.hidden = key !== name; });
  }

  async function digestBytes(text) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
  }
  async function digestHex(text) { return hex(await digestBytes(text)); }
  async function importAesKey(prefix, addressKey) {
    const raw = await digestBytes(`${prefix}|${addressKey}`);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  }
  async function ivFor(prefix, addressKey) {
    return (await digestBytes(`${prefix}|${addressKey}`)).slice(0, 12);
  }
  async function decryptCellPack(addressKey, ciphertext) {
    const key = await importAesKey('murder-city-pack-v2', addressKey);
    const iv = await ivFor('murder-city-pack-iv-v2', addressKey);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBytes(ciphertext));
    return JSON.parse(decoder.decode(plain).trimEnd());
  }
  async function decryptCaseSecret(addressKey) {
    const key = await importAesKey('murder-city-secret-v2', addressKey);
    const iv = await ivFor('murder-city-secret-iv-v2', addressKey);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBytes(SECRET.ciphertext));
    return JSON.parse(decoder.decode(plain));
  }
  async function lookupRecord(addressKey) {
    const h = await digestHex(`murder-city-lookup-v2|${addressKey}`);
    return PACKS[h] || null;
  }

  function addressKey(d, a, s) { return `${Number(d)}|${a}|${Number(s)}`; }
  function addressLabel(d, a, s) {
    const districtName = CASE.districtNames[String(Number(d))] || '';
    return `District ${Number(d)} · ${districtName} · Avenue ${a} · Street ${Number(s)}`;
  }

  function validate() {
    const d = Number(el.district.value);
    const a = el.avenue.value;
    const s = Number(el.street.value);
    if (!Number.isInteger(d) || d < 1 || d > CASE.dimensions.districts) return 'District must be from 1 to 100.';
    if (!CASE.dimensions.avenues.includes(a)) return 'Choose an Avenue from A to G.';
    if (!CASE.dimensions.streets.includes(s)) return 'Choose a Street from 1 to 10.';
    return '';
  }

  function updateDistrictName() {
    const d = Number(el.district.value);
    const name = CASE.districtNames[String(d)];
    el.districtName.textContent = name ? `District ${d}: ${name}` : 'Enter a district number from 1 to 100.';
    el.districtStrip.classList.toggle('valid', Boolean(name));
  }

  function setLegend(id) {
    const item = imagesById.get(Number(id)) || LEGENDS.images[0];
    el.legendImage.src = `assets/legends/${item.file}`;
    el.legendImage.alt = item.label;
    el.legendNumber.textContent = `ARTWORK ${String(item.id).padStart(2, '0')} · ${item.label}`;
  }

  function setNonApartment() {
    el.legendImage.src = nonApartmentPath;
    el.legendImage.alt = 'Non-apartment landmark cell';
    el.legendNumber.textContent = 'LANDMARK CELL · NOT AN APARTMENT CANDIDATE';
  }

  async function unlockAudio() {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    } catch (_) {}
  }

  function beep(freq, duration, volume) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
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

  async function spinLegend(stopAtId) {
    el.scanner.classList.add('breaching');
    el.scanShell.classList.add('is-scanning');
    el.scanStatusText.textContent = 'BREACHING ADDRESS...';
    beep(118, .12, .04);
    await sleep(390);

    el.scanner.classList.remove('breaching');
    el.scanner.classList.add('scanning');
    el.scanStatusText.textContent = 'CYCLING ALL 35 ARTWORK FILES...';

    const total = LEGENDS.artworkCount;
    const start = Math.floor(Math.random() * total);

    // Fast first pass: every artwork is shown once.
    for (let i = 0; i < total; i++) {
      setLegend(((start + i) % total) + 1);
      beep(188 + i * 4, .016, .011);
      await sleep(20);
    }

    // Deceleration phase: visibly slows as if the scan is locking onto a cell.
    el.scanStatusText.textContent = 'NARROWING VISUAL MATCH...';
    let current = ((start + total - 1) % total) + 1;
    const slowSteps = 15;
    for (let i = 0; i < slowSteps; i++) {
      current = (current % total) + 1;
      setLegend(current);
      const t = i / (slowSteps - 1);
      beep(320 + i * 8, .022, .016);
      await sleep(38 + Math.pow(t, 2.55) * 205);
    }

    // Final lock, then deliberately hold for 0.8 s so the player can see it.
    if (stopAtId) setLegend(stopAtId);
    else setNonApartment();

    el.scanner.classList.remove('scanning');
    el.scanShell.classList.remove('is-scanning');
    el.scanStatusText.textContent = stopAtId ? 'VISUAL MATCH LOCKED' : 'CELL CLASSIFICATION LOCKED';
    beep(548, .095, .035);
    await sleep(800);
  }

  function resetResultContent() {
    el.wrongDetails.hidden = true;
    el.correctDetails.hidden = true;
    el.evidenceGrid.innerHTML = '';
    el.proofList.innerHTML = '';
    el.resultScroll.scrollTop = 0;
  }

  function prepareWrongResult(d, a, s, pack) {
    resetResultContent();
    el.resultPanel.className = 'result-panel wrong';
    el.resultStamp.innerHTML = 'ELIMI-<br>NATED';
    el.resultKicker.textContent = 'SEARCH RESULT / ADDRESS RULED OUT';
    el.resultTitle.textContent = 'The killer is not hiding here.';
    el.resultMessage.textContent = `${addressLabel(d, a, s)} does not survive all 18 clues.`;
    el.eliminationBadge.textContent = `FIRST ELIMINATED BY CLUE ${pack.clue}`;
    el.eliminationClue.textContent = pack.clueText;
    el.eliminationReason.textContent = pack.reason;
    el.wrongDetails.hidden = false;
  }

  function prepareNonApartmentResult(d, a, s) {
    resetResultContent();
    el.resultPanel.className = 'result-panel wrong';
    el.resultStamp.innerHTML = 'NOT A<br>CANDIDATE';
    el.resultKicker.textContent = 'SEARCH RESULT / LANDMARK CELL';
    el.resultTitle.textContent = 'The killer is not hiding here.';
    el.resultMessage.textContent = `${addressLabel(d, a, s)} is not one of the 4,883 apartment-building candidates in the QC city plan.`;
    el.eliminationBadge.textContent = 'OUTSIDE THE APARTMENT CANDIDATE POOL';
    el.eliminationClue.textContent = 'This cell is a landmark / non-apartment location.';
    el.eliminationReason.textContent = 'The elimination audit evaluates apartment buildings as possible hideouts. This cell therefore cannot be the final apartment address.';
    el.wrongDetails.hidden = false;
  }

  function prepareCorrectResult(payload) {
    resetResultContent();
    el.resultPanel.className = 'result-panel correct';
    el.resultStamp.innerHTML = 'CASE<br>CLOSED';
    el.resultKicker.textContent = 'SEARCH RESULT / POSITIVE MATCH';
    el.resultTitle.textContent = payload.headline;
    el.resultMessage.textContent = payload.subheadline;
    el.finalAddress.textContent = payload.addressLabel;
    el.finalDeduction.textContent = payload.finalDeduction;

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

    (payload.proofs || []).forEach(item => {
      const details = document.createElement('details');
      details.className = 'proof-item';
      const summary = document.createElement('summary');
      const n = document.createElement('span');
      n.className = 'proof-no';
      n.textContent = item.no;
      const t = document.createElement('span');
      t.textContent = item.clue;
      const f = document.createElement('span');
      f.className = 'proof-family';
      f.textContent = item.family;
      summary.append(n, t, f);
      const body = document.createElement('div');
      body.className = 'proof-body';
      const p = document.createElement('p');
      const strong = document.createElement('strong');
      strong.textContent = 'Why it fits: ';
      p.append(strong, document.createTextNode(item.proof));
      body.append(p);
      details.append(summary, body);
      el.proofList.append(details);
    });

    el.correctDetails.hidden = false;
  }

  function victorySound() {
    if (!soundOn) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => beep(f, .2, .045), i * 105));
  }

  function launchConfetti() {
    const canvas = el.confetti;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = innerWidth;
    const h = innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = ['#e33a2f', '#f4bc38', '#71d6e9', '#0b2b39', '#fff8e8'];
    const pieces = Array.from({ length: 115 }, () => ({
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
      ctx.clearRect(0, 0, w, h);
      pieces.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += .045;
        p.a += p.va;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      });
      if (++frame < 220) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    }
    requestAnimationFrame(draw);
  }

  el.form.addEventListener('submit', async event => {
    event.preventDefault();
    if (searchInProgress) return;

    el.error.textContent = '';
    const error = validate();
    if (error) {
      el.error.textContent = error;
      return;
    }
    if (!window.crypto?.subtle) {
      el.error.textContent = 'This checker requires HTTPS (GitHub Pages) or localhost.';
      return;
    }

    searchInProgress = true;
    el.breachBtn.disabled = true;
    resetResultContent();
    await unlockAudio();

    const d = Number(el.district.value);
    const a = el.avenue.value;
    const s = Number(el.street.value);
    const key = addressKey(d, a, s);
    el.scanAddress.textContent = addressLabel(d, a, s);

    showView('scan');
    policeEffect();

    try {
      const record = await lookupRecord(key);
      let stopAt = null;
      if (record) stopAt = Number(LEGENDS.apartmentVariantImageIds[String(record[0])]);
      else if (LANDMARK_MAP.cells?.[key]) stopAt = Number(LANDMARK_MAP.cells[key]);

      // Prepare the result data while the visual scan runs, but do not display it
      // until the final legend has been held on screen for 0.8 seconds.
      let resultPromise;
      if (!record) {
        resultPromise = Promise.resolve({ type: 'nonApartment' });
      } else {
        resultPromise = decryptCellPack(key, record[1]).then(async pack => {
          if (!pack.ok) return { type: 'wrong', pack };
          const payload = await decryptCaseSecret(key);
          return { type: 'correct', payload };
        });
      }

      const [result] = await Promise.all([resultPromise, spinLegend(stopAt)]);

      if (result.type === 'wrong') prepareWrongResult(d, a, s, result.pack);
      else if (result.type === 'nonApartment') prepareNonApartmentResult(d, a, s);
      else {
        prepareCorrectResult(result.payload);
        el.scanStatusText.textContent = 'POSITIVE MATCH — TARGET FOUND';
      }

      showView('result');

      if (result.type === 'correct') {
        policeEffect();
        launchConfetti();
        victorySound();
      }
    } catch (err) {
      console.error(err);
      showView('entry');
      el.error.textContent = 'The checker could not verify this address. Publish it on GitHub Pages (HTTPS) or run it on localhost.';
    } finally {
      searchInProgress = false;
      el.breachBtn.disabled = false;
    }
  });

  el.district.addEventListener('input', updateDistrictName);
  updateDistrictName();

  el.tryAgain.addEventListener('click', () => {
    resetResultContent();
    el.scanStatusText.textContent = 'TERMINAL READY';
    el.scanner.classList.remove('breaching', 'scanning');
    el.scanShell.classList.remove('is-scanning');
    showView('entry');
    // Deliberately do not focus District. The reader chooses what to edit next.
  });

  el.soundBtn.addEventListener('click', async () => {
    soundOn = !soundOn;
    el.soundBtn.setAttribute('aria-pressed', String(soundOn));
    el.soundLabel.textContent = `Sound: ${soundOn ? 'On' : 'Off'}`;
    if (soundOn) {
      await unlockAudio();
      beep(420, .08, .03);
    }
  });

  // Unlock audio silently on the first real interaction while preserving
  // the default "Sound: On" state.
  window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  showView('entry');
})();
