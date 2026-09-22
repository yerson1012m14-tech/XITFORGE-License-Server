/* Admin-only UI for per-aimbot activation warnings. */
(() => {
  'use strict';
  const admin = document.getElementById('adminView');
  if (!admin) return;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.textContent = '⚠️ Advertencias por aimbot';
  trigger.style.cssText = 'margin:12px 0;padding:12px 18px;border:1px solid #8b2730;border-radius:12px;background:#210b0d;color:white;cursor:pointer';
  const panel = document.createElement('section');
  panel.hidden = true;
  panel.style.cssText = 'background:#171112;border:1px solid #633039;border-radius:14px;padding:18px;margin:10px 0;color:white';
  const title = document.createElement('h3');
  title.textContent = 'Advertencia individual al activar Aimbot';
  const help = document.createElement('p');
  help.textContent = 'Activar el interruptor solo muestra la advertencia al activar ese aimbot. Las opciones restantes no mostrarán el aviso.';
  const message = document.createElement('p');
  const rows = document.createElement('div');
  const refresh = document.createElement('button');
  refresh.type = 'button'; refresh.textContent = 'Actualizar lista';
  refresh.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px';
  panel.append(title, help, refresh, message, rows);
  admin.prepend(panel);
  admin.prepend(trigger);
  const auth = () => ({ Authorization: `Bearer ${sessionStorage.getItem('xitforgeAdminToken') || ''}` });
  async function load() {
    rows.replaceChildren(); message.textContent = 'Cargando aimbots…';
    try {
      const response = await fetch('/api/admin/option-warnings', { headers: auth(), cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudo cargar la lista. Inicia sesión en el panel.');
      const data = await response.json();
      if (!data.ok || !Array.isArray(data.options)) throw new Error('Respuesta no válida.');
      message.textContent = data.options.length ? '' : 'Todavía no hay aimbots configurados.';
      for (const option of data.options) {
        const row = document.createElement('label');
        row.style.cssText = 'display:flex;gap:10px;align-items:center;justify-content:space-between;margin:8px 0;padding:10px;border:1px solid #403033;border-radius:8px';
        const name = document.createElement('span');
        name.textContent = `${option.name} · ${option.game}${option.option_enabled ? '' : ' · desactivado'}`;
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = option.warning_enabled === true;
        check.setAttribute('aria-label', `Mostrar advertencia para ${option.name}`);
        check.addEventListener('change', async () => {
          check.disabled = true; message.textContent = 'Guardando…';
          try {
            const response = await fetch(`/api/admin/options/${encodeURIComponent(option.id)}/warning`, {
              method: 'PUT', headers: { ...auth(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ enabled: check.checked })
            });
            if (!response.ok) throw new Error('No se pudo guardar.');
            const data = await response.json();
            if (!data.ok) throw new Error('No se pudo guardar.');
            message.textContent = 'Guardado correctamente.';
          } catch (error) {
            check.checked = !check.checked;
            message.textContent = error.message || 'Error de conexión.';
          } finally { check.disabled = false; }
        });
        row.append(name, check); rows.append(row);
      }
    } catch (error) { message.textContent = error.message || 'Error de conexión.'; }
  }
  trigger.addEventListener('click', () => { panel.hidden = !panel.hidden; if (!panel.hidden) load(); });
  refresh.addEventListener('click', load);
})();
