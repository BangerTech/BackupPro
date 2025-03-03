# BackupPro

Eine moderne Backup-Scheduling-Anwendung mit Unterstützung für verschiedene Backup-Ziele wie lokale Verzeichnisse, SFTP, Dropbox und Google Drive.

## Funktionen

- Erstellen und Verwalten von Backup-Zielen (lokal, SFTP, Dropbox, Google Drive)
- Planen von regelmäßigen Backups
- Manuelle Backups durchführen
- Überwachung des Backup-Status
- Benutzerfreundliche Oberfläche

## Technologien

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Datenbank**: PostgreSQL
- **Containerisierung**: Docker, Docker Compose

## Installation

### Voraussetzungen

- Docker und Docker Compose
- Node.js (für die Entwicklung)

### Installation mit Docker

1. Repository klonen:
   ```bash
   git clone https://github.com/IhrBenutzername/BackupPro.git
   cd BackupPro
   ```

2. Docker-Container starten:
   ```bash
   docker-compose up -d
   ```

3. Die Anwendung ist nun unter http://localhost:3000 verfügbar.

### Entwicklungsumgebung

1. Repository klonen:
   ```bash
   git clone https://github.com/IhrBenutzername/BackupPro.git
   cd BackupPro
   ```

2. Abhängigkeiten installieren:
   ```bash
   # Frontend
   cd frontend
   npm install
   
   # Backend
   cd ../backend
   npm install
   ```

3. Entwicklungsserver starten:
   ```bash
   # Frontend
   cd frontend
   npm run dev
   
   # Backend
   cd ../backend
   npm run dev
   ```

## Konfiguration

Die Anwendung kann über Umgebungsvariablen konfiguriert werden. Erstellen Sie eine `.env`-Datei im Hauptverzeichnis des Projekts:

```
# Datenbank
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=backup_schedule
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Backend
PORT=4000
NODE_ENV=production

# OAuth (für Cloud-Speicher)
DROPBOX_CLIENT_ID=your_dropbox_client_id
DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## Lizenz

MIT 