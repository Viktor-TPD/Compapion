// Parses the CompapionDB SavedVariables Lua table into a JS object.
// The format is a Lua table assignment: CompapionDB = { ... }
// We use a regex-based approach — no full Lua interpreter needed for this shape.

export interface GearSlot {
  slot: number;
  slot_name: string;
  item_link: string;
  item_name: string;
  icon: string | null;
  crafter_name: string | null;
}

export interface Profession {
  name: string;
  skill: number;
  max_skill: number;
}

export interface BossKill {
  boss_name: string;
  killed_at: number;
  party_members: string[];
}

export interface CharacterData {
  name: string;
  class: string;
  level: number;
}

export interface CompapionSavedVars {
  character: CharacterData;
  professions: Profession[];
  gear: GearSlot[];
  boss_kills: BossKill[];
  last_updated: number;
  version: number;
}

// Strips Lua comments and normalises line endings
function stripComments(src: string): string {
  return src.replace(/--[^\n]*/g, "").replace(/\r\n/g, "\n");
}

// Converts a Lua table literal string into a JS value recursively.
// Handles: string, number, boolean, nil, array tables, dict tables.
export function parseLuaValue(src: string): unknown {
  src = src.trim();

  if (src === "nil" || src === "") return null;
  if (src === "true") return true;
  if (src === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(src)) return Number(src);
  if (/^"(.*)"$/s.test(src)) return src.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");

  if (src.startsWith("{")) {
    return parseLuaTable(src);
  }

  // Unquoted string fallback (Lua identifiers used as values are unusual but handle gracefully)
  return src;
}

function parseLuaTable(src: string): unknown[] | Record<string, unknown> {
  // Strip outer braces
  const inner = src.slice(1, -1).trim();
  if (!inner) return [];

  const entries = splitTopLevel(inner);
  const result: Record<string, unknown> = {};
  let arrayIndex = 1;
  let isArray = true;

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Key-value: ["key"] = value  or  key = value
    const bracketKey = trimmed.match(/^\["(.+?)"\]\s*=\s*([\s\S]*)$/);
    const identKey = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([\s\S]*)$/);

    if (bracketKey) {
      isArray = false;
      result[bracketKey[1]] = parseLuaValue(bracketKey[2].trim());
    } else if (identKey) {
      isArray = false;
      result[identKey[1]] = parseLuaValue(identKey[2].trim());
    } else {
      result[String(arrayIndex++)] = parseLuaValue(trimmed);
    }
  }

  if (isArray) {
    return Object.values(result);
  }
  return result;
}

// Splits a Lua table body by top-level commas (ignoring commas inside nested tables/strings)
function splitTopLevel(src: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let start = 0;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' && src[i - 1] !== "\\") {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(src.slice(start, i));
        start = i + 1;
      }
    }
  }
  parts.push(src.slice(start));
  return parts;
}

export function parseSavedVars(fileContents: string): CompapionSavedVars | null {
  const stripped = stripComments(fileContents);
  const match = stripped.match(/CompapionDB\s*=\s*(\{[\s\S]*\})/);
  if (!match) return null;

  try {
    const raw = parseLuaValue(match[1]) as Record<string, unknown>;
    return raw as unknown as CompapionSavedVars;
  } catch {
    return null;
  }
}
