const { google } = require('googleapis');

// Securely parse the service account key and fix escaped newline character anomalies
let credentials;
try {
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  credentials = typeof rawKey === 'string' ? JSON.parse(rawKey) : rawKey;
  
  if (credentials && credentials.private_key) {
    // Crucial Fix: Converts escaped literal "\\n" text back into real algorithmic system newlines
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
  }
} catch (err) {
  console.error("Critical: Failed to pre-parse GOOGLE_SERVICE_ACCOUNT_KEY initialization settings:", err);
}

const googleAuthClient = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

exports.handler = async (event, context) => {
  // Reject unmapped transmission formats
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sheets = google.sheets({ version: 'v4', auth: googleAuthClient });
  const { action, payload } = JSON.parse(event.body || '{}');
  const sheetId = process.env.SHEET_ID;

  try {
    let result = { success: false };

    /* ========================================================
       USER DATA ARCHITECTURE METHODS LAYER
       ======================================================== */
    if (action === 'addUser') {
      // Row Format: Email, Status, Role, DP URL, Firebase UID, Name, WhatsApp Number
      const row = [
        payload.email, 
        'pending', 
        'user', 
        payload.dp || '', 
        payload.uid, 
        payload.name || '', 
        payload.whatsapp || ''
      ];
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Users!A:G',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] }
      });
      result = { success: true };
    }

    else if (action === 'checkUser') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const userRow = rows.find(r => r[0] === payload.email) || null;
      
      if (userRow) {
        result = { status: userRow[1], role: userRow[2], dp: userRow[3] };
      } else {
        result = { status: 'not_found', role: 'user', dp: '' };
      }
    }

    else if (action === 'getPendingUsers') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      // Map out objects matching pending filtering constraints
      const pendingUsers = rows.slice(1)
        .filter(r => r[1] === 'pending')
        .map(r => ({ email: r[0], name: r[5], whatsapp: r[6] }));
      result = { users: pendingUsers };
    }

    else if (action === 'approveUser') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const rIdx = rows.findIndex(r => r[0] === payload.email);
      
      if (rIdx >= 0) {
        // Explicitly update target status index position inside structural database cells
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Users!B${rIdx + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [['active']] }
        });
        result = { success: true };
      }
    }

    /* ========================================================
       SUPER USER SYSTEM OVERRIDE PREFERENCES METHODS
       ======================================================== */
    else if (action === 'getAdminPassword') {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Settings!B3' });
        const val = res.data.values ? res.data.values[0][0] : null;
        result = { password: val || payload.fallback };
      } catch (err) {
        result = { password: payload.fallback };
      }
    }

    else if (action === 'updateAdminPassword') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Settings!B3',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[payload.newPassword]] }
      });
      result = { success: true };
    }

    /* ========================================================
       TRANSACTIONS LOG MANAGEMENT METHODS LAYER
       ======================================================== */
    else if (action === 'addTransaction') {
      const id = 'TX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      const date = new Date().toISOString();
      const row = [
        id, 
        payload.uid, 
        payload.type, 
        date, 
        payload.cash || 0, 
        payload.flour || 0, 
        payload.expName || '', 
        payload.expAmt || 0, 
        payload.rate || 0
      ];
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Transactions!A:I',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [row] }
      });
      result = { success: true };
    }

    else if (action === 'getTransactions') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Transactions!A:I' });
      const rows = res.data.values || [];
      const txs = rows.slice(1).map(r => ({
        id: r[0],
        uid: r[1],
        type: r[2],
        date: r[3],
        cash: parseFloat(r[4]) || 0,
        flour: parseFloat(r[5]) || 0,
        expName: r[6],
        expAmt: parseFloat(r[7]) || 0,
        rate: parseFloat(r[8]) || 0
      }));
      result = { data: txs.reverse() }; // Return chronological trends backward for mobile logs
    }

    else if (action === 'updateTransaction') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Transactions!A:I' });
      const rows = res.data.values || [];
      const rIdx = rows.findIndex(r => r[0] === payload.id);
      
      if (rIdx >= 0) {
        const targetType = rows[rIdx][2];
        if (targetType === 'sale') {
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `Transactions!E${rIdx + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[payload.val]] }
          });
        } else {
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `Transactions!H${rIdx + 1}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[payload.val]] }
          });
        }
        result = { success: true };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (globalError) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: globalError.message })
    };
  }
};
