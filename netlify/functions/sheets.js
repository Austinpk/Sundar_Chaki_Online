const { google } = require('googleapis');

let googleAuthClient;

try {
  // Read the complete JSON credential payload directly from environment configurations
  const rawJsonCredentials = process.env.G_CREDENTIALS_JSON;
  
  if (!rawJsonCredentials) {
    throw new Error("Missing G_CREDENTIALS_JSON environment variable setup on Netlify.");
  }

  const credentialsObject = JSON.parse(rawJsonCredentials);

  // Extract the raw block data out of the private key
  let pureKeyText = credentialsObject.private_key;
  
  // Strip out any headers, footers, existing newlines, or literal '\n' text characters
  pureKeyText = pureKeyText
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
    .trim();

  // Reconstruct the PKCS#8 private key block structure with rigorous 64-character row boundaries
  const keyRows = pureKeyText.match(/.{1,64}/g);
  const formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${keyRows.join('\n')}\n-----END PRIVATE KEY-----\n`;

  googleAuthClient = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentialsObject.client_email,
      private_key: formattedPrivateKey
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

} catch (setupError) {
  console.error("🔴 INITIALIZATION GATEWAY CRASH:", setupError.message);
}

exports.handler = async (event, context) => {
  // Handle preflight CORS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!googleAuthClient) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: false, error: "Backend Google Auth client initialization failed." })
    };
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
      
      // Filter out rows that are 'pending' and map columns perfectly
      const pendingUsers = rows.slice(1)
        .filter(r => r[1] === 'pending')
        .map(r => ({ 
          email: r[0], 
          status: r[1],
          role: r[2],
          dp: r[3],
          uid: r[4],
          name: r[5] || 'Unknown', 
          whatsapp: r[6] || 'N/A' 
        }));
      result = { users: pendingUsers };
    }

    else if (action === 'approveUser') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const rIdx = rows.findIndex(r => r[0] === payload.email);
      
      if (rIdx >= 0) {
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
       NEW FEATURE LAYER: DECLINE & PURGE REGISTRATION REQUEST
       ======================================================== */
    else if (action === 'declineUser') {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Users!A:G' });
      const rows = res.data.values || [];
      const rIdx = rows.findIndex(r => r[0] === payload.email);
      
      if (rIdx >= 0) {
        // Overwrite the entire registration row array range with blank space entries to remove them
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `Users!A${rIdx + 1}:G${rIdx + 1}`,
          valueInputOption: 'USER_ENTERED',
          resource: { values: [['', '', '', '', '', '', '']] }
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
        expName: r[6] || '',
        expAmt: parseFloat(r[7]) || 0,
        rate: parseFloat(r[8]) || 0
      }));
      result = { data: txs.reverse() };
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
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify(result)
    };

  } catch (globalError) {
    console.error("🔴 EXPORTED BACKEND RUNTIME CRASH LOG:", globalError.stack || globalError.message);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, error: globalError.message })
    };
  }
};
