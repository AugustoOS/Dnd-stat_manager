/* Importadores de ficha: PDF do Aurora (preenchível ou "achatado"), PDF genérico
   (ficha oficial WotC / D&D Beyond, melhor esforço), arquivo .dnd5e/.xml do Aurora
   e backup JSON do próprio app. Roda no navegador e no Node (para testes). */
(function (root) {
"use strict";

/* ================= MODELO ================= */
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const ABIL_EN = {str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma"};
const SKILLS = [
  ["Acrobatics", "dex"], ["Animal Handling", "wis"], ["Arcana", "int"], ["Athletics", "str"],
  ["Deception", "cha"], ["History", "int"], ["Insight", "wis"], ["Intimidation", "cha"],
  ["Investigation", "int"], ["Medicine", "wis"], ["Nature", "int"], ["Perception", "wis"],
  ["Performance", "cha"], ["Persuasion", "cha"], ["Religion", "int"], ["Sleight of Hand", "dex"],
  ["Stealth", "dex"], ["Survival", "wis"]];
const CLASS_NAMES = ["Artificer", "Barbarian", "Bard", "Blood Hunter", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];

let _uid = 0;
const uid = () => Date.now().toString(36) + (++_uid).toString(36) + Math.random().toString(36).slice(2, 6);
const mod = n => Math.floor((n - 10) / 2);
const profFor = lvl => Math.ceil(Math.max(1, lvl) / 4) + 1;
const toInt = (v, d) => { const n = parseInt(String(v == null ? "" : v).replace(/[^\d-]/g, ""), 10); return isNaN(n) ? d : n; };
const clean = s => String(s == null ? "" : s).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();

function blankCharacter() {
  return {
    v: 2, id: uid(), meta: {source: "manual", importedAt: Date.now(), warnings: []},
    name: "Novo personagem", player: "", race: "", background: "", alignment: "", deity: "", xp: 0,
    classes: [],
    abilities: {str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10},
    saves: {}, skills: {},
    ac: 10, armor: "", shield: "", initExtra: 0, passiveExtra: 0,
    speed: {walk: 30, fly: 0, climb: 0, swim: 0, burrow: 0}, vision: "", defenses: "",
    hp: {max: 10, current: 10, temp: 0}, hitDice: [], deathSaves: {s: 0, f: 0}, concentration: "",
    attacks: [], attacksPerAction: 1,
    features: [], proficiencies: [],
    casting: [], slots: [0, 0, 0, 0, 0, 0, 0, 0, 0], slotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], pact: null,
    spells: [],
    items: [], attuneMax: 3, coins: {cp: 0, sp: 0, ep: 0, gp: 0, pp: 0},
    forms: [],
    bio: {gender: "", age: "", height: "", weight: "", eyes: "", skin: "", hair: "",
      traits: "", ideals: "", bonds: "", flaws: "", trinket: "", backgroundFeature: "", backgroundFeatureText: "",
      backstory: "", allies: "", additional: ""},
    notes: ""
  };
}

/* ================= TABELAS DE CONJURAÇÃO ================= */
const FULL_SLOTS = [null,
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]];
const FULL = ["bard", "cleric", "druid", "sorcerer", "wizard"];
const HALF = ["paladin", "ranger"];
const THIRD_SUB = /eldritch knight|arcane trickster/i;

function casterProgress(c) {
  const n = (c.name || "").toLowerCase();
  if (FULL.includes(n)) return {kind: "full", lvl: c.level};
  if (n === "artificer") return {kind: "half-up", lvl: c.level};
  if (HALF.includes(n)) return {kind: "half", lvl: c.level};
  if (THIRD_SUB.test(c.subclass || "")) return {kind: "third", lvl: c.level};
  return null;
}
/* Espaços de magia pela tabela (conjurador único usa a própria tabela; multiclasse usa a combinada) */
function slotsForClasses(classes) {
  const casters = classes.map(casterProgress).filter(Boolean);
  let cl = 0;
  if (casters.length === 1) {
    const c = casters[0];
    cl = c.kind === "full" ? c.lvl : c.kind === "half-up" ? Math.ceil(c.lvl / 2)
      : c.kind === "half" ? (c.lvl >= 2 ? Math.ceil(c.lvl / 2) : 0) : (c.lvl >= 3 ? Math.ceil(c.lvl / 3) : 0);
  } else {
    casters.forEach(c => {
      cl += c.kind === "full" ? c.lvl : c.kind === "half-up" ? Math.ceil(c.lvl / 2)
        : c.kind === "half" ? Math.floor(c.lvl / 2) : Math.floor(c.lvl / 3);
    });
  }
  const row = (FULL_SLOTS[Math.min(20, cl)] || []).slice();
  while (row.length < 9) row.push(0);
  return row;
}
function pactFor(classes) {
  const w = classes.find(c => /warlock/i.test(c.name));
  if (!w) return null;
  const l = w.level;
  const max = l >= 17 ? 4 : l >= 11 ? 3 : l >= 2 ? 2 : 1;
  const level = Math.min(5, Math.ceil(l / 2));
  return {level, max, used: 0};
}

/* ================= TEXTO / DESCRIÇÕES ================= */
/* Agrupa itens de texto (pdf.js) em linhas, de cima para baixo. */
function toLines(items, tol) {
  tol = tol || 1.6;
  const sorted = items.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  sorted.forEach(it => {
    const ln = lines.find(l => Math.abs(l.y - it.y) <= tol);
    if (ln) ln.items.push(it); else lines.push({y: it.y, items: [it]});
  });
  lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => b.y - a.y);
  return lines;
}
function lineText(l) {
  let out = "";
  l.items.forEach((it, i) => {
    const s = it.s;
    if (i && !/\s$/.test(out) && !/^\s/.test(s) && !/^[,.;:)]/.test(s)) out += " ";
    out += s;
  });
  return out.replace(/\s+/g, " ").trim();
}
function dominantFont(items) {
  const count = {};
  items.forEach(it => { count[it.f] = (count[it.f] || 0) + it.s.length; });
  return Object.keys(count).sort((a, b) => count[b] - count[a])[0];
}
/* Converte as linhas de uma caixa em texto com parágrafos (\n) e subtítulos em **negrito**. */
function richText(lines, left, body) {
  const paras = [];
  let cur = "";
  lines.forEach(l => {
    const first = l.items[0];
    const indented = first.x > left + 2.2;
    const heading = first.f !== body && /[.:]$/.test(first.s.trim());
    if (cur && (indented || heading)) { paras.push(cur); cur = ""; }
    let txt = "";
    l.items.forEach((it, i) => {
      let s = it.s;
      if (i === 0 && heading) s = "**" + s.trim() + "**";
      if (txt && !/\s$/.test(txt) && !/^\s/.test(s) && !/^[,.;:)]/.test(s)) txt += " ";
      txt += s;
    });
    txt = txt.replace(/\s+/g, " ").trim();
    cur = cur ? cur + " " + txt : txt;
  });
  if (cur) paras.push(cur);
  return paras.join("\n");
}
/* Caixas de "Título. texto..." (features, notas de itens): título em fonte diferente, na margem. */
function titledEntries(items) {
  if (!items.length) return [];
  const body = dominantFont(items);
  const left = Math.min.apply(null, items.map(i => i.x));
  const lines = toLines(items);
  const entries = [];
  let cur = null;
  lines.forEach(l => {
    const first = l.items[0];
    const isTitle = first.f !== body && Math.abs(first.x - left) < 1.6 && /\.\s*$/.test(first.s);
    if (isTitle) {
      cur = {title: first.s.trim().replace(/\.$/, ""), lines: []};
      entries.push(cur);
      const rest = l.items.slice(1);
      if (rest.length) cur.lines.push({y: l.y, items: rest.map((r, i) => i === 0 ? Object.assign({}, r, {x: left}) : r)});
    } else if (cur) cur.lines.push(l);
    else { cur = {title: "", lines: [l]}; entries.push(cur); }
  });
  return entries.map(e => ({title: e.title, text: e.lines.length ? richText(e.lines, left, body) : ""}));
}
const inBox = (it, x0, y0, x1, y1) => it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1;

/* ================= FEATURES ================= */
const PER = {"long rest": "long", "short rest": "short", "day": "long", "dawn": "long", "turn": "turn", "rest": "short"};
function featureFromTitle(title, text) {
  const f = {id: uid(), name: title, text: text || "", uses: null, act: []};
  const m = title.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  let tags = "";
  if (m) { f.name = m[1].trim(); tags = m[2]; }
  const u = tags.match(/(\d+)\s*\/\s*(Long Rest|Short Rest|Day|Dawn|Turn|Rest)/i);
  if (u) f.uses = {max: +u[1], per: PER[u[2].toLowerCase()] || "long", used: 0};
  if (/bonus action/i.test(tags)) f.act.push("bonus");
  else if (/\baction\b/i.test(tags)) f.act.push("action");
  if (/reaction/i.test(tags)) f.act.push("reaction");
  const t = f.text;
  if (!f.act.includes("reaction") && /(use your reaction|as a reaction|uses? its reaction)/i.test(t)) f.act.push("reaction");
  if (!f.act.includes("bonus") && /\bbonus action\b/i.test(t)) f.act.push("bonus");
  if (!f.act.length && /\b(you can use an action|as an action|use your action)\b/i.test(t)) f.act.push("action");
  if (!f.uses) {
    const once = t.match(/once (?:you use|per) .*?(?:until you finish a|per) (long|short) rest/i);
    if (/can't (?:do so|use (?:it|this feature)) again until you finish a (long|short) rest/i.test(t) || once) {
      const per = (t.match(/finish a (long|short) rest/i) || [])[1] || "long";
      f.uses = {max: 1, per: per.toLowerCase(), used: 0};
    }
  }
  return f;
}

/* ================= ITENS ================= */
function chargesFrom(desc) {
  const m = (desc || "").match(/has (\d+) charges/i);
  if (!m) return null;
  const r = desc.match(/regains? (\d+d\d+(?:\s*[+-]\s*\d+)?|all|\d+)(?: expended)? charges?(?:[^.]*?)(?:daily )?at dawn/i);
  return {max: +m[1], used: 0, regain: r ? r[1].replace(/\s+/g, "") : (/at dawn/i.test(desc) ? "all" : "")};
}
const WEAPONS = {
  "club": ["1d4", "bludgeoning", "light", "simple"], "dagger": ["1d4", "piercing", "finesse, light, thrown (20/60)", "simple"],
  "greatclub": ["1d8", "bludgeoning", "two-handed", "simple"], "handaxe": ["1d6", "slashing", "light, thrown (20/60)", "simple"],
  "javelin": ["1d6", "piercing", "thrown (30/120)", "simple"], "light hammer": ["1d4", "bludgeoning", "light, thrown (20/60)", "simple"],
  "mace": ["1d6", "bludgeoning", "", "simple"], "quarterstaff": ["1d6", "bludgeoning", "versatile (1d8)", "simple"],
  "sickle": ["1d4", "slashing", "light", "simple"], "spear": ["1d6", "piercing", "thrown (20/60), versatile (1d8)", "simple"],
  "light crossbow": ["1d8", "piercing", "ammunition (80/320), loading, two-handed", "simple ranged"],
  "dart": ["1d4", "piercing", "finesse, thrown (20/60)", "simple ranged"], "shortbow": ["1d6", "piercing", "ammunition (80/320), two-handed", "simple ranged"],
  "sling": ["1d4", "bludgeoning", "ammunition (30/120)", "simple ranged"],
  "battleaxe": ["1d8", "slashing", "versatile (1d10)", "martial"], "flail": ["1d8", "bludgeoning", "", "martial"],
  "glaive": ["1d10", "slashing", "heavy, reach, two-handed", "martial"], "greataxe": ["1d12", "slashing", "heavy, two-handed", "martial"],
  "greatsword": ["2d6", "slashing", "heavy, two-handed", "martial"], "halberd": ["1d10", "slashing", "heavy, reach, two-handed", "martial"],
  "lance": ["1d12", "piercing", "reach, special", "martial"], "longsword": ["1d8", "slashing", "versatile (1d10)", "martial"],
  "maul": ["2d6", "bludgeoning", "heavy, two-handed", "martial"], "morningstar": ["1d8", "piercing", "", "martial"],
  "pike": ["1d10", "piercing", "heavy, reach, two-handed", "martial"], "rapier": ["1d8", "piercing", "finesse", "martial"],
  "scimitar": ["1d6", "slashing", "finesse, light", "martial"], "shortsword": ["1d6", "piercing", "finesse, light", "martial"],
  "trident": ["1d6", "piercing", "thrown (20/60), versatile (1d8)", "martial"], "war pick": ["1d8", "piercing", "", "martial"],
  "warhammer": ["1d8", "bludgeoning", "versatile (1d10)", "martial"], "whip": ["1d4", "slashing", "finesse, reach", "martial"],
  "blowgun": ["1", "piercing", "ammunition (25/100), loading", "martial ranged"],
  "hand crossbow": ["1d6", "piercing", "ammunition (30/120), light, loading", "martial ranged"],
  "heavy crossbow": ["1d10", "piercing", "ammunition (100/400), heavy, loading, two-handed", "martial ranged"],
  "longbow": ["1d8", "piercing", "ammunition (150/600), heavy, two-handed", "martial ranged"]
};
function weaponBase(name, desc) {
  const n = (name || "").toLowerCase();
  const keys = Object.keys(WEAPONS).sort((a, b) => b.length - a.length);
  let k = keys.find(w => new RegExp("\\b" + w + "s?\\b").test(n));
  if (!k && desc) {
    const d = desc.toLowerCase().slice(0, 240);
    k = keys.find(w => new RegExp("\\b(magic |a |this )" + w + "\\b").test(d));
  }
  return k || null;
}
/* Monta um ataque sugerido para uma arma (bônus mágico + atributo + proficiência). */
function weaponAttack(C, item) {
  const base = (item.base && WEAPONS[item.base]) ? item.base : weaponBase(item.name, item.desc);
  if (!base) return null;
  const [dmg, type, props, cat] = WEAPONS[base];
  const bonusM = (item.name.match(/\+(\d)\b/) || (item.desc || "").match(/\+(\d) bonus to attack and damage rolls/i) || [])[1];
  const magic = bonusM ? +bonusM : 0;
  const finesse = /finesse/.test(props), ranged = /ranged/.test(cat);
  const sm = mod(C.abilities.str), dm = mod(C.abilities.dex);
  const am = ranged ? dm : finesse ? Math.max(sm, dm) : sm;
  const profTxt = (C.proficiencies.find(p => /weapon/i.test(p.label)) || {}).text || "";
  const proficient = new RegExp("\\b" + base + "s?\\b", "i").test(profTxt) ||
    (/simple weapons/i.test(profTxt) && /simple/.test(cat)) || (/martial weapons/i.test(profTxt) && /martial/.test(cat));
  const lvl = C.classes.reduce((a, c) => a + c.level, 0) || 1;
  const atk = am + magic + (proficient ? profFor(lvl) : 0);
  const dmgB = am + magic;
  const reach = /reach/.test(props) ? "10 ft" : ranged ? (props.match(/\((\d+\/\d+)\)/) || [])[1] + " ft" : "5 ft";
  return {id: uid(), name: item.name, range: reach, attack: (atk >= 0 ? "+" : "") + atk,
    damage: dmg + (dmgB ? (dmgB > 0 ? "+" : "") + dmgB : "") + " " + type,
    notes: props + (proficient ? "" : " · sem proficiência"), auto: true, itemId: item.id};
}

/* ================= ESTRUTURA DO PDF ================= */
/* Extrai campos e textos posicionados de cada página usando pdf.js. */
async function extractPdf(data, pdfjsLib) {
  const doc = await pdfjsLib.getDocument({data, verbosity: 0, isEvalSupported: false}).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({scale: 1});
    const ann = await page.getAnnotations();
    const fields = ann.filter(a => a.fieldName).map(a => ({
      name: a.fieldName,
      value: a.checkBox || a.radioButton ? (a.fieldValue && a.fieldValue !== "Off" ? "Yes" : "")
        : (a.fieldValue == null ? "" : Array.isArray(a.fieldValue) ? a.fieldValue.join(", ") : String(a.fieldValue)),
      rect: a.rect, cb: !!(a.checkBox || a.radioButton)
    }));
    const tc = await page.getTextContent();
    const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({
      s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.height || i.transform[3]), f: i.fontName
    }));
    pages.push({n, w: vp.width, h: vp.height, fields, items});
  }
  return {pages};
}

/* Gabarito das posições dos campos da página 1 do Aurora (para PDFs achatados, sem campos). */
const AURORA_P1 = {
  details_build: [266, 728, 522, 739], details_xp: [523, 728, 568, 739], details_character_name: [46, 712, 255, 729],
  details_background: [266, 702, 374, 714], details_player: [499, 702, 568, 714], details_alignment: [375, 702, 426, 714],
  details_deity: [427, 702, 499, 714], details_equipped_armor: [224, 644, 347, 653], details_armor_class: [363, 639, 391, 664],
  details_proficiency_bonus: [175, 631, 195, 648], details_equipped_shield: [224, 622, 356, 631],
  details_str_score: [43, 615, 78, 646], details_dex_score: [43, 544, 78, 575], details_con_score: [43, 472, 78, 503],
  details_int_score: [43, 400, 78, 431], details_wis_score: [43, 329, 78, 360], details_cha_score: [43, 257, 78, 288],
  details_str_save_total: [111, 605, 129, 613], details_dex_save_total: [111, 593, 129, 601], details_con_save_total: [111, 581, 129, 589],
  details_int_save_total: [111, 569, 129, 577], details_wis_save_total: [111, 557, 129, 565], details_cha_save_total: [111, 544, 129, 553],
  details_hp_max: [224, 552, 259, 562], details_hd: [278, 552, 333, 562], details_speed_walking: [224, 476, 259, 486],
  details_speed_fly: [267, 476, 302, 486], details_speed_climb: [310, 476, 345, 486], details_speed_swim: [353, 476, 388, 486],
  details_vision: [224, 454, 302, 464], details_resistances: [224, 398, 388, 449], details_passive_perception_total: [96, 241, 115, 254],
  details_initiative: [75, 200, 97, 216], details_encounter_box: [103, 203, 198, 212]
};
(function addSkillRects() {
  const keys = ["acrobatics", "animalhandling", "arcana", "athletics", "deception", "history", "insight", "intimidation",
    "investigation", "medicine", "nature", "perception", "performance", "persuasion", "religion", "sleightofhand", "stealth", "survival"];
  keys.forEach((k, i) => { const y = 476 - i * 12 + (i >= 17 ? 0 : 0); AURORA_P1["details_" + k + "_total"] = [111, y - 1, 129, y + 8]; });
  for (let r = 1; r <= 4; r++) {
    const y = 167 - (r - 1) * 22;
    AURORA_P1["details_attack" + r + "_weapon"] = [34, y, 166, y + 10];
    AURORA_P1["details_attack" + r + "_range"] = [173, y, 217, y + 10];
    AURORA_P1["details_attack" + r + "_attack"] = [222, y, 267, y + 10];
    AURORA_P1["details_attack" + r + "_damage"] = [273, y, 388, y + 10];
    AURORA_P1["details_attack" + r + "_description"] = [34, y - 9, 389, y - 1];
  }
})();
const AURORA_P2 = {
  background_gender: [265, 725, 348, 742], background_age: [349, 725, 417, 742], background_height: [418, 725, 492, 742],
  background_weight: [493, 725, 573, 742], background_eyes: [265, 699, 366, 716], background_skin: [368, 699, 469, 716],
  background_hair: [471, 699, 573, 716], background_feature_name: [45, 184, 189, 197]
};
const AURORA_P3 = {equipment_page_attunement_current: [324, 534, 351, 546], equipment_page_attunement_max: [360, 534, 387, 546],
  equipment_page_coins_cp: [216, 395, 243, 407], equipment_page_coins_sp: [252, 395, 279, 407], equipment_page_coins_ep: [288, 395, 315, 407],
  equipment_page_coins_gp: [324, 395, 351, 407], equipment_page_coins_pp: [360, 395, 387, 407]};
(function addGearRects() {
  for (let i = 0; i < 40; i++) {
    const y = 741 - i * 10;
    AURORA_P3["equipment_page_gear_name." + i] = [35, y, 183, y + 10];
    AURORA_P3["equipment_page_gear_count." + i] = [184, y, 196, y + 10];
    if (i < 20) {
      AURORA_P3["equipment_page_magic_gear_name." + i] = [215, y, 363, y + 10];
      AURORA_P3["equipment_page_magic_gear_count." + i] = [364, y, 376, y + 10];
    }
  }
})();
/* Num PDF achatado, os valores viram texto dentro do retângulo onde estaria o campo. */
function synthFields(page, template) {
  const used = new Set();
  const out = [];
  Object.keys(template).forEach(name => {
    const [x0, y0, x1, y1] = template[name];
    const hits = page.items.filter(it => !used.has(it) && it.x >= x0 - 2 && it.x <= x1 && it.y >= y0 - 2 && it.y <= y1 + 1 &&
      !/^[A-Z ,&—-]{4,}$/.test(it.s.trim()) && it.h >= 4);
    if (!hits.length) return;
    hits.forEach(h => used.add(h));
    out.push({name, value: lineTextAll(hits), rect: template[name], cb: false, synth: true});
  });
  return out;
}
const lineTextAll = items => toLines(items).map(lineText).join(" ").trim();

function pageKind(p) {
  const names = p.fields.map(f => f.name);
  const has = pre => names.some(n => n.startsWith(pre));
  const txt = s => p.items.some(i => i.s.trim() === s);
  if (has("details_build") || txt("CHARACTER LEVEL, RACE, & CLASS")) return "main";
  if (has("background_") || (txt("PERSONALITY TRAITS") && txt("BACKGROUND STORY"))) return "bio";
  if (has("equipment_page_") || txt("ADVENTURING GEAR")) return "inventory";
  if (has("spellcasting_class") || txt("SPELLS TO PREPARE")) return "spells";
  if (txt("CASTING TIME") && p.items.some(i => i.h >= 8)) return "spellcards";
  if (has("card_title")) return "itemcards";
  if (p.items.some(i => i.h >= 9) && p.items.some(i => /Player’s Handbook|Dungeon Master’s Guide|lb\.$/.test(i.s.trim()))) return "itemcards";
  if (txt("NOTES")) return "notes";
  if (has("companion_") || txt("COMPANION")) return "companion";
  return "other";
}

function isAuroraPdf(doc) {
  return doc.pages.some(p => p.fields.some(f => /^(details_build|spellcasting_class|card_title_)/.test(f.name)) ||
    p.items.some(i => /generated by (the )?Aurora/i.test(i.s)));
}

/* ================= PARSER DO AURORA (PDF) ================= */
function parseBuild(s, xpLevel) {
  s = clean(s);
  const out = {level: 0, race: "", classes: []};
  const m = s.match(/^Level\s+(\d+)\s+(.*)$/i);
  if (!m) return out;
  out.level = +m[1];
  let rest = m[2];
  const parts = rest.split(/\s+\/\s+/);
  const first = parts[0];
  let idx = -1, cname = "";
  CLASS_NAMES.forEach(cn => {
    const i = first.search(new RegExp("\\b" + cn + "\\b"));
    if (i >= 0 && (idx < 0 || i < idx)) { idx = i; cname = cn; }
  });
  if (idx > 0) { out.race = first.slice(0, idx).trim(); parts[0] = first.slice(idx); }
  else if (idx < 0) { const sp = first.indexOf(" "); out.race = sp > 0 ? first.slice(0, sp) : ""; parts[0] = sp > 0 ? first.slice(sp + 1) : first; }
  parts.forEach(p => {
    const lv = p.match(/\((\d+)\)\s*$/);
    const body = p.replace(/\s*\(\d+\)\s*$/, "");
    const ci = body.indexOf(",");
    out.classes.push({name: (ci >= 0 ? body.slice(0, ci) : body).trim(), subclass: ci >= 0 ? body.slice(ci + 1).trim() : "",
      level: lv ? +lv[1] : (parts.length === 1 ? out.level : 1)});
  });
  return out;
}

function parseAurora(doc) {
  const C = blankCharacter();
  C.meta.source = "aurora-pdf";
  const W = C.meta.warnings;
  const pages = doc.pages.map(p => Object.assign({kind: pageKind(p)}, p));
  const flat = !pages.some(p => p.fields.length > 3);
  if (flat) {
    W.push("PDF sem campos de formulário (achatado): li os valores pelas posições do texto. Confira os números.");
    pages.forEach(p => {
      if (p.kind === "main") p.fields = synthFields(p, AURORA_P1);
      if (p.kind === "bio") p.fields = synthFields(p, AURORA_P2);
      if (p.kind === "inventory") p.fields = synthFields(p, AURORA_P3);
    });
  }
  const F = {};
  pages.forEach(p => p.fields.forEach(f => { if (!(f.name in F) || (!F[f.name] && f.value)) F[f.name] = f.value; }));
  const g = k => clean(F[k]);

  /* identidade */
  C.name = g("details_character_name") || g("background_character_name") || C.name;
  const b = parseBuild(g("details_build"));
  C.race = b.race; C.classes = b.classes;
  if (!C.classes.length) W.push("Não encontrei classe/nível — ajuste na aba Ficha.");
  C.xp = toInt(g("details_xp"), 0);
  C.background = g("details_background"); C.player = g("details_player");
  C.alignment = g("details_alignment"); C.deity = g("details_deity");
  const level = b.level || C.classes.reduce((a, c) => a + c.level, 0) || 1;
  const prof = toInt(g("details_proficiency_bonus"), profFor(level));

  /* atributos, salvaguardas, perícias */
  ABILITIES.forEach(a => { const v = toInt(g("details_" + a + "_score"), NaN); if (!isNaN(v)) C.abilities[a] = v; });
  ABILITIES.forEach(a => {
    const total = toInt(g("details_" + a + "_save_total"), NaN);
    let p = F["details_" + a + "_save_proficiency"] === "Yes";
    const m = mod(C.abilities[a]);
    if (flat && !isNaN(total)) p = total - m >= prof;
    C.saves[a] = {prof: p, extra: isNaN(total) ? 0 : total - m - (p ? prof : 0)};
  });
  SKILLS.forEach(([sk, ab]) => {
    const k = sk.toLowerCase().replace(/\s+/g, "");
    const total = toInt(g("details_" + k + "_total"), NaN);
    let p = F["details_" + k + "_proficiency"] === "Yes", e = F["details_" + k + "_expertise"] === "Yes";
    const m = mod(C.abilities[ab]);
    if (flat && !isNaN(total)) { const d = total - m; e = d >= 2 * prof; p = e || d >= prof; }
    const base = m + (e ? 2 * prof : p ? prof : 0);
    C.skills[sk] = {prof: p || e, exp: e, extra: isNaN(total) ? 0 : total - base};
  });

  /* defesa e movimento */
  C.ac = toInt(g("details_armor_class"), 10);
  C.armor = g("details_equipped_armor"); C.shield = g("details_equipped_shield");
  C.hp.max = C.hp.current = toInt(g("details_hp_max"), 10);
  C.hitDice = (g("details_hd").match(/\d+d\d+/g) || []).map(h => { const [n, d] = h.split("d"); return {die: +d, total: +n, used: 0}; });
  C.speed = {walk: toInt(g("details_speed_walking"), 30), fly: toInt(g("details_speed_fly"), 0),
    climb: toInt(g("details_speed_climb"), 0), swim: toInt(g("details_speed_swim"), 0), burrow: 0};
  C.vision = g("details_vision");
  C.defenses = g("details_resistances").replace(/\n+/g, " · ");
  const init = toInt(g("details_initiative"), NaN);
  if (!isNaN(init)) C.initExtra = init - mod(C.abilities.dex);
  const pp = toInt(g("details_passive_perception_total"), NaN);
  if (!isNaN(pp)) {
    const sk = C.skills.Perception;
    C.passiveExtra = pp - (10 + mod(C.abilities.wis) + (sk.exp ? 2 * prof : sk.prof ? prof : 0) + sk.extra);
  }
  const enc = g("details_encounter_box").match(/(\d+)\s*Attack/i);
  if (enc) C.attacksPerAction = +enc[1];

  /* ataques da página 1 */
  for (let i = 1; i <= 12; i++) {
    const nm = g("details_attack" + i + "_weapon");
    if (!nm) continue;
    C.attacks.push({id: uid(), name: nm, range: g("details_attack" + i + "_range"),
      attack: g("details_attack" + i + "_attack").replace(/\s*vs AC/i, ""), damage: g("details_attack" + i + "_damage"),
      notes: g("details_attack" + i + "_description")});
  }

  /* features (página 1 + "Additional Features" da página 2) e proficiências */
  const main = pages.find(p => p.kind === "main");
  const bio = pages.find(p => p.kind === "bio");
  if (main) {
    const featItems = main.items.filter(it => inBox(it, 400, 158, 600, 700) && it.h >= 4);
    titledEntries(featItems).forEach(e => { if (e.title) C.features.push(Object.assign(featureFromTitle(e.title, e.text), {group: "feature"})); });
    const racial = main.items.filter(it => inBox(it, 218, 206, 392, 388) && it.h >= 4);
    titledEntries(racial).forEach(e => { if (e.title) C.features.push(Object.assign(featureFromTitle(e.title, e.text), {group: "race"})); });
    const profItems = main.items.filter(it => inBox(it, 400, 33, 600, 145) && it.h >= 4);
    titledEntries(profItems).forEach(e => { if (e.title) C.proficiencies.push({label: e.title, text: e.text}); });
  }
  if (bio) {
    const add = bio.items.filter(it => inBox(it, 335, 34, 600, 205) && it.h >= 4 && it.s.trim() !== "ADDITIONAL FEATURES");
    titledEntries(add).forEach(e => {
      if (e.title) C.features.push(Object.assign(featureFromTitle(e.title, e.text), {group: "feature"}));
      else if (e.text) C.bio.additional += (C.bio.additional ? "\n" : "") + e.text;
    });
    const box = (y0, y1) => { const its = bio.items.filter(it => inBox(it, 30, y0, 212, y1) && it.h >= 4 && !/^[A-Z ]{3,}$/.test(it.s.trim())); return its.length ? richText(toLines(its), Math.min.apply(null, its.map(i => i.x)), dominantFont(its)) : ""; };
    C.bio.traits = box(390, 445); C.bio.ideals = box(335, 385); C.bio.bonds = box(280, 330);
    C.bio.flaws = box(224, 275); C.bio.backgroundFeatureText = box(98, 180); C.bio.trinket = box(44, 92);
    if (flat) {
      const story = bio.items.filter(it => inBox(it, 335, 222, 600, 470) && it.h >= 4 && it.s.trim() !== "BACKGROUND STORY");
      if (story.length) C.bio.backstory = richText(toLines(story), 340, dominantFont(story));
    }
  }
  ["gender", "age", "height", "weight", "eyes", "skin", "hair"].forEach(k => { C.bio[k] = g("background_" + k); });
  C.bio.backgroundFeature = g("background_feature_name");
  if (g("background_story")) C.bio.backstory = clean(F.background_story).replace(/\n{2,}/g, "\n");
  C.bio.allies = g("background_allies");
  if (!C.bio.traits && g("background_personality_traits")) C.bio.traits = g("background_personality_traits");

  /* cartas (magias e itens) */
  const spellCards = {}, itemCards = {};
  pages.filter(p => p.kind === "spellcards").forEach(p => parseSpellCards(p).forEach(c => { spellCards[norm(c.name)] = c; }));
  pages.filter(p => p.kind === "itemcards").forEach(p => parseItemCards(p).forEach(c => { itemCards[norm(c.name)] = c; }));

  /* inventário */
  const inv = pages.find(p => p.kind === "inventory");
  const notes = {};
  if (inv) {
    const its = inv.items.filter(it => inBox(it, 405, 195, 600, 770) && it.h >= 4);
    titledEntries(its).forEach(e => { if (e.title) notes[norm(e.title)] = e.text; });
  }
  const addItem = (raw, qty, weight, magic) => {
    raw = clean(raw); if (!raw) return;
    const equipped = /^\[.*\]$/.test(raw);
    const name = raw.replace(/^\[|\]$/g, "").trim();
    const card = itemCards[norm(name)] || {};
    const desc = card.desc || notes[norm(name)] || "";
    C.items.push({id: uid(), name, qty: toInt(qty, 1), weight: weight || "", magic, equipped, attuned: false,
      type: card.type || "", book: card.book || "", desc, charges: chargesFrom(desc)});
  };
  for (let i = 0; i < 60; i++) addItem(F["equipment_page_gear_name." + i], F["equipment_page_gear_count." + i], F["equipment_page_gear_weight." + i], false);
  for (let i = 0; i < 40; i++) addItem(F["equipment_page_magic_gear_name." + i], F["equipment_page_magic_gear_count." + i], F["equipment_page_magic_gear_weight." + i], true);
  /* itens que só aparecem nas cartas */
  Object.keys(itemCards).forEach(k => {
    if (!C.items.some(i => norm(i.name) === k)) {
      const c = itemCards[k];
      C.items.push({id: uid(), name: c.name, qty: 1, weight: c.weight || "", magic: /wondrous|ring|potion|rod|staff|wand|scroll/i.test(c.type),
        equipped: false, attuned: false, type: c.type, book: c.book, desc: c.desc, charges: chargesFrom(c.desc)});
    }
  });
  C.attuneMax = toInt(g("equipment_page_attunement_max"), 3);
  inferAttunement(C, toInt(g("equipment_page_attunement_current"), 0));
  ["cp", "sp", "ep", "gp", "pp"].forEach(c => { C.coins[c] = toInt(g("equipment_page_coins_" + c), 0); });
  const armorName = norm(C.armor), shieldName = norm(C.shield);
  C.items.forEach(it => { if (norm(it.name) === armorName || (shieldName && norm(it.name) === shieldName)) it.equipped = true; });
  addWeaponAttacks(C);

  /* magias */
  parseSpellPages(C, pages, F, spellCards);
  linkFreeSpells(C);
  finishCharacter(C);
  return C;
}
const norm = s => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/\s*\((?:[^)]*)\)\s*$/, "").replace(/[^a-z0-9+' ]/g, "").replace(/\s+/g, " ").trim();

/* Cartas de magia: âncora no rótulo "CASTING TIME"; posições relativas fixas do modelo do Aurora. */
function parseSpellCards(p) {
  const anchors = p.items.filter(i => i.s.trim() === "CASTING TIME" && i.h < 6);
  const colOf = x => Math.floor(x / (p.w / 3));
  const cards = [];
  anchors.forEach(a => {
    const col = colOf(a.x);
    const inCard = it => colOf(it.x) === col && it.y <= a.y + 34 && it.y >= a.y - 200;
    const its = p.items.filter(inCard);
    const labelRx = /^(CASTING TIME|RANGE|DURATION|COMPONENTS)$/;
    const titleIts = its.filter(i => i.y > a.y + 20);
    const subIts = its.filter(i => i.y > a.y + 7 && i.y <= a.y + 20);
    const valueX = a.x + 30;
    const val = (dy) => lineTextAll(its.filter(i => i.x >= valueX && !labelRx.test(i.s.trim()) && i.y <= a.y + dy + 5 && i.y >= a.y + dy - 4.6 && i.h <= 6.5));
    const footY = Math.min.apply(null, its.map(i => i.y));
    const footer = its.filter(i => i.y <= footY + 2 && i.y < a.y - 150).sort((x, y) => x.x - y.x);
    const descIts = its.filter(i => i.y < a.y - 38 && !footer.includes(i));
    const name = lineTextAll(titleIts);
    if (!name) return;
    const sub = lineTextAll(subIts);
    const left = descIts.length ? Math.min.apply(null, descIts.map(i => i.x)) : 0;
    const card = {name, sub, castingTime: val(0), range: val(-11), duration: val(-22), components: val(-33),
      desc: descIts.length ? richText(toLines(descIts), left, dominantFont(descIts)) : "",
      origin: footer[0] ? footer[0].s.trim() : "", book: footer.slice(1).map(f => f.s.trim()).join(" ")};
    const lm = sub.match(/^(\d+)(?:st|nd|rd|th)-level (\w+)/i);
    if (lm) { card.level = +lm[1]; card.school = cap(lm[2]); }
    else if (/cantrip/i.test(sub)) { card.level = 0; card.school = cap(sub.split(/\s+/)[0]); }
    card.ritual = /ritual/i.test(sub);
    card.conc = /concentration/i.test(card.duration);
    cards.push(card);
  });
  return cards;
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

/* Cartas de itens: título/subtítulo/rodapé são campos; a descrição é texto dentro da carta. */
function parseItemCards(p) {
  const cards = [];
  const titles = p.fields.filter(f => /^card_title_/.test(f.name) && f.value);
  if (titles.length) {
    titles.forEach(t => {
      const key = t.name.replace("card_title_", "");
      const sub = p.fields.find(f => f.name === "card_subtitle_" + key) || {};
      const fl = p.fields.find(f => f.name === "card_footer_left_" + key) || {};
      const fr = p.fields.find(f => f.name === "card_footer_right_" + key) || {};
      const x0 = (fl.rect || t.rect)[0] - 2, x1 = (fl.rect || t.rect)[2] + 2;
      const yTop = (sub.rect || t.rect)[1], yBot = fl.rect ? fl.rect[3] : t.rect[1] - 230;
      const its = p.items.filter(i => i.x >= x0 && i.x <= x1 && i.y < yTop - 1 && i.y > yBot + 1);
      const left = its.length ? Math.min.apply(null, its.map(i => i.x)) : 0;
      cards.push({name: clean(t.value), type: clean(sub.value), weight: clean(fl.value), book: clean(fr.value),
        desc: its.length ? richText(toLines(its), left, dominantFont(its)) : ""});
    });
    return cards;
  }
  /* achatado: títulos são o texto maior */
  const colOf = x => Math.floor(x / (p.w / 3));
  p.items.filter(i => i.h >= 9).forEach(t => {
    const col = colOf(t.x);
    const its = p.items.filter(i => colOf(i.x) === col && i.y < t.y - 1 && i.y > t.y - 232);
    const sub = its.filter(i => i.y > t.y - 18);
    const foot = its.filter(i => i.y < t.y - 214);
    const body = its.filter(i => !sub.includes(i) && !foot.includes(i));
    const left = body.length ? Math.min.apply(null, body.map(i => i.x)) : 0;
    cards.push({name: t.s.trim(), type: lineTextAll(sub), weight: foot[0] ? foot[0].s.trim() : "", book: foot.slice(1).map(f => f.s.trim()).join(" "),
      desc: body.length ? richText(toLines(body), left, dominantFont(body)) : ""});
  });
  return cards;
}

function parseSpellPages(C, pages, F, cards) {
  const blocks = {};
  const blockOf = cls => blocks[cls] || (blocks[cls] = {cls, label: cls, ability: "", attack: "", dc: "", prepMax: "", spells: {}});
  const slotsByBlock = {};
  pages.filter(p => p.kind === "spells").forEach(p => {
    const classFields = p.fields.filter(f => /^spellcasting_class:/.test(f.name));
    classFields.forEach(cf => {
      const [, cls, n] = cf.name.split(":");
      const bl = blockOf(cls);
      bl.label = clean(cf.value) || cls;
      const k = ":" + cls + ":" + n;
      bl.ability = bl.ability || clean(F["spellcasting_ability" + k]);
      bl.attack = bl.attack || clean(F["spellcasting_bonus" + k]);
      bl.dc = bl.dc || clean(F["spellcasting_save" + k]);
      bl.prepMax = bl.prepMax || clean(F["spellcasting_prepare" + k]);
    });
    p.fields.forEach(f => {
      const m = f.name.match(/^spells_(\d+):(\d+)_:(.+):(\d+)$/);
      if (!m || !clean(f.value)) return;
      const bl = blockOf(m[3]);
      const raw = clean(f.value);
      const src = (raw.match(/\(([^)]*)\)\s*$/) || [])[1] || "";
      const name = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const prep = F["prepare_" + m[1] + ":" + m[2] + "_:" + m[3] + ":" + m[4]] === "Yes";
      const key = norm(name);
      const prev = bl.spells[key];
      if (prev) { prev.prepared = prev.prepared || prep; return; }
      bl.spells[key] = {name, level: +m[1], prepared: prep, source: src};
    });
    /* espaços de magia: texto "N SPELL SLOTS" na mesma linha do cabeçalho de nível */
    const headers = [];
    p.items.forEach(it => {
      const s = it.s.trim();
      let lv = null;
      let mm = s.match(/^(\d)(?:ST|ND|RD|TH) LEVEL$/);
      if (mm) lv = +mm[1];
      else if (/^\d$/.test(s) && p.items.some(o => o !== it && Math.abs(o.y - it.y) < 1.5 && /^(ST|ND|RD|TH) LEVEL$/.test(o.s.trim()) && o.x > it.x && o.x - it.x < 8)) lv = +s;
      if (lv) headers.push({lv, y: it.y});
    });
    p.items.forEach(it => {
      const mm = it.s.trim().match(/^(\d+) SPELL SLOTS?$/);
      if (!mm) return;
      const h = headers.find(hh => Math.abs(hh.y - it.y) < 2);
      if (!h) return;
      const owner = classFields.filter(cf => cf.rect[1] > it.y).sort((a, b) => a.rect[1] - b.rect[1])[0];
      const cls = owner ? owner.name.split(":")[1] : "_";
      (slotsByBlock[cls] = slotsByBlock[cls] || []).push({lv: h.lv, n: +mm[1]});
    });
  });

  /* PDF achatado: lista de magias vem das cartas */
  if (!Object.keys(blocks).length && Object.keys(cards).length) {
    const bl = blockOf((C.classes[0] || {}).name || "Spells");
    Object.keys(cards).forEach(k => {
      const c = cards[k];
      bl.spells[k] = {name: c.name, level: c.level || 0, prepared: /^Prepared/i.test(c.origin) || c.level === 0, source: ""};
    });
  }

  const slots = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  Object.keys(blocks).forEach(cls => {
    const bl = blocks[cls];
    const isOther = /other/i.test(cls);
    const prepares = !isOther && !!bl.prepMax && !/n\/a/i.test(bl.prepMax);
    if (!isOther) C.casting.push({cls, label: bl.label, ability: bl.ability, attack: bl.attack, dc: toInt(bl.dc, 0),
      prepMax: prepares ? toInt(bl.prepMax, 0) : 0, prepares});
    const sl = slotsByBlock[cls] || [];
    if (/warlock/i.test(cls) && sl.length) {
      const top = sl.reduce((a, s) => s.lv > a.lv ? s : a, sl[0]);
      C.pact = {level: top.lv, max: top.n, used: 0};
    } else sl.forEach(s => { slots[s.lv - 1] = Math.max(slots[s.lv - 1], s.n); });
    Object.keys(bl.spells).forEach(k => {
      const sp = bl.spells[k];
      const card = cards[k];
      const origin = card ? card.origin : "";
      const granted = card && origin && !/^(Prepared|Spellcasting|Pact Magic|Spellbook|Known)\b/i.test(origin);
      const s = {id: uid(), name: sp.name, level: sp.level, cls: isOther ? "Other" : cls,
        prepared: sp.level === 0 || isOther || !prepares || sp.prepared || !!granted,
        always: !!granted || isOther, source: sp.source || (granted ? origin.replace(/\s*\([^)]*\)$/, "") : "")};
      if (card) Object.assign(s, cardFields(card));
      C.spells.push(s);
    });
  });
  /* magias que só existem como carta (ex.: concedidas por item/feat) */
  Object.keys(cards).forEach(k => {
    if (C.spells.some(s => norm(s.name) === k)) return;
    const c = cards[k];
    C.spells.push(Object.assign({id: uid(), name: c.name, level: c.level || 0, cls: "Other", prepared: true, always: true,
      source: c.origin.replace(/\s*\([^)]*\)$/, "")}, cardFields(c)));
  });
  if (slots.some(Boolean)) C.slots = slots;
  else if (C.classes.length) C.slots = slotsForClasses(C.classes);
  if (!C.pact && C.classes.some(c => /warlock/i.test(c.name))) C.pact = pactFor(C.classes);
}
function cardFields(c) {
  return {school: c.school || "", castingTime: c.castingTime, range: c.range, duration: c.duration, components: c.components,
    desc: c.desc, book: c.book, ritual: !!c.ritual, conc: !!c.conc, fromCard: true};
}

/* Magias de feat/raça (Other Spells): 1 uso grátis por descanso longo; "at will" vira à vontade. */
function linkFreeSpells(C) {
  C.spells.forEach(s => {
    const rx = new RegExp(s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^.]*at will|at will[^.]*" + s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (s.level > 0 && C.features.some(f => rx.test(f.text))) { s.atWill = true; s.free = null; return; }
    if (s.cls !== "Other" || s.level === 0) return;
    const feat = C.features.find(f => s.source && norm(f.name) === norm(s.source));
    if (!feat || /once|1\/|without (?:using|expending) a spell slot/i.test(feat.text)) s.free = {max: 1, used: 0, per: "long"};
  });
}

/* Itens sintonizados: o Aurora marca com [colchetes] itens equipados OU sintonizados. */
function inferAttunement(C, current) {
  if (!current) return;
  const srd = (root.SRD_ITEMS || []);
  const srdAtt = n => { const it = srd.find(i => norm(i.n) === norm(n)); return it ? !!it.att : null; };
  const cands = C.items.filter(i => i.magic && i.equipped).map(i => {
    let score = 1;
    const known = srdAtt(i.name);
    if (known === true || /requires attunement/i.test(i.desc)) score = 3;
    else if (known === false || /\+\d\s*$/.test(i.name) || /^(shield|potion|scroll)/i.test(i.name)) score = 0;
    return {i, score};
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score);
  cands.slice(0, current).forEach(c => { c.i.attuned = true; });
  if (cands.length < current) C.meta.warnings.push("Confira quais itens estão sintonizados (o PDF diz " + current + ").");
}

/* Itens sem descrição (arquivo .dnd5e, PDF genérico): completa com o SRD quando o nome bate. */
function srdItem(name) {
  const list = root.SRD_ITEMS || [];
  const n = norm(name).replace(/,/g, "");
  return list.find(i => norm(i.n) === n) || list.find(i => n.startsWith(norm(i.n) + " ")) ||
    list.find(i => norm(i.n).startsWith(n.replace(/ \+\d$/, "")) && /\+\d$/.test(n));
}
function enrichItemsFromSrd(C) {
  C.items.forEach(i => {
    if (i.desc) return;
    const s = srdItem(i.name);
    if (!s) return;
    i.desc = s.t; i.type = i.type || s.h; i.magic = true;
    i.charges = i.charges || chargesFrom(s.t);
  });
}

function addWeaponAttacks(C) {
  C.items.forEach(it => {
    if (!/weapon/i.test(it.type) && !it.base && !weaponBase(it.name, it.desc)) return;
    if (C.attacks.some(a => norm(a.name) === norm(it.name))) {
      const a = C.attacks.find(x => norm(x.name) === norm(it.name)); a.itemId = it.id; return;
    }
    if (!it.magic && !it.equipped) return;
    const atk = weaponAttack(C, it);
    if (atk) C.attacks.push(atk);
  });
}

function finishCharacter(C) {
  /* Recursos: Wild Shape etc. já vêm das features com usos. */
  C.slotsUsed = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  C.spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  if (!C.hitDice.length && C.classes.length) {
    const HD = {barbarian: 12, fighter: 10, paladin: 10, ranger: 10, sorcerer: 6, wizard: 6};
    C.hitDice = C.classes.map(c => ({die: HD[c.name.toLowerCase()] || 8, total: c.level, used: 0}));
  }
  return C;
}

/* ================= PDF GENÉRICO (ficha oficial / D&D Beyond preenchível) ================= */
function parseGenericPdf(doc) {
  const C = blankCharacter();
  C.meta.source = "generic-pdf";
  C.meta.warnings.push("Ficha não-Aurora: importação por melhor esforço. Revise tudo na aba Ficha.");
  const F = {};
  const allFields = [];
  doc.pages.forEach(p => p.fields.forEach(f => { allFields.push(Object.assign({page: p.n}, f)); const k = f.name.toLowerCase().replace(/[^a-z0-9]/g, ""); if (!(k in F) || (!F[k] && f.value)) F[k] = f.value; }));
  const g = (...keys) => { for (const k of keys) { const v = clean(F[k]); if (v) return v; } return ""; };
  C.name = g("charactername", "charactername2", "name") || C.name;
  const cl = g("classlevel", "classandlevel", "class");
  const parts = cl.split(/\s*\/\s*/).filter(Boolean);
  parts.forEach(p => {
    const m = p.match(/^(.*?)\s*(\d+)\s*$/);
    C.classes.push({name: (m ? m[1] : p).replace(/[,(].*$/, "").trim(), subclass: "", level: m ? +m[2] : 1});
  });
  if (!C.classes.length) C.meta.warnings.push("Classe/nível não encontrados.");
  C.race = g("race", "racesubrace", "species"); C.background = g("background"); C.alignment = g("alignment");
  C.player = g("playername"); C.xp = toInt(g("xp", "experiencepoints"), 0);
  const AB = {str: ["str", "strength"], dex: ["dex", "dexterity"], con: ["con", "constitution"], int: ["int", "intelligence"], wis: ["wis", "wisdom"], cha: ["cha", "charisma"]};
  ABILITIES.forEach(a => { const v = toInt(g.apply(null, AB[a]), NaN); if (!isNaN(v) && v > 0 && v <= 30) C.abilities[a] = v; });
  const level = C.classes.reduce((a, c) => a + c.level, 0) || 1;
  const prof = toInt(g("profbonus", "proficiencybonus"), profFor(level));
  const SV = {str: "ststrength", dex: "stdexterity", con: "stconstitution", int: "stintelligence", wis: "stwisdom", cha: "stcharisma"};
  ABILITIES.forEach(a => {
    const t = toInt(g(SV[a]), NaN), m = mod(C.abilities[a]);
    const p = !isNaN(t) && t - m >= prof;
    C.saves[a] = {prof: p, extra: isNaN(t) ? 0 : t - m - (p ? prof : 0)};
  });
  const SKF = {"Animal Handling": "animal", "Sleight of Hand": "sleightofhand"};
  SKILLS.forEach(([sk, ab]) => {
    const t = toInt(g(SKF[sk] || sk.toLowerCase().replace(/\s/g, "")), NaN), m = mod(C.abilities[ab]);
    const d = isNaN(t) ? 0 : t - m;
    const e = d >= 2 * prof, p = e || d >= prof;
    C.skills[sk] = {prof: p, exp: e, extra: isNaN(t) ? 0 : t - m - (e ? 2 * prof : p ? prof : 0)};
  });
  C.ac = toInt(g("ac", "armorclass"), 10);
  C.hp.max = C.hp.current = toInt(g("hpmax", "maxhp", "hitpointmaximum"), 10);
  C.speed.walk = toInt(g("speed"), 30);
  const init = toInt(g("initiative"), NaN); if (!isNaN(init)) C.initExtra = init - mod(C.abilities.dex);
  const hd = g("hdtotal", "hd").match(/(\d+)\s*d\s*(\d+)/i);
  if (hd) C.hitDice = [{die: +hd[2], total: +hd[1], used: 0}];
  for (let i = 1; i <= 6; i++) {
    const s = i === 1 ? "" : String(i);
    const nm = g("wpnname" + s, "weaponname" + i);
    if (nm) C.attacks.push({id: uid(), name: nm, range: "", attack: g("wpn" + i + "atkbonus"), damage: g("wpn" + i + "damage"), notes: ""});
  }
  const feats = g("featuresandtraits", "feattraits", "features", "featurestraits");
  splitLooseText(feats).forEach(f => C.features.push(Object.assign(featureFromTitle(f.title, f.text), {group: "feature"})));
  const pl = g("proficiencieslang", "otherproficienciesandlanguages");
  if (pl) C.proficiencies.push({label: "Proficiências e idiomas", text: pl});
  const eq = g("equipment");
  eq.split(/\n|,\s*(?![^()]*\))/).map(s => s.trim()).filter(Boolean).forEach(s => {
    const m = s.match(/^(\d+)\s*[x×]?\s+(.*)$/) || s.match(/^(.*?)\s*[x×(](\d+)\)?$/);
    const name = m ? (isNaN(+m[1]) ? m[1] : m[2]) : s, qty = m ? (isNaN(+m[1]) ? +m[2] : +m[1]) : 1;
    C.items.push({id: uid(), name: name.trim(), qty: qty || 1, weight: "", magic: false, equipped: false, attuned: false, type: "", desc: "", charges: null});
  });
  ["cp", "sp", "ep", "gp", "pp"].forEach(c => { C.coins[c] = toInt(g(c), 0); });
  C.bio.traits = g("personalitytraits"); C.bio.ideals = g("ideals"); C.bio.bonds = g("bonds"); C.bio.flaws = g("flaws");
  C.bio.backstory = g("backstory", "characterbackstory"); C.bio.allies = g("allies");
  /* magias: campos "Spells NNNN" agrupados por coluna e por blocos verticais */
  const spellFields = allFields.filter(f => /^spells?\s*\d+/i.test(f.name) && clean(f.value));
  if (spellFields.length) {
    const ability = g("spellcastingability2", "spellcastingability");
    C.casting.push({cls: (C.classes[0] || {}).name || "Spells", label: g("spellcastingclass2", "spellcastingclass") || "Magias",
      ability, attack: g("spellatkbonus2", "spellattackbonus"), dc: toInt(g("spellsavedc2", "spellsavedc"), 0), prepMax: 0, prepares: false});
    const allSpellRects = allFields.filter(f => /^spells?\s*\d+/i.test(f.name));
    const levels = groupSpellLevels(allSpellRects);
    spellFields.forEach(f => {
      C.spells.push({id: uid(), name: clean(f.value), level: levels.get(f) || 0, cls: C.casting[0].cls, prepared: true, always: false, source: ""});
    });
    const slots = [];
    for (let l = 1; l <= 9; l++) slots.push(toInt(g("slotstotal" + (18 + l)), 0));
    C.slots = slots.some(Boolean) ? slots : slotsForClasses(C.classes);
    C.meta.warnings.push("Níveis das magias deduzidos pelo layout — confira.");
  } else if (C.classes.length) C.slots = slotsForClasses(C.classes);
  C.pact = pactFor(C.classes);
  finishCharacter(C);
  return C;
}
/* Ficha oficial: 3 colunas (truques,1,2 | 3,4,5 | 6,7,8,9), separadas por espaços verticais. */
function groupSpellLevels(fields) {
  const map = new Map();
  const byPage = {};
  fields.forEach(f => { (byPage[f.page] = byPage[f.page] || []).push(f); });
  Object.values(byPage).forEach(list => {
    const xs = list.map(f => f.rect[0]).sort((a, b) => a - b);
    const cols = [];
    xs.forEach(x => { if (!cols.length || x - cols[cols.length - 1] > 60) cols.push(x); });
    const colStart = [0, 3, 6];
    cols.forEach((cx, ci) => {
      const inCol = list.filter(f => Math.abs(f.rect[0] - cx) < 60).sort((a, b) => b.rect[1] - a.rect[1]);
      const hgt = inCol.length ? inCol[0].rect[3] - inCol[0].rect[1] : 10;
      let lvl = colStart[ci] || 0, prevY = null;
      inCol.forEach(f => {
        if (prevY != null && prevY - f.rect[1] > hgt * 2.2) lvl++;
        map.set(f, Math.min(9, lvl));
        prevY = f.rect[1];
      });
    });
  });
  return map;
}
function splitLooseText(txt) {
  const out = [];
  let cur = null;
  clean(txt).split("\n").forEach(line => {
    const l = line.trim(); if (!l) return;
    const m = l.match(/^(?:[*•=-]+\s*)?([A-Z][^.:]{2,60}?)(?:\s*[•|].*)?[.:]\s*(.*)$/) ;
    if (/^[*•]/.test(l) || (m && m[1].split(" ").length <= 7 && /^[A-Z]/.test(m[1]) && !cur) || (m && /^[*•]/.test(l))) {
      cur = {title: (m ? m[1] : l.replace(/^[*•\s]+/, "")).trim(), text: m ? m[2] : ""};
      out.push(cur);
    } else if (cur) cur.text += (cur.text ? " " : "") + l;
    else { cur = {title: l.slice(0, 60), text: ""}; out.push(cur); }
  });
  return out;
}

/* ================= AURORA .dnd5e / .xml ================= */
function parseAuroraXml(text, DOMParserImpl) {
  const DP = DOMParserImpl || root.DOMParser;
  const xml = new DP().parseFromString(text, "text/xml");
  const q = (sel, ctx) => (ctx || xml).getElementsByTagName(sel);
  const first = (tag, ctx) => { const e = q(tag, ctx)[0]; return e ? (e.textContent || "").trim() : ""; };
  if (!q("character").length) throw new Error("Arquivo não parece ser do Aurora (.dnd5e).");
  const C = blankCharacter();
  C.meta.source = "aurora-xml";
  const W = C.meta.warnings;
  W.push("Arquivo do Aurora não traz descrições nem valores calculados: atributos, CA e PV foram estimados. Para tudo completo, importe o PDF do Aurora.");
  const disp = q("display-properties")[0];
  const input = q("input")[0];
  C.name = first("name", input) || first("name", disp) || C.name;
  C.player = first("player-name", input);
  C.xp = toInt(first("experience", input), 0);
  C.race = first("race", disp); C.background = first("background", disp);
  const level = toInt(first("level", disp), 1);
  const classTxt = first("class", disp);

  const sum = Array.from(q("sum")[0] ? q("element", q("sum")[0]) : []);
  const ids = sum.map(e => ({type: e.getAttribute("type"), id: e.getAttribute("id") || ""}));
  const pretty = id => id.replace(/^ID_(?:[A-Z0-9]+_)*?(?:CLASS|ARCHETYPE|MULTICLASS)_/, "").replace(/^(?:[A-Z]+_)?(PHB|XGTE|TCOE|SCAG|EGW)_/, "")
    .split("_").map(w => w.length > 12 ? w.replace(/(OF|THE)(?=[A-Z])/g, "$1 ").replace(/([A-Z])(OF|THE)\b/g, "$1 $2") : w).join(" ")
    .toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  /* classes: a subclasse é o elemento "Archetype" aninhado no elemento Class/Multiclass da classe */
  const clsParts = classTxt.split("/").map(s => s.trim()).filter(Boolean);
  const classEls = Array.from(q("element")).filter(e => /^(Class|Multiclass)$/.test(e.getAttribute("type")));
  clsParts.forEach(p => {
    const m = p.match(/^(.*?)\s*\((\d+)\)$/);
    const name = (m ? m[1] : p).trim();
    const ce = classEls.find(e => (e.getAttribute("registered") || "").endsWith("_" + name.toUpperCase().replace(/\s+/g, "_")));
    const ae = ce && Array.from(q("element", ce)).find(e => e.getAttribute("type") === "Archetype");
    const arch = ae ? ae.getAttribute("registered") || "" : "";
    let sub = arch ? pretty(arch.replace(new RegExp("_" + name.toUpperCase() + "_"), "_")).replace(/\b(Of|The|And)\b/g, w => w.toLowerCase()) : "";
    const generic = ae ? (ae.getAttribute("name") || "") : "";
    if (generic && sub.toLowerCase().startsWith(generic.toLowerCase() + " ")) sub = sub.slice(generic.length + 1).replace(/^the\b/, "The");
    if (/circleofthemoon/i.test(arch.replace(/_/g, ""))) sub = "Circle of the Moon";
    C.classes.push({name, subclass: sub, level: m ? +m[2] : level});
  });

  /* atributos: base + aumentos explícitos */
  const abil = q("abilities")[0];
  ABILITIES.forEach(a => { C.abilities[a] = toInt(first(ABIL_EN[a], abil), 10); });
  ids.forEach(e => {
    const m = e.id.match(/_(STRENGTH|DEXTERITY|CONSTITUTION|INTELLIGENCE|WISDOM|CHARISMA)$/);
    if (!m) return;
    if (!/^(Ability Score Improvement|Racial Trait|Feat Feature)$/.test(e.type)) return;
    const k = ABILITIES.find(a => ABIL_EN[a] === m[1].toLowerCase());
    C.abilities[k] = Math.min(20, C.abilities[k] + 1);
  });
  const prof = profFor(level);
  const has = id => ids.some(e => e.id === id);
  ABILITIES.forEach(a => { C.saves[a] = {prof: has("ID_PROFICIENCY_SAVINGTHROW_" + ABIL_EN[a].toUpperCase()), extra: 0}; });
  SKILLS.forEach(([sk]) => {
    const key = sk.toUpperCase().replace(/\s+/g, "");
    const p = has("ID_PROFICIENCY_SKILL_" + key);
    const e = ids.some(x => /EXPERTISE/.test(x.id) && x.id.endsWith("_" + key));
    C.skills[sk] = {prof: p || e, exp: e, extra: 0};
  });

  /* PV: dados rolados (rndhp) + CON */
  const lvl1 = Array.from(q("element")).find(e => e.getAttribute("id") === "ID_LEVEL_1");
  const rnd = (lvl1 && lvl1.getAttribute("rndhp") || "").split(",").map(Number).filter(n => !isNaN(n));
  const conM = mod(C.abilities.con);
  if (rnd.length >= level) C.hp.max = rnd.slice(0, level).reduce((a, b) => a + b, 0) + conM * level;
  else C.hp.max = 8 + (level - 1) * 5 + conM * level;
  if (ids.some(e => /FEAT_TOUGH$/.test(e.id))) C.hp.max += 2 * level;
  C.hp.current = C.hp.max;

  /* aparência e história */
  const app = q("appearance")[0];
  ["age", "height", "weight", "eyes", "skin", "hair"].forEach(k => { C.bio[k] = first(k, app); });
  C.bio.gender = first("gender", input);
  C.bio.backstory = first("backstory", input);
  C.bio.traits = first("background-traits", input); C.bio.ideals = first("background-ideals", input);
  C.bio.bonds = first("background-bonds", input); C.bio.flaws = first("background-flaws", input);
  C.bio.trinket = first("background-trinket", input);
  const bf = q("feature", input)[0];
  if (bf) { C.bio.backgroundFeature = bf.getAttribute("name") || ""; C.bio.backgroundFeatureText = first("description", bf); }
  C.bio.allies = first("allies", input);
  C.bio.additional = first("additional-features", input);
  Array.from(q("note", input)).forEach(n => { const t = (n.textContent || "").trim(); if (t) C.notes += (C.notes ? "\n" : "") + t; });
  const alignEl = ids.find(e => e.type === "Alignment");
  if (alignEl) C.alignment = pretty(alignEl.id.replace("ID_ALIGNMENT_", "")).replace(/^Alignment /, "");

  /* proficiências e idiomas (a partir dos nomes dos elementos) */
  const profGroups = {Armor: [], Weapon: [], Tool: []}, langs = [];
  Array.from(q("element")).forEach(e => {
    const t = e.getAttribute("type"), n = e.getAttribute("name") || "";
    const m = n.match(/^(Armor|Weapon|Tool) Proficiency \((.+)\)$/);
    if (t === "Proficiency" && m && !profGroups[m[1]].includes(m[2])) profGroups[m[1]].push(m[2]);
    else if (t === "Proficiency" && /^Artisan’s Tool|^Tool/.test(n)) {
      const reg = (e.getAttribute("registered") || "").replace(/^ID_PROFICIENCY_TOOL_PROFICIENCY_/, "").replace(/_/g, " ").toLowerCase();
      if (reg) profGroups.Tool.push(reg);
    } else if (t === "Language") {
      const reg = e.getAttribute("registered") || e.getAttribute("id") || "";
      const ln = /^Language/.test(n) ? reg.replace(/^ID_LANGUAGE_/, "").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : n;
      if (ln && !langs.includes(ln)) langs.push(ln);
    }
  });
  if (profGroups.Armor.length) C.proficiencies.push({label: "Armor Proficiencies", text: profGroups.Armor.filter(a => / Armor$|^Shields$/.test(a)).join(", ") || profGroups.Armor.join(", ")});
  if (profGroups.Weapon.length) C.proficiencies.push({label: "Weapon Proficiencies", text: profGroups.Weapon.join(", ")});
  if (profGroups.Tool.length) C.proficiencies.push({label: "Tool Proficiencies", text: profGroups.Tool.join(", ")});
  if (langs.length) C.proficiencies.push({label: "Languages", text: langs.join(", ")});

  /* features (só nomes) */
  Array.from(q("element")).forEach(e => {
    const t = e.getAttribute("type");
    if (!/^(Class Feature|Archetype Feature|Racial Trait|Feat|Background Feature)$/.test(t)) return;
    const reg = e.getAttribute("registered") || e.getAttribute("id") || "";
    let name = e.getAttribute("name") || "";
    if (/^(Feat|Feat \(.*\)|Ability Score Improvement|Improvement Option.*|Druid Circle|Spellcasting|Ability Score Increase.*)$/.test(name) || /\(.*\)$/.test(name)) {
      if (t === "Feat" && reg) name = pretty(reg.replace(/^ID_(?:[A-Z0-9]+_)*FEAT_/, "FEAT_").replace(/^FEAT_/, ""));
      else return;
    }
    name = name.replace(/^Feature: /, "");
    if (!name || C.features.some(f => f.name === name)) return;
    C.features.push(Object.assign(featureFromTitle(name, ""), {group: t === "Racial Trait" ? "race" : "feature"}));
  });
  const wsF = C.features.find(f => /wild ?shape/i.test(f.name) && !/combat|elemental/i.test(f.name));
  if (wsF) { wsF.uses = {max: 2, per: "short", used: 0}; wsF.act = ["action"]; }

  /* magias */
  Array.from(q("spellcasting")).forEach(sc => {
    const cls = sc.getAttribute("name");
    const isPact = /PACT_MAGIC/.test(sc.getAttribute("source") || "") || /warlock/i.test(cls);
    const prepares = /druid|cleric|wizard|paladin|artificer/i.test(cls);
    const atk = toInt(sc.getAttribute("attack"), 0);
    C.casting.push({cls, label: cls, ability: sc.getAttribute("ability") || "", attack: (atk >= 0 ? "+" : "") + atk,
      dc: toInt(sc.getAttribute("dc"), 0), prepMax: 0, prepares});
    const sl = q("slots", sc)[0];
    if (sl) {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => toInt(sl.getAttribute("s" + i), 0));
      if (isPact) { const top = arr.reduce((a, n, i) => n ? i : a, 0); if (arr[top]) C.pact = {level: top + 1, max: arr[top], used: 0}; }
      else arr.forEach((n, i) => { C.slots[i] = Math.max(C.slots[i], n); });
    }
    Array.from(q("spell", sc)).forEach(s => {
      const name = s.getAttribute("name"), lv = toInt(s.getAttribute("level"), 0);
      const prep = s.getAttribute("prepared") === "true", always = s.getAttribute("always-prepared") === "true";
      const prev = C.spells.find(x => norm(x.name) === norm(name) && x.cls === cls);
      if (prev) { prev.prepared = prev.prepared || prep || always; return; }
      C.spells.push({id: uid(), name, level: lv, cls, prepared: lv === 0 || prep || always || !prepares, always, source: always ? "Feature" : ""});
    });
  });
  const add = q("additional", q("magic")[0])[0];
  if (add) Array.from(q("spell", add)).forEach(s => {
    C.spells.push({id: uid(), name: s.getAttribute("name"), level: toInt(s.getAttribute("level"), 0), cls: "Other",
      prepared: true, always: true, source: s.getAttribute("source") || ""});
  });
  const druid = C.casting.find(c => c.prepares);
  if (druid) {
    const cl = C.classes.find(c => c.name.toLowerCase() === druid.cls.toLowerCase());
    const ab = {Wisdom: "wis", Intelligence: "int", Charisma: "cha"}[druid.ability] || "wis";
    druid.prepMax = Math.max(1, (cl ? (/paladin|artificer/i.test(cl.name) ? Math.floor(cl.level / 2) : cl.level) : level) + mod(C.abilities[ab]));
  }

  /* equipamento (a tag <equipment> com itens; existe outra vazia dentro de <currency>) */
  const eqEl = Array.from(q("equipment")).find(e => q("item", e).length);
  const xmlItems = eqEl ? Array.from(q("item", eqEl)) : [];
  xmlItems.forEach(it => {
    if (it.getAttribute("hidden") === "true") return;
    const adorner = q("adorner", it)[0];
    const name = adorner ? adorner.getAttribute("name").replace(/^Weapon, (\+\d)$/, it.getAttribute("name") + " $1").replace(/^Armor, (\+\d)$/, it.getAttribute("name") + " $1") : it.getAttribute("name");
    const eq = q("equipped", it)[0], at = q("attunement", it)[0];
    const magic = !!adorner || /MAGIC_ITEM|GUTOOS|_ITEM_(?!TOOL)/.test(it.getAttribute("id") || "") && !/PHB_ITEM|GEAR/.test(it.getAttribute("id") || "");
    C.items.push({id: uid(), name, base: WEAPONS[(it.getAttribute("name") || "").toLowerCase()] ? it.getAttribute("name").toLowerCase() : undefined, qty: toInt(it.getAttribute("amount"), 1), weight: "", magic,
      equipped: !!eq && eq.textContent.trim() === "true", attuned: !!at && at.textContent.trim() === "true",
      type: "", desc: "", charges: null});
  });
  const cur = q("currency")[0];
  if (cur) ["copper", "silver", "electrum", "gold", "platinum"].forEach((k, i) => { C.coins[["cp", "sp", "ep", "gp", "pp"][i]] = toInt(first(k, cur), 0); });
  /* CA estimada */
  const ARM = {padded: [11, 99], leather: [11, 99], "studded leather": [12, 99], hide: [12, 2], "chain shirt": [13, 2], "scale mail": [14, 2],
    breastplate: [14, 2], "half plate": [15, 2], "ring mail": [14, 0], "chain mail": [16, 0], splint: [17, 0], plate: [18, 0]};
  const dexM = mod(C.abilities.dex);
  let ac = 10 + dexM;
  C.items.filter(i => i.equipped).forEach(i => {
    const raw = xmlItems.find(x => x.getAttribute("name") && i.name.includes(x.getAttribute("name")));
    const base = Object.keys(ARM).find(k => (raw ? raw.getAttribute("name") : i.name).toLowerCase() === k);
    if (base) { const [b, cap2] = ARM[base]; ac = b + Math.min(dexM, cap2) + ((i.name.match(/\+(\d)/) || [])[1] | 0); C.armor = i.name; }
  });
  if (C.items.some(i => i.equipped && /shield/i.test(i.name))) { ac += 2; C.shield = "Shield"; }
  enrichItemsFromSrd(C);
  C.items.filter(i => i.equipped || i.attuned).forEach(i => {
    const m = (i.desc || "").match(/\+(\d) bonus to AC/i);
    if (m && !/\+\d/.test(i.name)) ac += +m[1];
  });
  C.ac = ac;
  C.hitDice = [];
  addWeaponAttacks(C);
  linkFreeSpells(C);
  if (!C.slots.some(Boolean) && C.classes.length) C.slots = slotsForClasses(C.classes);
  finishCharacter(C);
  return C;
}

/* ================= BACKUP JSON ================= */
function parseBackup(text) {
  const data = JSON.parse(text);
  if (data && data.chars) return Object.values(data.chars);
  if (data && Array.isArray(data.characters)) return data.characters;
  if (data && data.v === 2 && data.name) return [data];
  if (data && data.hp && (data.slotsUsed || data.slots)) return [{legacy: data}];
  throw new Error("JSON não reconhecido.");
}

/* ================= ENTRADA ÚNICA PARA PDF ================= */
async function importPdf(data, pdfjsLib) {
  const doc = await extractPdf(data, pdfjsLib);
  if (isAuroraPdf(doc)) return parseAurora(doc);
  if (doc.pages.some(p => p.fields.length > 10)) return parseGenericPdf(doc);
  throw new Error("Não consegui ler esta ficha: o PDF não tem campos de formulário nem o formato do Aurora.");
}

const api = {blankCharacter, extractPdf, parseAurora, parseGenericPdf, parseAuroraXml, parseBackup, importPdf,
  isAuroraPdf, slotsForClasses, pactFor, profFor, mod, uid, norm, SKILLS, ABILITIES, featureFromTitle, chargesFrom,
  weaponAttack, weaponBase, WEAPONS};
root.Importers = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
