/* MQTT 5.10.1 / protocol v2. All state remains in the two browsers. */
(function () {
  'use strict';
  const BROKERS = ['wss://broker-cn.emqx.io:8084/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
  const uid = () => crypto.randomUUID();
  const hash = value => {
    const text = JSON.stringify(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16);
  };
  window.createGameRoom = function (options) {
    let client, host, room, node, name, peer = null, session = '', peerName = '';
    let id = uid(), generation = 0, candidate = null, joined = false, disposed = true, terminal = false;
    let tx = 0, rx = 0, txHash = '0', rxHash = '0', lastSeen = 0, lastAck = 0;
    let paused = false, deadline = 0;
    let incoming = false, queue = [], accepted = new Map(), sentHashes = new Map([[0, '0']]);
    let panel, status, retryButton, invite, interval, waitingSince = 0;
    const byId = id => document.getElementById(id);
    const controls = document.createElement('div');
    controls.style.cssText = 'margin:12px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;';
    const label = document.createElement('label');
    label.textContent = '联机节点：';
    const picker = document.createElement('select');
    picker.setAttribute('aria-label', '联机节点');
    ['节点 1', '节点 2'].forEach((text, i) => { const o = new Option(text, String(i)); picker.add(o); });
    label.append(picker);
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = '复制邀请链接'; copy.disabled = true;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(invite); copy.textContent = '邀请链接已复制'; }
      catch (_) { prompt('复制邀请链接（包含节点和房间号）', invite); }
    };
    controls.append(label, copy);
    byId('connectionPanel').append(controls);
    const params = new URLSearchParams(location.hash.slice(1));
    if (/^[01]$/.test(params.get('node') || '')) picker.value = params.get('node');
    if (/^\d{8}$/.test(params.get('room') || '')) byId('roomInput').value = params.get('room');

    function sendWire(data, to = peer) {
      if (!client || !client.connected || disposed) return;
      client.publish(options.prefix + room, JSON.stringify({ v: 2, from: id, to: to || null, session, ...data }), { qos: 1 });
    }
    function overlay(text, fatal = false) {
      if (!panel) {
        panel = document.createElement('div');
        panel.setAttribute('role', 'alert');
        panel.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(15,12,24,.9);color:white;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font:16px/1.7 system-ui;';
        const box = document.createElement('div');
        status = document.createElement('p');
        retryButton = document.createElement('button');
        retryButton.type = 'button'; retryButton.textContent = '立即重连';
        retryButton.style.cssText = 'padding:12px 18px;margin:8px;cursor:pointer;';
        retryButton.onclick = () => {
          if (disposed) { location.reload(); return; }
          terminal = false;
          if (joined) { deadline = Date.now() + 45000; client.reconnect(); }
          else start({host, room, name});
        };
        const leave = document.createElement('button');
        leave.type = 'button'; leave.textContent = '退出并返回房间面板';
        leave.style.cssText = retryButton.style.cssText;
        leave.onclick = () => { stop(true); options.onExit('已退出，请重新创建或加入房间。'); };
        box.append(status, retryButton, leave); panel.append(box); document.body.append(panel);
      }
      status.textContent = text;
      retryButton.hidden = fatal;
    }
    function hideOverlay() { if (panel) panel.remove(); panel = null; }
    function fatal(text, retry = false) { terminal = true; paused = true; overlay(text, !retry); }
    function pause(text) {
      if (!joined || disposed) return;
      if (!paused) deadline = Date.now() + 45000;
      paused = true;
      overlay(text + ' 对局已暂停，正在重连。');
    }
    function checkpoint() {
      return { tx, rx, txHash, rxHash, round: options.round(), state: hash(options.snapshot()) };
    }
    function reconciled(c) {
      const local = checkpoint();
      return c && c.tx === local.rx && c.rx === local.tx && c.txHash === local.rxHash && c.rxHash === local.txHash && c.round === local.round && c.state === local.state && !queue.length;
    }
    function beginRecovery() {
      pause('正在核对双方操作记录和对局状态。');
      sendWire({ kind: 'sync', checkpoint: checkpoint() });
    }
    function receiveOperation(m) {
      if (!Number.isSafeInteger(m.seq) || m.seq < 1 || typeof m.op !== 'string' || m.op.length > 80 || !m.body || typeof m.body !== 'object' || Array.isArray(m.body)) return;
      if (m.seq <= rx) {
        const old = accepted.get(m.seq);
        if (old && old.op === m.op) sendWire({ kind: 'ack', seq: m.seq, op: m.op, digest: old.digest });
        return;
      }
      if (m.seq !== rx + 1) return; // Stop-and-wait retransmission fills any gap.
      if (!Number.isSafeInteger(m.round) || m.round < 1) return;
      if (m.round > options.round()) return; // Peer may finish its previous round first.
      const verdict = m.round === options.round() ? options.validate(m.body) : false;
      if (verdict === 'wait') return;
      if (!verdict) { sendWire({ kind: 'invalid', op: m.op }); fatal('收到不符合当前规则的操作，对局已停止，避免双方状态继续分歧。'); return; }
      try {
        incoming = true;
        options.receive(m.body);
        rxHash = hash([rxHash, m.seq, m.op, m.round, m.body]);
        rx = m.seq;
        accepted.set(rx, { op: m.op, digest: rxHash });
        sendWire({ kind: 'ack', seq: rx, op: m.op, digest: rxHash });
      } catch (error) {
        console.error(error);
        fatal('处理对方操作失败，对局已暂停。请退出并重新开局。');
      } finally { incoming = false; }
    }
    function receive(m) {
      if (disposed || terminal || !m || m.v !== 2 || typeof m.from !== 'string' || m.from === id || (m.to && m.to !== id)) return;
      if (m.kind === 'hello') {
        if (!host) return;
        if (!/^[\s\S]{1,24}$/.test(m.name || '')) return;
        if ((peer && peer !== m.from) || (candidate && candidate.id !== m.from && Date.now() - candidate.at < 15000)) {
          sendWire({ kind: 'full' }, m.from); return;
        }
        if (peer === m.from) { sendWire({ kind: 'welcome', name, session }, m.from); return; }
        candidate = { id: m.from, name: m.name, at: Date.now() };
        sendWire({ kind: 'welcome', name, session }, m.from); return;
      }
      if (!host && !peer && m.kind === 'full' && m.to === id) { fatal('房间已满，已有两位玩家或正在建立连接。'); return; }
      if (!host && !joined && m.kind === 'welcome' && typeof m.session === 'string' && m.session.length <= 80 && typeof m.name === 'string') {
        if (peer && peer !== m.from) return;
        peer = m.from; session = m.session; peerName = m.name.slice(0, 24);
        sendWire({ kind: 'accept' }); return;
      }
      if (host && m.kind === 'accept' && candidate && candidate.id === m.from && m.session === session) {
        peer = candidate.id; peerName = candidate.name;
        sendWire({ kind: 'joined', name }); return;
      }
      if (!peer || m.from !== peer || m.session !== session) return;
      lastSeen = Date.now();
      if (m.kind === 'joined' && !host) {
        sendWire({ kind: 'joined_ack' });
        if (!joined) establish();
        return;
      }
      if (m.kind === 'joined_ack' && host) { if (!joined) establish(); return; }
      if (!joined) return;
      if (m.kind === 'op') { receiveOperation(m); return; }
      if (m.kind === 'ack') {
        const item = queue[0];
        if (!item || item.seq !== m.seq || item.op !== m.op) return;
        // Compare the digest against our local operation history, never a peer supplied value.
        if (m.digest !== sentHashes.get(m.seq)) { fatal('操作记录校验失败，请退出并重新开局。'); return; }
        queue.shift(); lastAck = m.seq; pump(); return;
      }
      if (m.kind === 'invalid') { fatal('双方操作规则或游戏版本不一致，请退出后刷新页面。'); return; }
      if (m.kind === 'leave') { fatal('对方已主动退出，本局无法继续。'); return; }
      if (m.kind === 'heartbeat') {
        if (paused || m.paused) {
          if (!paused) beginRecovery();
          sendWire({ kind: 'sync', checkpoint: checkpoint() });
        }
        return;
      }
      if (m.kind === 'sync') {
        if (!paused) pause('对方正在恢复连接。');
        if (reconciled(m.checkpoint)) {
          sendWire({ kind: 'sync_ok', checkpoint: checkpoint() });
        } else {
          pump();
        }
        return;
      }
      if (m.kind === 'sync_ok' && paused && reconciled(m.checkpoint)) {
        sendWire({ kind: 'resume', checkpoint: checkpoint() });
        return;
      }
      if (m.kind === 'resume' && paused && reconciled(m.checkpoint)) {
        sendWire({ kind: 'resume_ack', checkpoint: checkpoint() });
        paused = false; hideOverlay(); return;
      }
      if (m.kind === 'resume_ack' && paused && reconciled(m.checkpoint)) {
        paused = false; hideOverlay();
      }
    }
    function establish() {
      joined = true; candidate = null; lastSeen = Date.now();
      options.onPeer(peerName);
      byId('connStatus').textContent = '已连接，操作自动确认';
    }
    function pump() {
      if (!joined || !queue.length || !client || !client.connected) return;
      const item = queue[0];
      if (!item.at || Date.now() - item.at > 900) {
        item.at = Date.now(); sendWire(item.frame);
      }
    }
    function send(body) {
      if (!joined || disposed || terminal || (paused && !incoming)) return false;
      if (body.type === 'nickname') return true;
      const payload = JSON.parse(JSON.stringify(body));
      delete payload._from; delete payload._mid;
      const round = options.round(), op = uid(), seq = ++tx;
      txHash = hash([txHash, seq, op, round, payload]);
      sentHashes.set(seq, txHash);
      queue.push({ seq, op, digestExpected: txHash, frame: { kind: 'op', seq, op, round, body: payload }, at: 0 });
      pump(); return true;
    }
    function stop(notify = false) {
      if (notify && joined) sendWire({ kind: 'leave' });
      disposed = true; generation++; clearInterval(interval);
      if (client) { const old = client; client = null; old.end(true); }
      hideOverlay(); picker.disabled = false; copy.disabled = true;
      joined = paused = false;
    }
    function start(config) {
      stop(); disposed = false; terminal = false; generation++;
      host = config.host; room = config.room; name = config.name.slice(0, 24); node = Number(picker.value);
      id = uid(); peer = null; session = host ? uid() : ''; candidate = null;
      tx = rx = lastAck = 0; txHash = rxHash = '0'; queue = []; accepted = new Map(); sentHashes = new Map([[0, '0']]);
      waitingSince = Date.now(); lastSeen = 0; picker.disabled = true;
      const url = new URL(location.href); url.hash = new URLSearchParams({ room, node: String(node) }).toString();
      invite = url.href; copy.disabled = false; copy.textContent = '复制邀请链接';
      if (typeof mqtt === 'undefined') { fatal('联机组件加载失败，请刷新页面重试。'); return; }
      const token = generation;
      client = mqtt.connect(BROKERS[node], { clientId: 'game_v2_' + id, clean: true, keepalive: 15, connectTimeout: 8000, reconnectPeriod: 1500 });
      const current = client;
      current.on('connect', () => {
        if (disposed || token !== generation) return;
        current.subscribe(options.prefix + room, { qos: 1 }, (error, grants) => {
          if (disposed || token !== generation) return;
          if (error || (grants && grants.some(g => g.qos !== 1))) { fatal('服务连接失败：房间未获得可靠消息订阅，请重试。', true); return; }
          if (joined) beginRecovery();
          else { waitingSince = Date.now(); byId('connStatus').textContent = host ? '等待对方加入，可复制邀请链接。' : '正在寻找房主…'; if (!host) sendWire({ kind: 'hello', name }, null); }
        });
      });
      current.on('message', (topic, bytes) => {
        if (disposed || token !== generation || topic !== options.prefix + room || bytes.length > 65536) return;
        try { receive(JSON.parse(bytes.toString())); } catch (e) { console.warn('忽略无效联机消息', e); }
      });
      current.on('close', () => { if (!disposed && token === generation && joined) pause('服务连接已中断。'); });
      current.on('error', () => { if (!disposed && token === generation && !joined) byId('connStatus').textContent = '服务连接失败，正在重试当前节点…'; });
      interval = setInterval(() => {
        if (disposed || terminal) return;
        const now = Date.now();
        if (!joined) {
          if (host && candidate && now - candidate.at > 15000) { candidate = null; peer = null; }
          if (host && peer) sendWire({ kind: 'joined', name });
          else if (!host) sendWire({ kind: 'hello', name }, null);
          if (now - waitingSince > 25000 && (!host || !current.connected)) fatal(current.connected ? '房间不存在或房主未响应，请核对邀请链接中的节点和房间号。' : '服务连接失败，请重试或退出后切换节点，并重新分享邀请链接。', true);
          return;
        }
        sendWire({ kind: 'heartbeat', paused });
        if (now - lastSeen > 10000 && !paused) pause('对方暂时离线或网络不稳定。');
        if (queue.length && now - (queue[0].firstAt || (queue[0].firstAt = now)) > 10000 && !paused) pause('关键操作尚未得到对方确认。');
        pump();
        if (paused) {
          if (now > deadline) { fatal('重连等待已超过 45 秒，对局状态已保留。可重试恢复当前局，或退出后重新开局。', true); return; }
          overlay('对局已暂停，等待重连（' + Math.max(0, Math.ceil((deadline - now) / 1000)) + ' 秒）。正在核对操作记录与状态。');
          sendWire({ kind: 'sync', checkpoint: checkpoint() });
        }
      }, 1000);
    }
    // Block pointer and keyboard actions during recovery; received operations may still settle.
    window.addEventListener('keydown', e => {
      if (paused && panel) {
        if (!panel.contains(e.target)) e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);
    window.addEventListener('pagehide', () => { if (joined) sendWire({ kind: 'heartbeat', paused: true }); });
    window.addEventListener('online', () => { if (joined && client && !client.connected) client.reconnect(); });
    return { start, stop, send, paused: () => paused, invite: () => invite };
  };
})();
