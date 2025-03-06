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

2. Konfiguration anpassen:
   ```bash
   cp .env.example .env
   # Bearbeiten Sie die .env-Datei und passen Sie die Werte an Ihre Umgebung an
   ```

3. Docker-Container starten:
   ```bash
   docker-compose up -d
   ```

4. Die Anwendung ist nun unter http://localhost:3000 verfügbar.

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

Die Anwendung kann über Umgebungsvariablen in der `.env`-Datei konfiguriert werden. Eine Beispielkonfiguration:

```
# Timezone settings
# Set your desired timezone here
TZ=Europe/Berlin

# Network settings
# Set your local IP address or hostname here
HOST_IP=192.168.2.86
# Ports for the different services
FRONTEND_PORT=3000
BACKEND_PORT=4000
POSTGRES_PORT=5432

# Database settings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=backup_schedule

# Application settings
NODE_ENV=production
FILE_EXPLORER_BASE_DIR=/host_fs
```

### OAuth-Konfiguration für Cloud-Dienste

Die OAuth-Konfiguration für Cloud-Dienste wie Dropbox und Google Drive erfolgt direkt beim Anlegen eines Targets in der Web-UI:

1. Navigieren Sie zu "Targets" und klicken Sie auf "Neues Target erstellen"
2. Wählen Sie den Target-Typ (z.B. Dropbox oder Google Drive)
3. Geben Sie die erforderlichen OAuth-Anmeldeinformationen (Client ID und Secret) ein
4. Diese Daten werden in der Datenbank gespeichert und für alle Operationen mit diesem Target verwendet

Es ist nicht notwendig, OAuth-Anmeldeinformationen in der `.env`-Datei zu konfigurieren.

### Zeitzoneneinstellung

Die Zeitzone kann über die `TZ`-Umgebungsvariable konfiguriert werden. Diese Einstellung wird für alle Komponenten (Frontend, Backend und PostgreSQL) verwendet.

Beispiele für gültige Zeitzonen:
- `Europe/Berlin` (Deutschland)
- `Europe/Vienna` (Österreich)
- `Europe/Zurich` (Schweiz)
- `Europe/London` (Großbritannien)
- `America/New_York` (USA Ostküste)
- `America/Los_Angeles` (USA Westküste)
- `Asia/Tokyo` (Japan)

Eine vollständige Liste der Zeitzonen finden Sie [hier](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

## Lizenz

MIT 