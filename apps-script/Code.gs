/**
 * PersonalCRM — Google Sheets "Nhập nhanh"
 * Menu: PersonalCRM → Đồng bộ ngay / Tạo cấu trúc Sheet
 *
 * Cài đặt (1 lần):
 * 1. Mở Google Sheet mới → Extensions → Apps Script → dán toàn bộ file này.
 * 2. ⚙ Project Settings → Script Properties → thêm:
 *    - SYNC_URL   = https://yzlpegtomgtdiwvuvftw.supabase.co/functions/v1/sheet-sync
 *    - SYNC_TOKEN = <token do Claude cấp — hỏi trong chat>
 * 3. Quay lại Sheet, tải lại trang → menu "PersonalCRM" → "Tạo cấu trúc Sheet".
 * 4. Nhập liệu vào tab Persons_Input / Interactions_Input → menu → "Đồng bộ ngay".
 *
 * Quy tắc: chỉ dòng có sync_status trống hoặc ❌ mới được gửi; dòng ✅ bỏ qua.
 * Sheet chỉ là kênh NHẬP một chiều — không bao giờ xóa dữ liệu trên app.
 */

var GROUPS = ['gia_dinh', 'ban_be', 'doi_tac', 'dong_nghiep', 'con_cai', 'khac'];
var ITYPES = ['gap_mat', 'goi_dien', 'nhan_tin', 'du_lich', 'an_uong', 'cong_viec', 'khac'];

var P_HEADERS = ['full_name', 'nickname', 'group_type', 'phone', 'email', 'birthday (dd/mm/yyyy)',
  'company', 'job_title', 'tags (phẩy)', 'hobbies (phẩy)', 'facebook', 'zalo', 'linkedin', 'notes', 'sync_status'];
var I_HEADERS = ['person_phone_or_email', 'date (dd/mm/yyyy)', 'type', 'title', 'note', 'location', 'sync_status'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PersonalCRM')
    .addItem('Đồng bộ ngay', 'syncNow')
    .addItem('Tạo cấu trúc Sheet', 'setupSheet')
    .addToUi();
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var p = ss.getSheetByName('Persons_Input') || ss.insertSheet('Persons_Input');
  var i = ss.getSheetByName('Interactions_Input') || ss.insertSheet('Interactions_Input');
  var l = ss.getSheetByName('Log') || ss.insertSheet('Log');

  p.getRange(1, 1, 1, P_HEADERS.length).setValues([P_HEADERS]).setFontWeight('bold');
  i.getRange(1, 1, 1, I_HEADERS.length).setValues([I_HEADERS]).setFontWeight('bold');
  if (l.getLastRow() === 0) l.appendRow(['thời gian', 'thành công', 'lỗi', 'chi tiết']);

  // Dropdown validation
  p.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(GROUPS, true).build());
  i.getRange(2, 3, 999).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ITYPES, true).build());
  p.setFrozenRows(1); i.setFrozenRows(1);
  SpreadsheetApp.getUi().alert('Đã tạo 3 tab: Persons_Input, Interactions_Input, Log');
}

function props_() {
  var sp = PropertiesService.getScriptProperties();
  var url = sp.getProperty('SYNC_URL');
  var token = sp.getProperty('SYNC_TOKEN');
  if (!url || !token) throw new Error('Thiếu SYNC_URL / SYNC_TOKEN trong Script Properties');
  return { url: url, token: token };
}

function fmtDate_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy');
  }
  return String(v || '').trim();
}

function syncNow() {
  var cfg = props_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var pSheet = ss.getSheetByName('Persons_Input');
  var iSheet = ss.getSheetByName('Interactions_Input');
  var log = ss.getSheetByName('Log');

  var persons = [], pRows = [];
  if (pSheet && pSheet.getLastRow() > 1) {
    var pData = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, P_HEADERS.length).getValues();
    pData.forEach(function (r, idx) {
      var status = String(r[14] || '');
      if (status.indexOf('✅') === 0) return; // đã đồng bộ — bỏ qua
      if (!String(r[0] || '').trim() && !String(r[3] || '').trim()) return; // dòng trống
      persons.push({
        row: idx + 2, full_name: String(r[0] || '').trim(), nickname: String(r[1] || '').trim(),
        group_type: String(r[2] || '').trim(), phone: String(r[3] || '').trim(),
        email: String(r[4] || '').trim(), birthday: fmtDate_(r[5]),
        company: String(r[6] || '').trim(), job_title: String(r[7] || '').trim(),
        tags: String(r[8] || '').trim(), hobbies: String(r[9] || '').trim(),
        facebook: String(r[10] || '').trim(), zalo: String(r[11] || '').trim(),
        linkedin: String(r[12] || '').trim(), notes: String(r[13] || '').trim()
      });
      pRows.push(idx + 2);
    });
  }

  var interactions = [];
  if (iSheet && iSheet.getLastRow() > 1) {
    var iData = iSheet.getRange(2, 1, iSheet.getLastRow() - 1, I_HEADERS.length).getValues();
    iData.forEach(function (r, idx) {
      var status = String(r[6] || '');
      if (status.indexOf('✅') === 0) return;
      if (!String(r[0] || '').trim()) return;
      interactions.push({
        row: idx + 2, person_phone_or_email: String(r[0] || '').trim(),
        date: fmtDate_(r[1]), type: String(r[2] || '').trim(),
        title: String(r[3] || '').trim(), note: String(r[4] || '').trim(),
        location: String(r[5] || '').trim()
      });
    });
  }

  if (persons.length === 0 && interactions.length === 0) {
    SpreadsheetApp.getUi().alert('Không có dòng nào cần đồng bộ.');
    return;
  }

  var res;
  try {
    var resp = UrlFetchApp.fetch(cfg.url, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ token: cfg.token, persons: persons, interactions: interactions }),
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() === 401) throw new Error('Sai SYNC_TOKEN (401)');
    if (resp.getResponseCode() >= 400) throw new Error('Server trả lỗi ' + resp.getResponseCode());
    res = JSON.parse(resp.getContentText());
  } catch (e) {
    log.appendRow([new Date(), 0, 0, 'LỖI: ' + e.message]);
    SpreadsheetApp.getUi().alert('Đồng bộ thất bại: ' + e.message);
    return;
  }

  var ok = 0, err = 0, details = [];
  var now = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM HH:mm');
  (res.persons || []).forEach(function (r) {
    var cell = pSheet.getRange(r.row, 15);
    if (r.status === 'error') { err++; cell.setValue('❌ ' + (r.message || 'lỗi')); details.push('P' + r.row + ': ' + r.message); }
    else { ok++; cell.setValue('✅ ' + now); }
  });
  (res.interactions || []).forEach(function (r) {
    var cell = iSheet.getRange(r.row, 7);
    if (r.status === 'error') { err++; cell.setValue('❌ ' + (r.message || 'lỗi')); details.push('I' + r.row + ': ' + r.message); }
    else { ok++; cell.setValue('✅ ' + now); }
  });

  log.appendRow([new Date(), ok, err, details.join(' | ') || '-']);
  SpreadsheetApp.getUi().alert('Đồng bộ xong: ' + ok + ' thành công, ' + err + ' lỗi.');
}
