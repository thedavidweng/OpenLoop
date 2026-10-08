import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass
    def respond(self, value, code=200):
        body = json.dumps(value).encode()
        self.send_response(code); self.end_headers(); self.wfile.write(body)
    def do_GET(self):
        if self.path == '/health': self.respond({'status': 'ok'})
        elif self.path == '/v1/model_inventory': self.respond({'code': 200, 'data': {'models': [{'name': os.environ.get('ACESTEP_CONFIG_PATH', 'acestep-v15-xl-turbo'), 'is_loaded': True}], 'lm_models': [{'name': os.environ.get('ACESTEP_LM_MODEL_PATH', 'acestep-5Hz-lm-1.7B'), 'is_loaded': True}]}, 'error': None})
        elif self.path.startswith('/v1/audio?'):
            self.send_response(200); self.end_headers(); self.wfile.write(b'local audio')
        else: self.respond({'error': 'unknown endpoint'}, 404)
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/release_task':
            self.server.request = payload
            self.respond({'code': 200, 'data': {'task_id': 'backend-task'}, 'error': None})
        elif self.path == '/query_result':
            result = {'file': '/v1/audio?path=%2Ftmp%2Faudio.wav', 'prompt': self.server.request['prompt'], 'model': self.server.request['model']}
            if self.server.request['prompt'] != 'omit-seed':
                result['seed_value'] = str(1234 if self.server.request['use_random_seed'] else self.server.request['seed'])
            self.respond({'code': 200, 'data': [{'task_id': 'backend-task', 'status': 1, 'result': json.dumps([result])}], 'error': None})
        else: self.respond({'error': 'unknown endpoint'}, 404)
server = HTTPServer(('127.0.0.1', int(os.environ.get('ACESTEP_API_PORT', '0'))), Handler)
print(server.server_port, flush=True)
server.serve_forever()
