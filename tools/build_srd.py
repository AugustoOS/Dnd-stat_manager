"""Gera data/srd-*.js a partir do banco aberto do SRD 5.1 (D&D 5e 2014).

Fonte: https://github.com/5e-bits/5e-database (src/2014/en)
Conteúdo do SRD 5.1 © Wizards of the Coast, licenciado sob CC-BY-4.0.

Uso:  python tools/build_srd.py [pasta_com_os_json]
Sem pasta, baixa os JSON direto do GitHub.
"""
import json
import os
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2014/en/"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
HEADER = ("/* Gerado por tools/build_srd.py — SRD 5.1 (D&D 5e 2014), "
          "© Wizards of the Coast, CC-BY-4.0. Fonte: github.com/5e-bits/5e-database */\n")


def load(name, folder):
    if folder:
        with open(os.path.join(folder, "srd-%s.json" % name), encoding="utf-8") as f:
            return json.load(f)
    with urllib.request.urlopen(BASE + "5e-SRD-%s.json" % name) as r:
        return json.loads(r.read().decode("utf-8"))


def ft(v):
    """'40 ft.' -> 40"""
    try:
        return int(str(v).split()[0])
    except (ValueError, IndexError):
        return 0


ABBR = {"STR": "Str", "DEX": "Dex", "CON": "Con", "INT": "Int", "WIS": "Wis", "CHA": "Cha"}


def usage_suffix(u):
    if not u:
        return ""
    t = u.get("type", "")
    if t == "per day":
        return " (%s/Day)" % u.get("times")
    if t == "recharge on roll":
        mv = u.get("min_value", 6)
        return " (Recharge %s)" % ("6" if mv == 6 else "%s–6" % mv)
    if t == "recharge after rest":
        rests = " or ".join(r.title() for r in u.get("rest_types", []))
        return " (Recharges after a %s Rest)" % rests if rests else ""
    if t == "per turn":
        return ""
    return ""


def entries(lst):
    out = []
    for a in lst or []:
        out.append([a["name"] + usage_suffix(a.get("usage")), a.get("desc", "")])
    return out


def monster(m):
    ac_parts = []
    for a in m["armor_class"]:
        extra = ""
        if a.get("armor"):
            extra = ", ".join(x["name"].lower() for x in a["armor"])
        elif a.get("type") not in (None, "dex"):
            extra = a["type"] + " armor" if a["type"] == "natural" else a["type"]
        if a.get("desc"):
            extra = a["desc"]
        ac_parts.append("%d%s" % (a["value"], " (%s)" % extra if extra else ""))
    sp = m.get("speed", {})
    speed_txt = []
    for k in ("walk", "burrow", "climb", "fly", "swim"):
        if k in sp:
            s = sp[k]
            if k == "fly" and sp.get("hover"):
                s += " (hover)"
            speed_txt.append(s if k == "walk" else "%s %s" % (k, s))
    saves, skills = [], []
    for p in m.get("proficiencies", []):
        nm = p["proficiency"]["name"]
        if nm.startswith("Saving Throw: "):
            saves.append("%s +%d" % (ABBR.get(nm.split(": ")[1], nm), p["value"]))
        elif nm.startswith("Skill: "):
            skills.append("%s +%d" % (nm.split(": ")[1], p["value"]))
    senses = []
    for k in ("blindsight", "darkvision", "tremorsense", "truesight"):
        if k in m["senses"]:
            senses.append("%s %s" % (k, m["senses"][k]))
    senses.append("passive Perception %s" % m["senses"].get("passive_perception", 10))
    t = m["type"]
    sub = m.get("subtype")
    out = {
        "n": m["name"],
        "s": m["size"],
        "t": t + (" (%s)" % sub if sub else ""),
        "al": m.get("alignment", ""),
        "ac": ", ".join(ac_parts),
        "hp": m["hit_points"],
        "hd": m.get("hit_points_roll") or m.get("hit_dice", ""),
        "sp": ", ".join(speed_txt),
        "v": [ft(sp.get(k, 0)) for k in ("walk", "fly", "swim", "climb", "burrow")],
        "ab": [m[k] for k in ("strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma")],
        "cr": m["challenge_rating"],
        "xp": m.get("xp", 0),
    }
    if saves: out["sv"] = ", ".join(saves)
    if skills: out["sk"] = ", ".join(skills)
    for key, src in (("dv", "damage_vulnerabilities"), ("dr", "damage_resistances"), ("di", "damage_immunities")):
        if m.get(src): out[key] = "; ".join(m[src])
    if m.get("condition_immunities"):
        out["ci"] = ", ".join(c["name"].lower() for c in m["condition_immunities"])
    out["se"] = ", ".join(senses)
    if m.get("languages"): out["la"] = m["languages"]
    for key, src in (("tr", "special_abilities"), ("a", "actions"), ("r", "reactions"), ("l", "legendary_actions")):
        e = entries(m.get(src))
        if e: out[key] = e
    return out


def spell(s):
    comp = ", ".join(s.get("components", []))
    if s.get("material"):
        comp += " (%s)" % s["material"].rstrip(".")
    out = {
        "n": s["name"],
        "l": s["level"],
        "sc": s["school"]["name"],
        "ct": s["casting_time"],
        "r": s["range"],
        "d": ("Concentration, up to " + s["duration"][0].lower() + s["duration"][1:]) if s.get("concentration") and not s["duration"].startswith("Concentration") else s["duration"],
        "c": comp,
        "t": "\n".join(s.get("desc", [])),
        "cl": [c["name"] for c in s.get("classes", [])],
    }
    if s.get("ritual"): out["rit"] = 1
    if s.get("concentration"): out["conc"] = 1
    if s.get("higher_level"): out["hl"] = "\n".join(s["higher_level"])
    return out


def item(i):
    desc = i.get("desc", [])
    head = desc[0] if desc else ""
    return {"n": i["name"], "h": head, "t": "\n".join(desc[1:]), "att": 1 if "requires attunement" in head else 0}


def write(name, var, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(HEADER)
        f.write("window.%s=" % var)
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    print("%-24s %4d registros  %7.0f KB" % (name, len(data), os.path.getsize(path) / 1024))


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else None
    os.makedirs(OUT, exist_ok=True)
    write("srd-monsters.js", "SRD_MONSTERS", [monster(m) for m in load("Monsters", folder)])
    write("srd-spells.js", "SRD_SPELLS", [spell(s) for s in load("Spells", folder)])
    items = [item(i) for i in load("Magic-Items", folder) if not i.get("variant")]
    write("srd-items.js", "SRD_ITEMS", items)


if __name__ == "__main__":
    main()
