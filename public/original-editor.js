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
/*
 * =========================================================
 * XITFORGE - EDITAR GRUPOS DE BORRADO AL DESACTIVAR
 * Se ejecuta después de app-extra.js.
 * =========================================================
 */
(() => {
  'use strict';

  const card = document.getElementById('deleteFilesCard');
  if (!card) return;

  const wrap = document.getElementById('deleteFilesWrap');
  const formWrap = document.getElementById('deleteFileFormWrap');
  const form = document.getElementById('deleteFileForm');
  const game = document.getElementById('deleteFileGame');
  const optionList = document.getElementById('deleteFileOptionsList');
  const route = document.getElementById('deleteFileRoute');
  const fileName = document.getElementById('deleteFileName');
  const errorLabel = document.getElementById('deleteFileFormError');
  const newButton = document.getElementById('newDeleteFileButton');
  const cancelButton = document.getElementById('cancelDeleteFileButton');

  if (
    !wrap ||
    !formWrap ||
    !form ||
    !game ||
    !optionList ||
    !route ||
    !fileName ||
    !errorLabel
  ) {
    return;
  }

  const submitButton =
    form.querySelector('button[type="submit"]');

  let editingGroup = null;
  let saving = false;

  function groupedDeleteFiles(items) {
    const map = new Map();

    for (const item of items || []) {
      const itemRoute = String(item.route || '').trim();
      const itemFileName = String(item.fileName || '').trim();
      const key =
        `${itemRoute.toLowerCase()}|${itemFileName.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          route: itemRoute,
          fileName: itemFileName,
          items: []
        });
      }

      map.get(key).items.push(item);
    }

    return Array.from(map.values());
  }

  function selectedOptionIds() {
    return Array.from(
      optionList.querySelectorAll(
        'input[data-delete-option-id]:checked'
      )
    )
      .map(input => Number(input.dataset.deleteOptionId))
      .filter(id => Number.isSafeInteger(id) && id > 0);
  }

  function setSelectedOptionIds(ids) {
    const selected = new Set(
      (ids || [])
        .map(Number)
        .filter(id => Number.isSafeInteger(id) && id > 0)
    );

    optionList
      .querySelectorAll(
        'input[data-delete-option-id]'
      )
      .forEach(input => {
        input.checked = selected.has(
          Number(input.dataset.deleteOptionId)
        );
      });
  }

  function groupScope(group) {
    const games = Array.from(
      new Set(
        group.items
          .map(item => item.game)
          .filter(Boolean)
      )
    );

    if (games.length > 1) {
      return 'both';
    }

    return games[0] || 'both';
  }

  function clearEditMode() {
    editingGroup = null;
    errorLabel.textContent = '';

    if (submitButton) {
      submitButton.textContent =
        'Guardar para las seleccionadas';
    }
  }

  async function refreshDeletePanel() {
    const optionsTab =
      document.getElementById('optionsTab');

    if (optionsTab) {
      optionsTab.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true
        })
      );
    }
  }

  async function openGroupEditor(index) {
    if (saving) return;

    errorLabel.textContent = '';

    const data =
      await api('/api/admin/delete-files');

    const groups =
      groupedDeleteFiles(data.deleteFiles || []);

    const group = groups[index];

    if (!group) {
      throw new Error(
        'Ese grupo cambió. Actualiza la lista e inténtalo otra vez.'
      );
    }

    editingGroup = {
      items: group.items.map(item => ({
        id: Number(item.id),
        optionId: Number(item.optionId),
        route: String(item.route || ''),
        fileName: String(item.fileName || '')
      }))
    };

    form.reset();
    game.value = groupScope(group);
    route.value = group.route;
    fileName.value = group.fileName;
    formWrap.classList.remove('hidden');

    if (submitButton) {
      submitButton.textContent = 'Guardar cambios';
    }

    /*
     * El listener original de app-extra.js reconstruye
     * las opciones cuando cambia el juego.
     */
    game.dispatchEvent(
      new Event('change', { bubbles: true })
    );

    await new Promise(resolve =>
      requestAnimationFrame(resolve)
    );

    setSelectedOptionIds(
      group.items.map(item => item.optionId)
    );

    formWrap.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  }

  function attachEditButtons() {
    const cards =
      Array.from(
        wrap.querySelectorAll('.originalFileItem')
      );

    cards.forEach((item, index) => {
      const side =
        item.querySelector('.originalFileSide');

      const deleteButton =
        item.querySelector('[data-delete-group]');

      if (
        !side ||
        !deleteButton ||
        side.querySelector('[data-edit-delete-group]')
      ) {
        return;
      }

      const button =
        document.createElement('button');

      button.type = 'button';
      button.className = 'small';
      button.textContent = 'Editar';
      button.dataset.editDeleteGroup =
        String(index);

      button.style.marginRight = '6px';

      button.addEventListener(
        'click',
        async () => {
          button.disabled = true;

          try {
            await openGroupEditor(
              Number(button.dataset.editDeleteGroup)
            );
          } catch (error) {
            showToast(
              error.message || 'No se pudo abrir la edición.',
              'error'
            );
          } finally {
            button.disabled = false;
          }
        }
      );

      deleteButton.before(button);
    });
  }

  /*
   * Captura el submit SOLO cuando estamos editando.
   * Si es un grupo nuevo, se deja trabajar al código original.
   */
  form.addEventListener(
    'submit',
    async event => {
      if (!editingGroup) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (saving) return;

      errorLabel.textContent = '';

      const optionIds = selectedOptionIds();
      const newRoute = route.value.trim();
      const newFileName = fileName.value.trim();

      if (optionIds.length === 0) {
        errorLabel.textContent =
          'Selecciona al menos una opción.';
        return;
      }

      if (!newRoute) {
        errorLabel.textContent =
          'Escribe la ruta.';
        return;
      }

      if (!newFileName) {
        errorLabel.textContent =
          'Escribe el nombre exacto del archivo.';
        return;
      }

      const snapshot = {
        items: editingGroup.items.map(
          item => ({ ...item })
        )
      };

      const oldText =
        submitButton
          ? submitButton.textContent
          : '';

      saving = true;

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent =
          `GUARDANDO 0/${optionIds.length}...`;
      }

      try {
        let completed = 0;

        /*
         * Primero crea/actualiza las reglas nuevas.
         * Así, si algo falla, las reglas anteriores
         * todavía no se han eliminado.
         */
        for (const optionId of optionIds) {
          await api(
            '/api/admin/delete-files',
            {
              method: 'POST',
              body: JSON.stringify({
                optionId,
                route: newRoute,
                fileName: newFileName
              })
            }
          );

          completed += 1;

          if (submitButton) {
            submitButton.textContent =
              `GUARDANDO ${completed}/${optionIds.length}...`;
          }
        }

        const desiredRules = new Set(
          optionIds.map(
            optionId =>
              String(optionId) +
              '\u0000' +
              newRoute +
              '\u0000' +
              newFileName
          )
        );

        /*
         * Borra únicamente las asociaciones anteriores
         * que ya no forman parte del grupo editado.
         */
        for (const oldItem of snapshot.items) {
          const oldKey =
            String(oldItem.optionId) +
            '\u0000' +
            oldItem.route +
            '\u0000' +
            oldItem.fileName;

          if (!desiredRules.has(oldKey)) {
            await api(
              `/api/admin/delete-files/${Number(oldItem.id)}`,
              { method: 'DELETE' }
            );
          }
        }

        showToast(
          'Grupo de borrado actualizado'
        );

        clearEditMode();
        form.reset();
        game.value = 'both';
        formWrap.classList.add('hidden');

        await refreshDeletePanel();

      } catch (error) {
        errorLabel.textContent =
          error.message ||
          'No se pudo guardar la edición.';
      } finally {
        saving = false;

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            editingGroup
              ? 'Guardar cambios'
              : 'Guardar para las seleccionadas';
        }
      }
    },
    true
  );

  /*
   * Al abrir "Agregar para borrar" se sale
   * del modo edición y vuelve al comportamiento normal.
   */
  if (newButton) {
    newButton.addEventListener(
      'click',
      clearEditMode,
      true
    );
  }

  if (cancelButton) {
    cancelButton.addEventListener(
      'click',
      clearEditMode,
      true
    );
  }

  const observer =
    new MutationObserver(attachEditButtons);

  observer.observe(
    wrap,
    {
      childList: true,
      subtree: true
    }
  );

  attachEditButtons();
})();
