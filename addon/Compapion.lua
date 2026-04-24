-- Compapion WoW Addon
-- Tracks professions, equipped gear, and boss kills for the crafted-gear challenge.
-- Data is written to SavedVariables and read by the Electron desktop app.

CompapionDB = CompapionDB or {}

local ADDON_NAME = "Compapion"

-- All 19 equippable inventory slots
local SLOT_NAMES = {
  [1]  = "Head",
  [2]  = "Neck",
  [3]  = "Shoulder",
  [5]  = "Chest",
  [6]  = "Waist",
  [7]  = "Legs",
  [8]  = "Feet",
  [9]  = "Wrist",
  [10] = "Hands",
  [11] = "Ring1",
  [12] = "Ring2",
  [13] = "Trinket1",
  [14] = "Trinket2",
  [15] = "Back",
  [16] = "MainHand",
  [17] = "OffHand",
  [18] = "Ranged",
  [19] = "Tabard",
  [4]  = "Shirt",
}

-- Boss names we watch for in the combat log
local TRACKED_BOSSES = {
  ["Edwin VanCleef"]        = true,  -- Deadmines       → cap 22
  ["Charlga Razorflank"]    = true,  -- Razorfen Kraul  → cap 29
  ["Arcanist Doan"]         = true,  -- SM Library      → cap 37
  ["Archaedas"]             = true,  -- Uldaman         → cap 42
  ["Chief Ukorz Sandscalp"] = true,  -- Zul'Farrak      → cap 48
  ["Shade of Eranikus"]     = true,  -- Sunken Temple   → cap 52
  ["Baron Rivendare"]       = true,  -- Stratholme      → cap 60
}

local gearDebounceTimer = nil
local GEAR_DEBOUNCE_SECONDS = 3

-- ─── Helpers ────────────────────────────────────────────────────────────────

local function GetPartyMembers()
  local members = {}
  local count = GetNumGroupMembers()
  if count > 0 then
    for i = 1, count do
      -- Works for both party and raid
      local name = GetRaidRosterInfo(i)
      if name then
        members[#members + 1] = name
      end
    end
  end
  -- Always include self
  members[#members + 1] = UnitName("player")
  return members
end

-- Extract crafter name from an item link.
-- Crafted links embed the crafter in position 8 of the item string: item:id:0:0:0:0:0:crafter_id
-- Classic does NOT embed the crafter name in the link natively — we return nil.
-- The electron app will resolve this server-side if needed.
local function GetCrafterFromLink(itemLink)
  if not itemLink then return nil end
  -- TBC crafted items embed crafter name directly as the last non-zero field
  local crafter = itemLink:match("|Hitem:%d+:%d+:%d+:%d+:%d+:%d+:%-?%d+:%d+:(%a[^|:]*)|")
  if crafter and crafter ~= "" and crafter ~= "0" then
    return crafter
  end
  return nil
end

local function GetItemIcon(itemLink)
  if not itemLink then return nil end
  local itemId = itemLink:match("|Hitem:(%d+):")
  if not itemId then return nil end
  local _, _, _, _, _, _, _, _, _, texture = GetItemInfo(itemLink)
  if texture then
    -- Strip path, return just the icon name
    return texture:match("([^\\]+)$"):lower()
  end
  return nil
end

-- ─── Profession Snapshot ────────────────────────────────────────────────────

local function SnapshotProfessions()
  local professions = {}
  -- GetProfessions returns up to 6 indices (primary x2, secondary x4)
  local p1, p2, a1, a2, a3, a4 = GetProfessions()
  local indices = { p1, p2, a1, a2, a3, a4 }
  for _, idx in ipairs(indices) do
    if idx then
      local name, _, rank, maxRank = GetProfessionInfo(idx)
      if name then
        professions[#professions + 1] = {
          name     = name,
          skill    = rank,
          max_skill = maxRank,
        }
      end
    end
  end
  return professions
end

-- ─── Gear Snapshot ──────────────────────────────────────────────────────────

local function SnapshotGear()
  local gear = {}
  for slotId, slotName in pairs(SLOT_NAMES) do
    local itemLink = GetInventoryItemLink("player", slotId)
    if itemLink then
      local itemName = GetItemInfo(itemLink)
      gear[#gear + 1] = {
        slot        = slotId,
        slot_name   = slotName,
        item_link   = itemLink,
        item_name   = itemName or "",
        icon        = GetItemIcon(itemLink),
        crafter_name = GetCrafterFromLink(itemLink),
      }
    end
  end
  return gear
end

-- ─── Write to SavedVariables ─────────────────────────────────────────────────

local function WriteSnapshot(reason)
  local playerName = UnitName("player")
  local _, playerClass = UnitClass("player")
  local playerLevel = UnitLevel("player")

  CompapionDB.character = {
    name    = playerName,
    class   = playerClass,
    level   = playerLevel,
  }
  CompapionDB.professions   = SnapshotProfessions()
  CompapionDB.gear          = SnapshotGear()
  CompapionDB.last_updated  = time()
  CompapionDB.version       = 1

  -- boss_kills accumulate; we never overwrite them here
  CompapionDB.boss_kills = CompapionDB.boss_kills or {}
end

-- ─── Gear Debounce ───────────────────────────────────────────────────────────

local function ScheduleGearSnapshot()
  if gearDebounceTimer then
    gearDebounceTimer:Cancel()
  end
  gearDebounceTimer = C_Timer.NewTimer(GEAR_DEBOUNCE_SECONDS, function()
    gearDebounceTimer = nil
    WriteSnapshot("gear_change")
  end)
end

-- ─── Boss Kill Detection ──────────────────────────────────────────────────────

local function OnCombatLogEvent()
  local _, eventType, _, _, _, _, _, destName = CombatLogGetCurrentEventInfo()
  if eventType ~= "UNIT_DIED" then return end
  if not TRACKED_BOSSES[destName] then return end

  CompapionDB.boss_kills = CompapionDB.boss_kills or {}
  -- Avoid duplicate kills (same boss, same session)
  for _, kill in ipairs(CompapionDB.boss_kills) do
    if kill.boss_name == destName then return end
  end

  CompapionDB.boss_kills[#CompapionDB.boss_kills + 1] = {
    boss_name     = destName,
    killed_at     = time(),
    party_members = GetPartyMembers(),
  }
end

-- ─── Frame & Event Registration ──────────────────────────────────────────────

local frame = CreateFrame("Frame", ADDON_NAME .. "Frame")

frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("PLAYER_LOGOUT")
frame:RegisterEvent("SKILL_LINES_CHANGED")
frame:RegisterEvent("PLAYER_EQUIPMENT_CHANGED")
frame:RegisterEvent("COMBAT_LOG_EVENT_UNFILTERED")

frame:SetScript("OnEvent", function(self, event, ...)
  if event == "PLAYER_LOGIN" then
    WriteSnapshot("login")
    print("|cff00ccff[Compapion]|r Loaded. Tracking professions, gear, and boss kills.")

  elseif event == "PLAYER_LOGOUT" then
    WriteSnapshot("logout")

  elseif event == "SKILL_LINES_CHANGED" then
    WriteSnapshot("skill_change")

  elseif event == "PLAYER_EQUIPMENT_CHANGED" then
    ScheduleGearSnapshot()

  elseif event == "COMBAT_LOG_EVENT_UNFILTERED" then
    OnCombatLogEvent()
  end
end)
