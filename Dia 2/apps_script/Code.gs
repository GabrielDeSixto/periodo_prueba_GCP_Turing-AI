/*
Advanced Google Workspace automation (Google Apps Script)
Funciones:
- leerDatosYProcesar(): lee filas nuevas en una hoja y procesa los registros
- onEdit(e): trigger simple para detectar ediciones y procesar la fila editada
- programarProcesamiento(): trigger por tiempo (invocable) para procesar periódicamente
- crearEventoCalendar(data): crea un evento en Calendar según datos
- enviarNotificacionEmail(data): envía email usando MailApp
- enviarNotificacionChat(text): publica en un chat webhook (opcional)
- util: marcarFilaProcesada(range, id) para evitar reprocesos

Notas: adapta IDs de hoja, nombres y URLs (webhook) a tu entorno.
*/

var SHEET_NAME = 'Datos'; // nombre de la hoja de cálculo usada
var PROCESSED_COL = 'H'; // columna para marcar filas procesadas (ejemplo)
// Opcional: fija el ID de la hoja para evitar depender de getActiveSpreadsheet()
var SPREADSHEET_ID = '1Yw1SwHrVowfR2Qz6B4Gi7sMaEGFsJgNQRQpwsCu3Niw'; // <- pega aquí el ID de tu hoja (extraído de la URL)

// Nota: el webhook de Google Chat se guarda en Script Properties (no en el código)

function leerDatosYProcesar() {
  try {
    var sheet;
    try {
      sheet = getSheet();
    } catch (err) {
      Logger.log(err.message);
      return;
    }

    var dataRange = sheet.getDataRange();
    var values = dataRange.getValues();

    // Asumimos que la primera fila es encabezado
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var rowIndex = i + 1; // filas 1-indexed
      var processed = row[getColumnIndexFromLetter(PROCESSED_COL) - 1];

      if (!processed) {
        // Ajusta indices de columnas según tu plantilla. Ejemplo:
        var id = row[0]; // Col A: ID
        var nombre = row[1]; // Col B
        var email = row[2]; // Col C
        var fechaEvento = row[3]; // Col D, formato ISO o fecha
        var descripcion = row[4]; // Col E

        var datos = {
          id: id,
          nombre: nombre,
          email: email,
          fechaEvento: fechaEvento,
          descripcion: descripcion,
          fila: rowIndex
        };

        // Lógica de negocio: ejemplo crear evento y notificar
        try {
          if (fechaEvento) {
            crearEventoCalendar(datos);
          }
          enviarNotificacionEmail(datos);
          enviarNotificacionChat('Nuevo registro procesado: ID=' + id + ', nombre=' + nombre);

          // marcar como procesado
          sheet.getRange(PROCESSED_COL + rowIndex).setValue('PROCESADO');
        } catch (innerErr) {
          Logger.log('Error procesando fila ' + rowIndex + ': ' + innerErr);
          // Escribe un mensaje de error en la hoja para auditoría
          sheet.getRange(PROCESSED_COL + rowIndex).setValue('ERROR: ' + innerErr.message);
        }
      }
    }
  } catch (e) {
    Logger.log('Error en leerDatosYProcesar: ' + e);
  }
}

function onEdit(e) {
  // Trigger simple: cuando se edite la hoja, procesar la fila editada
  try {
    var range = e.range;
    var sheet = range.getSheet();
    if (sheet.getName() !== SHEET_NAME) return;

    var row = range.getRow();
    if (row === 1) return; // no procesar encabezado

    // Opcional: procesar solo si se edita una columna específica
    // var col = range.getColumn(); if (col !== 3) return; // solo cuando se edite col C

    // Llamar a la función principal para procesar (puede procesar todas las filas no marcadas)
    leerDatosYProcesar();
  } catch (err) {
    Logger.log('Error en onEdit: ' + err);
  }
}

function programarProcesamiento() {
  // Función invocable que crea un trigger de tiempo (diario cada 5 minutos por ejemplo)
  // Ejecuta esta función manualmente la primera vez.
  try {
    // elimina triggers previos con mismo handler para evitar duplicados
    var triggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'leerDatosYProcesar') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }

    ScriptApp.newTrigger('leerDatosYProcesar')
      .timeBased()
      .everyMinutes(5)
      .create();

    Logger.log('Trigger programado: leerDatosYProcesar cada 5 minutos');
  } catch (e) {
    Logger.log('Error en programarProcesamiento: ' + e);
  }
}

function crearEventoCalendar(datos) {
  try {
    // Asumimos que fechaEvento es un string o Date; convertimos si es necesario
    var calendar = CalendarApp.getDefaultCalendar();
    var start;
    if (typeof datos.fechaEvento === 'string') {
      start = new Date(datos.fechaEvento);
    } else if (datos.fechaEvento instanceof Date) {
      start = datos.fechaEvento;
    } else {
      start = new Date();
    }

    var end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hora por defecto
    var event = calendar.createEvent('Evento: ' + datos.nombre, start, end, {description: datos.descripcion});
    Logger.log('Evento creado: ' + event.getId());
    return event.getId();
  } catch (e) {
    throw new Error('crearEventoCalendar fallo: ' + e.message);
  }
}

function enviarNotificacionEmail(datos) {
  try {
    var subject = 'Registro procesado: ' + datos.id;
    var body = 'Hola ' + datos.nombre + '\n\n' +
               'Tu registro ha sido procesado.\n' +
               'ID: ' + datos.id + '\n' +
               'Descripción: ' + datos.descripcion + '\n\n' +
               'Saludos.';
    if (datos.email) {
      MailApp.sendEmail(datos.email, subject, body);
      Logger.log('Email enviado a ' + datos.email);
    } else {
      Logger.log('No hay email para enviar para ID ' + datos.id);
    }
  } catch (e) {
    throw new Error('enviarNotificacionEmail fallo: ' + e.message);
  }
}

function enviarNotificacionChat(text) {
  try {
    var CHAT_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK_URL');
    if (!CHAT_WEBHOOK_URL || CHAT_WEBHOOK_URL.indexOf('https://') !== 0) {
      Logger.log('Chat webhook no configurado. Mensaje: ' + text);
      return;
    }
    var payload = JSON.stringify({text: text});
    var options = {method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true};
    var response = UrlFetchApp.fetch(CHAT_WEBHOOK_URL, options);
    Logger.log('Chat response: ' + response.getResponseCode());
  } catch (e) {
    Logger.log('enviarNotificacionChat fallo: ' + e);
  }
}

// Helpers: obtener la hoja (por ID si SPREADSHEET_ID está configurado)
function getSheet() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No se encontró Spreadsheet. Asegura que SPREADSHEET_ID sea correcto o que el script esté ligado a una hoja.');
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Hoja no encontrada: ' + SHEET_NAME + '. Hojas disponibles: ' + ss.getSheets().map(function(s){return s.getName();}).join(', '));
  return sheet;
}

function debugListSheets() {
  var ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('No hay ActiveSpreadsheet (script no está ligado).');
    return;
  }
  Logger.log('Spreadsheet ID: ' + ss.getId());
  Logger.log('Hojas encontradas: ' + ss.getSheets().map(function(s){return s.getName();}).join(', '));
}

// Guardar webhook de Chat en Script Properties (ejecutar manualmente una vez)
function setChatWebhookUrl(url) {
  if (!url || url.indexOf('https://') !== 0) throw new Error('URL inválida');
  PropertiesService.getScriptProperties().setProperty('CHAT_WEBHOOK_URL', url);
  Logger.log('CHAT_WEBHOOK_URL guardado en Script Properties');
}

// Helpers
function getColumnIndexFromLetter(letter) {
  var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return base.indexOf(letter.toUpperCase()) + 1;
}

function marcarFilaProcesada(range, id) {
  // placeholder: puedes implementar marcación avanzada si necesitas
  range.setValue('PROCESADO');
}
