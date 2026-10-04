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
        elif self.path.startswith('/v1/audio?'):
            self.send_response(200); self.end_headers(); self.wfile.write(b'local audio')
        else: self.respond({'error': 'unknown endpoint'}, 404)
    def do_POST(self):
        payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/release_task':
            self.server.request = payload
            self.respond({'code': 200, 'data': {'task_id': 'backend-task'}, 'error': None})
        elif self.path == '/query_result':
            self.respond({'code': 200, 'data': [{'task_id': 'backend-task', 'status': 1, 'result': json.dumps([{'file': '/v1/audio?path=%2Ftmp%2Faudio.wav', 'seed': self.server.request['seed'], 'prompt': self.server.request['prompt'], 'model': self.server.request['model']}])}], 'error': None})
        else: self.respond({'error': 'unknown endpoint'}, 404)
server = HTTPServer(('127.0.0.1', int(os.environ.get('ACESTEP_API_PORT', '0'))), Handler)
print(server.server_port, flush=True)
server.serve_forever()
