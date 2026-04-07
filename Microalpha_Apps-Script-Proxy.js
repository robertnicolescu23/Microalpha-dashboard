// ============================================================
// MICROALPHA DASHBOARD — Google Apps Script Proxy
// ============================================================
//
// SETUP (5 minute):
// 1. Deschide Google Sheet-ul cu Incasari MicroAlpha
// 2. Extensions → Apps Script
// 3. Sterge tot ce e in editor si paste acest cod
// 4. Modifica SECRET_TOKEN mai jos (pune orice string secret)
// 5. Click "Deploy" → "New deployment"
// 6. Type: "Web app"
// 7. Execute as: "Me" (contul tau)
// 8. Who has access: "Anyone" (nu iti face griji — token-ul protejeaza datele)
// 9. Click "Deploy" → copiaza URL-ul generat
// 10. Pune URL-ul si token-ul in dashboard (Settings)
//
// IMPORTANT: Sheet-ul ramane PRIVAT. Scriptul ruleaza sub contul
// tau si doar requesturile cu token-ul corect primesc date.
// ============================================================

// ═══ CONFIGURARE ═══
const SECRET_TOKEN = 'CHANGE-ME-TO-YOUR-OWN-SECRET';  // ⚠️ OBLIGATORIU: Schimba cu un token unic inainte de deploy!

// Lunile relevante (doar Microalpha, de la Feb 2026)
const RELEVANT_MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];

// ═══ MAIN HANDLER ═══
function doGet(e) {
  // CORS headers
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // Verificare token
  var token = e.parameter.token;
  if (token !== SECRET_TOKEN) {
    output.setContent(JSON.stringify({ error: 'Unauthorized', message: 'Token invalid' }));
    return output;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var result = { months: [], meta: { lastUpdate: new Date().toISOString(), sheetName: ss.getName() } };

    for (var i = 0; i < sheets.length; i++) {
      var sheet = sheets[i];
      var name = sheet.getName();

      // Doar lunile relevante
      if (RELEVANT_MONTHS.indexOf(name) === -1) continue;

      var data = sheet.getDataRange().getValues();
      if (data.length < 2) continue;

      // Citeste totalul incasari din L1
      var totalIncasari = parseFloat(data[0][11]) || 0;

      // Daca nu are incasari si nu are tranzactii, skip
      if (totalIncasari === 0 && data.length < 3) continue;

      var transactions = [];

      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        var clientName = row[1]; // Coloana B
        if (!clientName || String(clientName).trim() === '') continue;

        var dateVal = row[0]; // Coloana A
        var contract = row[2]; // Coloana C
        var factura = row[3]; // Coloana D
        var achitat = parseFloat(row[4]) || 0; // Coloana E
        var total = parseFloat(row[5]) || 0; // Coloana F
        var manager = row[6] || ''; // Coloana G
        var restPlata = parseFloat(row[7]) || 0; // Coloana H
        var tipPlata = row[8] || ''; // Coloana I
        var serviciu = row[9] || ''; // Coloana J

        // Determina tipul
        var type = 'other';
        if (String(serviciu).indexOf('Anual') > -1) type = 'annual';
        else if (String(serviciu).indexOf('Lunar') > -1) type = 'monthly';

        // Formatare data
        var dateStr = '';
        if (dateVal instanceof Date) {
          dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else {
          dateStr = String(dateVal);
        }

        transactions.push({
          date: dateStr,
          client: String(clientName).trim(),
          contract: contract,
          factura: factura,
          amount: achitat,
          total: total,
          manager: String(manager).trim(),
          restPlata: restPlata,
          tipPlata: String(tipPlata).trim(),
          service: String(serviciu).trim(),
          type: type
        });
      }

      // Calculeaza MRR
      var mrrAnnual = 0;
      var mrrMonthly = 0;
      var annualCount = 0;
      var monthlyCount = 0;

      for (var t = 0; t < transactions.length; t++) {
        if (transactions[t].type === 'annual') {
          mrrAnnual += transactions[t].amount / 12;
          annualCount++;
        } else if (transactions[t].type === 'monthly') {
          mrrMonthly += transactions[t].amount;
          monthlyCount++;
        }
      }

      result.months.push({
        name: name,
        monthIndex: RELEVANT_MONTHS.indexOf(name),
        totalIncasari: totalIncasari,
        transactions: transactions,
        transactionCount: transactions.length,
        annualSubs: annualCount,
        monthlySubs: monthlyCount,
        newSubscribers: annualCount + monthlyCount,
        mrr: Math.round((mrrAnnual + mrrMonthly) * 100) / 100,
        mrrAnnual: Math.round(mrrAnnual * 100) / 100,
        mrrMonthly: Math.round(mrrMonthly * 100) / 100
      });
    }

    // Sorteaza lunile cronologic
    result.months.sort(function(a, b) { return a.monthIndex - b.monthIndex; });

    // ═══ CUMULATIVE MRR ═══
    // Recalculeaza MRR cumulativ: pentru fiecare luna, include TOTI abonatii activi
    // (nu doar tranzactiile din luna respectiva)
    var allSubTx = [];
    for (var mi = 0; mi < result.months.length; mi++) {
      var mo = result.months[mi];
      for (var ti = 0; ti < mo.transactions.length; ti++) {
        var tx = mo.transactions[ti];
        if ((tx.type === 'annual' || tx.type === 'monthly') && tx.amount > 0) {
          allSubTx.push({ client: tx.client, type: tx.type, amount: tx.amount, date: tx.date, monthIndex: mo.monthIndex });
        }
      }
    }

    for (var mi = 0; mi < result.months.length; mi++) {
      var mo = result.months[mi];
      var mIdx = mo.monthIndex; // 0-based month index
      var year = new Date().getFullYear();
      var monthStart = new Date(year, mIdx, 1);
      var monthEnd = new Date(year, mIdx + 1, 0);

      // Find latest active subscription per client for this month
      var activeByClient = {};
      for (var si = 0; si < allSubTx.length; si++) {
        var stx = allSubTx[si];
        var txDate = new Date(stx.date);
        if (txDate > monthEnd) continue; // future transaction
        var validity = stx.type === 'annual' ? 365 : 30;
        var expiry = new Date(txDate.getTime() + validity * 86400000);
        if (expiry >= monthStart) {
          if (!activeByClient[stx.client] || txDate > new Date(activeByClient[stx.client].date)) {
            activeByClient[stx.client] = stx;
          }
        }
      }

      var cMRR = 0;
      var clients = Object.keys(activeByClient);
      for (var ci = 0; ci < clients.length; ci++) {
        var sub = activeByClient[clients[ci]];
        cMRR += sub.type === 'annual' ? sub.amount / 12 : sub.amount;
      }
      mo.mrr = Math.round(cMRR * 100) / 100;
    }

    output.setContent(JSON.stringify(result));
    return output;

  } catch (err) {
    output.setContent(JSON.stringify({ error: 'Server Error', message: err.toString() }));
    return output;
  }
}

// ═══ TEST FUNCTION ═══
// Ruleaza asta in Apps Script editor pentru a testa
function testEndpoint() {
  var e = { parameter: { token: SECRET_TOKEN } };
  var result = doGet(e);
  Logger.log(result.getContent());
}
