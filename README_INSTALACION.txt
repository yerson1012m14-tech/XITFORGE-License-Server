XITFORGE PANEL — Bundle ID opcional para Tunnel V2

ARCHIVOS A REEMPLAZAR
1. options-routes.js
2. public/app.js
3. public/index.html

NO necesitas modificar server.js ni style.css.

COMPATIBILIDAD
- El campo viejo `bundleId` sigue saliendo exactamente desde GAME_MAP.
- Se agrega un campo nuevo y opcional `tunnelBundleId`.
- La IPA normal puede seguir leyendo `bundleId` y ignorar el campo nuevo.
- La IPA Tunnel V2 podrá leer `tunnelBundleId`.
- Si dejas el Bundle ID Tunnel V2 vacío, se guarda como NULL y todo lo viejo sigue igual.

BASE DE DATOS
Al iniciar el servidor se agregan automáticamente, sin borrar datos:
- app_options.tunnel_bundle_id
- app_original_files.tunnel_bundle_id

PANEL
En Opciones aparece `Bundle ID para Tunnel V2`.
En Archivos originales también aparece el mismo campo para DESACTIVAR.

INSTALACIÓN
1. Haz copia de los 3 archivos actuales.
2. Sustituye los 3 archivos por los de este paquete.
3. Reinicia Render.
4. Entra al panel y abre Opciones.
5. El campo nuevo es opcional.

EJEMPLO JSON
{
  "bundleId": "com.dts.freefireth",
  "tunnelBundleId": "com.jasonxit.miapp",
  "route": "Documents/..."
}

`bundleId` conserva el contrato viejo.
`tunnelBundleId` es solo para la nueva IPA Tunnel V2.
