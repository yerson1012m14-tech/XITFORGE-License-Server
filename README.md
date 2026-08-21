# XITFORGE License Server

Servidor público de licencias + panel privado de administración.

Está pensado para:
- Crear keys `XXXX-XXXX-XXXX-XXXX`.
- Duración: 1 día, 7 días, 30 días, 1 año o permanente.
- Límite de dispositivos.
- Revocar y reactivar keys.
- Extender expiración.
- Validar una key desde la IPA por HTTPS.
- Guardar licencias en SQLite.

## Requisitos

Node.js 24 o superior.

Node.js 24 incluye el módulo `node:sqlite`, que permite usar SQLite sin instalar un paquete nativo adicional.

## 1. Instalar

En PowerShell:

```powershell
cd xitforge-license-server
npm install
```

## 2. Configurar secretos

No dependas todavía de un archivo `.env`: esta primera versión lee las variables desde el entorno del proceso.

En PowerShell define:

```powershell
$env:ADMIN_PASSWORD="una_contraseña_muy_fuerte"
$env:ADMIN_TOKEN_SECRET="una_cadena_aleatoria_de_mas_de_32_caracteres"
$env:PUBLIC_BASE_URL="http://localhost:3000"
```

## 3. Ejecutar localmente

PowerShell:

```powershell
$env:ADMIN_PASSWORD="TU_CONTRASEÑA"
$env:ADMIN_TOKEN_SECRET="CAMBIA_ESTO_POR_UN_SECRETO_LARGO_Y_ALEATORIO"
$env:PUBLIC_BASE_URL="http://localhost:3000"

npm start
```

Abre:

```text
http://localhost:3000
```

## 4. API pública

### Validar

POST `/api/license/validate`

```json
{
  "key": "XXXX-XXXX-XXXX-XXXX",
  "deviceId": "device-id-aleatorio"
}
```

Respuesta válida:

```json
{
  "ok": true,
  "valid": true,
  "expiresAt": "2026-08-28T12:00:00.000Z",
  "keyPrefix": "XXXX-XXXX"
}
```

## 5. Antes de publicarlo

No uses HTTP en producción.

Publícalo detrás de HTTPS y configura:

```text
PUBLIC_BASE_URL=https://api.tudominio.com
```

Además:
- cambia la contraseña del panel;
- cambia `ADMIN_TOKEN_SECRET`;
- limita el acceso del panel si vas a compartir la URL;
- usa un dominio y un certificado TLS;
- haz backups de `data/licenses.db`.

## Siguiente integración

La siguiente pieza es reemplazar la lista local de keys de `LicenseValidator.m` por una petición HTTPS a:

```text
https://TU-DOMINIO/api/license/validate
```

y conectar la respuesta con `LicenseViewController`.
