/*
 * XITFORGE - DOS ARCHIVOS POR OPCIÓN
 *
 * Este archivo se carga DESPUÉS de /app.js.
 * No reemplaza el panel actual: extiende solamente "Opciones".
 */

(() => {
  'use strict';

  /*
   * =========================================================
   * AGREGAR CAMPO "ARCHIVO 2 (OPCIONAL)"
   * =========================================================
   */

  const sortLabel =
    document.querySelector(
      'label[for="optionSortOrder"]'
    );

  if (!sortLabel) {
    console.error(
      'XITFORGE two-file addon: optionSortOrder label not found.'
    );
    return;
  }

  const secondFileLabel =
    document.createElement('label');

  secondFileLabel.htmlFor =
    'optionFile2';

  secondFileLabel.textContent =
    'Archivo 2 para ACTIVAR (opcional)';

  const secondFileInput =
    document.createElement('input');

  secondFileInput.id =
    'optionFile2';

  secondFileInput.type =
    'file';

  const secondFileHelp =
    document.createElement('p');

  secondFileHelp.className =
    'fieldHelp';

  secondFileHelp.textContent =
    'Puedes dejarlo vacío. Si lo eliges, ACTIVAR tendrá dos archivos. Máximo 32 MB.';

  sortLabel.parentNode.insertBefore(
    secondFileLabel,
    sortLabel
  );

  sortLabel.parentNode.insertBefore(
    secondFileInput,
    sortLabel
  );

  sortLabel.parentNode.insertBefore(
    secondFileHelp,
    sortLabel
  );

  const optionFile2 =
    secondFileInput;


  /*
   * =========================================================
   * HELPERS DE ARCHIVOS
   * =========================================================
   */

  async function uploadOptionFileSlot(
    id,
    file,
    slot
  ) {
    if (!file) {
      return;
    }

    if (
      file.size >
      32 * 1024 * 1024
    ) {
      throw new Error(
        `${file.name} supera 32 MB.`
      );
    }

    const endpoint =
      Number(slot) === 2
        ? `/api/admin/options/${id}/file2`
        : `/api/admin/options/${id}/file`;

    const response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${token}`,

            'Content-Type':
              'application/octet-stream',

            'X-File-Name':
              file.name,

            'X-File-Mime':
              file.type ||
              'application/octet-stream'
          },

          body:
            file
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      response.status === 401
    ) {
      logout();

      throw new Error(
        'Sesión expirada'
      );
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        `No se pudo subir el archivo ${slot}.`
      );
    }

    return data;
  }


  /*
   * =========================================================
   * REEMPLAZAR SOLO EL SUBMIT DE OPCIONES
   *
   * Capture=true hace que este handler corra antes que el
   * handler viejo de app.js. stopImmediatePropagation evita
   * que la opción se guarde dos veces.
   * =========================================================
   */

  optionForm.addEventListener(
    'submit',
    async event => {
      event.preventDefault();
      event.stopImmediatePropagation();

      optionFormError.textContent =
        '';

      const submitButton =
        optionForm.querySelector(
          'button[type="submit"]'
        );

      const oldText =
        submitButton.textContent;

      submitButton.disabled =
        true;

      submitButton.textContent =
        'GUARDANDO...';

      try {
        const id =
          optionId.value.trim();

        const payload = {
          name:
            optionName.value.trim(),

          description:
            optionDescription.value.trim(),

          game:
            optionGame.value,

          category:
            optionCategory.value,

          route:
            optionRoute.value.trim(),

          sortOrder:
            Number(
              optionSortOrder.value
            ) || 0
        };

        let targetId =
          id;

        if (id) {
          await api(
            `/api/admin/options/${id}`,
            {
              method: 'PUT',
              body:
                JSON.stringify(
                  payload
                )
            }
          );
        } else {
          const created =
            await api(
              '/api/admin/options',
              {
                method: 'POST',
                body:
                  JSON.stringify(
                    payload
                  )
              }
            );

          targetId =
            created.option
              ? String(
                  created.option.id
                )
              : '';
        }

        if (!targetId) {
          throw new Error(
            'No se pudo obtener el ID de la opción.'
          );
        }

        const firstFile =
          optionFile.files[0] ||
          null;

        const secondFile =
          optionFile2.files[0] ||
          null;

        if (firstFile) {
          await uploadOptionFileSlot(
            targetId,
            firstFile,
            1
          );
        }

        if (secondFile) {
          await uploadOptionFileSlot(
            targetId,
            secondFile,
            2
          );
        }

        closeOptionForm();

        showToast(
          'Opción guardada correctamente'
        );

        await loadOptions();

      } catch (error) {
        optionFormError.textContent =
          error.message;
      } finally {
        submitButton.disabled =
          false;

        submitButton.textContent =
          oldText;
      }
    },
    true
  );


  /*
   * =========================================================
   * LIMPIAR ARCHIVO 2 AL ABRIR / CERRAR
   * =========================================================
   */

  const originalOpenOptionForm =
    openOptionForm;

  openOptionForm = function (
    option = null
  ) {
    originalOpenOptionForm(
      option
    );

    optionFile2.value =
      '';
  };

  const originalCloseOptionForm =
    closeOptionForm;

  closeOptionForm =
    function () {
      originalCloseOptionForm();

      optionFile2.value =
        '';
    };


  /*
   * =========================================================
   * RENDER DE OPCIONES CON DOS ARCHIVOS
   * =========================================================
   */

  renderOptions =
    function () {

      const filter =
        optionsGameFilter.value;

      let items =
        optionsCache;

      if (
        filter !== 'all'
      ) {
        items =
          items.filter(
            option =>
              option.game === filter
          );
      }

      if (
        items.length === 0
      ) {
        optionsWrap.innerHTML =
          `
            <div class="emptyState">

              <div class="emptyIcon">
                +
              </div>

              <h3>
                No hay opciones
              </h3>

              <p class="muted">
                Crea la primera opción para este juego.
              </p>

            </div>
          `;

        return;
      }

      optionsWrap.innerHTML =
        items
          .map(
            option =>
              `
                <article
                  class="optionCard
                  ${
                    option.enabled
                      ? ''
                      : 'optionDisabled'
                  }"
                >

                  <div class="optionMain">

                    <div
                      class="optionIcon"
                    >
                      ⚙
                    </div>

                    <div
                      class="optionText"
                    >

                      <div
                        class="optionTitleRow"
                      >

                        <h3>
                          ${escapeHtml(
                            option.name
                          )}
                        </h3>

                        ${
                          option.enabled
                            ? `
                              <span
                                class="badge active"
                              >
                                ACTIVA
                              </span>
                            `
                            : `
                              <span
                                class="badge revoked"
                              >
                                DESACTIVADA
                              </span>
                            `
                        }

                      </div>

                      <p>
                        ${escapeHtml(
                          option.description ||
                          'Sin descripción'
                        )}
                      </p>

                    </div>

                  </div>


                  <div
                    class="optionMeta"
                  >

                    <span>
                      <strong>
                        Categoría:
                      </strong>

                      ${
                        option.category === 'aimbot'
                          ? 'Aimbots'
                          : (
                              option.category === 'fps'
                                ? 'FPS'
                                : 'Hologramas'
                            )
                      }
                    </span>

                    <span>
                      <strong>
                        Juego:
                      </strong>

                      ${gameLabel(
                        option.game
                      )}
                    </span>

                    <span>
                      <strong>
                        Ruta:
                      </strong>

                      <code>
                        ${escapeHtml(
                          option.route
                        )}
                      </code>
                    </span>

                    <span>
                      <strong>
                        ARCHIVO 1:
                      </strong>

                      ${
                        option.hasFile
                          ? escapeHtml(
                              option.fileName ||
                              'Archivo modificado'
                            )
                          : 'Sin archivo'
                      }
                    </span>

                    <span>
                      <strong>
                        ARCHIVO 2:
                      </strong>

                      ${
                        option.hasFile2
                          ? escapeHtml(
                              option.file2Name ||
                              'Archivo modificado'
                            )
                          : 'Sin archivo'
                      }
                    </span>

                  </div>


                  <div
                    class="optionActions"
                  >

                    <button
                      class="small"
                      data-option-action="edit"
                      data-id="${option.id}"
                    >
                      Editar
                    </button>


                    <button
                      class="small"
                      data-option-action="toggle"
                      data-id="${option.id}"
                    >
                      ${
                        option.enabled
                          ? 'Desactivar'
                          : 'Activar'
                      }
                    </button>


                    ${
                      option.hasFile
                        ? `
                          <button
                            class="small danger"
                            data-option-action="delete-file1"
                            data-id="${option.id}"
                          >
                            Eliminar archivo 1
                          </button>
                        `
                        : ''
                    }


                    ${
                      option.hasFile2
                        ? `
                          <button
                            class="small danger"
                            data-option-action="delete-file2"
                            data-id="${option.id}"
                          >
                            Eliminar archivo 2
                          </button>
                        `
                        : ''
                    }


                    <button
                      class="small danger"
                      data-option-action="delete"
                      data-id="${option.id}"
                    >
                      Eliminar opción
                    </button>

                  </div>

                </article>
              `
          )
          .join('');

      optionsWrap
        .querySelectorAll(
          'button[data-option-action]'
        )
        .forEach(
          button => {
            button.addEventListener(
              'click',
              handleOptionAction
            );
          }
        );
    };


  /*
   * =========================================================
   * BORRADO INDIVIDUAL DE ARCHIVOS
   * =========================================================
   */

  const originalHandleOptionAction =
    handleOptionAction;

  handleOptionAction =
    async function (event) {

      const button =
        event.currentTarget;

      const id =
        Number(
          button.dataset.id
        );

      const action =
        button.dataset.optionAction;

      const option =
        optionsCache.find(
          item =>
            Number(item.id) === id
        );

      if (!option) {
        return;
      }

      if (
        action !== 'delete-file1' &&
        action !== 'delete-file2'
      ) {
        return originalHandleOptionAction(
          event
        );
      }

      const slot =
        action === 'delete-file2'
          ? 2
          : 1;

      const fileName =
        slot === 2
          ? option.file2Name
          : option.fileName;

      const confirmed =
        confirm(
          `¿Eliminar solamente el archivo ${slot} "${fileName || 'Sin nombre'}"?\n\nLa opción "${option.name}" NO se borrará.`
        );

      if (!confirmed) {
        return;
      }

      button.disabled =
        true;

      try {
        const endpoint =
          slot === 2
            ? `/api/admin/options/${id}/file2`
            : `/api/admin/options/${id}/file`;

        await api(
          endpoint,
          {
            method: 'DELETE'
          }
        );

        showToast(
          `Archivo ${slot} eliminado`
        );

        await loadOptions();

      } catch (error) {
        button.disabled =
          false;

        showToast(
          error.message,
          'error'
        );
      }
    };

})();
/*
 * =========================================================
 * XITFORGE - ARCHIVOS PARA BORRAR AL DESACTIVAR
 * =========================================================
 */

(() => {
  'use strict';

  const originalCard =
    document.querySelector(
      '.originalFilesCard'
    );

  if (!originalCard) {
    console.error(
      'XITFORGE delete rules: originalFilesCard not found.'
    );
    return;
  }

  const section =
    document.createElement(
      'section'
    );

  section.className =
    'card originalFilesCard';

  section.id =
    'deleteFilesCard';

  section.innerHTML = `
    <div class="sectionTitle">

      <div>
        <h2>
          Archivos para BORRAR al DESACTIVAR
        </h2>

        <p class="muted">
          Configura archivos que XITFORGE debe eliminar del juego
          cuando el cliente desactive una opción.
        </p>
      </div>

      <button
        id="newDeleteFileButton"
        type="button"
      >
        + Agregar para borrar
      </button>

    </div>

    <div
      id="deleteFileFormWrap"
      class="originalFormWrap hidden"
    >

      <form id="deleteFileForm">

        <div class="originalFormGrid">

          <div>
            <label for="deleteFileGame">
              Juego
            </label>

            <select
              id="deleteFileGame"
              required
            >
              <option value="freefire_normal">
                Free Fire Normal
              </option>

              <option value="freefire_max">
                Free Fire MAX
              </option>
            </select>
          </div>

          <div>
            <label for="deleteFileOption">
              Opción
            </label>

            <select
              id="deleteFileOption"
              required
            ></select>
          </div>

        </div>

        <label for="deleteFileRoute">
          Ruta
        </label>

        <input
          id="deleteFileRoute"
          type="text"
          maxlength="2048"
          placeholder="Ej. Documents/contentcache/..."
          required
        >

        <label for="deleteFileName">
          Nombre exacto del archivo a borrar
        </label>

        <input
          id="deleteFileName"
          type="text"
          maxlength="255"
          placeholder="Ej. archivo_extra.bytes"
          required
        >

        <p class="fieldHelp">
          No tienes que subir el archivo. Solo indica la ruta
          y su nombre exacto. La regla queda vinculada a la opción
          seleccionada.
        </p>

        <div
          class="formActions originalFormActions"
        >
          <button type="submit">
            Guardar para borrar
          </button>

          <button
            id="cancelDeleteFileButton"
            class="secondary"
            type="button"
          >
            Cancelar
          </button>
        </div>

        <p
          id="deleteFileFormError"
          class="error"
        ></p>

      </form>

    </div>

    <div id="deleteFilesWrap"></div>
  `;

  originalCard.insertAdjacentElement(
    'afterend',
    section
  );


  const newDeleteFileButton =
    document.getElementById(
      'newDeleteFileButton'
    );

  const deleteFileFormWrap =
    document.getElementById(
      'deleteFileFormWrap'
    );

  const deleteFileForm =
    document.getElementById(
      'deleteFileForm'
    );

  const deleteFileGame =
    document.getElementById(
      'deleteFileGame'
    );

  const deleteFileOption =
    document.getElementById(
      'deleteFileOption'
    );

  const deleteFileRoute =
    document.getElementById(
      'deleteFileRoute'
    );

  const deleteFileName =
    document.getElementById(
      'deleteFileName'
    );

  const cancelDeleteFileButton =
    document.getElementById(
      'cancelDeleteFileButton'
    );

  const deleteFileFormError =
    document.getElementById(
      'deleteFileFormError'
    );

  const deleteFilesWrap =
    document.getElementById(
      'deleteFilesWrap'
    );


  let deleteFilesCache =
    [];

  let deleteOptionsCache =
    [];


  async function loadDeleteOptions() {
    const data =
      await api(
        '/api/admin/options'
      );

    deleteOptionsCache =
      data.options || [];

    renderDeleteOptionChoices();
  }


  function renderDeleteOptionChoices() {
    const game =
      deleteFileGame.value;

    const items =
      deleteOptionsCache
        .filter(
          option =>
            option.game === game
        );

    if (
      items.length === 0
    ) {
      deleteFileOption.innerHTML =
        `
          <option value="">
            No hay opciones para este juego
          </option>
        `;

      deleteFileOption.disabled =
        true;

      return;
    }

    deleteFileOption.disabled =
      false;

    deleteFileOption.innerHTML =
      items
        .map(
          option =>
            `
              <option
                value="${Number(option.id)}"
              >
                ${escapeHtml(option.name)}
              </option>
            `
        )
        .join('');
  }


  async function loadDeleteFiles() {
    try {
      const data =
        await api(
          '/api/admin/delete-files'
        );

      deleteFilesCache =
        data.deleteFiles || [];

      renderDeleteFiles();

    } catch (error) {
      deleteFilesWrap.innerHTML =
        `
          <div class="emptyState error">
            ${escapeHtml(error.message)}
          </div>
        `;
    }
  }


  function renderDeleteFiles() {
    if (
      deleteFilesCache.length === 0
    ) {
      deleteFilesWrap.innerHTML =
        `
          <div class="emptyState compactEmpty">
            Todavía no hay archivos configurados para borrar.
          </div>
        `;

      return;
    }

    deleteFilesWrap.innerHTML =
      deleteFilesCache
        .map(
          item =>
            `
              <div class="originalFileItem">

                <div class="originalFileMain">

                  <strong>
                    ${escapeHtml(item.fileName)}
                  </strong>

                  <span>
                    ${escapeHtml(gameLabel(item.game))}
                    ·
                    ${escapeHtml(item.optionName || 'Opción')}
                  </span>

                  <code>
                    ${escapeHtml(item.route)}
                  </code>

                </div>

                <div class="originalFileSide">

                  <span>
                    Se borrará al DESACTIVAR
                  </span>

                  <button
                    type="button"
                    class="small danger"
                    data-delete-rule="${Number(item.id)}"
                  >
                    Eliminar regla
                  </button>

                </div>

              </div>
            `
        )
        .join('');

    deleteFilesWrap
      .querySelectorAll(
        '[data-delete-rule]'
      )
      .forEach(
        button => {
          button.addEventListener(
            'click',
            async () => {
              const id =
                Number(
                  button.dataset.deleteRule
                );

              const item =
                deleteFilesCache.find(
                  value =>
                    Number(value.id) === id
                );

              if (!item) {
                return;
              }

              const confirmed =
                confirm(
                  `¿Quitar la regla que borra "${item.fileName}" al DESACTIVAR?\n\nEsto solo elimina la regla del panel; no borra nada del teléfono ahora mismo.`
                );

              if (!confirmed) {
                return;
              }

              button.disabled =
                true;

              try {
                await api(
                  `/api/admin/delete-files/${id}`,
                  {
                    method: 'DELETE'
                  }
                );

                showToast(
                  'Regla de borrado eliminada'
                );

                await loadDeleteFiles();

              } catch (error) {
                button.disabled =
                  false;

                showToast(
                  error.message,
                  'error'
                );
              }
            }
          );
        }
      );
  }


  newDeleteFileButton
    .addEventListener(
      'click',
      async () => {
        deleteFileFormError
          .textContent = '';

        deleteFileFormWrap
          .classList
          .remove('hidden');

        try {
          await loadDeleteOptions();
        } catch (error) {
          deleteFileFormError
            .textContent =
              error.message;
        }

        deleteFileFormWrap
          .scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
      }
    );


  cancelDeleteFileButton
    .addEventListener(
      'click',
      () => {
        deleteFileForm
          .reset();

        deleteFileFormError
          .textContent = '';

        deleteFileFormWrap
          .classList
          .add('hidden');

        renderDeleteOptionChoices();
      }
    );


  deleteFileGame
    .addEventListener(
      'change',
      renderDeleteOptionChoices
    );


  deleteFileForm
    .addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        deleteFileFormError
          .textContent = '';

        const optionId =
          Number(
            deleteFileOption.value
          );

        const route =
          deleteFileRoute
            .value
            .trim();

        const fileName =
          deleteFileName
            .value
            .trim();

        if (
          !Number.isSafeInteger(optionId) ||
          optionId < 1
        ) {
          deleteFileFormError
            .textContent =
              'Selecciona una opción.';

          return;
        }

        const submitButton =
          deleteFileForm
            .querySelector(
              'button[type="submit"]'
            );

        const oldText =
          submitButton.textContent;

        submitButton.disabled =
          true;

        submitButton.textContent =
          'GUARDANDO...';

        try {
          await api(
            '/api/admin/delete-files',
            {
              method: 'POST',

              body:
                JSON.stringify({
                  optionId,
                  route,
                  fileName
                })
            }
          );

          showToast(
            'Archivo configurado para borrar al DESACTIVAR'
          );

          deleteFileForm
            .reset();

          deleteFileFormWrap
            .classList
            .add('hidden');

          renderDeleteOptionChoices();

          await loadDeleteFiles();

        } catch (error) {
          deleteFileFormError
            .textContent =
              error.message;

        } finally {
          submitButton.disabled =
            false;

          submitButton.textContent =
            oldText;
        }
      }
    );


  /*
   * Cuando el usuario entra a "Opciones", refrescar también
   * las reglas de borrado.
   */
  optionsTab
    .addEventListener(
      'click',
      () => {
        loadDeleteFiles();
        loadDeleteOptions()
          .catch(() => {});
      }
    );


  /*
   * Si el panel ya está abierto, dejar la sección lista.
   */
  loadDeleteFiles();
  loadDeleteOptions()
    .catch(() => {});

})();
