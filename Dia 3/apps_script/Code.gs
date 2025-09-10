/* Web App receiver for Day 3
   - doPost(e) valida firma HMAC enviada como query param 'sig'
   - el secreto compartido se guarda en Script Properties (clave: SHARED_SECRET)
   - escribe una nueva fila en la hoja `Integracion` con metadatos
   - envía notificación por email o Chat
*/

var TARGET_SHEET = 'Integracion';

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var sig = e.parameter && e.parameter.sig;
    if (!sig) return ContentService.createTextOutput('Missing signature').setMimeType(ContentService.MimeType.TEXT);

    var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
    if (!secret) return ContentService.createTextOutput('Secret not configured').setMimeType(ContentService.MimeType.TEXT);

    // calcular HMAC-SHA256 del body
    var computed = Utilities.computeHmacSha256Signature(raw, secret);
    var computedHex = computed.map(function(b){
      var v = (b < 0) ? b + 256 : b;
      return ('0' + v.toString(16)).slice(-2);
    }).join('');

    if (computedHex !== sig) {
      return ContentService.createTextOutput('Invalid signature').setMimeType(ContentService.MimeType.TEXT).setXFrameOptionsMode(ContentService.XFrameOptionsMode.DEFAULT);
    }

    var data = JSON.parse(raw);
    // Validaciones mínimas
    if (!data.bucket || !data.name) {
      return ContentService.createTextOutput('Invalid payload').setMimeType(ContentService.MimeType.TEXT);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(TARGET_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(TARGET_SHEET);
      // escribir encabezado
      sheet.appendRow(['timestamp','bucket','name','size','contentType','status']);
    }

    var ts = new Date();
    sheet.appendRow([ts, data.bucket, data.name, data.size || '', data.contentType || '', 'RECEIVED']);

    // Notificación simple por correo al propietario del spreadsheet
    try {
      var owner = Session.getActiveUser().getEmail();
      if (owner) {
        MailApp.sendEmail(owner, 'Nuevo archivo procesado', 'Archivo: ' + data.name + ' en bucket: ' + data.bucket + '\nTimestamp: ' + ts);
      }
    } catch (notifyErr) {
      Logger.log('Error notificando por email: ' + notifyErr);
    }

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
}

// Helper para guardar el secret compartido (ejecutar manualmente una vez)
function setSharedSecret(secret) {
  PropertiesService.getScriptProperties().setProperty('SHARED_SECRET', secret);
  Logger.log('SHARED_SECRET guardado.');
}
