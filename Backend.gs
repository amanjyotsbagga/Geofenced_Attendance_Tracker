const CONFIG = {
  SPREADSHEET_ID: 'PASTE_SPREADSHEET_ID_HERE',
  ADMIN_EMAIL: 'admin@example.com',
  GEOFENCE_CENTER: {
    lat: 0,
    lng: 0
  },
  GEOFENCE_RADIUS_METERS: 100
};

const SHEETS = {
  EMPLOYEES: 'Employees',
  ATTENDANCE: 'Attendance'
};

const EMPLOYEE_HEADERS = [
  'Name',
  'Hourly Rate',
  'Status',
  'Last Device ID',
  'Last Seen At'
];

const ATTENDANCE_HEADERS = [
  'Timestamp',
  'Name',
  'Status',
  'Latitude',
  'Longitude',
  'Distance (m)',
  'Within Geofence',
  'Device ID',
  'Device Anomaly',
  'Browser',
  'OS',
  'Device Type',
  'Device Vendor',
  'Device Model',
  'Hourly Rate',
  'Session Hours',
  'Session Wage'
];

function doGet() {
  ensureSetup_();
  return HtmlService.createHtmlOutputFromFile('Frontend').setTitle('Geofenced Attendance Tracker');
}

function getActiveEmployees() {
  ensureSetup_();
  var sheet = getSheet_(SHEETS.EMPLOYEES);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return [];
  }

  var rows = values.slice(1);
  var result = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var name = String(row[0] || '').trim();
    var status = String(row[2] || '').trim().toUpperCase();
    if (name && status === 'ACTIVE') {
      result.push(name);
    }
  }

  return result;
}

function processSubmission(payload) {
  ensureSetup_();

  var data = payload || {};
  var name = String(data.name || '').trim();
  var status = String(data.status || '').trim().toUpperCase();
  var latitude = Number(data.latitude);
  var longitude = Number(data.longitude);
  var deviceInfo = data.deviceInfo || {};

  if (!name) {
    throw new Error('Employee name is required.');
  }

  if (status !== 'IN' && status !== 'OUT') {
    throw new Error('Status must be IN or OUT.');
  }

  if (!isFinite(latitude) || !isFinite(longitude)) {
    throw new Error('Valid location coordinates are required.');
  }

  var employeesSheet = getSheet_(SHEETS.EMPLOYEES);
  var employee = findEmployee_(employeesSheet, name);

  if (!employee) {
    throw new Error('Employee not found.');
  }

  if (employee.status !== 'ACTIVE') {
    throw new Error('Employee is not active.');
  }

  var distance = calculateDistanceMeters_(
    CONFIG.GEOFENCE_CENTER.lat,
    CONFIG.GEOFENCE_CENTER.lng,
    latitude,
    longitude
  );
  var withinFence = distance <= CONFIG.GEOFENCE_RADIUS_METERS;

  if (!withinFence) {
    throw new Error('You are outside the geofence by ' + Math.round(distance) + ' meters.');
  }

  var now = new Date();
  var deviceId = String(deviceInfo.deviceId || '').trim();
  var anomaly = detectDeviceAnomaly_(employee, deviceId);
  updateEmployeeDevice_(employeesSheet, employee.rowIndex, deviceId, now);

  var attendanceSheet = getSheet_(SHEETS.ATTENDANCE);
  var sessionData = getSessionData_(attendanceSheet, name, status, now, Number(employee.hourlyRate || 0));

  attendanceSheet.appendRow([
    now,
    name,
    status,
    latitude,
    longitude,
    Math.round(distance),
    withinFence ? 'YES' : 'NO',
    deviceId,
    anomaly ? 'YES' : 'NO',
    String(deviceInfo.browser || ''),
    String(deviceInfo.os || ''),
    String(deviceInfo.deviceType || ''),
    String(deviceInfo.deviceVendor || ''),
    String(deviceInfo.deviceModel || ''),
    Number(employee.hourlyRate || 0),
    sessionData.hours,
    sessionData.wage
  ]);

  return {
    ok: true,
    message: 'Recorded ' + status + ' for ' + name,
    distanceMeters: Math.round(distance),
    deviceAnomaly: anomaly,
    sessionHours: sessionData.hours,
    sessionWage: sessionData.wage
  };
}

function ensureSetup_() {
  var spreadsheet = getSpreadsheet_();
  var employeesSheet = spreadsheet.getSheetByName(SHEETS.EMPLOYEES) || spreadsheet.insertSheet(SHEETS.EMPLOYEES);
  var attendanceSheet = spreadsheet.getSheetByName(SHEETS.ATTENDANCE) || spreadsheet.insertSheet(SHEETS.ATTENDANCE);

  ensureHeaderRow_(employeesSheet, EMPLOYEE_HEADERS);
  ensureHeaderRow_(attendanceSheet, ATTENDANCE_HEADERS);
}

function getSpreadsheet_() {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID === 'PASTE_SPREADSHEET_ID_HERE') {
    throw new Error('Set CONFIG.SPREADSHEET_ID in Code.gs before deploying.');
  }

  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function getSheet_(name) {
  var spreadsheet = getSpreadsheet_();
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function ensureHeaderRow_(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = range.getValues()[0];
  var empty = true;

  for (var i = 0; i < current.length; i++) {
    if (String(current[i] || '').trim()) {
      empty = false;
      break;
    }
  }

  if (empty) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function findEmployee_(sheet, name) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var rowName = String(row[0] || '').trim();
    if (rowName === name) {
      return {
        rowIndex: i + 1,
        name: rowName,
        hourlyRate: row[1],
        status: String(row[2] || '').trim().toUpperCase(),
        lastDeviceId: String(row[3] || '').trim(),
        lastSeenAt: row[4]
      };
    }
  }

  return null;
}

function updateEmployeeDevice_(sheet, rowIndex, deviceId, timestamp) {
  sheet.getRange(rowIndex, 4).setValue(deviceId || '');
  sheet.getRange(rowIndex, 5).setValue(timestamp);
}

function detectDeviceAnomaly_(employee, deviceId) {
  if (!employee.lastDeviceId) {
    return false;
  }

  if (!deviceId) {
    return false;
  }

  return employee.lastDeviceId !== deviceId;
}

function getSessionData_(attendanceSheet, name, status, now, hourlyRate) {
  if (status !== 'OUT') {
    return {
      hours: '',
      wage: ''
    };
  }

  var lastIn = findLatestOpenIn_(attendanceSheet, name, now);
  if (!lastIn) {
    return {
      hours: '',
      wage: ''
    };
  }

  var hours = (now.getTime() - lastIn.getTime()) / (1000 * 60 * 60);
  var roundedHours = Math.max(0, Math.round(hours * 100) / 100);

  return {
    hours: roundedHours,
    wage: Math.max(0, Math.round(roundedHours * hourlyRate * 100) / 100)
  };
}

function findLatestOpenIn_(attendanceSheet, name, now) {
  var values = attendanceSheet.getDataRange().getValues();
  var today = formatDateKey_(now);

  for (var i = values.length - 1; i >= 1; i--) {
    var row = values[i];
    var timestamp = row[0];
    var rowName = String(row[1] || '').trim();
    var status = String(row[2] || '').trim().toUpperCase();

    if (rowName !== name || status !== 'IN' || !(timestamp instanceof Date)) {
      continue;
    }

    if (formatDateKey_(timestamp) === today) {
      return timestamp;
    }
  }

  return null;
}

function formatDateKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function calculateDistanceMeters_(lat1, lon1, lat2, lon2) {
  var earthRadius = 6371000;
  var toRadians = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRadians;
  var dLon = (lon2 - lon1) * toRadians;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRadians) * Math.cos(lat2 * toRadians) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}
