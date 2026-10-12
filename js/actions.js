"use strict";
/* ================= VIDA ================= */
const hasWarCaster = () => C.features.some(f => /war ?caster/i.test(f.name));
function applyDamage(n) {
  let dmg = n;
  const msgs = [];
  const t = Math.min(C.hp.temp, dmg);
  C.hp.temp -= t; dmg -= t;
  const af = activeForm();
  if (af && dmg > 0) {
    const d = Math.min(af.cur, dmg);
    af.cur -= d; dmg -= d;
    if (af.cur <= 0) {
      C.forms = C.forms.filter(f => f !== af);
      msgs.push(`<b>${esc(af.name)}</b> caiu a 0 PV: você volta à forma normal${dmg ? ` e sofre ${dmg} de dano excedente` : ""}.`);
    }
  }
  if (dmg > 0) C.hp.current = Math.max(0, C.hp.current - dmg);
  if (C.concentration) msgs.push(`Concentração em ${esc(C.concentration)}: salvaguarda de CON, CD <b>${Math.max(10, Math.floor(n / 2))}</b>${hasWarCaster() ? " com vantagem (War Caster)" : ""}.`);
  if (C.hp.current === 0 && !activeForm()) msgs.push("0 PV: role testes contra a morte.");
  commit();
  if (msgs.length) toast(msgs.join("<br>"), "long");
}
function applyHeal(n, toMain) {
  const af = !toMain && activeForm();
  if (af) af.cur = Math.min(af.max, af.cur + n);
  else {
    if (C.hp.current === 0) C.deathSaves = {s: 0, f: 0};
    C.hp.current = Math.min(C.hp.max, C.hp.current + n);
  }
  commit();
}
function setConc(name) {
  if (C.concentration && C.concentration !== name && !confirm(`Encerrar a concentração em ${C.concentration} para concentrar em ${name}?`)) return false;
  C.concentration = name;
  return true;
}

/* ================= CONJURAR ================= */
function castSpell(id, mode) {
  const s = C.spells.find(x => x.id === id);
  if (!s) return;
  const info = spellInfo(s);
  let how = "";
  if (mode === "0") how = "truque";
  else if (mode === "w") how = "à vontade";
  else if (mode === "r") how = "como ritual (+10 min)";
  else if (mode === "f") { if (s.free.used >= s.free.max) return toast("Uso grátis já gasto."); how = "uso grátis"; }
  else if (mode === "p") { if (C.pact.used >= C.pact.max) return toast("Sem espaços de pacto."); how = "espaço de pacto " + ORD(C.pact.level); }
  else if (mode[0] === "s") {
    const l = +mode.slice(1);
    if (C.slots[l - 1] - C.slotsUsed[l - 1] <= 0) return toast("Sem espaços de " + ORD(l) + " nível.");
    how = "espaço de " + ORD(l);
  }
  if (info.conc && !setConc(s.name)) return;
  if (mode === "f") s.free.used++;
  else if (mode === "p") C.pact.used++;
  else if (mode[0] === "s") C.slotsUsed[+mode.slice(1) - 1]++;
  commit();
  toast(`<b>${esc(s.name)}</b> conjurada — ${how}${info.conc ? " · concentração" : ""}`);
}

/* ================= FORMAS ================= */
function transform(via, name) {
  const m = findMonster(name);
  if (!m) return;
  const lbl = {ws: "Wild Shape", elemental: "Wild Shape elemental", shapechange: "Shapechange", polymorph: "Polymorph", manual: "forma"}[via];
  if (via === "ws" || via === "elemental") {
    const f = wsFeature(C), ws = wsInfo(C);
    const cost = via === "elemental" ? 2 : 1;
    if (!ws.unlimited && f && f.uses) {
      if (usesLeft(f.uses) < cost) return toast("Sem usos de Wild Shape suficientes.");
      f.uses.used += cost;
    }
    C.forms = C.forms.filter(x => x.via !== "ws" && x.via !== "elemental");
  } else if (via === "shapechange") {
    if (!/shapechange/i.test(C.concentration)) {
      if (C.slots[8] - C.slotsUsed[8] <= 0) return toast("Sem espaço de 9º nível.");
      if (!setConc("Shapechange")) return;
      C.slotsUsed[8]++;
    }
    C.forms = C.forms.filter(x => x.via !== "shapechange");
  } else if (via === "polymorph") {
    const sl = [4, 5, 6, 7, 8, 9].find(l => C.slots[l - 1] - C.slotsUsed[l - 1] > 0);
    if (!sl) return toast("Sem espaço de 4º nível ou maior.");
    if (!setConc("Polymorph")) return;
    C.slotsUsed[sl - 1]++;
    C.forms = C.forms.filter(x => x.via !== "polymorph");
  }
  C.forms.unshift({id: I.uid(), name: m.n, mon: m.n, cur: m.hp, max: m.hp, via});
  closeSheet();
  UI.tab = "combat";
  commit();
  window.scrollTo(0, 0);
  toast(`${lbl}: você virou <b>${esc(m.n)}</b> (${m.hp} PV, CA ${parseInt(m.ac, 10)}).`);
}

/* ================= DESCANSOS ================= */
function regainCharges(it) {
  const c = it.charges;
  if (!c || !c.used) return "";
  if (!c.regain) return "";
  const before = c.used;
  if (/^all$/i.test(c.regain)) c.used = 0;
  else { const r = rollDice(c.regain); c.used = Math.max(0, c.used - r.total); }
  return `${esc(it.name)}: +${before - c.used} cargas`;
}
function longRest() {
  const msgs = [];
  C.hp.current = C.hp.max; C.hp.temp = 0;
  C.slotsUsed = C.slotsUsed.map(() => 0);
  if (C.pact) C.pact.used = 0;
  C.features.forEach(f => { if (f.uses) f.uses.used = 0; });
  C.spells.forEach(s => { if (s.free) s.free.used = 0; });
  let regain = Math.max(1, Math.floor(C.hitDice.reduce((a, h) => a + h.total, 0) / 2));
  C.hitDice.slice().sort((a, b) => b.die - a.die).forEach(h => { const r = Math.min(h.used, regain); h.used -= r; regain -= r; });
  C.deathSaves = {s: 0, f: 0};
  C.items.forEach(i => { const m = regainCharges(i); if (m) msgs.push(m); });
  commit();
  toast("Descanso longo: PV, espaços, características e dados de vida recuperados." + (msgs.length ? "<br>" + msgs.join("<br>") : ""), "long");
}
function shortRest() {
  C.features.forEach(f => { if (f.uses && f.uses.per === "short") f.uses.used = 0; });
  if (C.pact) C.pact.used = 0;
  commit();
  toast("Descanso curto: recursos de descanso curto recuperados. Gaste dados de vida em Recursos.", "long");
}

/* ================= IMPORTAÇÃO ================= */
async function handleFile(kind, file) {
  if (!file) return;
  openSheet("busy", "Lendo " + file.name + "…");
  try {
    await needItems().catch(() => {});
    let chars;
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      const lib = await needPdfjs();
      chars = [await I.importPdf(new Uint8Array(await file.arrayBuffer()), lib)];
    } else if (/\.(dnd5e|xml)$/i.test(file.name) || kind === "xml") {
      chars = [I.parseAuroraXml(await file.text())];
    } else chars = backupChars(await file.text());
    receive(chars);
  } catch (e) {
    console.error(e);
    openSheet("info", `<div class="h2">Não consegui importar</div><p>${esc(e.message || e)}</p>
      <p class="hint">Dica: o PDF do Aurora é o formato mais completo. Se for outra ficha, tente o PDF preenchível (com campos).</p>`);
  }
}
function backupChars(text) {
  return I.parseBackup(text).map(c => c.legacy ? migrateLegacy(c.legacy) : c);
}
function receive(chars) {
  if (!chars.length) throw new Error("Nenhuma ficha encontrada.");
  chars.forEach(normalize);
  if (!C) { addChars(chars); return; }
  UI.pending = {chars};
  openSheet("replace");
}
function addChars(chars) {
  chars.forEach(ch => { if (DB.chars[ch.id]) ch.id = I.uid(); DB.chars[ch.id] = ch; });
  setActive(chars[0].id);
  UI.tab = "combat";
  commit();
  openSheet("importDone", chars[0].id);
}
/* Substitui a ficha atual mantendo o "estado de sessão" (PV, gastos, formas). */
function replaceChar(nw) {
  const old = C;
  nw.id = old.id;
  nw.hp.current = Math.min(nw.hp.max, old.hp.current);
  nw.hp.temp = old.hp.temp;
  nw.deathSaves = old.deathSaves; nw.forms = old.forms; nw.concentration = old.concentration;
  nw.slotsUsed = nw.slots.map((m, i) => Math.min(m, old.slotsUsed[i] || 0));
  if (nw.pact && old.pact) nw.pact.used = Math.min(nw.pact.max, old.pact.used);
  const byName = (list, n) => list.find(x => I.norm(x.name) === I.norm(n));
  nw.features.forEach(f => { const o = byName(old.features, f.name); if (f.uses && o && o.uses) f.uses.used = Math.min(f.uses.max, o.uses.used); });
  nw.items.forEach(i => { const o = byName(old.items, i.name); if (i.charges && o && o.charges) i.charges.used = Math.min(i.charges.max, o.charges.used); });
  nw.spells.forEach(s => { const o = byName(old.spells, s.name); if (o && o.customDesc) s.customDesc = o.customDesc; if (s.free && o && o.free) s.free.used = o.free.used; });
  if (!nw.notes) nw.notes = old.notes;
  DB.chars[nw.id] = nw;
  setActive(nw.id);
  openSheet("importDone", nw.id);
}
function exportBackup() {
  const json = JSON.stringify(DB);
  const name = "fichas-dnd-" + new Date().toISOString().slice(0, 10) + ".json";
  const blob = new Blob([json], {type: "application/json"});
  try {
    const file = new File([blob], name, {type: "application/json"});
    if (navigator.canShare && navigator.canShare({files: [file]})) { navigator.share({files: [file], title: name}).catch(() => {}); return; }
  } catch (e) { /* segue para o download */ }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function copyBackup() {
  const json = JSON.stringify(DB);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(() => toast("Backup copiado."), () => fallbackCopy(json));
  else fallbackCopy(json);
}
function fallbackCopy(txt) {
  const t = document.createElement("textarea");
  t.value = txt; document.body.appendChild(t); t.select(); t.setSelectionRange(0, txt.length);
  try { document.execCommand("copy"); toast("Backup copiado."); } catch (e) { toast("Não consegui copiar."); }
  t.remove();
}

/* ================= STAT BLOCK COLADO ================= */
function parseStatBlockText(txt) {
  const lines = String(txt || "").replace(/\r/g, "").replace(/[−–]/g, "-").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) throw new Error("Cole o stat block inteiro (nome, CA, PV, atributos, ações).");
  const m = {n: lines[0], s: "Medium", t: "beast", al: "", ac: "10", hp: 1, hd: "", sp: "30 ft.", v: [30, 0, 0, 0, 0],
    ab: [10, 10, 10, 10, 10, 10], cr: 0, xp: 0, tr: [], a: [], b: [], r: [], l: []};
  const meta = lines[1].match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+([^,]+?)(?:,\s*(.*))?$/i);
  if (meta) { m.s = meta[1][0].toUpperCase() + meta[1].slice(1).toLowerCase(); m.t = meta[2].trim().toLowerCase(); m.al = (meta[3] || "").trim(); }
  const all = lines.join("\n");
  const grab = rx => { const x = all.match(rx); return x ? x[1].trim() : ""; };
  m.ac = grab(/^(?:Armor Class|AC)\s+(.+)$/im) || "10";
  const hp = all.match(/^(?:Hit Points|HP)\s+(\d+)\s*(?:\(([^)]+)\))?/im);
  if (hp) { m.hp = +hp[1]; m.hd = (hp[2] || "").replace(/\s+/g, " "); }
  m.sp = grab(/^Speed\s+(.+)$/im) || "30 ft.";
  const spd = k => { const x = m.sp.match(k === "walk" ? /^(\d+)\s*ft/i : new RegExp(k + "\\s+(\\d+)\\s*ft", "i")); return x ? +x[1] : 0; };
  m.v = [spd("walk"), spd("fly"), spd("swim"), spd("climb"), spd("burrow")];
  const abs = Array.from(all.matchAll(/\b(\d{1,2})\s*\(\s*[+-]?\s*\d+\s*\)/g)).map(x => +x[1]);
  if (abs.length >= 6) m.ab = abs.slice(0, 6);
  m.sv = grab(/^Saving Throws\s+(.+)$/im); m.sk = grab(/^Skills\s+(.+)$/im);
  m.dv = grab(/^Damage Vulnerabilities\s+(.+)$/im); m.dr = grab(/^Damage Resistances\s+(.+)$/im);
  m.di = grab(/^Damage Immunities\s+(.+)$/im); m.ci = grab(/^Condition Immunities\s+(.+)$/im);
  m.se = grab(/^Senses\s+(.+)$/im); m.la = grab(/^Languages\s+(.+)$/im);
  const cr = all.match(/^(?:Challenge|CR)\s+(\d+(?:\/\d+)?)\s*(?:\(([\d,.]+)\s*XP)?/im);
  if (cr) { const [a, b] = cr[1].split("/"); m.cr = b ? +a / +b : +a; m.xp = cr[2] ? +cr[2].replace(/[,.]/g, "") : 0; }
  const statRx = /^((Armor Class|AC|Hit Points|HP|Speed|Saving Throws|Skills|Damage \w+|Condition Immunities|Senses|Languages|Challenge|CR|Proficiency Bonus|STR|DEX|CON|INT|WIS|CHA|MOD|SAVE)\b|\d+\s*\(|[+-]?\d+$)/i;
  let start = 2;
  lines.forEach((l, i) => { if (i > 1 && statRx.test(l)) start = i + 1; });
  let sec = "tr", cur = null;
  const SEC = {actions: "a", "bonus actions": "b", reactions: "r", "legendary actions": "l"};
  lines.slice(start).forEach(l => {
    const s = SEC[l.toLowerCase().replace(/:$/, "")];
    if (s) { sec = s; cur = null; return; }
    const e = l.match(/^([A-Z][^.]{1,70}?(?:\([^)]*\))?)\.\s+(.*)$/);
    if (e && !/^(Melee|Ranged|Hit)\b/.test(e[1]) && e[1].split(" ").length <= 8) { cur = [e[1], e[2]]; m[sec].push(cur); }
    else if (cur) cur[1] += "\n" + l;
    else if (sec !== "l") { cur = ["Nota", l]; m[sec].push(cur); }
  });
  ["tr", "a", "b", "r", "l"].forEach(k => { if (!m[k].length) delete m[k]; });
  return m;
}

/* ================= EVENTOS ================= */
const scrollMemo = {};
function goTab(t) {
  scrollMemo[UI.tab] = window.scrollY;
  UI.tab = t;
  render();
  window.scrollTo(0, scrollMemo[t] || 0);
}
document.querySelectorAll("nav button").forEach(b => b.addEventListener("click", () => goTab(b.dataset.tab)));

function pipToggle(u, i) { const avail = u.max - u.used; u.used = Math.max(0, Math.min(u.max, i < avail ? u.used + 1 : u.used - 1)); }

const ACTS = {
  noop() {},
  tab: t => goTab(t),
  closesheet: () => closeSheet(),
  import: () => openSheet("import"),
  pick: kind => { const el = document.getElementById("file-" + kind); el.value = ""; el.click(); },
  paste: () => openSheet("paste"),
  dopaste() {
    try { receive(backupChars(document.getElementById("pastebox").value)); }
    catch (e) { toast("O texto não é um backup válido."); }
  },
  blank() {
    const ch = normalize(I.blankCharacter());
    DB.chars[ch.id] = ch;
    setActive(ch.id);
    closeSheet();
    goTab("sheet");
    toast("Ficha em branco criada. Preencha os dados abaixo.");
  },
  pend(how) {
    const p = UI.pending; UI.pending = null; UI.sheet = null;
    if (!p) return closeSheet();
    if (how === "replace" && p.chars.length === 1) replaceChar(p.chars[0]);
    else addChars(p.chars);
  },
  amt: n => { UI.amt = +n; render(); },
  dmg: () => applyDamage(UI.amt),
  heal: () => applyHeal(UI.amt),
  addform() {
    const nm = prompt("Nome da forma (ex.: Fire Elemental)"); if (!nm) return;
    const mx = parseInt(prompt("Vida máxima da forma"), 10); if (!mx || mx <= 0) return;
    const m = findMonster(nm);
    C.forms.unshift({id: I.uid(), name: m ? m.n : nm, mon: m ? m.n : "", cur: mx, max: mx, via: "manual"});
    commit();
  },
  delform: id => { C.forms = C.forms.filter(f => f.id !== id); commit(); },
  "form-": id => { const f = C.forms.find(x => x.id === id); if (f) { f.cur = Math.max(0, f.cur - UI.amt); if (!f.cur) { C.forms = C.forms.filter(x => x !== f); toast(`${esc(f.name)} caiu a 0 PV: forma normal.`); } commit(); } },
  "form+": id => { const f = C.forms.find(x => x.id === id); if (f) { f.cur = Math.min(f.max, f.cur + UI.amt); commit(); } },
  wsheal(l) {
    l = +l;
    if (C.slots[l - 1] - C.slotsUsed[l - 1] <= 0) return;
    C.slotsUsed[l - 1]++;
    const r = rollDice(l + "d8");
    applyHeal(r.total);
    toast(`Combat Wild Shape: slot ${ORD(l)} → <b>+${r.total} PV</b> ${r.detail}`);
  },
  slot: (idx, i) => { const u = {max: C.slots[idx], used: C.slotsUsed[idx]}; pipToggle(u, +i); C.slotsUsed[idx] = u.used; commit(); },
  pact: i => { pipToggle(C.pact, +i); commit(); },
  feat: (id, i) => { const f = C.features.find(x => x.id === id); if (f && f.uses) { pipToggle(f.uses, +i); commit(); } },
  "feat-": id => { const f = C.features.find(x => x.id === id); f.uses.used = Math.min(f.uses.max, f.uses.used + 1); commit(); },
  "feat+": id => { const f = C.features.find(x => x.id === id); f.uses.used = Math.max(0, f.uses.used - 1); commit(); },
  free: (id, i) => { const s = C.spells.find(x => x.id === id); if (s && s.free) { pipToggle(s.free, +i); commit(); } },
  "chg-": id => { const it = C.items.find(x => x.id === id); it.charges.used = Math.min(it.charges.max, it.charges.used + 1); commit(); },
  "chg+": id => { const it = C.items.find(x => x.id === id); it.charges.used = Math.max(0, it.charges.used - 1); commit(); },
  hd(i) {
    const h = C.hitDice[+i];
    if (!h || h.used >= h.total) return;
    h.used++;
    const r = rollDice("1d" + h.die), gain = Math.max(0, r.total + abilMod(C, "con"));
    applyHeal(gain, true);
    toast(`Dado de vida: d${h.die} (${r.total}) ${fm(abilMod(C, "con"))} = <b>+${gain} PV</b>`);
  },
  short: () => shortRest(),
  long: () => { if (confirm("Fazer descanso longo? Recupera PV, espaços de magia e características.")) longRest(); },
  acttab: k => { UI.actTab = k; render(); },
  open: key => { key = decodeURIComponent(key); UI.open[key] = !UI.open[key]; if (key.startsWith("b:")) Object.keys(UI.open).forEach(k => { if (k !== key && k.startsWith("b:")) UI.open[k] = false; }); render(); },
  rollatk(id) {
    const a = C.attacks.find(x => x.id === id);
    const bonus = parseInt((a.attack || "").replace(/[^\d+-]/g, ""), 10) || 0;
    const d20 = rollDice("1d20").total;
    const dm = (a.damage || "").match(/\d+d\d+(?:\s*[+-]\s*\d+)?/);
    const dmg = dm ? rollDice(dm[0]) : null;
    const crit = d20 === 20 ? " · <b>CRÍTICO</b> (dobre os dados)" : d20 === 1 ? " · falha crítica" : "";
    toast(`${esc(a.name)}: ataque <b>${d20 + bonus}</b> (${d20}${fm(bonus)})${dmg ? ` · dano <b>${dmg.total}</b> ${esc((a.damage || "").replace(dm[0], "").trim())}` : ""}${crit}`, "long");
  },
  editatk: id => openSheet("attack", id),
  saveatk(id) {
    const v = k => document.getElementById(k).value.trim();
    const data = {name: v("na-name") || "Ataque", attack: v("na-atk"), damage: v("na-dmg"), range: v("na-rng"), notes: v("na-notes")};
    if (id === "new") C.attacks.push(Object.assign({id: I.uid()}, data));
    else Object.assign(C.attacks.find(x => x.id === id), data, {auto: false});
    closeSheet(); commit();
  },
  delatk: id => { C.attacks = C.attacks.filter(a => a.id !== id); closeSheet(); commit(); },
  cast: (id, mode) => castSpell(id, mode),
  spelltext: id => { needSpells().catch(() => {}).then(() => openSheet("spelltext", id)); },
  savespelltext(id) { const s = C.spells.find(x => x.id === id); s.customDesc = document.getElementById("st-text").value.trim(); closeSheet(); commit(); },
  clearspelltext(id) { const s = C.spells.find(x => x.id === id); delete s.customDesc; closeSheet(); commit(); },
  useitem(id) {
    const it = C.items.find(x => x.id === id);
    if (it.charges) { if (it.charges.used >= it.charges.max) return toast("Sem cargas."); it.charges.used++; commit(); return toast(`${esc(it.name)}: ${it.charges.max - it.charges.used} cargas restantes.`); }
    if (it.qty <= 0) return;
    it.qty--;
    const h = (it.desc || "").match(/regains? (\d+d\d+(?:\s*\+\s*\d+)?) hit points/i);
    if (h) { const r = rollDice(h[1]); applyHeal(r.total); toast(`${esc(it.name)}: <b>+${r.total} PV</b> ${r.detail}`); }
    else { commit(); toast(`${esc(it.name)} usado (${it.qty} restante${it.qty === 1 ? "" : "s"}).`); }
  },
  item: id => openSheet("item", id),
  ieq: id => { const i = C.items.find(x => x.id === id); i.equipped = !i.equipped; commit(); },
  iatt(id) {
    const i = C.items.find(x => x.id === id);
    if (!i.attuned && C.items.filter(x => x.attuned).length >= C.attuneMax && !confirm(`Você já tem ${C.attuneMax} itens sintonizados. Sintonizar mesmo assim?`)) return;
    i.attuned = !i.attuned; commit();
  },
  imag: id => { const i = C.items.find(x => x.id === id); i.magic = !i.magic; commit(); },
  iqty: (id, d) => { const i = C.items.find(x => x.id === id); i.qty = Math.max(0, i.qty + +d); commit(); },
  idel(id) { const i = C.items.find(x => x.id === id); if (!confirm(`Remover ${i.name}?`)) return; C.items = C.items.filter(x => x.id !== id); closeSheet(); commit(); },
  iwatk(id) {
    const i = C.items.find(x => x.id === id);
    const a = I.weaponAttack(C, i) || {id: I.uid(), name: i.name, attack: "", damage: "", range: "", notes: ""};
    C.attacks.push(a); commit(); openSheet("attack", a.id);
  },
  additem: () => openSheet("additem"),
  saveitem() {
    const v = k => document.getElementById(k);
    const name = v("ni-name").value.trim(); if (!name) return;
    const chg = parseInt(v("ni-chg").value, 10);
    const desc = v("ni-desc").value.trim();
    C.items.push({id: I.uid(), name, qty: parseInt(v("ni-qty").value, 10) || 1, weight: "", magic: v("ni-mag").checked,
      equipped: v("ni-eq").checked, attuned: v("ni-att").checked, type: "", desc,
      charges: chg > 0 ? {max: chg, used: 0, regain: ""} : I.chargesFrom(desc)});
    closeSheet(); commit();
  },
  ds: (k, i) => { const cur = C.deathSaves[k], v = +i; C.deathSaves[k] = cur === v + 1 ? v : v + 1; commit(); },
  endconc: () => { C.concentration = ""; commit(); },
  sfilter: f => { UI.spellFilter = f; render(); },
  prep(id) {
    const s = C.spells.find(x => x.id === id);
    if (!s || s.level === 0 || s.always) return;
    s.prepared = !s.prepared;
    const c = castingFor(C, s);
    if (s.prepared && c && c.prepares && c.prepMax) {
      const n = C.spells.filter(x => x.cls === s.cls && x.prepared && x.level > 0 && !x.always).length;
      if (n > c.prepMax) toast(`Atenção: ${n} preparadas, o limite é ${c.prepMax}.`);
    }
    commit();
  },
  addspell: () => openSheet("addspell"),
  saveaddspell() {
    const name = document.getElementById("ns-name").value.trim(); if (!name) return;
    const level = Math.max(0, Math.min(9, parseInt(document.getElementById("ns-lvl").value, 10) || 0));
    const cls = document.getElementById("ns-cls").value;
    C.spells.push({id: I.uid(), name, level, cls, prepared: true, always: cls === "Other", source: ""});
    C.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    closeSheet(); commit();
  },
  fmode: id => { UI.formMode = id; render(); },
  fmove: k => { UI.formMove = UI.formMove === k ? "" : k; render(); },
  mon(name) {
    name = decodeURIComponent(name);
    if (!window.SRD_MONSTERS) { needMonsters().then(() => openSheet("monster", name)); return; }
    openSheet("monster", name);
  },
  tf: (via, name) => transform(via, decodeURIComponent(name)),
  addmon: () => openSheet("addmon"),
  parsemon() {
    const box = document.getElementById("am-preview");
    try {
      UI.parsedMon = parseStatBlockText(document.getElementById("am-text").value);
      box.innerHTML = statBlock(Object.assign({src: "custom"}, UI.parsedMon)) +
        `<button class="big primary wide mt8" data-act="savemon">Salvar criatura</button>`;
    } catch (e) { box.innerHTML = `<p class="hint warn">${esc(e.message)}</p>`; }
  },
  savemon() {
    const m = UI.parsedMon; if (!m) return;
    DB.custom = (DB.custom || []).filter(x => I.norm(x.n) !== I.norm(m.n)).concat(m);
    UI.parsedMon = null;
    save();
    openSheet("monster", m.n);
    render();
    toast(`${esc(m.n)} adicionada ao bestiário.`);
  },
  delmon(name) {
    name = decodeURIComponent(name);
    if (!confirm(`Excluir ${name} do bestiário?`)) return;
    DB.custom = (DB.custom || []).filter(x => x.n !== name);
    closeSheet(); commit();
  },
  switch: id => { setActive(id); goTab("combat"); },
  clearwarn: () => { C.meta.warnings = []; commit(); },
  addclass: () => { C.classes.push({name: "", subclass: "", level: 1}); commit(); },
  clvl(i, d) {
    const c = C.classes[+i];
    c.level = Math.max(1, Math.min(20, c.level + +d));
    C.slots = I.slotsForClasses(C.classes);
    const p = I.pactFor(C.classes);
    C.pact = p ? Object.assign(p, {used: C.pact ? Math.min(p.max, C.pact.used) : 0}) : null;
    commit();
  },
  delclass: i => { if (confirm("Remover esta classe?")) { C.classes.splice(+i, 1); commit(); } },
  save: k => { C.saves[k].prof = !C.saves[k].prof; commit(); },
  skill(n) {
    const s = C.skills[decodeURIComponent(n)];
    if (s.exp) { s.exp = false; s.prof = false; } else if (s.prof) s.exp = true; else s.prof = true;
    commit();
  },
  addfeat: () => openSheet("feature", "new"),
  editfeat: id => openSheet("feature", id),
  savefeat(id) {
    const name = document.getElementById("nf-name").value.trim() || "Característica";
    const max = parseInt(document.getElementById("nf-max").value, 10);
    const per = document.getElementById("nf-per").value;
    const act = Array.from(document.querySelectorAll(".nf-act")).filter(x => x.checked).map(x => x.value);
    const text = document.getElementById("nf-text").value.trim();
    let f = C.features.find(x => x.id === id);
    if (!f) { f = {id: I.uid(), group: "feature"}; C.features.push(f); }
    const used = f.uses ? f.uses.used : 0;
    Object.assign(f, {name, text, act, uses: max > 0 ? {max, per, used: Math.min(max, used)} : null});
    closeSheet(); commit();
  },
  delfeat: id => { C.features = C.features.filter(f => f.id !== id); closeSheet(); commit(); },
  export: () => exportBackup(),
  copy: () => copyBackup(),
  delchar() {
    if (!confirm(`Apagar a ficha de ${C.name}? Isso não pode ser desfeito.`)) return;
    delete DB.chars[C.id];
    const next = Object.values(DB.chars)[0];
    C = next || null; DB.active = next ? next.id : null;
    UI.tab = "combat";
    commit();
  }
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el || el.disabled) return;
  const raw = el.dataset.act;
  const i = raw.indexOf(":");
  const act = i < 0 ? raw : raw.slice(0, i);
  const rest = i < 0 ? "" : raw.slice(i + 1);
  const fn = ACTS[act];
  if (!fn) return;
  e.preventDefault();
  if (act === "open" || act === "mon" || act === "tf" || act === "delmon") fn(...(act === "tf" ? [rest.slice(0, rest.indexOf(":")), rest.slice(rest.indexOf(":") + 1)] : [rest]));
  else fn(...rest.split(":"));
});

/* campos numéricos rápidos */
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches("[data-num]")) {
    const v = parseInt(el.value, 10) || 0;
    const [k, a] = el.dataset.num.split(":");
    if (k === "amt") { UI.amt = Math.max(1, v); return render(); }
    if (k === "hp.temp") C.hp.temp = Math.max(0, v);
    else if (k === "hp.max") { C.hp.max = Math.max(1, v); C.hp.current = Math.min(C.hp.current, C.hp.max); }
    else if (k === "formcur") { const f = C.forms.find(x => x.id === a); f.cur = Math.max(0, Math.min(f.max, v)); }
    else if (k === "formmax") { const f = C.forms.find(x => x.id === a); f.max = Math.max(1, v); f.cur = Math.min(f.cur, f.max); }
    else if (k === "abil") C.abilities[a] = Math.max(1, Math.min(30, v));
    else if (k === "coin") C.coins[a] = Math.max(0, v);
    return commit();
  }
  if (el.matches("[data-f]")) {
    const path = el.dataset.f.split(".");
    let o = C;
    path.slice(0, -1).forEach(p => { o = o[p]; });
    const last = path[path.length - 1];
    const v = el.dataset.t === "num" ? (parseInt(el.value, 10) || 0) : el.value;
    o[last] = v;
    if (path[0] === "slots") C.slotsUsed = C.slotsUsed.map((u, i) => Math.min(u, C.slots[i]));
    if (el.tagName === "TEXTAREA" || el.dataset.t !== "num") { normalize(C); save(); if (path[0] === "name" || path[0] === "classes") render(); return; }
    return commit();
  }
  if (el.matches("[data-if]")) {
    const it = C.items.find(x => x.id === el.dataset.if);
    it.desc = el.value;
    if (!it.charges) it.charges = I.chargesFrom(it.desc);
    commit();
    return;
  }
  if (el.matches("input[type=file]")) handleFile(el.dataset.kind, el.files[0]);
});
/* buscas: atualiza só a lista, sem perder o foco do campo */
document.addEventListener("input", e => {
  const el = e.target;
  if (!el.matches("[data-input]")) return;
  UI[el.dataset.input] = el.value;
  if (el.dataset.input === "spellQ") document.getElementById("spellList").innerHTML = spellListHTML();
  if (el.dataset.input === "formQ") document.getElementById("monList").innerHTML = monListHTML();
});
document.addEventListener("focus", e => { if (e.target.matches && e.target.matches("input[type=number]")) e.target.select(); }, true);
document.addEventListener("keydown", e => { if (e.key === "Escape" && UI.sheet) closeSheet(); });

/* ================= INÍCIO ================= */
loadDB();
render();
setTimeout(() => {
  needSpells().then(() => {
    srdSpellIdx = null;
    const busy = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (C && !busy && !UI.sheet) render();
  }).catch(() => {});
  needItems().catch(() => {});
}, 400);
