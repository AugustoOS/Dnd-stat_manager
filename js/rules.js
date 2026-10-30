"use strict";
/* ================= TEMAS POR CLASSE ================= */
const THEMES = {moon: ["Lua", "#E9D8A6"], arcane: ["Arcano", "#A9C1FF"], blood: ["Fúria", "#F08A6C"], shadow: ["Sombra", "#B9A8F2"],
  holy: ["Sagrado", "#F4CD6A"], pact: ["Pacto", "#D597F2"], ember: ["Brasa", "#FF9F80"], song: ["Canção", "#F7A8C8"],
  steel: ["Aço", "#BFCBDD"], wild: ["Selva", "#A6D68F"], ki: ["Ki", "#F2B26B"], gear: ["Engenho", "#72D3D9"]};
const CLASS_THEME = {druid: "moon", wizard: "arcane", barbarian: "blood", "blood hunter": "blood", rogue: "shadow", cleric: "holy",
  paladin: "holy", warlock: "pact", sorcerer: "ember", bard: "song", fighter: "steel", ranger: "wild", monk: "ki", artificer: "gear"};
const mainClass = ch => ch.classes.slice().sort((a, b) => b.level - a.level)[0] || null;
const themeKey = ch => (ch && THEMES[ch.theme]) ? ch.theme : (ch && mainClass(ch) && CLASS_THEME[mainClass(ch).name.toLowerCase()]) || "moon";
function applyTheme() {
  const hex = THEMES[themeKey(C)][1];
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const dim = rgb.map((v, i) => Math.round(v * .25 + [12, 17, 32][i] * .75));
  const st = document.documentElement.style;
  st.setProperty("--moon", hex);
  st.setProperty("--moonrgb", rgb.join(","));
  st.setProperty("--moondim", "rgb(" + dim.join(",") + ")");
}

/* ================= RECURSOS DE CLASSE (5e 2014) ================= */
const RULES_V = 1;
const byLevel = (lvl, table) => table.reduce((v, [l, x]) => lvl >= l ? x : v, 0);
const featNamed = (ch, rx) => ch.features.find(f => rx.test(f.name.trim()));
const lvlOf = (ch, name) => classLevel(ch, new RegExp("^" + name + "$", "i"));
const subOf = (ch, name) => (ch.classes.find(c => new RegExp("^" + name + "$", "i").test(c.name)) || {}).subclass || "";
const atLeast1 = n => Math.max(1, n);

/* Usos que o PDF/arquivo nem sempre escreve no título da feature ("Rage (3/Long Rest)").
   max 0 = sem limite; only = só ajusta se a feature já existir (talentos). */
function classResources(ch) {
  const L = n => lvlOf(ch, n), out = [];
  const b = L("barbarian"), bd = L("bard"), cl = L("cleric"), f = L("fighter"), m = L("monk"), p = L("paladin"),
    s = L("sorcerer"), w = L("wizard"), ar = L("artificer");
  if (b) out.push({rx: /^rage$/i, name: "Rage", max: b >= 20 ? 0 : byLevel(b, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), per: "long", act: ["bonus"],
    text: "On your turn, you can enter a rage as a bonus action. It lasts for 1 minute."});
  if (bd) out.push({rx: /^bardic inspiration$/i, name: "Bardic Inspiration", max: atLeast1(abilMod(ch, "cha")), per: bd >= 5 ? "short" : "long", fixPer: true, act: ["bonus"],
    text: `Inspire one creature other than yourself within 60 feet of you who can hear you. It gains one Bardic Inspiration die, a d${bardDie(bd)}.`});
  if (cl >= 2) out.push({rx: /^channel divinity$/i, name: "Channel Divinity", max: byLevel(cl, [[2, 1], [6, 2], [18, 3]]), per: "short"});
  else if (p >= 3) out.push({rx: /^channel divinity$/i, name: "Channel Divinity", max: 1, per: "short"});
  if (f) {
    out.push({rx: /^second wind$/i, name: "Second Wind", max: 1, per: "short", act: ["bonus"], text: `On your turn, you can use a bonus action to regain hit points equal to 1d10 + ${f}.`});
    if (f >= 2) out.push({rx: /^action surge$/i, name: "Action Surge", max: f >= 17 ? 2 : 1, per: "short", text: "On your turn, you can take one additional action."});
    if (f >= 9) out.push({rx: /^indomitable$/i, name: "Indomitable", max: byLevel(f, [[9, 1], [13, 2], [17, 3]]), per: "long", text: "You can reroll a saving throw that you fail. You must use the new roll."});
    if (f >= 3 && /battle master/i.test(subOf(ch, "fighter"))) out.push({rx: /^(combat superiority|superiority dice)$/i, name: "Superiority Dice",
      max: byLevel(f, [[3, 4], [7, 5], [15, 6]]), per: "short", text: `You have superiority dice, which are d${f >= 18 ? 12 : f >= 10 ? 10 : 8}s.`});
  }
  if (m >= 2) out.push({rx: /^ki( points)?$/i, name: "Ki", max: m, per: "short", text: "Flurry of Blows, Patient Defense and Step of the Wind cost 1 ki point each."});
  if (p) {
    out.push({rx: /^lay on hands/i, name: "Lay on Hands", max: 5 * p, per: "long", act: ["action"], text: `You have a pool of healing power that restores ${5 * p} hit points per long rest.`});
    out.push({rx: /^divine sense$/i, name: "Divine Sense", max: 1 + Math.max(0, abilMod(ch, "cha")), per: "long", act: ["action"]});
  }
  if (s >= 2) out.push({rx: /^(font of magic|sorcery points)$/i, name: "Sorcery Points", max: s, per: "long", text: "You can transform spell slots into sorcery points and back."});
  out.push({rx: /^metamagic adept$/i, max: 2, per: "long", only: true});
  if (w) out.push({rx: /^arcane recovery$/i, name: "Arcane Recovery", max: 1, per: "long",
    text: `Once per day when you finish a short rest, you can recover expended spell slots with a combined level up to ${Math.ceil(w / 2)} (none of 6th level or higher).`});
  if (ar >= 7) out.push({rx: /^flash of genius$/i, name: "Flash of Genius", max: atLeast1(abilMod(ch, "int")), per: "long", act: ["reaction"]});
  return out;
}
const bardDie = l => l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6;

/* Cria ou completa os recursos. Idempotente: roda na importação, na migração e ao mudar de nível. */
function applyClassRules(ch) {
  const dismissed = ch.meta.dismissed || [];
  classResources(ch).forEach(r => {
    let f = ch.features.find(x => r.rx.test(x.name.trim()));
    if (!f) {
      if (r.only || !r.max || dismissed.includes(r.name)) return;
      f = {id: I.uid(), name: r.name, text: r.text || "", uses: null, act: r.act || [], group: "feature", auto: true};
      ch.features.push(f);
    }
    if (!r.max) { f.uses = null; return; }
    if (!f.uses || f.auto || f.autoUses) {
      if (!f.uses) f.autoUses = true;
      f.uses = {max: r.max, per: r.per, used: Math.min(r.max, f.uses ? f.uses.used : 0)};
    }
    if (r.fixPer) f.uses.per = r.per;
    if (!f.text && r.text) f.text = r.text;
    if (!f.act.length && r.act) f.act = r.act.slice();
  });
  ch.meta.rulesV = RULES_V;
}
const sorceryFeature = ch => featNamed(ch, /^(font of magic|sorcery points)$/i);
const arcaneRecovery = ch => lvlOf(ch, "wizard") ? featNamed(ch, /^arcane recovery$/i) : null;

/* ================= ESTADOS ATIVOS ================= */
/* Ligados a uma feature (gasta um uso ao ativar) ou a uma magia (Shield). ac/speed entram na faixa de números. */
const STATES = [
  {key: "rage", name: "Fúria", rx: /^rage$/i, act: "bonus",
    eff: ch => [`+${rageDmg(ch)} de dano em ataques corpo a corpo com FOR`, "Vantagem em testes e salvaguardas de FOR",
      "Resistência a dano contundente, cortante e perfurante", "Não conjura nem mantém concentração", "Dura 1 minuto"]},
  {key: "bladesong", name: "Canção da Lâmina", rx: /^bladesong$/i, act: "bonus", ac: ch => atLeast1(abilMod(ch, "int")), speed: () => 10,
    eff: ch => [`+${atLeast1(abilMod(ch, "int"))} na CA e em salvaguardas de CON para concentração`, "+3 m (10 ft) de deslocamento",
      "Vantagem em testes de DES (Acrobacia)", "Sem armadura média/pesada nem escudo", "Dura 1 minuto"]},
  {key: "giant", name: "Poder do Gigante", rx: /^giant.s might$/i, act: "bonus",
    eff: () => ["Fica Grande (se for menor)", "Vantagem em testes e salvaguardas de FOR", "+1d6 de dano uma vez por turno com arma", "Dura 1 minuto"]},
  {key: "hexcurse", name: "Maldição do Hexblade", rx: /^hexblade.s curse$/i, act: "bonus",
    eff: ch => [`+${profB(ch)} de dano contra o alvo amaldiçoado`, "Crítico com 19 ou 20 contra o alvo",
      `Se o alvo morrer: recupera ${lvlOf(ch, "warlock") + abilMod(ch, "cha")} PV`, "Dura 1 minuto"]},
  {key: "shield", name: "Escudo Arcano", spell: /^shield$/i, act: "reaction", ac: () => 5, turn: true,
    eff: () => ["+5 na CA até o início do seu próximo turno", "Imune a Míssil Mágico"]},
  {key: "dodge", name: "Esquiva", basic: true, act: "action", turn: true,
    eff: () => ["Ataques contra você têm desvantagem", "Vantagem em salvaguardas de DES", "Até o início do seu próximo turno"]}
];
const rageDmg = ch => { const b = lvlOf(ch, "barbarian"); return b >= 16 ? 4 : b >= 9 ? 3 : 2; };
const stateDef = key => STATES.find(s => s.key === key);
const isOn = (ch, key) => ch.states.includes(key);
const availableStates = ch => STATES.filter(s => s.rx && featNamed(ch, s.rx));
function stateBonus(ch, what) { return ch.states.reduce((a, k) => { const s = stateDef(k); return a + (s && s[what] ? s[what](ch) : 0); }, 0); }
const curAC = ch => ch.ac + stateBonus(ch, "ac");
const curSpeed = ch => {
  if (ch.conditions.some(c => /grappled|restrained|paralyzed|petrified|stunned|unconscious/.test(c)) || ch.exhaustion >= 5) return 0;
  const v = ch.speed.walk + stateBonus(ch, "speed");
  return ch.exhaustion >= 2 ? Math.floor(v / 2) : v;
};

/* ================= CONDIÇÕES ================= */
/* [chave, nome, regra, efeito automático nas rolagens: atk/chk/save = -1 desvantagem, +1 vantagem] */
const CONDITIONS = [
  ["blinded", "Cego", "Falha automática em testes que dependem de visão. Ataques contra você têm vantagem e os seus têm desvantagem.", {atk: -1}],
  ["charmed", "Enfeitiçado", "Não pode atacar quem o enfeitiçou nem mirá-lo com efeitos nocivos. Ele tem vantagem em testes sociais com você."],
  ["deafened", "Surdo", "Falha automática em testes que dependem de audição."],
  ["frightened", "Amedrontado", "Desvantagem em testes e ataques enquanto a fonte do medo estiver à vista. Não pode se aproximar dela por vontade própria.", {atk: -1, chk: -1}],
  ["grappled", "Agarrado", "Deslocamento 0. Termina se quem agarra ficar incapacitado ou se um efeito afastar vocês."],
  ["incapacitated", "Incapacitado", "Não pode realizar ações nem reações."],
  ["invisible", "Invisível", "Não pode ser visto sem magia ou sentido especial. Seus ataques têm vantagem e os ataques contra você têm desvantagem.", {atk: 1}],
  ["paralyzed", "Paralisado", "Incapacitado; não se move nem fala. Falha em salvaguardas de FOR e DES. Ataques contra você têm vantagem; acerto a 1,5 m é crítico."],
  ["petrified", "Petrificado", "Vira pedra: incapacitado, resistência a todo dano, imune a veneno e doença. Falha em salvaguardas de FOR e DES."],
  ["poisoned", "Envenenado", "Desvantagem em jogadas de ataque e testes de habilidade.", {atk: -1, chk: -1}],
  ["prone", "Caído", "Só rasteja. Desvantagem nos seus ataques. Ataques a 1,5 m contra você têm vantagem; à distância, desvantagem. Levantar custa metade do deslocamento.", {atk: -1}],
  ["restrained", "Contido", "Deslocamento 0. Desvantagem em ataques e em salvaguardas de DES. Ataques contra você têm vantagem.", {atk: -1, dexsave: -1}],
  ["stunned", "Atordoado", "Incapacitado; não se move e mal fala. Falha em salvaguardas de FOR e DES. Ataques contra você têm vantagem."],
  ["unconscious", "Inconsciente", "Incapacitado, cai e larga o que segura. Falha em salvaguardas de FOR e DES. Ataques contra você têm vantagem; acerto a 1,5 m é crítico."]
];
const EXHAUSTION = ["", "Desvantagem em testes de habilidade", "Deslocamento pela metade", "Desvantagem em ataques e salvaguardas",
  "PV máximo pela metade", "Deslocamento 0", "Morte"];
const condName = k => (CONDITIONS.find(c => c[0] === k) || [k, k])[1];

/* Vantagem/desvantagem automática: condições, exaustão e estados. kind: atk | chk | save; ab: atributo; skill: perícia. */
function autoMode(ch, kind, ab, skill) {
  const adv = [], dis = [];
  ch.conditions.forEach(k => {
    const c = CONDITIONS.find(x => x[0] === k), e = c && c[3];
    if (!e) return;
    const v = e[kind] || (kind === "save" && ab === "dex" ? e.dexsave : 0);
    if (v > 0) adv.push(c[1]); else if (v < 0) dis.push(c[1]);
  });
  if (ch.exhaustion >= 1 && kind === "chk") dis.push("Exaustão");
  if (ch.exhaustion >= 3 && kind !== "chk") dis.push("Exaustão");
  if ((isOn(ch, "rage") || isOn(ch, "giant")) && ab === "str" && kind !== "atk") adv.push(isOn(ch, "rage") ? "Fúria" : "Poder do Gigante");
  if (isOn(ch, "bladesong") && skill === "Acrobatics") adv.push("Canção da Lâmina");
  if (isOn(ch, "dodge") && kind === "save" && ab === "dex") adv.push("Esquiva");
  return {adv, dis};
}

/* ================= ROLAGENS ================= */
const die = n => 1 + Math.floor(Math.random() * n);
const halflingLucky = ch => ch.features.some(f => /^lucky$/i.test(f.name.trim()) && !f.uses && /roll a 1/i.test(f.text));
/* Rola um d20 com o modo manual (UI.rollMode) somado ao automático; o modo manual vale só para esta rolagem. */
function rollD20(ch, kind, ab, skill, opt) {
  opt = opt || {};
  const a = autoMode(ch, kind, ab, skill);
  if (UI.rollMode === "adv") a.adv.push("escolhida"); else if (UI.rollMode === "dis") a.dis.push("escolhida");
  UI.rollMode = "normal";
  const mode = a.adv.length && !a.dis.length ? "adv" : a.dis.length && !a.adv.length ? "dis" : "normal";
  const notes = [];
  const one = () => { let r = die(20); if (r === 1 && halflingLucky(ch)) { notes.push("Sortudo: o 1 foi rolado de novo"); r = die(20); } return r; };
  const rolls = mode === "normal" ? [one()] : [one(), one()];
  let nat = mode === "adv" ? Math.max(...rolls) : mode === "dis" ? Math.min(...rolls) : rolls[0];
  if (opt.reliable && nat < 10) { notes.push("Talento Confiável: d20 vira 10"); nat = 10; }
  if (mode !== "normal") notes.unshift((mode === "adv" ? "vantagem" : "desvantagem") + " (" + (mode === "adv" ? a.adv : a.dis).join(", ") + ")");
  else if (a.adv.length && a.dis.length) notes.unshift("vantagem e desvantagem se anulam");
  return {nat, rolls, mode, notes};
}
const d20Text = r => "d20 " + (r.rolls.length > 1 ? "(" + r.rolls.join(", ") + ")" : r.rolls[0]);

/* Rola uma expressão de dano. crit dobra os dados. Retorna {total, detail}. */
function rollDmg(expr, crit) {
  const e = String(expr || "").replace(/\s+/g, "");
  return rollDice(crit ? e.replace(/(\d*)d(\d+)/g, (_, n, s) => (2 * (+n || 1)) + "d" + s) : e);
}
function pushLog(title, total, detail) {
  C.log.unshift({t: Date.now(), title, total, detail});
  C.log = C.log.slice(0, 30);
}
/* Toast grande de rolagem. lines: [{label, total, detail, crit, fail}]; btns: HTML de botões (deixa o toast clicável). */
function showRoll(title, lines, btns) {
  lines.forEach(l => pushLog(title + (l.label ? " · " + l.label : ""), l.total, l.detail));
  save();
  toast(`<div class="rt-title">${esc(title)}</div>` + lines.map(l => `<div class="rt-line"><span>${esc(l.label || "")}</span>
    <b class="rt-num ${l.crit ? "crit" : l.fail ? "fail" : ""}">${l.total}</b><span class="rt-detail">${l.detail}</span></div>`).join("") +
    (btns ? `<div class="row wrap gap6 mt8">${btns}</div>` : ""), "long roll" + (btns ? " act" : ""));
  if (UI.sheet && UI.sheet.type === "dice") renderSheet();
}

/* Testes a partir da ficha: perícia, salvaguarda, atributo, iniciativa. */
function rollTest(kind, key) {
  let bonus = 0, title = "", ab = null, skill = null, k = "chk", opt = {};
  if (kind === "skill") {
    skill = key; ab = (I.SKILLS.find(s => s[0] === key) || [0, "int"])[1]; bonus = skillTotal(C, key); title = SKILL_PT[key] || key;
    opt.reliable = C.skills[key].prof && featNamed(C, /^reliable talent$/i);
  } else if (kind === "save") { ab = key; k = "save"; bonus = saveTotal(C, key); title = "Salvaguarda de " + ABIL_SHORT[key]; }
  else if (kind === "abil") { ab = key; bonus = abilMod(C, key); title = "Teste de " + ABIL.find(a => a[0] === key)[2]; }
  else { ab = "dex"; bonus = initiative(C); title = "Iniciativa"; }
  const r = rollD20(C, k, ab, skill, opt);
  const total = r.nat + bonus;
  if (kind === "init") { startCombat(); C.turn.init = total; commit(); }
  showRoll(title, [{total, detail: d20Text(r) + fm(bonus) + (r.notes.length ? " · " + r.notes.join(" · ") : "") +
    (r.nat === 20 && kind === "save" ? " · 20 natural" : ""), crit: r.nat === 20, fail: r.nat === 1}]);
}

/* ================= EXTRAS DE DANO ================= */
/* Somam-se ao ataque que você rolar. def: ligado por padrão; once: desliga sozinho depois de usado no turno. */
function damageExtras(ch) {
  const out = [], f = rx => featNamed(ch, rx);
  const sa = f(/^sneak attack$/i), rog = lvlOf(ch, "rogue");
  if (sa || rog) out.push({key: "sneak", label: "Ataque Furtivo", dice: ((sa && sa.text.match(/(\d+)d6/)) || [0, Math.ceil(rog / 2)])[1] + "d6", once: true});
  const ds = f(/^divine strike$/i);
  if (ds) out.push({key: "dstrike", label: "Golpe Divino", dice: (ds.text.match(/(\d+d8)/) || [0, lvlOf(ch, "cleric") >= 14 ? "2d8" : "1d8"])[1], once: true});
  if (lvlOf(ch, "paladin") >= 2) out.push({key: "smite", label: "Destruição Divina", smite: true});
  if (f(/^great weapon master$/i)) out.push({key: "gwm", label: "Great Weapon Master", flat: 10, hit: -5});
  if (f(/^sharpshooter$/i)) out.push({key: "ss", label: "Sharpshooter", flat: 10, hit: -5});
  if (isOn(ch, "rage")) out.push({key: "rage", label: "Fúria", flat: rageDmg(ch), def: true});
  const sv = f(/^song of victory$/i);
  if (sv && isOn(ch, "bladesong")) out.push({key: "victory", label: "Song of Victory", flat: +((sv.text.match(/add (\d+)/) || [])[1] || atLeast1(abilMod(ch, "int"))), def: true});
  if (isOn(ch, "giant")) out.push({key: "giant", label: "Poder do Gigante", dice: "1d6", once: true, def: true});
  if (isOn(ch, "hexcurse")) out.push({key: "hexcurse", label: "Maldição", flat: profB(ch), def: true});
  if (/^hex$/i.test(ch.concentration)) out.push({key: "hex", label: "Hex", dice: "1d6", def: true});
  if (/hunter.s mark/i.test(ch.concentration)) out.push({key: "hm", label: "Hunter's Mark", dice: "1d6", def: true});
  return out;
}
const extraOn = x => UI.ext[x.key] != null ? UI.ext[x.key] : (x.smite ? 0 : !!x.def);
const smiteDice = (lvl, ch) => Math.min(5, 1 + lvl) + "d8";

/* Rola um ataque da lista: d20 + bônus, dano com extras ligados, crítico dobra os dados. */
function rollAttack(a) {
  const extras = damageExtras(C).filter(extraOn);
  const hitMod = extras.reduce((s, x) => s + (x.hit || 0), 0);
  const bonus = (parseInt((a.attack || "").replace(/[^\d+-]/g, ""), 10) || 0) + hitMod;
  const r = rollD20(C, "atk");
  const critRange = isOn(C, "hexcurse") ? 19 : 20;
  const crit = r.nat >= critRange, miss = r.nat === 1;
  const lines = [{label: "Ataque", total: r.nat + bonus, detail: d20Text(r) + fm(bonus) + (r.notes.length ? " · " + r.notes.join(" · ") : "") +
    (crit ? " · CRÍTICO" : miss ? " · falha crítica" : ""), crit, fail: miss}];
  const dm = (a.damage || "").match(/\d+d\d+(?:\s*[+-]\s*\d+)?/);
  if (dm) {
    const base = rollDmg(dm[0], crit);
    let total = base.total;
    const parts = [base.detail + " " + esc((a.damage || "").replace(dm[0], "").trim())];
    extras.forEach(x => {
      if (x.smite) {
        const l = UI.ext.smite;
        if (C.slots[l - 1] - C.slotsUsed[l - 1] <= 0) return;
        C.slotsUsed[l - 1]++;
        const d = rollDmg(smiteDice(l), crit); total += d.total; parts.push(`Destruição ${ORD(l)} ${d.detail}`);
        UI.ext.smite = 0;
        return;
      }
      if (x.dice) { const d = rollDmg(x.dice, crit); total += d.total; parts.push(x.label + " " + d.detail); }
      if (x.flat) { total += x.flat; parts.push(x.label + " +" + x.flat); }
      if (x.once) UI.ext[x.key] = false;
    });
    lines.push({label: "Dano", total, detail: parts.join(" · ")});
  }
  markAttack();
  commit();
  showRoll(a.name, lines);
}

/* ================= MAGIAS: DANO, CURA, ATAQUE, SALVAGUARDA ================= */
const WORD_N = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6};
const ABIL_FROM_EN = {strength: "FOR", dexterity: "DES", constitution: "CON", intelligence: "INT", wisdom: "SAB", charisma: "CAR"};
function castMod(ch, sp) {
  const c = castingFor(ch, sp);
  const ab = c && ABIL_BY_NAME[(c.ability || "").toLowerCase()];
  return ab ? abilMod(ch, ab) : Math.max(abilMod(ch, "int"), abilMod(ch, "wis"), abilMod(ch, "cha"));
}
/* Lê o texto da magia (inglês, do PDF ou do SRD) e monta a rolagem para o nível de espaço usado. */
function spellPlan(ch, sp, info, slot) {
  const t = (info.desc || "").replace(/\*\*/g, "");
  const lv = totalLevel(ch), sm = castMod(ch, sp);
  const plan = {atk: /(ranged|melee) spell attack/i.test(t), half: /half as much damage/i.test(t), save: "", rolls: [], heal: null, notes: []};
  const sv = t.match(/(?:make|succeed on|must make|must succeed on) an? (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i);
  if (sv) plan.save = ABIL_FROM_EN[sv[1].toLowerCase()];
  const tier = 1 + (lv >= 5) + (lv >= 11) + (lv >= 17);
  const cantripScales = sp.level === 0 && /5th level/i.test(t);
  const hl = t.match(/increases? by (\d+)d(\d+) for (each|every two) slot levels? above/i);
  const hlFlat = t.match(/increases? by (\d+) for each slot level above/i);
  const up = sp.level > 0 && slot > sp.level ? slot - sp.level : 0;
  const upDice = (n, s) => hl && +hl[2] === s ? n + +hl[1] * (hl[3] === "every two" ? Math.floor(up / 2) : up) : n;
  const heal = t.match(/regains? (?:a number of )?hit points equal to (\d+)d(\d+)(\s*\+\s*your spellcasting ability modifier)?/i) ||
    t.match(/regains? (\d+)d(\d+)(\s*\+\s*your spellcasting ability modifier)? hit points/i);
  const healFix = !heal && t.match(/regain (\d+) hit points/i);
  if (heal || healFix) {
    const dice = heal ? upDice(+heal[1], +heal[2]) + "d" + heal[2] : "";
    let flat = heal ? (heal[3] ? sm : 0) : +healFix[1] + (hlFlat ? +hlFlat[1] * up : 0);
    if (slot > 0 && featNamed(ch, /^disciple of life$/i)) { flat += 2 + slot; plan.notes.push(`Disciple of Life +${2 + slot}`); }
    plan.heal = {dice, flat};
    if (slot > 0 && featNamed(ch, /^blessed healer$/i)) plan.blessed = 2 + slot;
    return plan;
  }
  /* vários projéteis: "You create three rays/darts..." + "one more dart for each slot level above" */
  const proj = t.match(/creates? (\w+) [^.]*?\b(darts?|missiles?|rays?|bolts?)\b/i);
  let count = proj ? (WORD_N[proj[1].toLowerCase()] || +proj[1] || 1) : 1;
  if (proj && /(one|an) (?:additional|more) (dart|ray|missile|bolt)/i.test(t)) count += up;
  const darts = t.match(/dart deals (\d+d\d+) \+ (\d+)/i);
  if (darts) {
    plan.rolls.push({label: count + " dardos", expr: Array(count).fill(darts[1] + "+" + darts[2]).join("+"), type: "force"});
    return plan;
  }
  const dm = t.match(/(\d+)d(\d+)(\s*\+\s*your spellcasting ability modifier)?\s+(\w+) damage/i) ||
    t.match(/(\w+) damage equal to (\d+)d(\d+)(\s*\+\s*your spellcasting ability modifier)?/i);
  if (!dm) return plan.atk || plan.save ? plan : null;
  const swap = !/^\d+$/.test(dm[1]);
  let n = +(swap ? dm[2] : dm[1]);
  const sides = +(swap ? dm[3] : dm[2]), plusMod = swap ? dm[4] : dm[3], type = swap ? dm[1] : dm[4];
  n = cantripScales ? n * tier : upDice(n, sides);
  let flat = plusMod ? sm : 0;
  const beams = sp.level === 0 && /two beams at 5th level/i.test(t) ? tier : plan.atk ? count : 1;
  if (/eldritch blast/i.test(sp.name)) {
    const ag = ch.features.find(f => /agonizing blast/i.test(f.text) || /agonizing blast/i.test(f.name));
    if (ag) { flat += +((ag.text.match(/agonizing blast\.?\*?\*?\s*when you cast eldritch blast, add (\d+)/i) || [])[1] || Math.max(0, abilMod(ch, "cha"))); plan.notes.push("Agonizing Blast"); }
  }
  for (let i = 0; i < beams; i++) plan.rolls.push({label: beams > 1 ? "Raio " + (i + 1) : "", expr: n + "d" + sides + (flat ? "+" + flat : ""), type: type.toLowerCase()});
  if (/or take 1d12|instead takes 1d12/i.test(t)) plan.notes.push("1d12 se o alvo já estiver ferido");
  return plan;
}
const DMG_PT = {acid: "ácido", bludgeoning: "contundente", cold: "frio", fire: "fogo", force: "energia", lightning: "elétrico", necrotic: "necrótico",
  piercing: "perfurante", poison: "veneno", psychic: "psíquico", radiant: "radiante", slashing: "cortante", thunder: "trovejante"};

/* Rola o que a magia pede e mostra no toast. slot = nível do espaço (0 para truque / sem espaço). */
function rollSpell(sp, slot) {
  const info = spellInfo(sp);
  const plan = spellPlan(C, sp, info, slot || sp.level);
  if (!plan) return false;
  const c = castingFor(C, sp) || {};
  const atkB = parseInt(String(c.attack || "").replace(/[^\d+-]/g, ""), 10) || (profB(C) + castMod(C, sp));
  const lines = [];
  const lvTxt = sp.level ? " (" + ORD(slot || sp.level) + ")" : "";
  if (plan.heal) {
    const r = plan.heal.dice ? rollDice(plan.heal.dice) : {total: 0, detail: ""};
    const total = r.total + plan.heal.flat;
    lines.push({label: "Cura", total, detail: (plan.heal.dice ? plan.heal.dice + " " + r.detail : "") + (plan.heal.flat ? " +" + plan.heal.flat : "") +
      (plan.notes.length ? " · " + plan.notes.join(" · ") : "")});
    const btns = `<button class="chip on" data-act="healme:${total}">Curar a mim (+${total})</button>` +
      (plan.blessed ? `<button class="chip" data-act="healme:${plan.blessed}">Curei outro: Blessed Healer +${plan.blessed} em mim</button>` : "");
    showRoll(sp.name + lvTxt, lines, btns);
    return true;
  }
  if (plan.atk) {
    const manual = UI.rollMode;
    (plan.rolls.length ? plan.rolls : [{}]).forEach(ro => {
      UI.rollMode = manual;
      const r = rollD20(C, "atk");
      ro.crit = r.nat === 20;
      lines.push({label: "Ataque" + (ro.label ? " · " + ro.label : ""), total: r.nat + atkB, detail: d20Text(r) + fm(atkB) + (r.notes.length ? " · " + r.notes.join(" · ") : "") +
        (r.nat === 20 ? " · CRÍTICO" : r.nat === 1 ? " · falha crítica" : ""), crit: r.nat === 20, fail: r.nat === 1});
    });
  }
  if (plan.save) lines.push({label: "Salvaguarda", total: "CD " + (c.dc || 8 + profB(C) + castMod(C, sp)), detail: plan.save + " do alvo"});
  plan.rolls.forEach(ro => {
    const r = rollDmg(ro.expr, ro.crit);
    lines.push({label: "Dano" + (ro.label ? " · " + ro.label : ""), total: r.total, detail: r.detail + " " + (DMG_PT[ro.type] || ro.type) +
      (plan.half ? " · metade se passar" : "") + (plan.notes.length ? " · " + plan.notes.join(" · ") : "")});
  });
  if (!lines.length) return false;
  showRoll(sp.name + lvTxt, lines);
  return true;
}

/* ================= TURNO ================= */
function startCombat() {
  if (!C.turn.round) C.turn = {round: 1, action: false, bonus: false, reaction: false, move: false, attacks: 0};
}
function nextTurn() {
  const T = C.turn;
  Object.assign(T, {round: (T.round || 0) + 1, action: false, bonus: false, reaction: false, move: false, attacks: 0, bonusSpell: false, slotSpell: false});
  C.features.forEach(f => { if (f.uses && f.uses.per === "turn") f.uses.used = 0; });
  C.states = C.states.filter(k => !(stateDef(k) || {}).turn);
  damageExtras(C).forEach(x => { if (x.once) UI.ext[x.key] = undefined; });
}
function endCombat() {
  C.turn = {round: 0, action: false, bonus: false, reaction: false, move: false, attacks: 0};
  C.states = [];
}
/* Marca o uso no turno (só durante o combate). */
function markUse(kind) { if (C.turn.round && kind && kind !== "other") C.turn[kind] = true; }
function markAttack() {
  if (!C.turn.round) return;
  C.turn.attacks = (C.turn.attacks || 0) + 1;
  if (C.turn.attacks >= (C.attacksPerAction || 1)) C.turn.action = true;
}
