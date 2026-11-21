(function () {
  // === 0. CHẶN QUẢNG CÁO & TỰ ĐỘNG NHẬN THƯỞNG (NO-ADS + INSTANT REWARD) ===
  window.adsbygoogle = window.adsbygoogle || [];
  window.adConfig = window.adBreak = function () {};
  window.passBeforeAdData = function () {};
  window.adBreakDoneData = function () {
    if (window.myGameInstance) window.myGameInstance.SendMessage("GameObjectAds", "resumeGame");
  };
  window.gainReward = function () {
    if (window.myGameInstance) {
      window.myGameInstance.SendMessage("GameObjectAds", "resumeGameRewarded");
      window.myGameInstance.SendMessage("GameObjectAds", "rewardAdsCompleted");
    }
  };
  window.cancelReward = window.gainReward;
  window.noRewardAdsAvailable = window.gainReward;
  window.showNextAd = function () {
    setTimeout(window.adBreakDoneData, 50);
  };
  window.showReward = function () {
    setTimeout(window.gainReward, 50);
  };

  // === 1. HOOK THỜI GIAN CHO SPEED HACK (AN TOÀN CHO ÂM THANH) ===
  let speedMultiplier = 1;
  const origPerfNow = performance.now.bind(performance);
  const origRAF = window.requestAnimationFrame.bind(window);

  let lastRealPerf = origPerfNow();
  let virtualPerf = lastRealPerf;

  performance.now = function () {
    const real = origPerfNow();
    virtualPerf += (real - lastRealPerf) * speedMultiplier;
    lastRealPerf = real;
    return virtualPerf;
  };

  window.requestAnimationFrame = function (cb) {
    if (speedMultiplier === 1) {
      return origRAF(cb);
    }
    return origRAF(function (realTs) {
      cb(performance.now());
    });
  };

  // === 2. HOOK WEBASSEMBLY MEMORY & WEBAUDIO MUTE ===
  window.__wasmMemory = null;
  const origAC = window.AudioContext || window.webkitAudioContext;
  const capturedAudioContexts = [];
  if (origAC) {
    const WrappedAC = function (...args) {
      const ctx = new origAC(...args);
      capturedAudioContexts.push(ctx);
      return ctx;
    };
    WrappedAC.prototype = origAC.prototype;
    if (window.AudioContext) window.AudioContext = WrappedAC;
    if (window.webkitAudioContext) window.webkitAudioContext = WrappedAC;
  }

  function captureMemory(importObj, result) {
    try {
      if (importObj && importObj.env && importObj.env.memory instanceof WebAssembly.Memory) {
        window.__wasmMemory = importObj.env.memory;
      }
      if (result && result.instance && result.instance.exports) {
        for (const k of Object.keys(result.instance.exports)) {
          if (result.instance.exports[k] instanceof WebAssembly.Memory) {
            window.__wasmMemory = result.instance.exports[k];
          }
        }
      }
    } catch (e) {}
  }

  const origInstantiate = WebAssembly.instantiate;
  WebAssembly.instantiate = async function (bufferSource, importObject) {
    const res = await origInstantiate.call(WebAssembly, bufferSource, importObject);
    captureMemory(importObject, res);
    return res;
  };

  if (WebAssembly.instantiateStreaming) {
    const origInstantiateStreaming = WebAssembly.instantiateStreaming;
    WebAssembly.instantiateStreaming = async function (source, importObject) {
      const res = await origInstantiateStreaming.call(WebAssembly, source, importObject);
      captureMemory(importObject, res);
      return res;
    };
  }

  // === 3. BỘ QUÉT BỘ NHỚ (CHEAT ENGINE TRÊN WEB) ===
  let foundAddresses = []; // [{ type: 'i32' | 'f32', index: number }]
  let freezeTimer = null;

  function scanNew(targetVal) {
    if (!window.__wasmMemory) return { ok: false, msg: "Game chưa tải xong RAM!" };
    const buf = window.__wasmMemory.buffer;
    const i32 = new Int32Array(buf);
    const f32 = new Float32Array(buf);
    const num = Number(targetVal);
    if (Number.isNaN(num)) return { ok: false, msg: "Số không hợp lệ!" };

    foundAddresses = [];
    const isInt = Number.isInteger(num);
    for (let i = 0; i < i32.length; i++) {
      if (isInt && i32[i] === num) {
        foundAddresses.push({ type: "i32", index: i });
      }
      if (Math.abs(f32[i] - num) < 0.01) {
        foundAddresses.push({ type: "f32", index: i });
      }
    }
    return { ok: true, count: foundAddresses.length };
  }

  function filterNext(targetVal) {
    if (!window.__wasmMemory) return { ok: false, msg: "Game chưa tải xong RAM!" };
    if (foundAddresses.length === 0) return scanNew(targetVal);

    const buf = window.__wasmMemory.buffer;
    const i32 = new Int32Array(buf);
    const f32 = new Float32Array(buf);
    const num = Number(targetVal);
    if (Number.isNaN(num)) return { ok: false, msg: "Số không hợp lệ!" };

    const next = [];
    for (const item of foundAddresses) {
      if (item.type === "i32" && item.index < i32.length && i32[item.index] === num) {
        next.push(item);
      } else if (item.type === "f32" && item.index < f32.length && Math.abs(f32[item.index] - num) < 0.01) {
        next.push(item);
      }
    }
    foundAddresses = next;
    return { ok: true, count: foundAddresses.length };
  }

  function writeAddresses(newVal) {
    if (!window.__wasmMemory || foundAddresses.length === 0) return 0;
    const buf = window.__wasmMemory.buffer;
    const i32 = new Int32Array(buf);
    const f32 = new Float32Array(buf);
    const num = Number(newVal);
    if (Number.isNaN(num)) return 0;

    let updated = 0;
    // Giới hạn an toàn tối đa 200 địa chỉ để tránh crash nếu người dùng chưa lọc kỹ
    const limit = Math.min(foundAddresses.length, 200);
    for (let k = 0; k < limit; k++) {
      const item = foundAddresses[k];
      if (item.type === "i32" && item.index < i32.length) {
        i32[item.index] = Math.floor(num);
        updated++;
      } else if (item.type === "f32" && item.index < f32.length) {
        f32[item.index] = num;
        updated++;
      }
    }
    return updated;
  }

  // === 4. GIAO DIỆN MOD MENU ===
  function mountUI() {
    const style = document.createElement("style");
    style.textContent = `
      #mod-root {
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
        user-select: none;
      }
      #mod-toggle {
        background: linear-gradient(135deg, #0ea5e9, #6366f1);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 999px;
        padding: 8px 14px;
        font-weight: 800;
        font-size: 13px;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(14, 165, 233, 0.45);
      }
      #mod-panel {
        display: none;
        margin-top: 8px;
        width: 280px;
        background: rgba(15, 23, 42, 0.92);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(56, 189, 248, 0.4);
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65);
        font-size: 12px;
      }
      #mod-panel.open { display: block; }
      .mod-sec { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(148,163,184,0.2); }
      .mod-sec:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
      .mod-title { font-weight: 700; color: #38bdf8; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      .mod-row { display: flex; gap: 6px; margin-bottom: 6px; }
      .mod-btn {
        flex: 1;
        padding: 7px 6px;
        border: 1px solid rgba(148,163,184,0.3);
        border-radius: 8px;
        background: #1e293b;
        color: #e2e8f0;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
      }
      .mod-btn.active { background: #0284c7; border-color: #38bdf8; color: #fff; }
      .mod-btn.primary { background: linear-gradient(90deg, #10b981, #059669); border: none; color: #fff; }
      .mod-btn.warn { background: #b91c1c; border: none; color: #fff; }
      .mod-input {
        width: 100%;
        padding: 7px 9px;
        border-radius: 8px;
        border: 1px solid rgba(148,163,184,0.35);
        background: #0f172a;
        color: #fff;
        font-size: 13px;
        margin-bottom: 6px;
        outline: none;
      }
      .mod-status { font-size: 11px; color: #cbd5e1; margin-top: 4px; line-height: 1.4; }
      .mod-check { display: flex; align-items: center; gap: 6px; cursor: pointer; margin-top: 6px; color: #cbd5e1; }
    `;
    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "mod-root";
    root.innerHTML = `
      <button id="mod-toggle">🛠️ MOD MENU</button>
      <div id="mod-panel">
        <div class="mod-sec">
          <div class="mod-title">⚡ Tốc độ Game & Âm thanh</div>
          <div class="mod-row" id="speed-btns">
            <button class="mod-btn active" data-spd="1">1x</button>
            <button class="mod-btn" data-spd="2">2x</button>
            <button class="mod-btn" data-spd="3">3x</button>
            <button class="mod-btn" data-spd="5">5x</button>
          </div>
          <button id="btn-mute-audio" class="mod-btn" style="width:100%;">🔊 Âm thanh: Đang Bật (Bấm để Tắt)</button>
        </div>

        <div class="mod-sec">
          <div class="mod-title">💰 Mod Tiền / Kim Cương (RAM)</div>
          <input id="mod-scan-val" class="mod-input" type="number" placeholder="Nhập số tiền hiện có..." />
          <div class="mod-row">
            <button id="btn-scan" class="mod-btn">🔍 Quét mới</button>
            <button id="btn-filter" class="mod-btn">🎯 Lọc tiếp</button>
            <button id="btn-reset-scan" class="mod-btn">🔄</button>
          </div>
          <div id="mod-scan-status" class="mod-status">Mẹo: Nhập số tiền hiện tại -> Quét -> Kiếm thêm tiền -> Nhập số mới -> Lọc tiếp (còn &lt; 10 địa chỉ rồi sửa).</div>
        </div>

        <div class="mod-sec">
          <div class="mod-title">💎 Sửa Giá Trị</div>
          <input id="mod-set-val" class="mod-input" type="number" value="999999" placeholder="Số tiền muốn đặt..." />
          <button id="btn-apply" class="mod-btn primary" style="width:100%;">✨ ĐẶT GIÁ TRỊ NÀY</button>
          <label class="mod-check">
            <input id="chk-freeze" type="checkbox" />
            <span>❄️ Đóng băng giá trị (Không bị trừ tiền)</span>
          </label>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    // Chặn sự kiện bàn phím/chuột trong Mod Menu lọt xuống Unity
    ["keydown", "keyup", "keypress", "mousedown", "pointerdown", "touchstart"].forEach((evt) => {
      root.addEventListener(evt, (e) => e.stopPropagation());
    });

    const toggleBtn = document.getElementById("mod-toggle");
    const panel = document.getElementById("mod-panel");
    toggleBtn.addEventListener("click", () => panel.classList.toggle("open"));

    // Speed buttons
    document.querySelectorAll("#speed-btns .mod-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        speedMultiplier = Number(btn.dataset.spd);
        document.querySelectorAll("#speed-btns .mod-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      });
    });

    // Mute button
    let audioMuted = false;
    const muteAudioBtn = document.getElementById("btn-mute-audio");
    muteAudioBtn.addEventListener("click", async () => {
      audioMuted = !audioMuted;
      for (const ctx of capturedAudioContexts) {
        try {
          if (audioMuted) await ctx.suspend();
          else await ctx.resume();
        } catch (e) {}
      }
      muteAudioBtn.textContent = audioMuted
        ? "🔇 Âm thanh: Đã Tắt (Bấm để Bật)"
        : "🔊 Âm thanh: Đang Bật (Bấm để Tắt)";
    });

    const scanInput = document.getElementById("mod-scan-val");
    const statusEl = document.getElementById("mod-scan-status");
    const setInput = document.getElementById("mod-set-val");
    const chkFreeze = document.getElementById("chk-freeze");

    document.getElementById("btn-scan").addEventListener("click", () => {
      const res = scanNew(scanInput.value);
      statusEl.textContent = res.ok
        ? `🔍 Đã quét xong: tìm thấy ${res.count.toLocaleString()} địa chỉ.`
        : `⚠️ ${res.msg}`;
    });

    document.getElementById("btn-filter").addEventListener("click", () => {
      const res = filterNext(scanInput.value);
      statusEl.textContent = res.ok
        ? `🎯 Đã lọc xong: còn ${res.count.toLocaleString()} địa chỉ.`
        : `⚠️ ${res.msg}`;
    });

    document.getElementById("btn-reset-scan").addEventListener("click", () => {
      foundAddresses = [];
      chkFreeze.checked = false;
      if (freezeTimer) { clearInterval(freezeTimer); freezeTimer = null; }
      statusEl.textContent = "🔄 Đã xóa kết quả quét cũ.";
    });

    document.getElementById("btn-apply").addEventListener("click", () => {
      if (foundAddresses.length === 0) {
        statusEl.textContent = "⚠️ Hãy Quét & Lọc ra địa chỉ trước khi sửa!";
        return;
      }
      if (foundAddresses.length > 200) {
        statusEl.textContent = `⚠️ Còn quá nhiều (${foundAddresses.length} địa chỉ). Hãy kiếm/tiêu tiền rồi bấm "Lọc tiếp" cho an toàn!`;
        return;
      }
      const n = writeAddresses(setInput.value);
      statusEl.textContent = `✅ Đã sửa ${n} địa chỉ thành ${Number(setInput.value).toLocaleString()}!`;
    });

    chkFreeze.addEventListener("change", () => {
      if (freezeTimer) { clearInterval(freezeTimer); freezeTimer = null; }
      if (chkFreeze.checked) {
        if (foundAddresses.length === 0 || foundAddresses.length > 200) {
          chkFreeze.checked = false;
          statusEl.textContent = "⚠️ Cần lọc còn dưới 200 địa chỉ mới bật Đóng băng được.";
          return;
        }
        freezeTimer = setInterval(() => writeAddresses(setInput.value), 250);
        statusEl.textContent = "❄️ Đang đóng băng giá trị!";
      } else {
        statusEl.textContent = "Đã tắt đóng băng.";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountUI);
  } else {
    mountUI();
  }
})();
