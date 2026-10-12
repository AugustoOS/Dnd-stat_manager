"use strict";
/* ================= CONSTANTES ================= */
const KEY = "dnd-stat-manager-v2";
const OLD_KEY = "habib-ficha-v1";
const I = window.Importers;

const ABIL = [["str", "FOR", "Força"], ["dex", "DES", "Destreza"], ["con", "CON", "Constituição"],
  ["int", "INT", "Inteligência"], ["wis", "SAB", "Sabedoria"], ["cha", "CAR", "Carisma"]];
const ABIL_SHORT = Object.fromEntries(ABIL.map(a => [a[0], a[1]]));
const ABIL_BY_NAME = {strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha"};
const SKILL_PT = {"Acrobatics": "Acrobacia", "Animal Handling": "Lidar com animais", "Arcana": "Arcanismo", "Athletics": "Atletismo",
  "Deception": "Enganação", "History": "História", "Insight": "Intuição", "Intimidation": "Intimidação", "Investigation": "Investigação",
  "Medicine": "Medicina", "Nature": "Natureza", "Perception": "Percepção", "Performance": "Atuação", "Persuasion": "Persuasão",
  "Religion": "Religião", "Sleight of Hand": "Prestidigitação", "Stealth": "Furtividade", "Survival": "Sobrevivência"};
const SIZE_PT = {Tiny: "Miúdo", Small: "Pequeno", Medium: "Médio", Large: "Grande", Huge: "Enorme", Gargantuan: "Imenso"};
const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const TYPE_PT = {aberration: "Aberração", beast: "Fera", celestial: "Celestial", construct: "Constructo", dragon: "Dragão",
  elemental: "Elemental", fey: "Fada", fiend: "Corruptor", giant: "Gigante", humanoid: "Humanoide", monstrosity: "Monstruosidade",
  ooze: "Gosma", plant: "Planta", undead: "Morto-vivo", swarm: "Enxame"};
const PER_PT = {long: "desc. longo", short: "desc. curto", turn: "turno"};
const ACT_TABS = [["action", "Ação"], ["bonus", "Ação bônus"], ["reaction", "Reação"], ["other", "Outras"]];
const BASIC = {
  action: [["Atacar", "Faz um ataque corpo a corpo ou à distância (ou mais, com Ataque Extra)."],
    ["Conjurar", "Conjura uma magia com tempo de conjuração de 1 ação."],
    ["Disparada", "Ganha deslocamento extra igual ao seu deslocamento neste turno."],
    ["Desengajar", "Seu movimento não provoca ataques de oportunidade neste turno."],
    ["Esquivar", "Ataques contra você têm desvantagem e você tem vantagem em salvaguardas de DES até seu próximo turno (se puder ver o atacante)."],
    ["Ajudar", "Dá vantagem a um aliado no próximo teste de habilidade, ou no próximo ataque contra uma criatura a 1,5 m de você."],
    ["Esconder", "Faz um teste de Destreza (Furtividade) para se esconder."],
    ["Preparar", "Escolhe um gatilho e uma ação; quando o gatilho acontece, usa sua reação para agir."],
    ["Procurar", "Faz um teste de Sabedoria (Percepção) ou Inteligência (Investigação) para encontrar algo."],
    ["Usar objeto", "Interage com um segundo objeto ou usa um item que exija ação."]],
  bonus: [],
  reaction: [["Ataque de oportunidade", "Quando uma criatura hostil que você vê sai do seu alcance, faz um ataque corpo a corpo contra ela."]],
  other: []
};

/* ================= ESTADO ================= */
let DB = {v: 2, active: null, chars: {}, custom: []};
let C = null;
const UI = {tab: "combat", amt: 5, actTab: "action", spellFilter: "all", spellQ: "", open: {}, formMode: "",
  formQ: "", formMove: "", formSort: "cr", sheet: null, sheetStack: [], storageOK: true};

function loadDB() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) DB = Object.assign({v: 2, active: null, chars: {}, custom: []}, JSON.parse(raw));
    else {
      const old = localStorage.getItem(OLD_KEY);
      if (old) { const ch = migrateLegacy(JSON.parse(old)); DB.chars[ch.id] = ch; DB.active = ch.id; saveNow(); }
    }
  } catch (e) { UI.storageOK = false; }
  Object.values(DB.chars).forEach(normalize);
  C = DB.chars[DB.active] || Object.values(DB.chars)[0] || null;
  if (C) DB.active = C.id;
}
let saveTimer = null;
function saveNow() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); UI.storageOK = true; }
  catch (e) { UI.storageOK = false; }
}
function save() {
  const dot = document.getElementById("dot");
  if (dot) dot.classList.add("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveNow();
    if (dot) { dot.classList.remove("saving"); dot.style.background = UI.storageOK ? "" : "var(--red)"; }
  }, 250);
}
function commit() { if (C) normalize(C); save(); render(); }
function setActive(id) { C = DB.chars[id] || null; DB.active = C ? C.id : null; UI.open = {}; UI.formMode = ""; commit(); }

/* Garante que todos os campos existam e estejam dentro dos limites. */
function normalize(ch) {
  const base = I.blankCharacter();
  Object.keys(base).forEach(k => { if (ch[k] == null) ch[k] = base[k]; });
  ["bio", "abilities", "speed", "coins", "hp", "deathSaves", "meta"].forEach(k => { ch[k] = Object.assign({}, base[k], ch[k]); });
  ch.hp.max = Math.max(1, +ch.hp.max || 1);
  ch.hp.current = Math.max(0, Math.min(ch.hp.max, +ch.hp.current || 0));
  ch.hp.temp = Math.max(0, +ch.hp.temp || 0);
  while (ch.slots.length < 9) ch.slots.push(0);
  while (ch.slotsUsed.length < 9) ch.slotsUsed.push(0);
  ch.slotsUsed = ch.slotsUsed.map((u, i) => Math.max(0, Math.min(ch.slots[i] || 0, u || 0)));
  if (ch.pact) ch.pact.used = Math.max(0, Math.min(ch.pact.max, ch.pact.used || 0));
  I.ABILITIES.forEach(a => { if (!ch.saves[a]) ch.saves[a] = {prof: false, extra: 0}; });
  I.SKILLS.forEach(([s]) => { if (!ch.skills[s]) ch.skills[s] = {prof: false, exp: false, extra: 0}; });
  ch.features.forEach(f => { if (f.uses) f.uses.used = Math.max(0, Math.min(f.uses.max, f.uses.used || 0)); if (!f.act) f.act = []; });
  ch.items.forEach(i => { if (i.charges) i.charges.used = Math.max(0, Math.min(i.charges.max, i.charges.used || 0)); });
  ch.spells.forEach(s => { if (s.free) s.free.used = Math.max(0, Math.min(s.free.max, s.free.used || 0)); });
  ch.forms = ch.forms.filter(f => f.max > 0);
  ch.forms.forEach(f => { f.cur = Math.max(0, Math.min(f.max, f.cur)); });
  ch.hitDice.forEach(h => { h.used = Math.max(0, Math.min(h.total, h.used || 0)); });
  /* Druida sem a feature de Wild Shape com usos (ficha manual): cria o contador. */
  if (druidLevel(ch) >= 2 && !wsFeature(ch)) {
    ch.features.push(Object.assign(I.featureFromTitle("Wild Shape (Action—2/Short Rest)", "You can use your action to magically assume the shape of a beast that you have seen before."), {group: "feature"}));
  }
  const ws = wsFeature(ch);
  if (ws && druidLevel(ch) >= 20) ws.uses = null;
  return ch;
}

/* ================= MIGRAÇÃO DA VERSÃO 1 (ficha fixa do Habib) ================= */
function migrateLegacy(o) {
  const C1 = I.blankCharacter();
  C1.meta.source = "legado";
  C1.meta.warnings = ["Ficha migrada da versão anterior. Importe o PDF do Aurora para trazer descrições, itens e features."];
  C1.name = "Habib Esphyrr Uneno V'Ent";
  C1.race = "Human";
  C1.classes = [{name: "Druid", subclass: "Circle of the Moon", level: o.level || 18}];
  const map = {FOR: "str", DES: "dex", CON: "con", INT: "int", SAB: "wis", CAR: "cha"};
  Object.keys(map).forEach(k => { if (o.abilities && o.abilities[k] != null) C1.abilities[map[k]] = o.abilities[k]; });
  Object.keys(map).forEach(k => { C1.saves[map[k]] = {prof: !!(o.saveProfs && o.saveProfs[k]), extra: 0}; });
  C1.ac = o.ac || 10;
  if (o.hp) C1.hp = {max: o.hp.max, current: o.hp.current, temp: o.hp.temp || 0};
  C1.slots = I.slotsForClasses(C1.classes);
  if (Array.isArray(o.slotsUsed)) C1.slotsUsed = o.slotsUsed.slice();
  C1.forms = (o.pools || []).map(p => ({id: String(p.id), name: p.name, cur: p.current, max: p.max, via: "manual"}));
  const LEG = {0: ["Guidance", "Primal Savagery", "Produce Flame", "Thorn Whip"],
    1: ["Absorb Elements", "Animal Friendship", "Beast Bond", "Charm Person", "Create or Destroy Water", "Cure Wounds", "Detect Magic", "Detect Poison and Disease", "Earth Tremor", "Entangle", "Faerie Fire", "Fog Cloud", "Goodberry", "Healing Word", "Ice Knife", "Jump", "Longstrider", "Purify Food and Drink", "Snare", "Speak with Animals", "Thunderwave"],
    2: ["Alter Self", "Animal Messenger", "Barkskin", "Beast Sense", "Darkvision", "Dust Devil", "Earthbind", "Enhance Ability", "Find Traps", "Flame Blade", "Flaming Sphere", "Gust of Wind", "Healing Spirit", "Heat Metal", "Hold Person", "Lesser Restoration", "Locate Animals or Plants", "Locate Object", "Moonbeam", "Pass without Trace", "Protection from Poison", "Skywrite", "Spike Growth", "Summon Beast", "Warding Wind", "Wither and Bloom"],
    3: ["Call Lightning", "Conjure Animals", "Daylight", "Dispel Magic", "Erupting Earth", "Feign Death", "Flame Arrows", "Meld into Stone", "Plant Growth", "Protection from Energy", "Sleet Storm", "Speak with Plants", "Summon Fey", "Tidal Wave", "Wall of Water", "Water Breathing", "Water Walk", "Wind Wall"],
    4: ["Blight", "Charm Monster", "Confusion", "Conjure Minor Elementals", "Conjure Woodland Beings", "Control Water", "Dominate Beast", "Elemental Bane", "Freedom of Movement", "Giant Insect", "Grasping Vine", "Guardian of Nature", "Hallucinatory Terrain", "Ice Storm", "Locate Creature", "Polymorph", "Stone Shape", "Stoneskin", "Summon Elemental", "Wall of Fire", "Watery Sphere"],
    5: ["Antilife Shell", "Awaken", "Commune with Nature", "Conjure Elemental", "Contagion", "Control Winds", "Geas", "Greater Restoration", "Insect Plague", "Maelstrom", "Mass Cure Wounds", "Planar Binding", "Reincarnate", "Scrying", "Summon Draconic Spirit", "Transmute Rock", "Tree Stride", "Wall of Stone", "Wrath of Nature"],
    6: ["Bones of the Earth", "Conjure Fey", "Druid Grove", "Find the Path", "Heal", "Heroes' Feast", "Investiture of Flame", "Investiture of Ice", "Investiture of Stone", "Investiture of Wind", "Move Earth", "Primordial Ward", "Sunbeam", "Transport via Plants", "Wall of Thorns", "Wind Walk"],
    7: ["Draconic Transformation", "Fire Storm", "Mirage Arcane", "Plane Shift", "Regenerate", "Reverse Gravity", "Whirlwind"],
    8: ["Animal Shapes", "Antipathy/Sympathy", "Control Weather", "Earthquake", "Feeblemind", "Sunburst", "Tsunami"],
    9: ["Foresight", "Shapechange", "Storm of Vengeance", "True Resurrection"]};
  const prep = o.prepared || [];
  Object.keys(LEG).forEach(l => LEG[l].forEach(n => C1.spells.push({id: I.uid(), name: n, level: +l, cls: "Druid", prepared: +l === 0 || prep.includes(n), always: n === "Alter Self", atWill: n === "Alter Self", source: n === "Alter Self" ? "Thousand Forms" : ""})));
  (o.customSpells || []).forEach(c => C1.spells.push({id: I.uid(), name: c.name, level: c.lvl, cls: "Druid", prepared: prep.includes(c.name), always: false, source: ""}));
  C1.spells.push({id: I.uid(), name: "Silvery Barbs", level: 1, cls: "Other", prepared: true, always: true, source: "Fey Touched", free: {max: 1, used: o.feyUsed ? 1 : 0, per: "long"}});
  C1.spells.push({id: I.uid(), name: "Misty Step", level: 2, cls: "Other", prepared: true, always: true, source: "Fey Touched", free: {max: 1, used: 0, per: "long"}});
  C1.casting = [{cls: "Druid", label: "Druid, Circle of the Moon", ability: "Wisdom", attack: "", dc: 0, prepMax: 0, prepares: true}];
  const ws = Object.assign(I.featureFromTitle("Wild Shape (Action—2/Short Rest)", "You can use your action to magically assume the shape of a beast that you have seen before."), {group: "feature"});
  ws.uses.used = (o.wildShape && o.wildShape.used) || 0;
  C1.features.push(ws);
  C1.features.push(Object.assign(I.featureFromTitle("Combat Wild Shape (Bonus Action)", "You can use Wild Shape on your turn as a bonus action, rather than as an action. While you are transformed by Wild Shape, you can use a bonus action to expend one spell slot to regain 1d8 hit points per level of the spell slot expended."), {group: "feature"}));
  C1.features.push(Object.assign(I.featureFromTitle("Fey Touched", "You can cast this feat's spells without a spell slot once per long rest."), {group: "feature"}));
  C1.deathSaves = o.deathSaves || {s: 0, f: 0};
  return C1;
}

/* ================= CÁLCULOS ================= */
const mod = n => Math.floor(((+n || 0) - 10) / 2);
const fm = n => (n >= 0 ? "+" : "") + n;
const totalLevel = ch => Math.max(1, ch.classes.reduce((a, c) => a + (+c.level || 0), 0));
const profB = ch => I.profFor(totalLevel(ch));
const abilMod = (ch, a) => mod(ch.abilities[a]);
function saveTotal(ch, a) { const s = ch.saves[a] || {}; return abilMod(ch, a) + (s.prof ? profB(ch) : 0) + (s.extra || 0); }
function skillTotal(ch, name) {
  const ab = (I.SKILLS.find(s => s[0] === name) || [0, "int"])[1];
  const s = ch.skills[name] || {};
  return abilMod(ch, ab) + (s.exp ? 2 * profB(ch) : s.prof ? profB(ch) : 0) + (s.extra || 0);
}
const passivePerc = ch => 10 + skillTotal(ch, "Perception") + (ch.passiveExtra || 0);
const initiative = ch => abilMod(ch, "dex") + (ch.initExtra || 0);
const classLevel = (ch, rx) => ch.classes.filter(c => rx.test(c.name)).reduce((a, c) => a + (+c.level || 0), 0);
const druidLevel = ch => classLevel(ch, /druid/i);
const isMoon = ch => ch.classes.some(c => /druid/i.test(c.name) && /moon/i.test(c.subclass || "")) ||
  ch.features.some(f => /^circle forms$/i.test(f.name));
const wsFeature = ch => ch.features.find(f => /^wild ?shape$/i.test(f.name.trim()) || /^wildshape/i.test(f.name.trim()));
function knows(ch, name) { const n = I.norm(name); return ch.spells.find(s => I.norm(s.name) === n); }

/* Regras de Wild Shape (5e 2014). */
function wsInfo(ch) {
  const d = druidLevel(ch);
  if (d < 2) return null;
  const moon = isMoon(ch);
  let cr = moon ? (d >= 6 ? Math.floor(d / 3) : 1) : d >= 8 ? 1 : d >= 4 ? 0.5 : 0.25;
  const cf = ch.features.find(f => /circle forms/i.test(f.name));
  const m = cf && cf.text.match(/CR as high as (\d+)/i);
  if (m) cr = Math.max(cr, +m[1]);
  return {level: d, moon, cr, swim: d >= 4, fly: d >= 8, elemental: moon && d >= 10, hours: Math.floor(d / 2),
    unlimited: d >= 20, combat: moon || ch.features.some(f => /combat wild shape/i.test(f.name))};
}
function castingFor(ch, sp) {
  return ch.casting.find(c => c.cls === sp.cls) || ch.casting[0] || null;
}
const crText = cr => cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr);
const usesLeft = u => u ? u.max - u.used : 0;

/* ================= DADOS ================= */
function rollDice(expr) {
  const e = String(expr || "").replace(/\s+/g, "").replace(/−/g, "-");
  let total = 0, detail = [];
  const re = /([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g;
  let m;
  while ((m = re.exec(e))) {
    if (m[3]) {
      const n = +(m[2] || 1), sides = +m[3], sign = m[1] === "-" ? -1 : 1;
      const rolls = Array.from({length: n}, () => 1 + Math.floor(Math.random() * sides));
      total += sign * rolls.reduce((a, b) => a + b, 0);
      detail.push((sign < 0 ? "−" : "") + "[" + rolls.join("+") + "]");
    } else if (m[5]) {
      const sign = m[4] === "-" ? -1 : 1;
      total += sign * +m[5];
      detail.push((sign < 0 ? "−" : "+") + m[5]);
    }
  }
  return {total, detail: detail.join(" ").replace(/^\+/, "")};
}

/* ================= CARREGAMENTO SOB DEMANDA ================= */
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error("Falha ao carregar " + src)); };
    document.head.appendChild(s);
  });
  return loaded[src];
}
const needMonsters = () => loadScript("data/srd-monsters.js");
const needSpells = () => loadScript("data/srd-spells.js");
const needItems = () => loadScript("data/srd-items.js");
async function needPdfjs() {
  await loadScript("vendor/pdfjs/pdf.min.js");
  const lib = window.pdfjsLib || window["pdfjs-dist/build/pdf"];
  lib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js";
  return lib;
}

/* ================= MAGIAS ================= */
let srdSpellIdx = null;
function srdSpell(name) {
  if (!window.SRD_SPELLS) return null;
  if (!srdSpellIdx) { srdSpellIdx = {}; window.SRD_SPELLS.forEach(s => { srdSpellIdx[I.norm(s.n)] = s; }); }
  return srdSpellIdx[I.norm(name)] || null;
}
/* Junta o que veio da ficha (carta do PDF) com o SRD; o PDF tem prioridade, salvo se o texto veio cortado. */
function spellInfo(sp) {
  const srd = srdSpell(sp.name);
  const info = {name: sp.name, level: sp.level, school: sp.school || (srd && srd.sc) || "", castingTime: sp.castingTime || (srd && srd.ct) || "",
    range: sp.range || (srd && srd.r) || "", duration: sp.duration || (srd && srd.d) || "", components: sp.components || (srd && srd.c) || "",
    ritual: sp.ritual || !!(srd && srd.rit), conc: sp.conc || !!(srd && srd.conc) || /concentration/i.test(sp.duration || ""),
    desc: sp.desc || "", book: sp.book || "", src: sp.desc ? "ficha" : ""};
  const cut = info.desc && !/[.!?)"”]\s*$/.test(info.desc);
  if (srd && (!info.desc || cut)) {
    info.desc = srd.t + (srd.hl ? "\n**At Higher Levels.** " + srd.hl : "");
    info.src = cut ? "SRD (o texto da ficha estava cortado)" : "SRD 5.1";
    info.book = info.book || "SRD 5.1";
  }
  if (sp.customDesc) { info.desc = sp.customDesc; info.src = "sua anotação"; }
  return info;
}
function actionKind(ct) {
  ct = (ct || "").toLowerCase();
  if (!ct) return "action";
  if (/bonus action/.test(ct)) return "bonus";
  if (/reaction/.test(ct)) return "reaction";
  if (/^1 action/.test(ct)) return "action";
  return "other";
}
const ORD = n => n + "º";
const levelLabel = l => l === 0 ? "Truques" : ORD(l) + " nível";

/* ================= MONSTROS ================= */
function allMonsters() {
  const srd = (window.SRD_MONSTERS || []).map(m => Object.assign({src: "SRD"}, m));
  return srd.concat((DB.custom || []).map(m => Object.assign({src: "custom"}, m)));
}
function findMonster(name) {
  const n = I.norm(name);
  return (DB.custom || []).find(m => I.norm(m.n) === n) || (window.SRD_MONSTERS || []).find(m => I.norm(m.n) === n) || null;
}
const mType = m => (m.t || "").toLowerCase();
const isBeast = m => /^beast/.test(mType(m));
const isSwarm = m => /swarm/.test(mType(m));
/* Ataques do stat block: "+5 to hit ... Hit: 8 (1d8 + 4) piercing damage" */
function parseMonsterAttack(desc) {
  const hit = (desc.match(/([+-]\d+) to hit/) || [])[1];
  const dmg = (desc.match(/Hit:\s*\d+\s*\(([^)]+)\)\s*(\w+)/) || []);
  const reach = (desc.match(/(reach|range) ([\d/]+ ft\.?)/) || [])[2];
  const save = (desc.match(/DC (\d+) (\w+) saving throw/) || []);
  return {hit, dmg: dmg[1] ? dmg[1].replace(/\s+/g, "") + " " + dmg[2] : "", reach: reach || "", save: save[1] ? "CD " + save[1] + " " + save[2] : ""};
}

/* ================= TEXTO ================= */
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
function rich(txt) {
  return String(txt || "").split("\n").filter(p => p.trim()).map(p =>
    "<p>" + esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") + "</p>").join("");
}
function toast(msg, kind) {
  const t = document.getElementById("toast");
  t.innerHTML = msg;
  t.className = "show " + (kind || "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ""; }, kind === "long" ? 5200 : 2600);
}
