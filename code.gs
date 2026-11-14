// ============================================
// RENEGADES GUILD — APPS SCRIPT BACKEND v4.3
// Handles: Registration + Mission Log + Notices + Applications + Founder Data and Images
// ============================================

const FOUNDER_PASSWORD = "RIPCOF2026"; // Founder Access Password

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action || "register";

    if (action === "register") {
      return handleRegistration(data);
    } else if (action === "mission") {
      return handleMission(data);
    } else if (action === "notice") {
      return handleNotice(data);
    } else if (action === "notice_edit") {
      return handleNoticeEdit(data);
    } else if (action === "notice_delete") {
      return handleNoticeDelete(data);
    } else if (action === "approve_application" || action === "reject_application") {
      return handleApplicationStatus(data, action === "approve_application" ? "Approved" : "Rejected");
    } else if (action === "founder_image") {
      return handleFounderImage(data);
    } else if (action === "founder_details") {
      return handleFounderDetails(data);
    } else if (action === "member_details") {
      return handleMemberDetails(data);
    } else if (action === "member_image") {
      return handleMemberImage(data);
    } else {
      return jsonResponse("error", "Unknown action.");
    }
  } catch (err) {
    return jsonResponse("error", err.toString());
  }
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : "";
  if (action === "founders" || action === "founder_images" || action === "members") {
    const payload = { result: "success" };
    if (action === "founders" || action === "founder_images") {
      payload.images = getFounderImageIds();
    }
    if (action === "founders") {
      const spreadsheet = getFounderSpreadsheet();
      payload.founders = getFounderRecords(spreadsheet);
      const founderSheet = spreadsheet.getSheetByName(FOUNDER_SHEET_NAME);
      payload.spreadsheetUrl = spreadsheet.getUrl().replace(/#.*$/, "") + "#gid=" + founderSheet.getSheetId();
    }
    if (action === "members") payload.members = getApprovedMemberRecords();
    const serialized = JSON.stringify(payload);
    const callback = (e.parameter.callback || "").toString();
    if (callback) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
        return jsonResponse("error", "Invalid callback.");
      }
      return ContentService.createTextOutput(callback + "(" + serialized + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(serialized)
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("RENEG▲DES API v4.3 — Online.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(status, msg) {
  return ContentService.createTextOutput(JSON.stringify({
    result: status, message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========== FOUNDER DATA AND IMAGES ==========
const FOUNDER_IMAGE_NAMES = ["NEZUMI", "OUJI", "TEN", "MAMIKI", "SAM"];
const FOUNDER_IMAGE_FOLDER_ID = "1MEJa1RzYbqnBlwZta0JZ8u0fTNe2zScS";
const FOUNDER_SHEET_NAME = "Founders";
const FOUNDER_SPREADSHEET_ID_KEY = "RENEGADES_SPREADSHEET_ID";
const FOUNDER_SHEET_HEADERS = [
  "file", "name", "handle", "role", "weapon", "rank", "rankIcon",
  "country", "age", "blood", "sign", "smule", "skills", "style",
  "personality", "tattoo", "food", "flower", "animal", "story"
];
const FOUNDER_EDITABLE_FIELDS = [
  "handle", "role", "weapon", "rank", "rankIcon", "country", "age", "blood",
  "sign", "smule", "skills", "style", "personality", "tattoo", "food",
  "flower", "animal", "story"
];
const MEMBER_EDITABLE_FIELDS = [
  "smule", "country", "age", "blood", "sign", "role", "skills", "style",
  "weapon", "personality", "tattoo", "food", "flower", "animal"
];
const MEMBER_RECORD_FIELDS = MEMBER_EDITABLE_FIELDS.concat(["image"]);
const FOUNDER_DEFAULT_ROWS = [
  ["001", "NEZUMI", "Nezumiii", "Network Overseer", "Electro Brass Knuckles", "Founder", "🜏", "Neo-Brazil", "31", "O+", "Cancer ♋ (July 13)", "@Nezumiii", "Close-quarters combat, territorial defense", "Bruiser / Landlord & Warden", "Blunt, Possessive, Protective", "left side of the neck", "Cake", "Hydrangea", "Whale",
    "Nezu — handle Nezumiii — is a thirty-one-year-old bruiser out of the neon-choked sprawl of Neo-Brazil, their O+ blood marking them as a universal donor in a city that bleeds people dry.\n\nWithin the guild, they're the Landlord and Warden — the one who holds the keys, guards the walls, and makes sure nobody forgets whose ground they're standing on. Blunt, possessive, and fiercely protective, Nezu treats the guild like personal territory: step inside and you're under their shield, threaten it and you're scrap metal.\n\nNo fancy chrome or long-range tech — just reinforced brass knuckles and brutal close-quarters combat that ends arguments before they start.\n\nBorn July 13th under Cancer ♋, they're the perfect armored guardian: hard shell, iron grip, and utterly merciless to anyone who breaches their walls."],
  ["002", "OUJI", "NatsuOuji", "Waste Grid Custodian", "Twin Tian Swords", "Founder", "🜏", "West Jap(v)anese", "99", "Ø (Synthetic)", "Orion", "@NatsuOuji", "Archive decoding, faction intelligence", "Curator / Shadow Operative", "Sleepy-eyed, Observant, Silent", "top of left hand", "Egg", "Jasmine", "Cat",
    "Ouji — handle NatsuOuji — is a ninety-nine-year-old keeper in the rusted sprawl of West Jap(v)anese, a world where steel towers crumble and new guilds rise from the wreckage. His synthetic blood type Ø lets him outlast what the wasteland takes from everyone else.\n\nWithin the guild he serves as Curator, safeguarding old-world archives and decoding forgotten data — but that's only the cover. Beneath it, he moves between factions as a shadow, gathering secrets under the guise of quiet scholarship.\n\nSleepy-eyed and slow to speak, he'd rather watch from the corner of a firelit hall than stand at its centre, learning every face and every weakness.\n\nBorn under the sign of Orion, he wears that old defiance like the chronometer on his wrist — saying nothing, explaining less."],
  ["003", "TEN", "96_10", "Safehouse Warden", "96 Dagger", "Founder", "🜏", "Irradiated USA", "30", "O", "Taurus ♉", "@96_10", "Bare-handed combat, safehouse hospitality", "Brawler / Innkeeper", "Easy-going, Warm, Unforgiving", "Mid-forearm (wrap)", "Melon Pan", "Spider Lily", "Bird",
    "Ten — handle 96_10 — is a thirty-year-old brawler from the irradiated sprawl of what was once the USA, her blood type O marking her as a universal donor in a world that always needs something from everyone else.\n\nWithin the guild she's the Innkeeper, and on most nights she's the easiest soul in the room — laughing, pouring drinks, earrings catching the firelight as she dozes off behind the counter. Easy-going, warm, the kind of calm that makes every wanderer feel welcome.\n\nBut cross her wrong and that warmth dies fast — her cold stare is enough to shake the guildhall walls, and the sleepy bartender closes the distance bare-handed before you can blink. A renegade's mark wraps her mid-forearm, a brand she's too chill to care about — until she isn't.\n\nBorn under Taurus ♉, she's patient as stone, and just as unforgiving when pushed."],
  ["004", "MAMIKI", "8maamiki", "Blood-Code Enchantress", "Whisper Longbow", "Founder", "🜏", "Drowned Indonesia", "220", "A", "Cancer ♋", "@8maamiki", "Long-range precision, ancient counsel", "Advisor / Harbinger / Artist", "Quiet, Wise, Relentless", "left ankle", "Dango", "Wild Rose", "Cat",
    "Mami — handle 8maamiki — is a two-hundred-and-twenty-year-old archer from the drowned coasts of what was once Indonesia, now just another fractured territory in the wasteland. Half-vampire, she has outlived centuries with unnatural grace, her blood type A kept pure by the very curse running through her veins.\n\nWithin the guild she serves as Advisor — the one younger members seek when the wasteland wears them down, her words quiet but heavy with the kind of wisdom only time and hunger can teach.\n\nShe is also a harbinger and artist, a deadly shot who paints with arrows before the enemy even knows they're marked. She fights like a shadow — silent, precise, always one step ahead — driven by a single creed: every arrow loosed is a lesson the next one will remember.\n\nBorn under Cancer ♋, she carries the tide in her — patient, relentless, and impossible to pull back."],
  ["005", "SAM", "moemelonyan", "Data Vault Archivist", "Rift Butterfly Knife", "Founder", "🜏", "Rain-soaked UK ruins", "25", "Red (Unclassified)", "Virgo ♍ (Aug 25)", "@moemelonyan", "Ledger tracking, contract enforcement", "Handler / Bookkeeper", "Aloof, Sharp-tongued, Deeply Loyal", "inside left cat ear", "Sweets", "Wisteria", "Cat",
    "Sam — handle moemelonyan — is a twenty-five-year-old drifter with no fixed coordinates, though their accent ghosts somewhere around the rain-soaked ruins of the old UK. Their blood type is listed as simply \"red,\" which is either a medical anomaly or a flat refusal to be categorized — take your pick.\n\nWithin the guild, Sam is the Handler and Bookkeeper, the quiet one tracking every credit, every contract, every debt owed. Don't let the ledger fool you: when the numbers stop adding up, a butterfly knife spins between their fingers with lethal, feline precision.\n\nSam fights like a cat — silent, sudden, all claws and no warning. Aloof at first glance, sharp-tongued and seemingly cold, but earn their trust and you'll find a loyalty that runs deeper than most.\n\nBorn August 25th under Virgo ♍, they're meticulous, calculating, and quietly devoted to the few they let past the hiss."]
];

function getFounderSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(FOUNDER_SPREADSHEET_ID_KEY);
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Run initializeFounderSheet from the bound spreadsheet script before deploying.");
  }
  properties.setProperty(FOUNDER_SPREADSHEET_ID_KEY, spreadsheet.getId());
  return spreadsheet;
}

function initializeFounderSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open this script from the guild spreadsheet and run it again.");
  PropertiesService.getScriptProperties().setProperty(
    FOUNDER_SPREADSHEET_ID_KEY,
    spreadsheet.getId()
  );
  getFounderRecords(spreadsheet);
}

function getFounderImageIds() {
  const properties = PropertiesService.getScriptProperties();
  const images = {};
  FOUNDER_IMAGE_NAMES.forEach(name => {
    const fileId = properties.getProperty("FOUNDER_IMAGE_" + name);
    if (fileId) images[name] = fileId;
  });
  return images;
}

function getFounderRecords(spreadsheet) {
  if (!spreadsheet) throw new Error("This Apps Script project must be bound to the guild spreadsheet.");

  let sheet = spreadsheet.getSheetByName(FOUNDER_SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(FOUNDER_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, FOUNDER_SHEET_HEADERS.length).setValues([FOUNDER_SHEET_HEADERS]);
    sheet.getRange(2, 1, FOUNDER_DEFAULT_ROWS.length, FOUNDER_SHEET_HEADERS.length)
      .setValues(FOUNDER_DEFAULT_ROWS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, FOUNDER_SHEET_HEADERS.length).setFontWeight("bold");
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => header.toString().trim().toLowerCase());
  const columns = {};
  FOUNDER_SHEET_HEADERS.forEach(header => {
    const column = headers.indexOf(header.toLowerCase());
    if (column === -1) throw new Error("Founders sheet is missing the '" + header + "' column.");
    columns[header] = column;
  });

  const seen = {};
  const founders = values.slice(1).filter(row => row[columns.name].trim() !== "").map(row => {
    const founder = {};
    FOUNDER_SHEET_HEADERS.forEach(header => {
      founder[header] = row[columns[header]].trim();
    });
    founder.name = founder.name.toUpperCase();
    if (FOUNDER_IMAGE_NAMES.indexOf(founder.name) === -1) {
      throw new Error("Unknown founder name in Founders sheet: " + founder.name);
    }
    if (seen[founder.name]) throw new Error("Duplicate founder in Founders sheet: " + founder.name);
    seen[founder.name] = true;
    return founder;
  });
  if (!founders.length) throw new Error("The Founders sheet does not contain any founder rows.");
  const missing = FOUNDER_IMAGE_NAMES.filter(name => !seen[name]);
  if (missing.length) throw new Error("Founders sheet is missing rows for: " + missing.join(", ") + ".");
  return founders;
}

function handleFounderDetails(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }

  const founder = (data.founder || "").toString().trim().toUpperCase();
  if (FOUNDER_IMAGE_NAMES.indexOf(founder) === -1) {
    return jsonResponse("error", "Unknown founder.");
  }
  if (!data.details || typeof data.details !== "object" || Array.isArray(data.details)) {
    return jsonResponse("error", "Founder details are missing or invalid.");
  }

  const details = {};
  FOUNDER_EDITABLE_FIELDS.forEach(field => {
    const value = data.details[field];
    if (typeof value !== "string") {
      throw new Error("Invalid founder detail: " + field);
    }
    const maxLength = field === "story" ? 4000 : 200;
    if (value.length > maxLength) {
      throw new Error(field + " must be no more than " + maxLength + " characters.");
    }
    details[field] = value.trim();
  });

  const spreadsheet = getFounderSpreadsheet();
  getFounderRecords(spreadsheet);
  const sheet = spreadsheet.getSheetByName(FOUNDER_SHEET_NAME);
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => header.toString().trim().toLowerCase());
  const nameColumn = headers.indexOf("name");
  const rowIndex = values.findIndex((row, index) =>
    index > 0 && row[nameColumn].trim().toUpperCase() === founder
  );
  if (rowIndex === -1) return jsonResponse("error", "Founder not found in Founders sheet.");

  FOUNDER_EDITABLE_FIELDS.forEach(field => {
    const column = headers.indexOf(field.toLowerCase());
    if (column === -1) throw new Error("Founders sheet is missing the '" + field + "' column.");
    sheet.getRange(rowIndex + 1, column + 1).setValue(details[field]);
  });

  return jsonResponse("success", founder + " details updated.");
}

function getApprovedMemberRecords() {
  const sheet = getFounderSpreadsheet().getSheetByName("RENEGADES Database");
  if (!sheet) throw new Error("Sheet 'RENEGADES Database' not found.");

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) throw new Error("The member database is empty.");
  const headers = values[0].map(header => header.toString().trim().toLowerCase());
  const columns = {};
  ["timestamp", "name", "status", "cofs"].concat(MEMBER_RECORD_FIELDS).forEach(header => {
    const column = headers.indexOf(header);
    if (column === -1) throw new Error("Member database is missing the '" + header + "' column.");
    columns[header] = column;
  });

  return values.slice(1).reduce((members, row, index) => {
    if (row[columns.status].trim().toLowerCase() !== "approved" || !row[columns.name].trim()) {
      return members;
    }
    const member = {
      rowIndex: index + 2,
      timestamp: row[columns.timestamp].trim(),
      name: row[columns.name].trim(),
      cofs: row[columns.cofs].trim()
    };
    MEMBER_RECORD_FIELDS.forEach(field => {
      member[field] = row[columns[field]].trim();
    });
    members.push(member);
    return members;
  }, []);
}

function handleMemberDetails(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }
  if (!data.details || typeof data.details !== "object" || Array.isArray(data.details)) {
    return jsonResponse("error", "Member details are missing or invalid.");
  }

  const details = {};
  MEMBER_EDITABLE_FIELDS.forEach(field => {
    const value = data.details[field];
    if (typeof value !== "string") {
      throw new Error("Invalid member detail: " + field);
    }
    const maxLength = 500;
    if (value.length > maxLength) {
      throw new Error(field + " must be no more than " + maxLength + " characters.");
    }
    details[field] = value.trim();
  });

  const target = findApprovedMemberTarget(data);
  if (target.error) return jsonResponse("error", target.error);

  MEMBER_EDITABLE_FIELDS.forEach(field => {
    const column = target.headers.indexOf(field);
    if (column === -1) throw new Error("Member database is missing the '" + field + "' column.");
    target.sheet.getRange(target.rowNumber, column + 1).setValue(details[field]);
  });

  return jsonResponse("success", target.name + " details updated.");
}

function findApprovedMemberTarget(data) {
  const rowNumber = Number(data.row_index);
  const name = (data.name || "").toString().trim();
  const timestamp = (data.timestamp || "").toString().trim();
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || !name) {
    return { error: "Member record is missing or invalid." };
  }

  const sheet = getFounderSpreadsheet().getSheetByName("RENEGADES Database");
  if (!sheet) throw new Error("Sheet 'RENEGADES Database' not found.");
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => header.toString().trim().toLowerCase());
  const nameColumn = headers.indexOf("name");
  const statusColumn = headers.indexOf("status");
  const timestampColumn = headers.indexOf("timestamp");
  if (nameColumn === -1 || statusColumn === -1 || timestampColumn === -1) {
    throw new Error("The member database is missing a required identity column.");
  }

  const matchesIdentity = row =>
    row[nameColumn].trim() === name &&
    (!timestamp || row[timestampColumn].trim() === timestamp);
  let targetIndex = rowNumber - 1;
  if (!values[targetIndex] || !matchesIdentity(values[targetIndex])) {
    targetIndex = timestamp
      ? values.findIndex((row, index) => index > 0 && matchesIdentity(row))
      : -1;
  }
  if (targetIndex < 1) return { error: "Member record changed or is no longer available." };
  if (values[targetIndex][statusColumn].trim().toLowerCase() !== "approved") {
    return { error: "Only approved members can be edited." };
  }
  return {
    sheet: sheet,
    headers: headers,
    rowNumber: targetIndex + 1,
    name: name
  };
}

function handleMemberImage(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }

  const target = findApprovedMemberTarget(data);
  if (target.error) return jsonResponse("error", target.error);

  const imageData = (data.imageData || "").toString();
  const fileName = "member-" + target.name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") + ".jpg";
  const blob = createPortraitBlob(imageData, fileName);
  const file = getFounderImageFolder().createFile(blob);
  const imageUrl = "https://drive.google.com/thumbnail?id=" + encodeURIComponent(file.getId()) + "&sz=w800";
  const imageColumn = target.headers.indexOf("image");
  if (imageColumn === -1) throw new Error("Member database is missing the 'image' column.");
  target.sheet.getRange(target.rowNumber, imageColumn + 1).setValue(imageUrl);

  return jsonResponse("success", target.name + " portrait saved.");
}

function getFounderImageFolder() {
  return DriveApp.getFolderById(FOUNDER_IMAGE_FOLDER_ID);
}

function authorizeFounderImageUploads() {
  const folder = getFounderImageFolder();
  let probe;
  try {
    probe = folder.createFile(
      "renegades-drive-upload-check.txt",
      "Temporary upload authorization check.",
      MimeType.PLAIN_TEXT
    );
  } finally {
    if (probe) probe.setTrashed(true);
  }
}

function handleFounderImage(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }

  const founder = (data.founder || "").toString().trim().toUpperCase();
  if (FOUNDER_IMAGE_NAMES.indexOf(founder) === -1) {
    return jsonResponse("error", "Unknown founder.");
  }

  const imageData = (data.imageData || "").toString();
  const blob = createPortraitBlob(imageData, "founder-" + founder.toLowerCase() + ".jpg");
  const file = getFounderImageFolder().createFile(blob);
  PropertiesService.getScriptProperties().setProperty("FOUNDER_IMAGE_" + founder, file.getId());

  return jsonResponse("success", founder + " portrait saved.");
}

function createPortraitBlob(imageData, fileName) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageData) || imageData.length > 700000) {
    throw new Error("Invalid or oversized portrait image.");
  }

  const bytes = Utilities.base64Decode(imageData);
  if (bytes.length > 512 * 1024 ||
      bytes.length < 4 ||
      (bytes[0] & 255) !== 255 ||
      (bytes[1] & 255) !== 216 ||
      (bytes[bytes.length - 2] & 255) !== 255 ||
      (bytes[bytes.length - 1] & 255) !== 217) {
    throw new Error("Portrait must be a JPEG no larger than 512 KB.");
  }

  return Utilities.newBlob(bytes, "image/jpeg", fileName);
}

// ========== REGISTRATION ==========
function handleRegistration(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RENEGADES Database");
  if (!sheet) throw new Error("Sheet 'RENEGADES Database' not found.");

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const key = h.toString().trim().toLowerCase();
    return data[key] !== undefined ? data[key] : "";
  });

  sheet.appendRow(row);
  return jsonResponse("success", "Dossier received.");
}

// ========== APPROVE / REJECT APPLICATION ==========
function handleApplicationStatus(data, newStatus) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RENEGADES Database");
  if (!sheet) throw new Error("Sheet 'RENEGADES Database' not found.");

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().trim().toLowerCase());
  const nameCol = headers.indexOf("name");
  const statusCol = headers.indexOf("status");
  const tsCol = headers.indexOf("timestamp");
  if (nameCol === -1) throw new Error("'name' column not found.");
  if (statusCol === -1) throw new Error("'status' column not found.");

  const targetName = (data.name || "").toString().trim();
  const targetTs = (data.timestamp || "").toString().trim();

  // Compare timestamps whether the cell holds text or a Date.
  const tsText = v => (v instanceof Date ? v.toISOString() : v.toString().trim());
  const tsMatches = cellTs =>
    cellTs && targetTs && (cellTs === targetTs || cellTs.slice(0, 19) === targetTs.slice(0, 19));

  // 1) Row number sent by the page, verified by name so a shifted sheet can't hit the wrong row.
  let rowIdx = parseInt(data.row_index) - 1; // values[] index
  if (!(rowIdx >= 1 && rowIdx < values.length &&
        values[rowIdx][nameCol].toString().trim() === targetName)) {
    rowIdx = -1;
    // 2) Fallback: match by name + timestamp.
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][nameCol].toString().trim() !== targetName) continue;
      if (tsCol === -1 || !targetTs || tsMatches(tsText(values[i][tsCol]))) {
        rowIdx = i;
        break;
      }
    }
  }
  if (rowIdx === -1) return jsonResponse("error", "Application not found.");

  sheet.getRange(rowIdx + 1, statusCol + 1).setValue(newStatus);
  return jsonResponse("success", targetName + " marked " + newStatus + ".");
}

// ========== MISSION LOG ==========
function handleMission(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName("Mission Log");
  const mainSheet = ss.getSheetByName("RENEGADES Database");
  if (!logSheet) throw new Error("Sheet 'Mission Log' not found.");
  if (!mainSheet) throw new Error("Sheet 'RENEGADES Database' not found.");

  const memberNames = (data.member || "").split(",").map(n => n.trim()).filter(n => n.length > 0);
  if (memberNames.length === 0) return jsonResponse("error", "No member names provided.");

  const cofsToAdd = parseInt(data.cofs) || 0;
  const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  const nameCol = headers.findIndex(h => h.toString().trim().toLowerCase() === "name");
  const cofsCol = headers.findIndex(h => h.toString().trim().toLowerCase() === "cofs");

  if (nameCol === -1) throw new Error("'name' column not found.");
  if (cofsCol === -1) throw new Error("'cofs' column not found.");

  const allData = mainSheet.getDataRange().getValues();
  const results = [];

  memberNames.forEach(memberName => {
    const lower = memberName.toLowerCase();
    let found = false;

    for (let i = 1; i < allData.length; i++) {
      const cellName = allData[i][nameCol].toString().trim().toLowerCase();
      if (cellName === lower) {
        const currentCofs = parseInt(allData[i][cofsCol]) || 0;
        const newCofs = currentCofs + cofsToAdd;
        mainSheet.getRange(i + 1, cofsCol + 1).setValue(newCofs);
        allData[i][cofsCol] = newCofs;

        logSheet.appendRow([
          new Date().toISOString(),
          data.founder || "Unknown",
          memberName,
          data.mission || "",
          data.type || "General",
          cofsToAdd,
          data.notes || ""
        ]);

        results.push(memberName + ": +" + cofsToAdd + " COFs");
        found = true;
        break;
      }
    }
    if (!found) results.push(memberName + ": NOT FOUND");
  });

  return jsonResponse("success", results.join(" | "));
}

// ========== POST NOTICE ==========
function handleNotice(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const noticeSheet = ss.getSheetByName("Notices");
  if (!noticeSheet) throw new Error("Sheet 'Notices' not found.");

  const now = new Date();
  const durationHours = parseFloat(data.duration_hours) || 24;
  const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  noticeSheet.appendRow([
    now.toISOString(),
    data.title || "Untitled Notice",
    data.content || "",
    durationHours,
    data.founder || "Unknown",
    expiresAt.toISOString()
  ]);

  return jsonResponse("success", "Notice posted.");
}

// ========== EDIT NOTICE ==========
function handleNoticeEdit(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notices");
  if (!sheet) throw new Error("Sheet 'Notices' not found.");

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().trim().toLowerCase());
  const tsCol = headers.indexOf("timestamp");
  const titleCol = headers.indexOf("title");
  const contentCol = headers.indexOf("content");
  const durCol = headers.indexOf("duration_hours");
  const founderCol = headers.indexOf("founder");
  let expCol = headers.indexOf("expires_at");
  if (expCol === -1) expCol = headers.indexOf("expired_at");

  const targetTs = (data.original_timestamp || "").toString().trim();

  for (let i = 1; i < values.length; i++) {
    const cellTs = values[i][tsCol].toString().trim();
    if (cellTs === targetTs || (cellTs && targetTs && cellTs.slice(0, 19) === targetTs.slice(0, 19))) {
      const row = i + 1;
      const durationHours = parseFloat(data.duration_hours) || 24;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      if (titleCol !== -1) sheet.getRange(row, titleCol + 1).setValue(data.title || "");
      if (contentCol !== -1) sheet.getRange(row, contentCol + 1).setValue(data.content || "");
      if (durCol !== -1) sheet.getRange(row, durCol + 1).setValue(durationHours);
      if (founderCol !== -1) sheet.getRange(row, founderCol + 1).setValue(data.founder || "");
      if (expCol !== -1) sheet.getRange(row, expCol + 1).setValue(expiresAt.toISOString());

      return jsonResponse("success", "Notice updated.");
    }
  }
  return jsonResponse("error", "Notice target not found.");
}

// ========== DELETE NOTICE ==========
function handleNoticeDelete(data) {
  if (data.password !== FOUNDER_PASSWORD) {
    return jsonResponse("error", "Access denied. Invalid Founder code.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Notices");
  if (!sheet) throw new Error("Sheet 'Notices' not found.");

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => h.toString().trim().toLowerCase());
  const tsCol = headers.indexOf("timestamp");

  const targetTs = (data.original_timestamp || "").toString().trim();

  for (let i = values.length - 1; i >= 1; i--) {
    const cellTs = values[i][tsCol].toString().trim();
    if (cellTs === targetTs || (cellTs && targetTs && cellTs.slice(0, 19) === targetTs.slice(0, 19))) {
      sheet.deleteRow(i + 1);
      return jsonResponse("success", "Notice deleted.");
    }
  }
  return jsonResponse("error", "Notice target not found.");
}