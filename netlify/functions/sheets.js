const { google } = require('googleapis');
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.SHEET_ID;
  
  try {
    const { action, payload } = JSON.parse(event.body || '{}');
    let result = {};

    // --- ADMIN PASSWORD ---
    if (action === 'getAdminPass') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Settings!B3' });
      result = { password: res.data.values?.[0]?.[0] || null };
    }
    else if (action === 'updateAdminPass') {
      await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: 'Settings!B3', valueInputOption: 'RAW', resource: { values: [[payload.password]] } });
      result = { success: true };
    }

    // --- USERS & AUTH ---
    else if (action === 'registerUser') {
      const row = [payload.email, payload.name || 'User', payload.phone, payload.dp || '', payload.uid, 'pending', 'user'];
      await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'Users!A:G', valueInputOption: 'RAW', resource: { values: [row] } });
      result = { success: true };
    }
    else if (action === 'getUserStatus') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const user = rows.find(r => r[0] === payload.email);
      result = user ? { status: user[5], role: user[6], name: user[1], phone: user[2], dp: user[3] } : { status: 'not_found' };
    }
    else if (action === 'approveUser') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:F' });
      const idx = (res.data.values || []).findIndex(r => r[0] === payload.email);
      if (idx > 0) {
        await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `Users!F${idx + 1}`, valueInputOption: 'RAW', resource: { values: [['active']] } });
      }
      result = { success: true };
    }
    else if (action === 'getPendingUsers') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const pending = (res.data.values || []).filter(r => r[5] === 'pending').map(r => ({ name: r[1], email: r[0], phone: r[2] }));
      result = { users: pending };
    }
    else if (action === 'updateProfile') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const idx = rows.findIndex(r => r[0] === payload.email);
      if (idx > 0) {
        await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `Users!D${idx + 1}:E${idx + 1}`, valueInputOption: 'RAW', resource: { values: [[payload.dp || rows[idx][3], payload.phone || rows[idx][2]]] } });
      }
      result = { success: true };
    }

    // --- TRANSACTIONS ---
    else if (action === 'addTransaction') {
      const row = [payload.id, payload.uid, payload.type, payload.date, payload.cash, payload.flour, payload.expName, payload.expAmt, payload.rate, new Date().toISOString()];
      await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'Transactions!A:J', valueInputOption: 'RAW', resource: { values: [row] } });
      result = { success: true };
    }
    else if (action === 'getTransactions') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Transactions!A:J' });
      let data = (res.data.values || []).slice(1).map(r => ({
        id: r[0], uid: r[1], type: r[2], date: r[3], cash: parseFloat(r[4])||0, flour: parseFloat(r[5])||0, expName: r[6], expAmt: parseFloat(r[7])||0, rate: parseFloat(r[8])||0
      }));
      if (payload.uid !== 'all') data = data.filter(d => d.uid === payload.uid);
      result = { data };
    }
    else if (action === 'updateTransaction') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Transactions!A:J' });
      const idx = (res.data.values || []).findIndex(r => r[0] === payload.id);
      if (idx > 0) {
        await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: `Transactions!A${idx + 1}:J${idx + 1}`, valueInputOption: 'RAW', resource: { values: [[...payload]] } });
      }
      result = { success: true };
    }

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};