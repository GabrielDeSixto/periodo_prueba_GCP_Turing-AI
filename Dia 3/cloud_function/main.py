# Cloud Function HTTP (observador) - ejemplo
# Este archivo ilustra la parte que recibiría el trigger por Storage (día 1)
# y reenvía metadatos al Apps Script Web App con firma HMAC.

import os
import json
import hmac
import hashlib
import base64
import requests

# Configurar desde variables de entorno al desplegar
APPS_SCRIPT_WEBAPP_URL = os.environ.get('APPS_SCRIPT_WEBAPP_URL')  # e.g. https://script.google.com/macros/s/XXX/exec
SHARED_SECRET = os.environ.get('SHARED_SECRET')  # secreto HMAC compartido

# Ejemplo de función HTTP que podrías adaptar a evento de Storage
def forward_to_apps_script(request):
    """
    Espera un POST con JSON (metadatos de archivo) o puede ser adaptada para recibir evento de Cloud Storage.
    Firma HMAC: se calcula sobre el cuerpo UTF-8 y se añade como query param 'sig' (hex).
    """
    try:
        payload = request.get_json(silent=True)
        if not payload:
            return ('Bad Request: no JSON', 400)

        # Validaciones básicas
        required = ['bucket', 'name']
        for r in required:
            if r not in payload:
                return (f'Bad Request: missing {r}', 400)

        body = json.dumps(payload, separators=(',', ':')).encode('utf-8')

        if not SHARED_SECRET or not APPS_SCRIPT_WEBAPP_URL:
            return ('Server misconfigured', 500)

        sig = hmac.new(SHARED_SECRET.encode('utf-8'), body, hashlib.sha256).hexdigest()

        url = APPS_SCRIPT_WEBAPP_URL
        # agregar la firma como query param
        if '?' in url:
            url = url + '&sig=' + sig
        else:
            url = url + '?sig=' + sig

        headers = {'Content-Type': 'application/json'}
        resp = requests.post(url, data=body, headers=headers, timeout=10)

        return (resp.text, resp.status_code)

    except Exception as e:
        return (f'Internal Error: {e}', 500)

# Si quieres ejecutar localmente para pruebas (no en Cloud Functions)
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--secret')
    args = parser.parse_args()
    APPS_SCRIPT_WEBAPP_URL = args.url or APPS_SCRIPT_WEBAPP_URL
    SHARED_SECRET = args.secret or SHARED_SECRET
    sample = {'bucket': 'test-bucket', 'name': 'sample.txt', 'size': 123, 'contentType': 'text/plain'}
    body = json.dumps(sample, separators=(',', ':')).encode('utf-8')
    sig = hmac.new(SHARED_SECRET.encode('utf-8'), body, hashlib.sha256).hexdigest()
    url = APPS_SCRIPT_WEBAPP_URL + ('&' if '?' in APPS_SCRIPT_WEBAPP_URL else '?') + 'sig=' + sig
    print('Posting to', url)
    r = requests.post(url, data=body, headers={'Content-Type':'application/json'})
    print(r.status_code, r.text)
