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
