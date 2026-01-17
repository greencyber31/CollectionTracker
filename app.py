import http.server
import socketserver
import json
import sqlite3
import os
import base64
import re
from urllib.parse import urlparse

PORT = 5000
DB_FILE = 'collection.db'
UPLOAD_FOLDER = 'uploads'

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            image_filename TEXT
        )
    ''')
    conn.commit()
    conn.close()

class CollectionHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # Serve API
        if parsed_path.path == '/api/items':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute('SELECT * FROM items ORDER BY id DESC')
            rows = c.fetchall()
            items = []
            for row in rows:
                items.append({
                    'id': row['id'],
                    'name': row['name'],
                    'description': row['description'],
                    'price': row['price'],
                    'image_filename': row['image_filename']
                })
            conn.close()
            self.wfile.write(json.dumps(items).encode())
            return

        # Serve Uploads
        if parsed_path.path.startswith('/uploads/'):
            # Security check to prevent directory traversal
            filename = os.path.basename(parsed_path.path)
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(file_path):
                self.send_response(200)
                # Simple mime type guessing
                if filename.lower().endswith('.png'):
                    self.send_header('Content-Type', 'image/png')
                elif filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
                    self.send_header('Content-Type', 'image/jpeg')
                else:
                    self.send_header('Content-Type', 'application/octet-stream')
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_error(404, "File not found")
            return

        # Serve Template (index.html)
        if parsed_path.path == '/' or parsed_path.path == '/index.html':
            self.path = '/templates/index.html'
            
        # For other static files, default behavior, but we need to map /static/ to the right place
        # The SimpleHTTPRequestHandler serves from CWD. 
        # So /static/css/style.css works if we are in root.
        
        # Hack to handle {{ url_for }} from template (which we aren't using anymore, but the HTML has it)
        # We need to manually fix the HTML or intercept it.
        # Actually proper way: Read file, replace {{...}}, send.
        if self.path == '/templates/index.html':
            try:
                with open('templates/index.html', 'r') as f:
                    content = f.read()
                # Simple template replacement
                content = content.replace("{{ url_for('static', filename='css/style.css') }}", "/static/css/style.css")
                content = content.replace("{{ url_for('static', filename='js/app.js') }}", "/static/js/app.js")
                
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                self.wfile.write(content.encode())
                return
            except FileNotFoundError:
                self.send_error(404, "Template not found")
                return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/items':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode())

            image_filename = None
            if data.get('image') and data.get('image_filename'):
                # Handle Base64 image
                header, encoded = data['image'].split(",", 1)
                image_data = base64.b64decode(encoded)
                # Basic sanitation
                safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '', data['image_filename'])
                # Make unique to prevent overwrite
                import time
                image_filename = f"{int(time.time())}_{safe_name}"
                
                with open(os.path.join(UPLOAD_FOLDER, image_filename), 'wb') as f:
                    f.write(image_data)

            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            c.execute('''
                INSERT INTO items (name, description, price, image_filename)
                VALUES (?, ?, ?, ?)
            ''', (data['name'], data['description'], data['price'], image_filename))
            item_id = c.lastrowid
            conn.commit()
            
            # Return the new item
            new_item = {
                'id': item_id,
                'name': data['name'],
                'description': data['description'],
                'price': data['price'],
                'image_filename': image_filename
            }
            conn.close()
            
            self.send_response(201)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(new_item).encode())
            return
        
        self.send_error(404)

    def do_DELETE(self):
        # Match /api/items/<id>
        match = re.search(r'/api/items/(\d+)', self.path)
        if match:
            item_id = int(match.group(1))
            conn = sqlite3.connect(DB_FILE)
            c = conn.cursor()
            
            # Optional: Delete image
            c.execute('SELECT image_filename FROM items WHERE id = ?', (item_id,))
            row = c.fetchone()
            if row and row[0]:
                try:
                    os.remove(os.path.join(UPLOAD_FOLDER, row[0]))
                except:
                    pass

            c.execute('DELETE FROM items WHERE id = ?', (item_id,))
            conn.commit()
            conn.close()
            
            self.send_response(204)
            self.end_headers()
            return
            
        self.send_error(404)

if __name__ == '__main__':
    init_db()
    print(f"Starting server at http://localhost:{PORT}")
    # Allow address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CollectionHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
