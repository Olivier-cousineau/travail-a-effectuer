/**
 * Deploy as Web App and set SHEET_NAME if needed.
 */
const SHEET_NAME = 'jobs';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    if (action === 'listJobs') return json_({ ok: true, jobs: listJobs_() });
    if (action === 'createJob') return json_({ ok: true, job: createJob_(body) });
    if (action === 'markDone') return json_({ ok: true, job: markDone_(body) });

    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['id', 'created_at', 'truck_number', 'job_description', 'status', 'completion_date', 'employee_name', 'comments', 'photo_data_url']);
  }
  return sh;
}

function listJobs_() {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  return values.slice(1).map((row) => rowToObj_(headers, row)).reverse();
}

function createJob_(body) {
  const sh = sheet_();
  const id = Utilities.getUuid();
  const created_at = new Date().toISOString();
  const status = body.status || 'Not done';
  const completion_date = status === 'Done' ? (body.completion_date || created_at.slice(0, 10)) : '';

  const record = {
    id,
    created_at,
    truck_number: String(body.truck_number || ''),
    job_description: String(body.job_description || ''),
    status,
    completion_date,
    employee_name: String(body.employee_name || ''),
    comments: String(body.comments || ''),
    photo_data_url: String(body.photo_data_url || ''),
  };

  validate_(record);

  sh.appendRow([
    record.id,
    record.created_at,
    record.truck_number,
    record.job_description,
    record.status,
    record.completion_date,
    record.employee_name,
    record.comments,
    record.photo_data_url,
  ]);

  return record;
}

function markDone_(body) {
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('id') + 1;
  const statusCol = headers.indexOf('status') + 1;
  const completionCol = headers.indexOf('completion_date') + 1;
  if (!idCol || !statusCol || !completionCol) throw new Error('Missing required columns');

  const targetId = String(body.id || '');
  if (!targetId) throw new Error('Missing id');

  for (let r = 2; r <= sh.getLastRow(); r++) {
    if (String(sh.getRange(r, idCol).getValue()) === targetId) {
      const date = String(body.completion_date || new Date().toISOString().slice(0, 10));
      sh.getRange(r, statusCol).setValue('Done');
      sh.getRange(r, completionCol).setValue(date);
      return { id: targetId, status: 'Done', completion_date: date };
    }
  }

  throw new Error('Job not found');
}

function validate_(record) {
  if (!record.truck_number) throw new Error('truck_number is required');
  if (!record.job_description) throw new Error('job_description is required');
  if (!record.employee_name) throw new Error('employee_name is required');
  if (!record.photo_data_url) throw new Error('photo_data_url is required');
}

function rowToObj_(headers, row) {
  const out = {};
  headers.forEach((h, i) => out[h] = row[i] == null ? '' : String(row[i]));
  return out;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
