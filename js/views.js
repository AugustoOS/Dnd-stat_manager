"use strict";
/* ================= ÍCONES / PEÇAS ================= */
const moonSVG = (filled, size) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
     <circle cx="12" cy="12" r="9" fill="${filled ? "var(--moon)" : "var(--moondim)"}"
       stroke="${filled ? "var(--moon)" : "rgba(233,216,166,.35)"}" stroke-width="1.5"/>
     ${filled ? '<circle cx="9.5" cy="9" r="2" fill="rgba(12,17,32,.18)"/>' : ""}</svg>`;
const num = (act, val, w) => `<input type="number" inputmode="numeric" value="${val}" data-num="${act}" style="width:${w || 64}px">`;
const pips = (act, max, used, size) => Array.from({length: max}, (_, i) =>
  `<button class="moon" data-act="${act}:${i}" aria-label="uso ${i + 1}">${moonSVG(i < max - used, size || 24)}</button>`).join("");
const tag = (t, cls) => `<span class="tag ${cls || ""}">${t}</span>`;
const chev = open => `<span class="chev ${open ? "open" : ""}">›</span>`;
const SPEED_ICON = {fly: "voo", swim: "nado", climb: "escalada", burrow: "escavação"};

function render() {
  const y = window.scrollY;
  const app = document.getElementById("app");
  const nav = document.querySelector("nav");
  if (!C) {
    nav.style.display = "none";
    document.getElementById("cname").textContent = "Stat Manager D&D 5e";
    document.getElementById("subtitle").textContent = "Nenhuma ficha carregada";
    app.innerHTML = welcomeView();
    renderSheet();
    return;
  }
  nav.style.display = "";
  const showForms = formModes(C).length > 1;
  document.querySelector('nav [data-tab="forms"]').style.display = showForms ? "" : "none";
  if (UI.tab === "forms" && !showForms) UI.tab = "combat";
  app.innerHTML = UI.tab === "combat" ? combatTab() : UI.tab === "spells" ? spellsTab() : UI.tab === "forms" ? formsTab() : sheetTab();
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.tab === UI.tab));
  document.getElementById("cname").textContent = C.name;
  document.getElementById("subtitle").textContent = classLine(C) + " · nível " + totalLevel(C);
  window.scrollTo(0, y);
  renderSheet();
}
const classLine = ch => ch.classes.length ? ch.classes.map(c => c.name + (c.subclass ? " (" + c.subclass + ")" : "") + (ch.classes.length > 1 ? " " + c.level : "")).join(" / ") : "Sem classe";

function welcomeView() {
  return `<div class="card hero">
    <div class="h1">Seu gerenciador de fichas</div>
    <p class="hint">Carregue uma ficha para controlar vida, recursos, magias e formas durante a sessão. Tudo fica salvo neste aparelho.</p>
    <button class="big primary" data-act="import">Importar ficha</button>
  </div>
  ${importOptions()}
  ${!UI.storageOK ? `<div class="hint warn">Este navegador bloqueou o salvamento. Abra pelo Safari / tela de início.</div>` : ""}`;
}
function importOptions() {
  return `<div class="card"><span class="lbl">Formas de carregar</span>
    <div class="opts">
      <button class="opt" data-act="pick:pdf"><b>PDF do Aurora</b><span>Recomendado. Lê a ficha inteira: atributos, features, itens, magias preparadas com descrição.</span></button>
      <button class="opt" data-act="pick:xml"><b>Arquivo do Aurora (.dnd5e / .xml)</b><span>Lê classes, magias, itens e sintonização. Sem descrições: o app completa com o SRD.</span></button>
      <button class="opt" data-act="pick:pdf"><b>PDF de outra ficha</b><span>Ficha oficial preenchível da WotC ou exportada do D&D Beyond (melhor esforço).</span></button>
      <button class="opt" data-act="pick:json"><b>Backup deste app (.json)</b><span>Restaura fichas salvas em outro aparelho.</span></button>
      <button class="opt" data-act="paste"><b>Colar backup (texto)</b><span>Cole o texto copiado na aba Ficha de outro aparelho.</span></button>
      <button class="opt" data-act="blank"><b>Ficha em branco</b><span>Preencha tudo à mão.</span></button>
    </div></div>`;
}

/* ================= COMBATE ================= */
function combatTab() {
  let h = statsStrip();
  h += hpCard();
  h += formsCard();
  h += resourcesCard();
  h += actionsCard();
  h += equipmentCard();
  h += deathCard();
  return h;
}
function statsStrip() {
  const cast = C.casting[0];
  const sp = C.speed;
  const extra = ["fly", "swim", "climb", "burrow"].filter(k => sp[k] > 0).map(k => SPEED_ICON[k] + " " + sp[k]).join(" · ");
  let h = `<div class="strip">
    <div><span>CA</span><b>${C.ac}</b></div>
    <div><span>Inic.</span><b>${fm(initiative(C))}</b></div>
    <div><span>Desl.</span><b>${sp.walk}</b></div>
    <div><span>Perc.</span><b>${passivePerc(C)}</b></div>
    <div><span>Prof.</span><b>${fm(profB(C))}</b></div>
    ${cast && cast.dc ? `<div><span>CD</span><b>${cast.dc}</b></div>` : ""}
  </div>`;
  const lines = [];
  if (extra) lines.push("Deslocamento: " + extra);
  if (C.defenses) lines.push(esc(C.defenses));
  if (C.vision) lines.push(esc(C.vision));
  if (lines.length) h += `<div class="hint center">${lines.join(" · ")}</div>`;
  if (C.concentration) h += `<div class="conc"><span>◉ Concentrando em <b>${esc(C.concentration)}</b></span>
    <button data-act="endconc" aria-label="Encerrar concentração">Encerrar</button></div>`;
  return h;
}
function activeForm() { return C.forms.find(f => f.cur > 0) || null; }
function hpCard() {
  const {hp} = C;
  const pct = Math.round(hp.current / hp.max * 100);
  const col = pct > 50 ? "var(--green)" : pct > 25 ? "var(--moon)" : "var(--red)";
  const af = activeForm();
  return `<div class="card">
    <div class="row"><span class="lbl">Pontos de vida</span>
      <span class="row gap6 muted small">temp ${num("hp.temp", hp.temp, 52)}</span></div>
    <div class="hpline">
      <span class="hpnum" style="color:${col}">${hp.current}</span>
      ${hp.temp > 0 ? `<span class="tempnum">+${hp.temp}</span>` : ""}
      <span class="muted big18">/</span>${num("hp.max", hp.max, 72)}</div>
    <div class="bar"><div style="width:${pct}%;background:${col}"></div></div>
    <div class="row gap8 mb10">
      ${[1, 5, 10].map(n => `<button class="amt ${UI.amt === n ? "on" : ""}" data-act="amt:${n}">${n}</button>`).join("")}
      ${num("amt", UI.amt, 64)}</div>
    <div class="row gap10">
      <button class="big dmg" data-act="dmg">− Dano</button>
      <button class="big heal" data-act="heal">+ Cura</button></div>
    ${af ? `<div class="hint center mt8">Dano e cura vão primeiro para a forma <b>${esc(af.name)}</b>.</div>` : ""}
  </div>`;
}
function formsCard() {
  const ws = wsInfo(C);
  if (!C.forms.length && !ws) {
    return `<div class="card"><div class="row"><span class="lbl">Vidas extras · formas</span>
      <button class="ghost" data-act="addform">+ Forma</button></div></div>`;
  }
  let h = `<div class="card"><div class="row"><span class="lbl">${ws ? "Forma atual" : "Vidas extras · formas"}</span>
    <div class="row gap6">${ws ? `<button class="ghost" data-act="tab:forms">Escolher forma</button>` : ""}
    <button class="ghost" data-act="addform">+</button></div></div>`;
  if (!C.forms.length) h += `<div class="hint mt8">Forma normal. ${ws ? `Wild Shape: feras até CR ${crText(ws.cr)}${ws.elemental ? " · elementais (2 usos)" : ""}.` : ""}</div>`;
  C.forms.forEach(f => {
    const pp = Math.round(f.cur / f.max * 100);
    const m = f.mon ? findMonster(f.mon) : null;
    h += `<div class="form">
      <div class="row"><button class="linkish serif17" data-act="${m ? "mon:" + encodeURIComponent(m.n) : "noop"}">${esc(f.name)} ${m ? chev(false) : ""}</button>
        <button class="x" data-act="delform:${f.id}" aria-label="Reverter">Reverter</button></div>
      ${m ? `<div class="hint">CA ${esc(m.ac)} · ${esc(m.sp)}</div>` : ""}
      <div class="row gap8 mt8">
        <button class="pm minus" data-act="form-:${f.id}">−</button>
        ${num("formcur:" + f.id, f.cur, 64)}<span class="muted">/</span>${num("formmax:" + f.id, f.max, 64)}
        <button class="pm plus" data-act="form+:${f.id}">+</button></div>
      <div class="bar mt8"><div style="width:${pp}%;background:${pp > 25 ? "var(--green)" : "var(--red)"}"></div></div>
      ${f.via ? `<div class="hint">${{ws: "Wild Shape", elemental: "Wild Shape elemental", shapechange: "Shapechange", polymorph: "Polymorph", manual: "manual"}[f.via] || ""}</div>` : ""}
    </div>`;
  });
  if (ws && ws.combat && C.forms.some(f => f.via === "ws" || f.via === "elemental") && slotLevels().length) {
    h += `<div class="sub mt8">Combat Wild Shape · ação bônus: gastar slot para curar 1d8 por nível</div>
      <div class="row wrap gap6 mt8">${slotLevels().map(l => `<button class="chip" data-act="wsheal:${l}">${ORD(l)} → ${l}d8</button>`).join("")}</div>`;
  }
  return h + `</div>`;
}
const slotLevels = () => C.slots.map((m, i) => (m - C.slotsUsed[i] > 0 ? i + 1 : 0)).filter(Boolean);

function resourcesCard() {
  let h = `<div class="card"><div class="row"><span class="lbl">Recursos</span><span class="hint">toque para gastar</span></div>`;
  const any = C.slots.some(Boolean);
  if (any) {
    C.slots.forEach((mx, idx) => {
      if (!mx) return;
      const used = C.slotsUsed[idx];
      h += `<div class="row res"><span class="rname ${used >= mx ? "muted" : ""}">${ORD(idx + 1)} nível</span>
        <div class="pips">${pips("slot:" + idx, mx, used, 26)}</div></div>`;
    });
  }
  if (C.pact) h += `<div class="row res"><span class="rname">Pacto (${ORD(C.pact.level)})</span>
    <div class="pips">${pips("pact", C.pact.max, C.pact.used, 26)}</div></div>`;
  C.features.filter(f => f.uses).forEach(f => {
    h += `<div class="row res"><span class="rname">${esc(f.name)} <small>${PER_PT[f.uses.per] || ""}</small></span>
      <div class="pips">${f.uses.max > 8 ? counter("feat", f.id, f.uses) : pips("feat:" + f.id, f.uses.max, f.uses.used, 24)}</div></div>`;
  });
  const ws = wsInfo(C);
  if (ws && ws.unlimited) h += `<div class="row res"><span class="rname">Wild Shape</span><span class="moonword">∞ Arquidruida</span></div>`;
  C.spells.filter(s => s.free).forEach(s => {
    h += `<div class="row res"><span class="rname">${esc(s.name)} <small>grátis · ${PER_PT[s.free.per] || ""}</small></span>
      <div class="pips">${pips("free:" + s.id, s.free.max, s.free.used, 24)}</div></div>`;
  });
  C.items.filter(i => i.charges).forEach(i => {
    h += `<div class="row res"><span class="rname">${esc(i.name)} <small>${i.charges.regain ? "recupera " + esc(i.charges.regain) + " ao amanhecer" : "cargas"}</small></span>
      ${counter("chg", i.id, i.charges)}</div>`;
  });
  C.hitDice.forEach((hd, i) => {
    h += `<div class="row res"><span class="rname">Dados de vida d${hd.die} <small>${hd.total - hd.used}/${hd.total}</small></span>
      <button class="chip" data-act="hd:${i}" ${hd.used >= hd.total ? "disabled" : ""}>Gastar 1d${hd.die}${fm(abilMod(C, "con"))}</button></div>`;
  });
  h += `<div class="row gap10 mt14">
      <button class="big soft" data-act="short">Descanso curto</button>
      <button class="big primary" data-act="long">Descanso longo</button></div></div>`;
  return h;
}
const counter = (kind, id, u) => `<div class="row gap6"><button class="pm sm minus" data-act="${kind}-:${id}">−</button>
  <span class="cnt">${u.max - u.used}<small>/${u.max}</small></span><button class="pm sm plus" data-act="${kind}+:${id}">+</button></div>`;

/* ---------- AÇÕES ---------- */
function actionsCard() {
  const t = UI.actTab;
  let h = `<div class="card"><div class="seg">${ACT_TABS.map(([k, l]) =>
    `<button class="${t === k ? "on" : ""}" data-act="acttab:${k}">${l}</button>`).join("")}</div><div class="list">`;
  const af = activeForm();
  const m = af && af.mon ? findMonster(af.mon) : null;
  if (m) {
    const key = t === "action" ? "a" : t === "reaction" ? "r" : t === "other" ? "l" : null;
    const list = key ? (m[key] || []) : [];
    if (list.length) {
      h += `<div class="sub">Forma: ${esc(m.n)}</div>`;
      list.forEach(([n, d], i) => {
        const id = "mon" + i + t, open = UI.open[id];
        const p = parseMonsterAttack(d);
        h += `<button class="li" data-act="open:${id}"><span class="lname">${esc(n)}</span>
          <span class="lmeta">${p.hit ? p.hit + " · " : ""}${esc(p.dmg || p.save)}</span>${chev(open)}</button>
          ${open ? `<div class="lbody">${rich(d)}</div>` : ""}`;
      });
      if (t === "action") h += `<div class="hint">Na forma de fera você não conjura magias com componente material e não usa equipamento que se fundiu à forma.</div>`;
    }
  }
  if (t === "action" && C.attacks.length) {
    h += `<div class="sub">Ataques${C.attacksPerAction > 1 ? ` · ${C.attacksPerAction} por ação Atacar` : ""}</div>`;
    C.attacks.forEach(a => {
      const open = UI.open["at:" + a.id];
      h += `<button class="li" data-act="open:at:${a.id}"><span class="lname">${esc(a.name)}</span>
        <span class="lmeta">${esc(a.attack)} · ${esc(a.damage)}</span>${chev(open)}</button>
        ${open ? `<div class="lbody">${a.range ? `<p>Alcance: ${esc(a.range)}</p>` : ""}${a.notes ? `<p>${esc(a.notes)}</p>` : ""}
          <div class="row gap6"><button class="chip" data-act="rollatk:${a.id}">Rolar</button><button class="chip" data-act="editatk:${a.id}">Editar</button></div></div>` : ""}`;
    });
  }
  /* magias por tempo de conjuração */
  const spells = C.spells.filter(s => (s.prepared || s.always || s.atWill || s.level === 0) && actionKind(spellInfo(s).castingTime) === t);
  if (spells.length) {
    h += `<div class="sub">Magias</div>`;
    spells.forEach(s => { h += spellRow(s, true); });
  }
  const feats = C.features.filter(f => t === "other" ? !f.act.length && (f.uses || f.text) : f.act.includes(t));
  if (feats.length) {
    h += `<div class="sub">${t === "other" ? "Características (passivas)" : "Características"}</div>`;
    feats.forEach(f => { h += featureRow(f); });
  }
  if (t === "action") {
    const usable = C.items.filter(i => i.qty > 0 && (/potion|elixir|oil of/i.test(i.name) || i.charges));
    if (usable.length) {
      h += `<div class="sub">Itens</div>`;
      usable.forEach(i => {
        h += `<div class="li static"><button class="linkish lname" data-act="item:${i.id}">${esc(i.name)}</button>
          <span class="lmeta">${i.charges ? (i.charges.max - i.charges.used) + " cargas" : "×" + i.qty}</span>
          <button class="chip" data-act="useitem:${i.id}">${i.charges ? "−1 carga" : "Usar"}</button></div>`;
      });
    }
  }
  const basic = BASIC[t];
  if (basic.length) {
    h += `<div class="sub">${t === "reaction" ? "Comum" : "Ações comuns"}</div><div class="row wrap gap6">` +
      basic.map(([n]) => `<button class="chip ${UI.open["b:" + n] ? "on" : ""}" data-act="open:b:${encodeURIComponent(n)}">${n}</button>`).join("") + `</div>`;
    const op = basic.find(([n]) => UI.open["b:" + n]);
    if (op) h += `<div class="hint mt8">${op[1]}</div>`;
  }
  if (t === "bonus") h += `<div class="hint mt8">Só uma ação bônus por turno. Se conjurar uma magia como ação bônus, a outra magia do turno só pode ser um truque de 1 ação.</div>`;
  return h + `</div></div>`;
}
function spellTags(s, info) {
  let t = "";
  if (s.level > 0) t += tag(ORD(s.level));
  if (info.conc) t += tag("C", "c");
  if (info.ritual) t += tag("R", "r");
  if (s.atWill) t += tag("à vontade", "g");
  else if (s.free) t += tag("grátis " + (s.free.max - s.free.used) + "/" + s.free.max, "g");
  if (s.source && s.cls === "Other") t += tag(esc(s.source));
  return t;
}
function spellRow(s, withCast) {
  const info = spellInfo(s);
  const key = "sp:" + s.id, open = UI.open[key];
  let h = `<button class="li" data-act="open:${key}"><span class="lname">${esc(s.name)} ${spellTags(s, info)}</span>
    <span class="lmeta">${esc(info.range)}</span>${chev(open)}</button>`;
  if (open) h += `<div class="lbody">${spellBody(s, info)}${withCast ? castButtons(s, info) : ""}</div>`;
  return h;
}
function spellBody(s, info) {
  const meta = [info.school ? (s.level ? ORD(s.level) + " nível · " : "Truque · ") + esc(info.school) : "",
    info.castingTime && "Conjuração: " + esc(info.castingTime), info.range && "Alcance: " + esc(info.range),
    info.components && "Componentes: " + esc(info.components), info.duration && "Duração: " + esc(info.duration)].filter(Boolean);
  let h = `<div class="meta">${meta.map(m => `<div>${m}</div>`).join("")}</div>`;
  if (info.desc) h += `<div class="desc">${rich(info.desc)}</div>`;
  else h += `<div class="hint">Sem descrição na ficha${window.SRD_SPELLS ? " nem no SRD" : ""}.</div>`;
  h += `<div class="row gap6 mt8"><span class="hint grow">${info.book ? esc(info.book) : ""}${info.src && info.src !== "ficha" ? " · " + esc(info.src) : ""}</span>
    <button class="chip" data-act="spelltext:${s.id}">${s.customDesc ? "Editar texto" : "Escrever texto"}</button></div>`;
  return h;
}
function castButtons(s, info) {
  const b = [];
  if (s.level === 0) b.push(`<button class="chip on" data-act="cast:${s.id}:0">Conjurar</button>`);
  else {
    if (s.atWill) b.push(`<button class="chip on" data-act="cast:${s.id}:w">À vontade</button>`);
    if (s.free && s.free.used < s.free.max) b.push(`<button class="chip on" data-act="cast:${s.id}:f">Grátis</button>`);
    for (let l = s.level; l <= 9; l++) {
      const mx = C.slots[l - 1];
      if (!mx) continue;
      const left = mx - C.slotsUsed[l - 1];
      b.push(`<button class="chip" data-act="cast:${s.id}:s${l}" ${left ? "" : "disabled"}>${ORD(l)} <small>(${left})</small></button>`);
    }
    if (C.pact && C.pact.level >= s.level) b.push(`<button class="chip" data-act="cast:${s.id}:p" ${C.pact.used < C.pact.max ? "" : "disabled"}>Pacto ${ORD(C.pact.level)} <small>(${C.pact.max - C.pact.used})</small></button>`);
    if (info.ritual) b.push(`<button class="chip" data-act="cast:${s.id}:r">Ritual (+10 min)</button>`);
  }
  return `<div class="castrow">${b.join("")}</div>`;
}
function featureRow(f) {
  const key = "ft:" + f.id, open = UI.open[key];
  const isWS = f === wsFeature(C);
  let h = `<div class="li static"><button class="linkish lname" data-act="open:${key}">${esc(f.name)} ${chev(open)}</button>
    ${f.uses ? `<div class="pips">${f.uses.max > 8 ? `<span class="cnt">${f.uses.max - f.uses.used}<small>/${f.uses.max}</small></span>` : pips("feat:" + f.id, f.uses.max, f.uses.used, 20)}</div>` : ""}</div>`;
  if (open) h += `<div class="lbody">${f.text ? rich(f.text) : `<p class="hint">Sem descrição.</p>`}
    ${isWS || /combat wild shape|elemental wild shape|circle forms/i.test(f.name) ? `<button class="chip on" data-act="tab:forms">Escolher forma →</button>` : ""}</div>`;
  return h;
}

/* ---------- EQUIPAMENTO ---------- */
function equipmentCard() {
  const att = C.items.filter(i => i.attuned).length;
  let h = `<div class="card"><div class="row"><span class="lbl">Equipamento</span>
    <span class="attn ${att > C.attuneMax ? "bad" : ""}">Sintonizados ${att}/${C.attuneMax}</span></div>`;
  const groups = [["Em uso", C.items.filter(i => i.equipped || i.attuned)],
    ["Itens mágicos", C.items.filter(i => i.magic && !i.equipped && !i.attuned)],
    ["Mochila", C.items.filter(i => !i.magic && !i.equipped && !i.attuned)]];
  groups.forEach(([label, list]) => {
    if (!list.length) return;
    h += `<div class="sub">${label}</div>`;
    list.forEach(i => {
      h += `<button class="li" data-act="item:${i.id}"><span class="lname">${esc(i.name)}${i.qty > 1 ? ` <small>×${i.qty}</small>` : ""}
        ${i.attuned ? tag("sintonizado", "g") : ""}${i.equipped ? tag("equipado") : ""}</span>
        <span class="lmeta">${i.charges ? (i.charges.max - i.charges.used) + "/" + i.charges.max : ""}</span>${chev(false)}</button>`;
    });
  });
  const c = C.coins;
  h += `<div class="coins">${["pp", "gp", "ep", "sp", "cp"].map(k => `<label><span>${{pp: "PL", gp: "PO", ep: "PE", sp: "PP", cp: "PC"}[k]}</span>${num("coin:" + k, c[k], 58)}</label>`).join("")}</div>
    <button class="ghost wide mt8" data-act="additem">+ Adicionar item</button></div>`;
  return h;
}
function deathCard() {
  return `<div class="card"><span class="lbl">Testes contra a morte</span>
    <div class="row around mt10">
    ${[["s", "Sucessos", "var(--green)"], ["f", "Falhas", "var(--red)"]].map(([k, lbl, c]) => `
      <div class="center"><div class="small" style="color:${c}">${lbl}</div>
      <div class="row">${[0, 1, 2].map(i =>
        `<button class="dsb" data-act="ds:${k}:${i}"><span class="ds" style="border-color:${c};background:${i < C.deathSaves[k] ? c : "transparent"}"></span></button>`).join("")}</div></div>`).join("")}
    </div></div>`;
}

/* ================= MAGIAS ================= */
function spellsTab() {
  let h = "";
  C.casting.forEach(c => {
    const prepN = C.spells.filter(s => s.cls === c.cls && s.prepared && s.level > 0 && !s.always).length;
    h += `<div class="card"><div class="row"><span class="serif18">${esc(c.label || c.cls)}</span>
      ${c.prepares && c.prepMax ? `<span class="row gap6"><b class="${prepN > c.prepMax ? "red" : "green"} serif20">${prepN}</b><span class="muted">/ ${c.prepMax} preparadas</span></span>` : ""}</div>
      <div class="hint">${esc(c.ability || "")}${c.dc ? " · CD " + c.dc : ""}${c.attack ? " · ataque " + esc(c.attack) : ""}${c.prepares ? "" : " · magias conhecidas"}</div></div>`;
  });
  if (!C.spells.length) return h + `<div class="card"><div class="hint">Esta ficha não tem magias.</div></div>`;
  h += `<div class="card sticky"><input type="search" class="search" placeholder="Buscar magia" value="${esc(UI.spellQ)}" data-input="spellQ">
    <div class="seg mt8">
      <button class="${UI.spellFilter === "all" ? "on" : ""}" data-act="sfilter:all">Todas</button>
      <button class="${UI.spellFilter === "prepared" ? "on" : ""}" data-act="sfilter:prepared">Preparadas</button></div>
    </div><div class="hint center">Círculo cheio = preparada (toque para trocar). Toque no nome de uma preparada para ver a descrição.</div>
    <div id="spellList">${spellListHTML()}</div>`;
  return h;
}
function spellListHTML() {
  const q = UI.spellQ.trim().toLowerCase();
  let list = C.spells.filter(s => !q || s.name.toLowerCase().includes(q));
  if (UI.spellFilter === "prepared") list = list.filter(s => s.prepared || s.always || s.level === 0);
  if (!list.length) return `<div class="card"><div class="hint">Nenhuma magia encontrada.</div></div>`;
  let h = "";
  for (let l = 0; l <= 9; l++) {
    const lv = list.filter(s => s.level === l);
    if (!lv.length) continue;
    const slot = l ? C.slots[l - 1] : 0;
    h += `<div class="card tight"><div class="row mb6"><span class="serif18">${levelLabel(l)}</span>
      ${slot ? `<span class="hint">${slot} espaço${slot > 1 ? "s" : ""}</span>` : ""}</div>`;
    lv.forEach(s => {
      const prepared = s.prepared || s.always || s.level === 0;
      const key = "sl:" + s.id, open = prepared && UI.open[key];
      const info = prepared ? spellInfo(s) : null;
      const fixed = s.level === 0 || s.always;
      h += `<div class="srow ${prepared ? "on" : ""}">
        <button class="pbox ${prepared ? "on" : ""} ${fixed ? "fixed" : ""}" data-act="${fixed ? "noop" : "prep:" + s.id}" aria-label="${prepared ? "Preparada" : "Não preparada"}"></button>
        <button class="sname" data-act="${prepared ? "open:" + key : "prep:" + s.id}">${esc(s.name)}
          ${prepared ? spellTags(s, info) : ""}${s.cls !== "Other" && C.casting.length > 1 ? tag(esc(s.cls)) : ""}</button>
        ${prepared ? chev(open) : ""}</div>
        ${open ? `<div class="lbody">${spellBody(s, info)}</div>` : ""}`;
    });
    h += `</div>`;
  }
  h += `<button class="ghost wide" data-act="addspell">+ Adicionar magia à lista</button>`;
  return h;
}

/* ================= FORMAS ================= */
function formModes(ch) {
  const ws = wsInfo(ch), lvl = totalLevel(ch);
  const modes = [];
  if (ws) modes.push({id: "wild", label: "Wild Shape",
    note: `Feras até CR ${crText(ws.cr)}${ws.swim ? "" : " · sem deslocamento de nado"}${ws.fly ? "" : " · sem voo"} · dura até ${ws.hours} h`,
    test: m => isBeast(m) && !isSwarm(m) && m.cr <= ws.cr && (ws.swim || !m.v[2]) && (ws.fly || !m.v[1])});
  if (ws && ws.elemental) modes.push({id: "elemental", label: "Elementais", note: "Elemental Wild Shape: gasta 2 usos de Wild Shape.",
    test: m => /^(air|earth|fire|water) elemental$/i.test(m.n)});
  if (knows(ch, "Shapechange")) modes.push({id: "shapechange", label: "Shapechange",
    note: `Criaturas até CR ${lvl} (seu nível), exceto constructos e mortos-vivos, que você já tenha visto. Mantém seus atributos mentais.`,
    test: m => m.cr <= lvl && !/construct|undead/.test(mType(m))});
  if (knows(ch, "Polymorph")) modes.push({id: "polymorph", label: "Polymorph",
    note: `Em você: fera com CR até ${lvl} (seu nível). Em outro alvo: até o CR/nível dele.`,
    test: m => isBeast(m) && !isSwarm(m) && m.cr <= lvl});
  if (knows(ch, "True Polymorph")) modes.push({id: "truepoly", label: "True Polymorph",
    note: `Criatura com CR até o nível/CR do alvo (em você: ${lvl}).`, test: m => m.cr <= lvl});
  if (knows(ch, "Animal Shapes")) modes.push({id: "animal", label: "Animal Shapes", note: "Aliados viram feras até CR 4, tamanho Grande ou menor.",
    test: m => isBeast(m) && !isSwarm(m) && m.cr <= 4 && SIZES.indexOf(m.s) <= 3});
  if (knows(ch, "Conjure Animals")) modes.push({id: "conjure", label: "Conjure Animals",
    note: "1 fera CR 2 · 2 de CR 1 · 4 de CR 1/2 · 8 de CR 1/4. Slot 5º ×2, 7º ×3, 9º ×4.",
    test: m => isBeast(m) && !isSwarm(m) && m.cr <= 2});
  modes.push({id: "all", label: "Bestiário", note: "Todas as criaturas (SRD 5.1 + as que você adicionou).", test: () => true});
  return modes;
}
function formsTab() {
  if (!window.SRD_MONSTERS) {
    needMonsters().then(render).catch(() => toast("Não consegui carregar o bestiário.", "bad"));
    return `<div class="card"><div class="hint center">Carregando bestiário…</div></div>`;
  }
  const modes = formModes(C);
  if (!modes.some(m => m.id === UI.formMode)) UI.formMode = modes[0].id;
  const mode = modes.find(m => m.id === UI.formMode);
  const ws = wsInfo(C);
  let h = "";
  if (ws) {
    const f = wsFeature(C);
    h += `<div class="card"><div class="row"><span class="lbl">Wild Shape</span>
      ${ws.unlimited ? `<span class="moonword">∞ Arquidruida</span>` : f && f.uses ? `<div class="pips">${pips("feat:" + f.id, f.uses.max, f.uses.used, 28)}</div>` : ""}</div>
      <div class="hint">Nível de druida ${ws.level}${ws.moon ? " · Círculo da Lua" : ""} · CR máx. ${crText(ws.cr)}${ws.combat ? " · como ação bônus" : ""}</div>
      ${C.forms.length ? `<div class="hint mt8">Forma atual: <b>${C.forms.map(x => esc(x.name)).join(", ")}</b></div>` : ""}</div>`;
  }
  h += `<div class="card">
    <div class="modes">${modes.map(m => `<button class="chip ${m.id === mode.id ? "on" : ""}" data-act="fmode:${m.id}">${m.label}</button>`).join("")}</div>
    <div class="hint mt8">${esc(mode.note)}</div>
    <input type="search" class="search mt8" placeholder="Buscar criatura ou tipo" value="${esc(UI.formQ)}" data-input="formQ">
    <div class="row wrap gap6 mt8">${["fly", "swim", "climb", "burrow"].map(k =>
      `<button class="chip sm ${UI.formMove === k ? "on" : ""}" data-act="fmove:${k}">${SPEED_ICON[k]}</button>`).join("")}
      <button class="chip sm" data-act="addmon">+ Criatura</button></div></div>
    <div id="monList">${monListHTML()}</div>`;
  return h;
}
function monListHTML() {
  const modes = formModes(C);
  const mode = modes.find(m => m.id === UI.formMode) || modes[0];
  const q = UI.formQ.trim().toLowerCase();
  const mv = {fly: 1, swim: 2, climb: 3, burrow: 4}[UI.formMove];
  const list = allMonsters().filter(m => mode.test(m) && (!q || m.n.toLowerCase().includes(q) || mType(m).includes(q) ||
    (TYPE_PT[mType(m).split(" ")[0]] || "").toLowerCase().includes(q)) && (!mv || m.v[mv] > 0))
    .sort((a, b) => b.cr - a.cr || a.n.localeCompare(b.n));
  if (!list.length) return `<div class="card"><div class="hint">Nenhuma criatura encontrada. Use “+ Criatura” para colar um stat block de outro livro.</div></div>`;
  let h = `<div class="hint center mb6">${list.length} criatura${list.length > 1 ? "s" : ""}</div>`;
  let cur = null;
  list.forEach(m => {
    if (m.cr !== cur) { if (cur !== null) h += `</div>`; cur = m.cr; h += `<div class="card tight"><div class="crhead">CR ${crText(m.cr)}</div>`; }
    const sp = [["fly", 1], ["swim", 2], ["climb", 3], ["burrow", 4]].filter(([, i]) => m.v[i] > 0).map(([k, i]) => SPEED_ICON[k] + " " + m.v[i]).join(" · ");
    h += `<button class="mrow" data-act="mon:${encodeURIComponent(m.n)}">
      <span class="mname">${esc(m.n)}${m.src === "custom" ? tag("seu", "g") : ""}</span>
      <span class="mmeta">${SIZE_PT[m.s] || m.s} · ${esc(TYPE_PT[mType(m).split(" ")[0]] || m.t)} · CA ${parseInt(m.ac, 10)} · PV ${m.hp} · desl. ${m.v[0]}${sp ? " · " + sp : ""}</span></button>`;
  });
  return h + `</div>`;
}
function statBlock(m) {
  const ab = m.ab.map((v, i) => `<div><span>${ABIL[i][1]}</span><b>${v}</b><small>(${fm(mod(v))})</small></div>`).join("");
  const line = (k, v) => v ? `<div><b>${k}</b> ${esc(v)}</div>` : "";
  const ents = (title, list) => list && list.length ? `<div class="sbh">${title}</div>` + list.map(([n, d]) =>
    `<p><b><i>${esc(n)}.</i></b> ${esc(d).replace(/\n/g, "<br>")}</p>`).join("") : "";
  return `<div class="statblock">
    <div class="sbname">${esc(m.n)}</div>
    <div class="sbsub">${esc(m.s)} ${esc(m.t)}${m.al ? ", " + esc(m.al) : ""}</div><hr>
    ${line("Armor Class", m.ac)}${line("Hit Points", m.hp + (m.hd ? " (" + m.hd + ")" : ""))}${line("Speed", m.sp)}<hr>
    <div class="abgrid">${ab}</div><hr>
    ${line("Saving Throws", m.sv)}${line("Skills", m.sk)}${line("Damage Vulnerabilities", m.dv)}${line("Damage Resistances", m.dr)}
    ${line("Damage Immunities", m.di)}${line("Condition Immunities", m.ci)}${line("Senses", m.se)}${line("Languages", m.la || "—")}
    ${line("Challenge", crText(m.cr) + (m.xp ? " (" + m.xp.toLocaleString("en-US") + " XP)" : ""))}<hr>
    ${(m.tr || []).map(([n, d]) => `<p><b><i>${esc(n)}.</i></b> ${esc(d).replace(/\n/g, "<br>")}</p>`).join("")}
    ${ents("Actions", m.a)}${ents("Bonus Actions", m.b)}${ents("Reactions", m.r)}
    ${m.l && m.l.length ? `<div class="sbh">Legendary Actions</div><p class="hint">A criatura pode realizar 3 ações lendárias, escolhendo entre as opções abaixo, ao fim do turno de outra criatura.</p>` + m.l.map(([n, d]) => `<p><b><i>${esc(n)}.</i></b> ${esc(d)}</p>`).join("") : ""}
    <div class="hint mt8">${m.src === "custom" ? "Criatura adicionada por você." : "SRD 5.1 · CC-BY-4.0"}</div>
  </div>`;
}

/* ================= FICHA ================= */
function sheetTab() {
  const chars = Object.values(DB.chars);
  let h = `<div class="card"><div class="row"><span class="lbl">Fichas</span>
    <div class="row gap6"><button class="ghost" data-act="import">Importar</button><button class="ghost" data-act="blank">Nova</button></div></div>
    <div class="list mt8">${chars.map(ch => `<button class="li ${ch.id === C.id ? "cur" : ""}" data-act="switch:${ch.id}">
      <span class="lname">${esc(ch.name)}</span><span class="lmeta">${esc(classLine(ch))} · ${totalLevel(ch)}</span></button>`).join("")}</div></div>`;
  if (C.meta.warnings && C.meta.warnings.length) h += `<div class="card warnbox"><div class="row"><span class="lbl">Avisos da importação</span>
    <button class="x" data-act="clearwarn">ok</button></div>${C.meta.warnings.map(w => `<p class="hint">• ${esc(w)}</p>`).join("")}</div>`;

  h += `<div class="card"><span class="lbl">Identidade</span><div class="form-grid mt8">
    ${field("Nome", "name")}${field("Raça", "race")}${field("Antecedente", "background")}${field("Tendência", "alignment")}
    ${field("Jogador", "player")}${field("XP", "xp", "num")}</div></div>`;

  h += `<div class="card"><div class="row"><span class="lbl">Classes · nível ${totalLevel(C)}</span><button class="ghost" data-act="addclass">+ Classe</button></div>
    ${C.classes.map((c, i) => `<div class="classrow">
      <input value="${esc(c.name)}" data-f="classes.${i}.name" placeholder="Classe">
      <input value="${esc(c.subclass || "")}" data-f="classes.${i}.subclass" placeholder="Subclasse">
      <div class="row gap6"><button class="stepbtn" data-act="clvl:${i}:-1">−</button><span class="lvlnum">${c.level}</span>
      <button class="stepbtn" data-act="clvl:${i}:1">+</button><button class="x" data-act="delclass:${i}">✕</button></div></div>`).join("")}
    <div class="hint mt8">Mudar o nível recalcula proficiência e espaços de magia pela tabela oficial. PV máximo você ajusta na mão.</div></div>`;

  h += `<div class="card"><span class="lbl">Combate</span><div class="form-grid mt8">
    ${field("CA", "ac", "num")}${field("PV máx.", "hp.max", "num")}${field("Desl.", "speed.walk", "num")}${field("Voo", "speed.fly", "num")}
    ${field("Nado", "speed.swim", "num")}${field("Escalada", "speed.climb", "num")}${field("Bônus inic.", "initExtra", "num")}${field("Ataques/ação", "attacksPerAction", "num")}</div>
    <div class="form-grid mt8">${field("Armadura", "armor")}${field("Escudo", "shield")}</div>
    <div class="mt8">${field("Resistências / defesas", "defenses")}</div>
    <div class="mt8">${field("Sentidos", "vision")}</div></div>`;

  h += `<div class="card"><span class="lbl">Atributos</span><div class="abgrid3 mt10">
    ${ABIL.map(([k, s]) => `<div class="abil"><div class="abl">${s}</div><div class="abm">${fm(abilMod(C, k))}</div>
      ${num("abil:" + k, C.abilities[k], 54)}</div>`).join("")}</div></div>`;

  h += `<div class="card"><span class="lbl">Salvaguardas</span><div class="mt6">
    ${ABIL.map(([k, , full]) => { const p = C.saves[k].prof; return `<button class="saverow" data-act="save:${k}">
      <span><span class="check ${p ? "on" : ""}"></span>${full}</span><span class="${p ? "moonword" : "muted"} serif18">${fm(saveTotal(C, k))}</span></button>`; }).join("")}</div></div>`;

  h += `<div class="card"><div class="row"><span class="lbl">Perícias</span><span class="hint">toque: — → prof. → especialista</span></div><div class="mt6">
    ${I.SKILLS.map(([s, a]) => { const sk = C.skills[s]; return `<button class="saverow" data-act="skill:${encodeURIComponent(s)}">
      <span><span class="check ${sk.exp ? "exp" : sk.prof ? "on" : ""}"></span>${SKILL_PT[s]} <small class="muted">${ABIL_SHORT[a]}</small></span>
      <span class="${sk.prof ? "moonword" : "muted"} serif18">${fm(skillTotal(C, s))}</span></button>`; }).join("")}
    <div class="row mt8"><span class="muted">Percepção passiva</span><b class="serif18">${passivePerc(C)}</b></div></div></div>`;

  if (C.casting.length) h += `<div class="card"><span class="lbl">Conjuração</span>${C.casting.map((c, i) => `<div class="form-grid mt8">
    ${field("Classe", "casting." + i + ".cls")}${field("Atributo", "casting." + i + ".ability")}${field("CD", "casting." + i + ".dc", "num")}
    ${field("Ataque", "casting." + i + ".attack")}${c.prepares ? field("Máx. preparadas", "casting." + i + ".prepMax", "num") : ""}</div>`).join("")}
    <div class="form-grid mt8">${C.slots.map((s, i) => field(ORD(i + 1) + " slots", "slots." + i, "num")).join("")}</div></div>`;

  h += `<div class="card"><div class="row"><span class="lbl">Características</span><button class="ghost" data-act="addfeat">+</button></div><div class="list mt8">
    ${C.features.map(f => { const open = UI.open["sf:" + f.id]; return `<button class="li" data-act="open:sf:${f.id}"><span class="lname">${esc(f.name)}
      ${f.uses ? tag(f.uses.max + "/" + (PER_PT[f.uses.per] || "")) : ""}${f.group === "race" ? tag("raça") : ""}</span>${chev(open)}</button>
      ${open ? `<div class="lbody">${f.text ? rich(f.text) : `<p class="hint">Sem descrição.</p>`}<button class="chip" data-act="editfeat:${f.id}">Editar</button></div>` : ""}`; }).join("")}
    </div></div>`;

  if (C.proficiencies.length) h += `<div class="card"><span class="lbl">Proficiências e idiomas</span>
    ${C.proficiencies.map(p => `<p class="small"><b>${esc(p.label)}.</b> ${esc(p.text)}</p>`).join("")}</div>`;

  const bio = C.bio;
  const openBio = UI.open.bio;
  h += `<div class="card"><button class="li" data-act="open:bio"><span class="lname lbl">História e aparência</span>${chev(openBio)}</button>
    ${openBio ? `<div class="form-grid mt8">${["gender:Gênero", "age:Idade", "height:Altura", "weight:Peso", "eyes:Olhos", "skin:Pele", "hair:Cabelo"].map(x => {
      const [k, l] = x.split(":"); return field(l, "bio." + k); }).join("")}</div>
      ${["traits:Traços de personalidade", "ideals:Ideais", "bonds:Vínculos", "flaws:Defeitos", "backgroundFeatureText:Característica do antecedente" + (bio.backgroundFeature ? " — " + bio.backgroundFeature : ""),
        "trinket:Bugiganga", "allies:Aliados e organizações", "additional:Características adicionais", "backstory:História"].map(x => {
        const i = x.indexOf(":"); const k = x.slice(0, i), l = x.slice(i + 1);
        return `<label class="tlabel">${esc(l)}<textarea data-f="bio.${k}" rows="${k === "backstory" ? 10 : 3}">${esc(bio[k])}</textarea></label>`; }).join("")}` : ""}</div>`;

  h += `<div class="card"><span class="lbl">Anotações</span><textarea class="mt8" data-f="notes" rows="5" placeholder="Anotações da sessão">${esc(C.notes)}</textarea></div>`;

  h += `<div class="card"><span class="lbl">Cópia de segurança</span>
    <div class="hint mt8">Tudo é salvo neste aparelho. Exporte para guardar ou levar a outro aparelho.</div>
    <div class="row gap8 mt10"><button class="amt" data-act="export">Exportar arquivo</button><button class="amt" data-act="copy">Copiar texto</button></div>
    <div class="row gap8 mt8"><button class="amt" data-act="pick:json">Importar arquivo</button><button class="amt" data-act="paste">Colar texto</button></div></div>`;
  h += `<button class="danger" data-act="delchar">Apagar esta ficha</button>`;
  if (!UI.storageOK) h += `<div class="hint warn center">Este navegador bloqueou o salvamento. Abra pelo Safari / tela de início.</div>`;
  h += `<div class="hint center mt14">Bestiário e magias de referência: SRD 5.1 © Wizards of the Coast (CC-BY-4.0).</div>`;
  return h;
}
function getPath(o, path) { return path.split(".").reduce((a, k) => a == null ? a : a[k], o); }
function field(label, path, type) {
  const v = getPath(C, path);
  return `<label class="fld"><span>${esc(label)}</span><input ${type === "num" ? 'type="number" inputmode="numeric"' : ""} value="${esc(v == null ? "" : v)}" data-f="${path}" data-t="${type || "text"}"></label>`;
}

/* ================= PAINEL (bottom sheet) ================= */
function openSheet(type, arg) { UI.sheet = {type, arg}; renderSheet(); }
function closeSheet() { UI.sheet = null; renderSheet(); }
function renderSheet() {
  const wrap = document.getElementById("sheet");
  if (!UI.sheet) { wrap.className = ""; wrap.innerHTML = ""; document.body.classList.remove("noscroll"); return; }
  const {type, arg} = UI.sheet;
  let body = "";
  try { body = SHEETS[type](arg); } catch (e) { console.error(e); body = `<p class="hint">Erro ao abrir: ${esc(e.message)}</p>`; }
  const prevScroll = wrap.querySelector(".sheet-body") ? wrap.querySelector(".sheet-body").scrollTop : 0;
  const same = wrap.dataset.key === type + ":" + arg;
  wrap.dataset.key = type + ":" + arg;
  wrap.className = "open";
  wrap.innerHTML = `<div class="backdrop" data-act="closesheet"></div><div class="sheet" role="dialog">
    <div class="grab"></div><button class="sheet-x" data-act="closesheet" aria-label="Fechar">✕</button>
    <div class="sheet-body">${body}</div></div>`;
  if (same) wrap.querySelector(".sheet-body").scrollTop = prevScroll;
  document.body.classList.add("noscroll");
}
const SHEETS = {
  import: () => `<div class="h2">Importar ficha</div>${importOptions()}`,
  busy: msg => `<div class="center pad"><div class="spinner"></div><p class="hint">${esc(msg)}</p></div>`,
  info: html => html,
  importDone: id => {
    const ch = DB.chars[id];
    if (!ch) return "";
    const prep = ch.spells.filter(s => s.prepared && s.level > 0).length;
    const desc = ch.spells.filter(s => s.desc).length;
    return `<div class="h2">Ficha carregada</div>
      <p><b>${esc(ch.name)}</b> — ${esc(classLine(ch))}, nível ${totalLevel(ch)}</p>
      <div class="meta"><div>${ch.features.length} características · ${ch.items.length} itens · ${ch.attacks.length} ataques</div>
      <div>${ch.spells.length} magias (${prep} preparadas, ${desc} com descrição da ficha)</div>
      <div>CA ${ch.ac} · PV ${ch.hp.max} · ${ch.items.filter(i => i.attuned).length}/${ch.attuneMax} sintonizados</div></div>
      ${ch.meta.warnings.length ? `<div class="warnbox mt8">${ch.meta.warnings.map(w => `<p class="hint">• ${esc(w)}</p>`).join("")}</div>` : ""}
      <button class="big primary wide mt14" data-act="closesheet">Começar</button>`;
  },
  replace: () => {
    const p = UI.pending;
    if (!p) return "";
    return `<div class="h2">Onde colocar?</div><p>Importado: <b>${esc(p.chars.map(c => c.name).join(", "))}</b></p>
      <button class="big primary wide" data-act="pend:add">Adicionar como nova ficha</button>
      ${p.chars.length === 1 && C ? `<button class="big soft wide mt8" data-act="pend:replace">Substituir “${esc(C.name)}”</button>
      <p class="hint mt8">Substituir mantém PV atual, recursos gastos e formas ativas quando possível.</p>` : ""}`;
  },
  paste: () => `<div class="h2">Colar backup</div><textarea id="pastebox" rows="10" placeholder="Cole aqui o texto do backup"></textarea>
    <button class="big primary wide mt8" data-act="dopaste">Restaurar</button>`,
  item: id => {
    const i = C.items.find(x => x.id === id);
    if (!i) return "";
    const att = C.items.filter(x => x.attuned).length;
    return `<div class="h2">${esc(i.name)}</div>${i.type ? `<div class="hint">${esc(i.type)}${i.book ? " · " + esc(i.book) : ""}</div>` : ""}
      <div class="row wrap gap6 mt10">
        <button class="chip ${i.equipped ? "on" : ""}" data-act="ieq:${i.id}">${i.equipped ? "✓ Equipado" : "Equipar"}</button>
        <button class="chip ${i.attuned ? "on" : ""}" data-act="iatt:${i.id}">${i.attuned ? "✓ Sintonizado" : "Sintonizar"} <small>(${att}/${C.attuneMax})</small></button>
        <button class="chip ${i.magic ? "on" : ""}" data-act="imag:${i.id}">Mágico</button></div>
      <div class="row gap8 mt10"><span class="muted grow">Quantidade</span><button class="pm sm minus" data-act="iqty:${i.id}:-1">−</button>
        <span class="cnt">${i.qty}</span><button class="pm sm plus" data-act="iqty:${i.id}:1">+</button></div>
      ${i.charges ? `<div class="row gap8 mt10"><span class="muted grow">Cargas${i.charges.regain ? " · recupera " + esc(i.charges.regain) : ""}</span>${counter("chg", i.id, i.charges)}</div>` : ""}
      <div class="desc mt10">${i.desc ? rich(i.desc) : `<p class="hint">Sem descrição.</p>`}</div>
      <label class="tlabel">Descrição / anotações<textarea data-if="${i.id}" rows="4">${esc(i.desc)}</textarea></label>
      <div class="row gap8 mt8"><button class="chip" data-act="iwatk:${i.id}">Criar ataque</button><button class="chip bad" data-act="idel:${i.id}">Remover item</button></div>`;
  },
  additem: () => `<div class="h2">Novo item</div>
    <label class="fld"><span>Nome</span><input id="ni-name"></label>
    <div class="form-grid mt8"><label class="fld"><span>Qtd.</span><input id="ni-qty" type="number" value="1"></label>
    <label class="fld"><span>Cargas (opcional)</span><input id="ni-chg" type="number"></label></div>
    <label class="tlabel">Descrição<textarea id="ni-desc" rows="4"></textarea></label>
    <div class="row wrap gap6 mt8"><label class="chk"><input type="checkbox" id="ni-mag"> mágico</label>
    <label class="chk"><input type="checkbox" id="ni-eq"> equipado</label><label class="chk"><input type="checkbox" id="ni-att"> sintonizado</label></div>
    <button class="big primary wide mt10" data-act="saveitem">Adicionar</button>`,
  attack: id => {
    const a = C.attacks.find(x => x.id === id) || {name: "", attack: "", damage: "", range: "", notes: ""};
    return `<div class="h2">${id === "new" ? "Novo ataque" : "Editar ataque"}</div>
      <label class="fld"><span>Nome</span><input id="na-name" value="${esc(a.name)}"></label>
      <div class="form-grid mt8"><label class="fld"><span>Ataque</span><input id="na-atk" value="${esc(a.attack)}" placeholder="+7"></label>
      <label class="fld"><span>Dano</span><input id="na-dmg" value="${esc(a.damage)}" placeholder="1d8+4 cortante"></label></div>
      <label class="fld mt8"><span>Alcance</span><input id="na-rng" value="${esc(a.range)}"></label>
      <label class="fld mt8"><span>Notas</span><input id="na-notes" value="${esc(a.notes || "")}"></label>
      <div class="row gap8 mt10"><button class="big primary grow" data-act="saveatk:${id}">Salvar</button>
      ${id !== "new" ? `<button class="big soft" data-act="delatk:${id}">Excluir</button>` : ""}</div>`;
  },
  feature: id => {
    const f = C.features.find(x => x.id === id) || {name: "", text: "", uses: null, act: []};
    return `<div class="h2">${id === "new" ? "Nova característica" : "Editar característica"}</div>
      <label class="fld"><span>Nome</span><input id="nf-name" value="${esc(f.name)}"></label>
      <div class="form-grid mt8"><label class="fld"><span>Usos (vazio = passiva)</span><input id="nf-max" type="number" value="${f.uses ? f.uses.max : ""}"></label>
      <label class="fld"><span>Recupera em</span><select id="nf-per">${["long", "short", "turn"].map(p => `<option value="${p}" ${f.uses && f.uses.per === p ? "selected" : ""}>${PER_PT[p]}</option>`).join("")}</select></label></div>
      <div class="row wrap gap6 mt8">${ACT_TABS.slice(0, 3).map(([k, l]) => `<label class="chk"><input type="checkbox" class="nf-act" value="${k}" ${f.act.includes(k) ? "checked" : ""}> ${l}</label>`).join("")}</div>
      <label class="tlabel">Descrição<textarea id="nf-text" rows="6">${esc(f.text)}</textarea></label>
      <div class="row gap8 mt10"><button class="big primary grow" data-act="savefeat:${id}">Salvar</button>
      ${id !== "new" ? `<button class="big soft" data-act="delfeat:${id}">Excluir</button>` : ""}</div>`;
  },
  spelltext: id => {
    const s = C.spells.find(x => x.id === id);
    return `<div class="h2">${esc(s.name)}</div><p class="hint">Escreva ou cole a descrição desta magia (vale para esta ficha).</p>
      <textarea id="st-text" rows="10">${esc(s.customDesc || spellInfo(s).desc)}</textarea>
      <div class="row gap8 mt8"><button class="big primary grow" data-act="savespelltext:${id}">Salvar</button>
      ${s.customDesc ? `<button class="big soft" data-act="clearspelltext:${id}">Usar original</button>` : ""}</div>`;
  },
  addspell: () => `<div class="h2">Adicionar magia</div>
    <label class="fld"><span>Nome</span><input id="ns-name" placeholder="Ex.: Shapechange"></label>
    <div class="form-grid mt8"><label class="fld"><span>Nível (0 = truque)</span><input id="ns-lvl" type="number" value="1"></label>
    <label class="fld"><span>Lista</span><select id="ns-cls">${C.casting.map(c => `<option>${esc(c.cls)}</option>`).join("")}<option value="Other">Outra (raça/talento)</option></select></label></div>
    <p class="hint mt8">Se a magia estiver no SRD, a descrição aparece sozinha.</p>
    <button class="big primary wide mt8" data-act="saveaddspell">Adicionar</button>`,
  monster: name => {
    const m = findMonster(name);
    if (!m) return `<p class="hint">Criatura não encontrada.</p>`;
    return statBlock(Object.assign({src: (DB.custom || []).some(c => c.n === m.n) ? "custom" : "SRD"}, m)) + transformButtons(m);
  },
  addmon: () => `<div class="h2">Adicionar criatura</div>
    <p class="hint">Cole o stat block completo (D&D Beyond, livro, 5etools…). O app separa nome, CA, PV, deslocamentos, atributos, CR, traços e ações.</p>
    <textarea id="am-text" rows="12" placeholder="Giant Subterranean Lizard&#10;Huge beast, unaligned&#10;Armor Class 14 (natural armor)&#10;Hit Points 66 (7d12 + 21)&#10;Speed 30 ft., swim 50 ft.&#10;STR DEX CON INT WIS CHA&#10;19 (+4) 12 (+1) 16 (+3) 2 (−4) 10 (+0) 7 (−2)&#10;…&#10;Challenge 4 (1,100 XP)&#10;Actions&#10;Multiattack. …"></textarea>
    <button class="big primary wide mt8" data-act="parsemon">Ler stat block</button>
    <div id="am-preview"></div>`
};
function transformButtons(m) {
  const ws = wsInfo(C), lvl = totalLevel(C);
  const b = [];
  const f = wsFeature(C);
  const left = ws && (ws.unlimited ? 99 : usesLeft(f && f.uses));
  const enc = encodeURIComponent(m.n);
  if (ws && isBeast(m) && !isSwarm(m) && m.cr <= ws.cr && (ws.swim || !m.v[2]) && (ws.fly || !m.v[1]))
    b.push(`<button class="big primary wide" data-act="tf:ws:${enc}" ${left >= 1 ? "" : "disabled"}>Wild Shape${ws.combat ? " (ação bônus)" : ""} · gasta 1 uso</button>`);
  if (ws && ws.elemental && /^(air|earth|fire|water) elemental$/i.test(m.n))
    b.push(`<button class="big primary wide" data-act="tf:elemental:${enc}" ${left >= 2 ? "" : "disabled"}>Wild Shape elemental · gasta 2 usos</button>`);
  if (knows(C, "Shapechange") && m.cr <= lvl && !/construct|undead/.test(mType(m))) {
    const active = /shapechange/i.test(C.concentration);
    b.push(`<button class="big soft wide" data-act="tf:shapechange:${enc}" ${active || C.slots[8] - C.slotsUsed[8] > 0 ? "" : "disabled"}>${active ? "Shapechange: mudar para esta forma" : "Conjurar Shapechange (slot 9º)"}</button>`);
  }
  if (knows(C, "Polymorph") && isBeast(m) && m.cr <= lvl) {
    const sl = [4, 5, 6, 7, 8, 9].find(l => C.slots[l - 1] - C.slotsUsed[l - 1] > 0);
    b.push(`<button class="big soft wide" data-act="tf:polymorph:${enc}" ${sl ? "" : "disabled"}>Polymorph em você (slot ${sl ? ORD(sl) : "4º+"})</button>`);
  }
  b.push(`<button class="big soft wide" data-act="tf:manual:${enc}">Só adicionar a vida desta forma</button>`);
  if ((DB.custom || []).some(c => c.n === m.n)) b.push(`<button class="danger" data-act="delmon:${enc}">Excluir criatura</button>`);
  return `<div class="tfbtns">${b.join("")}</div>`;
}
