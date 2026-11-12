// ============================================
// RENEGADES GUILD — APPS SCRIPT BACKEND v3.5
// Handles: Registration + Mission Log + Notices + Edit + Delete + Approve/Reject + Founder Images
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
    } else {
      return jsonResponse("error", "Unknown action.");
    }
  } catch (err) {
    return jsonResponse("error", err.toString());
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "founder_images") {
    const payload = JSON.stringify({
      result: "success",
      images: getFounderImageIds()
    });
    const callback = (e.parameter.callback || "").toString();
    if (callback) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
        return jsonResponse("error", "Invalid callback.");
      }
      return ContentService.createTextOutput(callback + "(" + payload + ");")
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(payload)
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput("RENEG▲DES API v3.5 — Online.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function jsonResponse(status, msg) {
  return ContentService.createTextOutput(JSON.stringify({
    result: status, message: msg
  })).setMimeType(ContentService.MimeType.JSON);
}

// ========== FOUNDER IMAGES ==========
const FOUNDER_IMAGE_NAMES = ["NEZUMI", "OUJI", "TEN", "MAMIKI", "SAM"];
const FOUNDER_IMAGE_FOLDER_KEY = "FOUNDER_IMAGE_FOLDER_ID";

function getFounderImageIds() {
  const properties = PropertiesService.getScriptProperties();
  const images = {};
  FOUNDER_IMAGE_NAMES.forEach(name => {
    const fileId = properties.getProperty("FOUNDER_IMAGE_" + name);
    if (fileId) images[name] = fileId;
  });
  return images;
}

function getFounderImageFolder() {
  const properties = PropertiesService.getScriptProperties();
  let folderId = properties.getProperty(FOUNDER_IMAGE_FOLDER_KEY);
  if (!folderId) {
    const folder = DriveApp.createFolder("Renegades Guild Founder Portraits");
    folderId = folder.getId();
    properties.setProperty(FOUNDER_IMAGE_FOLDER_KEY, folderId);
  }
  return DriveApp.getFolderById(folderId);
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
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageData) || imageData.length > 700000) {
    return jsonResponse("error", "Invalid or oversized portrait image.");
  }

  const bytes = Utilities.base64Decode(imageData);
  if (bytes.length > 512 * 1024 ||
      bytes.length < 4 ||
      (bytes[0] & 255) !== 255 ||
      (bytes[1] & 255) !== 216 ||
      (bytes[bytes.length - 2] & 255) !== 255 ||
      (bytes[bytes.length - 1] & 255) !== 217) {
    return jsonResponse("error", "Portrait must be a JPEG no larger than 512 KB.");
  }

  const blob = Utilities.newBlob(bytes, "image/jpeg", "founder-" + founder.toLowerCase() + ".jpg");
  const file = getFounderImageFolder().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  PropertiesService.getScriptProperties().setProperty("FOUNDER_IMAGE_" + founder, file.getId());

  return jsonResponse("success", founder + " portrait saved.");
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