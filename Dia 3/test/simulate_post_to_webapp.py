"""Simula el envío firmado al Apps Script Web App (útil para pruebas locales)."""
import argparse
import json
import hmac
import hashlib
import requests

parser = argparse.ArgumentParser()
parser.add_argument('--url', required=True, help='Apps Script webapp URL (ej: https://script.google.com/macros/s/XXX/exec)')
parser.add_argument('--secret', required=True, help='Shared secret HMAC')
args = parser.parse_args()

payload = {'bucket':'test-bucket','name':'file-from-test.txt','size':512,'contentType':'text/plain'}
body = json.dumps(payload, separators=(',',':')).encode('utf-8')
sig = hmac.new(args.secret.encode('utf-8'), body, hashlib.sha256).hexdigest()

url = args.url + ('&' if '?' in args.url else '?') + 'sig=' + sig
print('Posting to', url)
resp = requests.post(url, data=body, headers={'Content-Type':'application/json'}, timeout=10)
print(resp.status_code)
print(resp.text)
