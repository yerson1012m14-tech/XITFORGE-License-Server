(() => {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.className = 'originalEditor';
  dialog.setAttribute('aria-labelledby', 'originalEditTitle');
  dialog.innerHTML = `<form id="originalEditForm">
    <div class="originalEditHeading"><div><span class="originalEditEyebrow">ARCHIVOS ORIGINALES</span><h2 id="originalEditTitle">Editar original</h2></div><button type="button" data-close aria-label="Cerrar">×</button></div>
    <p class="originalEditIntro">Actualiza el destino o reemplaza el archivo que se aplica al desactivar.</p>
    <div class="originalEditGrid">
      <label>Juego<select name="game" required><option value="freefire_normal">Free Fire Normal</option><option value="freefire_max">Free Fire MAX</option></select></label>
      <label>Orden<input name="sortOrder" type="number" min="-100000" max="100000" step="1" required></label>
      <label class="originalEditWide">Carpeta de destino<input name="route" maxlength="2048" placeholder="Documents/carpeta" required></label>
      <label class="originalEditWide">Nombre de destino<input name="fileName" maxlength="255" required></label>
    </div>
    <div class="originalEditUpload"><strong>Archivo guardado</strong><p data-current></p><label>Reemplazar archivo (opcional)<input name="replacement" type="file"></label><p class="originalEditHint">Hasta 32 MB. Si no seleccionas otro archivo, se conserva el actual. El nombre de destino se mantiene.</p></div>
    <p data-error role="alert" hidden></p>
    <div class="originalEditActions"><button type="button" data-close>Cancelar</button><button type="submit">Guardar cambios</button></div>
  </form>`;
  document.body.appendChild(dialog);
  const form = dialog.querySelector('form');
  const errorLabel = dialog.querySelector('[data-error]');
  const submit = form.querySelector('[type=submit]');
  let selectedId = null, busy = false, revision = 0;
  const field = name => form.elements.namedItem(name);
  function error(message) { errorLabel.textContent = message; errorLabel.hidden = !message; }
  function close() { if (!busy) { revision++; dialog.close(); selectedId = null; } }
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  function lock(value) {
    busy = value;
    Array.from(form.elements).forEach(element => { element.disabled = value; });
  }
  async function open(id) {
    if (busy) return;
    const current = ++revision;
    selectedId = null; form.reset(); error(''); lock(true);
    submit.textContent = 'Cargando…';
    dialog.querySelector('[data-current]').textContent = 'Cargando archivo…';
    dialog.showModal();
    try {
      const data = await api(`/api/admin/original-files/${id}`);
      if (current !== revision) return;
      const item = data.original;
      ['game', 'route', 'fileName', 'sortOrder'].forEach(name => { field(name).value = item[name]; });
      dialog.querySelector('[data-current]').textContent = `${item.sourceFileName} · ${formatBytes(item.fileSize)}`;
      selectedId = id;
    } catch (failure) { error(failure.message); }
    finally { if (current === revision) { lock(false); submit.disabled = !selectedId; submit.textContent = 'Guardar cambios'; } }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !selectedId || !form.reportValidity()) return;
    error('');
    const data = { game: field('game').value, route: field('route').value.trim(), fileName: field('fileName').value.trim(), sortOrder: Number(field('sortOrder').value) };
    const file = field('replacement').files[0];
    if (file && (!file.size || file.size > 32 * 1024 * 1024)) { error('Selecciona un archivo de entre 1 byte y 32 MB.'); return; }
    lock(true); submit.textContent = 'Guardando…';
    let saved = false;
    try {
      const options = file ? { method: 'PUT', body: file, headers: {
        'Content-Type': 'application/octet-stream', 'x-game': encodeURIComponent(data.game),
        'x-route': encodeURIComponent(data.route), 'x-target-file-name': encodeURIComponent(data.fileName),
        'x-sort-order': String(data.sortOrder), 'x-source-file-name': encodeURIComponent(file.name),
        'x-file-mime': encodeURIComponent(file.type || 'application/octet-stream')
      }} : { method: 'PATCH', body: JSON.stringify(data) };
      await api(`/api/admin/original-files/${selectedId}`, options);
      saved = true;
      await loadOriginalFiles();
      showToast('Original actualizado.');
    } catch (failure) { error(failure.message); }
    finally { lock(false); submit.textContent = 'Guardar cambios'; if (saved) close(); }
  });
  function attachButtons() {
    document.querySelectorAll('[data-original-delete]').forEach(remove => {
      if (remove.parentElement.querySelector('[data-original-edit]')) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'small'; button.textContent = 'Editar';
      button.dataset.originalEdit = remove.dataset.originalDelete;
      button.addEventListener('click', () => open(button.dataset.originalEdit));
      remove.before(button);
    });
  }
  const render = window.renderOriginalFiles;
  window.renderOriginalFiles = function (...args) { const result = render.apply(this, args); attachButtons(); return result; };
  attachButtons();
})();
