let token =
  sessionStorage.getItem(
    'xitforgeAdminToken'
  ) || '';

/*
 * =========================================================
 * ELEMENTOS PRINCIPALES
 * =========================================================
 */

const loginView =
  document.getElementById(
    'loginView'
  );

const adminView =
  document.getElementById(
    'adminView'
  );

const loginForm =
  document.getElementById(
    'loginForm'
  );

const loginError =
  document.getElementById(
    'loginError'
  );

const logoutButton =
  document.getElementById(
    'logoutButton'
  );


/*
 * =========================================================
 * TABS
 * =========================================================
 */

const licensesTab =
  document.getElementById(
    'licensesTab'
  );

const optionsTab =
  document.getElementById(
    'optionsTab'
  );

const licensesView =
  document.getElementById(
    'licensesView'
  );

const optionsView =
  document.getElementById(
    'optionsView'
  );


/*
 * =========================================================
 * LICENCIAS
 * =========================================================
 */

const createForm =
  document.getElementById(
    'createForm'
  );

const createdKey =
  document.getElementById(
    'createdKey'
  );

const createdKeyValue =
  document.getElementById(
    'createdKeyValue'
  );

const copyKeyButton =
  document.getElementById(
    'copyKeyButton'
  );

const refreshButton =
  document.getElementById(
    'refreshButton'
  );

const tableWrap =
  document.getElementById(
    'tableWrap'
  );


/*
 * =========================================================
 * OPCIONES
 * =========================================================
 */

const newOptionButton =
  document.getElementById(
    'newOptionButton'
  );

const cancelOptionButton =
  document.getElementById(
    'cancelOptionButton'
  );

const refreshOptionsButton =
  document.getElementById(
    'refreshOptionsButton'
  );

const optionsGameFilter =
  document.getElementById(
    'optionsGameFilter'
  );

const optionFormCard =
  document.getElementById(
    'optionFormCard'
  );

const optionFormTitle =
  document.getElementById(
    'optionFormTitle'
  );

const optionForm =
  document.getElementById(
    'optionForm'
  );

const optionFormError =
  document.getElementById(
    'optionFormError'
  );

const optionId =
  document.getElementById(
    'optionId'
  );

const optionName =
  document.getElementById(
    'optionName'
  );

const optionDescription =
  document.getElementById(
    'optionDescription'
  );

const optionGame =
  document.getElementById(
    'optionGame'
  );

const optionRoute =
  document.getElementById(
    'optionRoute'
  );

const optionFile =
  document.getElementById(
    'optionFile'
  );

const optionSortOrder =
  document.getElementById(
    'optionSortOrder'
  );

const optionsWrap =
  document.getElementById(
    'optionsWrap'
  );


/*
 * =========================================================
 * ESTADO
 * =========================================================
 */

let optionsCache = [];


/*
 * =========================================================
 * API
 * =========================================================
 */

async function api(
  url,
  options = {}
) {

  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : {
          'Content-Type':
            'application/json'
        }),

    ...(options.headers || {})
  };

  if (token) {

    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(
      url,
      {
        ...options,
        headers
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
      'Error de servidor'
    );
  }

  return data;
}


/*
 * =========================================================
 * LOGIN
 * =========================================================
 */

loginForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    loginError.textContent =
      '';

    try {

      const password =
        document
          .getElementById(
            'adminPassword'
          )
          .value;

      const data =
        await api(
          '/api/admin/login',
          {
            method: 'POST',

            body:
              JSON.stringify({
                password
              })
          }
        );

      token =
        data.token;

      sessionStorage.setItem(
        'xitforgeAdminToken',
        token
      );

      loginForm.reset();

      showAdmin();

    } catch (error) {

      loginError.textContent =
        error.message;
    }
  }
);


/*
 * =========================================================
 * MOSTRAR ADMIN
 * =========================================================
 */

function showAdmin() {

  loginView.classList.add(
    'hidden'
  );

  adminView.classList.remove(
    'hidden'
  );

  showLicensesTab();

  loadLicenses();
}


/*
 * =========================================================
 * MOSTRAR LOGIN
 * =========================================================
 */

function showLogin() {

  adminView.classList.add(
    'hidden'
  );

  loginView.classList.remove(
    'hidden'
  );
}


/*
 * =========================================================
 * LOGOUT
 * =========================================================
 */

function logout() {

  token = '';

  sessionStorage.removeItem(
    'xitforgeAdminToken'
  );

  showLogin();
}


/*
 * =========================================================
 * TABS
 * =========================================================
 */

licensesTab.addEventListener(
  'click',
  showLicensesTab
);

optionsTab.addEventListener(
  'click',
  showOptionsTab
);


function showLicensesTab() {

  licensesTab.classList.add(
    'active'
  );

  optionsTab.classList.remove(
    'active'
  );

  licensesView.classList.remove(
    'hidden'
  );

  optionsView.classList.add(
    'hidden'
  );

  loadLicenses();
}


function showOptionsTab() {

  optionsTab.classList.add(
    'active'
  );

  licensesTab.classList.remove(
    'active'
  );

  optionsView.classList.remove(
    'hidden'
  );

  licensesView.classList.add(
    'hidden'
  );

  loadOptions();
}


/*
 * =========================================================
 * CREAR LICENCIA
 * =========================================================
 */

createForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    try {

      const durationDays =
        Number(
          document
            .getElementById(
              'durationDays'
            )
            .value
        );

      const deviceLimit =
        Number(
          document
            .getElementById(
              'deviceLimit'
            )
            .value
        );

      const data =
        await api(
          '/api/admin/licenses',
          {
            method: 'POST',

            body:
              JSON.stringify({
                durationDays,
                deviceLimit
              })
          }
        );

      createdKeyValue.textContent =
        data.key;

      createdKey.classList.remove(
        'hidden'
      );

      await loadLicenses();

    } catch (error) {

      alert(
        error.message
      );
    }
  }
);


/*
 * =========================================================
 * COPIAR KEY
 * =========================================================
 */

copyKeyButton.addEventListener(
  'click',
  async () => {

    try {

      await navigator.clipboard.writeText(
        createdKeyValue.textContent
      );

      copyKeyButton.textContent =
        'Copiada';

      setTimeout(
        () => {
          copyKeyButton.textContent =
            'Copiar';
        },
        1200
      );

    } catch {

      alert(
        'No se pudo copiar la key.'
      );
    }
  }
);


refreshButton.addEventListener(
  'click',
  loadLicenses
);

logoutButton.addEventListener(
  'click',
  logout
);


/*
 * =========================================================
 * LICENCIAS - FECHAS
 * =========================================================
 */

function formatDate(
  value
) {

  if (!value) {
    return 'Permanente';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;
  }

  return date.toLocaleString(
    'es-DO'
  );
}


/*
 * =========================================================
 * LICENCIAS - BADGE
 * =========================================================
 */

function statusBadge(
  status
) {

  const cls =
    status === 'active'
      ? 'active'
      : 'revoked';

  const label =
    status === 'active'
      ? 'ACTIVA'
      : 'REVOCADA';

  return `
    <span
      class="badge ${cls}"
    >
      ${label}
    </span>
  `;
}


/*
 * =========================================================
 * CARGAR LICENCIAS
 * =========================================================
 */

async function loadLicenses() {

  try {

    const data =
      await api(
        '/api/admin/licenses'
      );

    if (
      !data.licenses.length
    ) {

      tableWrap.innerHTML =
        '<p class="muted">No hay keys todavía.</p>';

      return;
    }

    const rows =
      data.licenses.map(
        license => {

          const actionButtons =
            license.status === 'active'

              ? `
                <button
                  class="small danger"
                  data-action="revoke"
                  data-id="${license.id}"
                >
                  Revocar
                </button>
              `

              : `
                <button
                  class="small"
                  data-action="reactivate"
                  data-id="${license.id}"
                >
                  Reactivar
                </button>
              `;

          return `
            <tr>

              <td>
                <strong>
                  ${license.key_prefix}
                  •••
                  ${license.key_last4}
                </strong>
              </td>

              <td>
                ${statusBadge(
                  license.status
                )}
              </td>

              <td>
                ${formatDate(
                  license.expires_at
                )}
              </td>

              <td>
                ${license.devices}
                /
                ${license.device_limit}
              </td>

              <td>
                ${formatDate(
                  license.created_at
                )}
              </td>

              <td>

                ${actionButtons}

                <button
                  class="small"
                  data-action="extend"
                  data-id="${license.id}"
                >
                  + días
                </button>

              </td>

            </tr>
          `;
        }
      ).join('');

    tableWrap.innerHTML = `
      <div class="tableScroll">

        <table>

          <thead>

            <tr>

              <th>
                Key
              </th>

              <th>
                Estado
              </th>

              <th>
                Expira
              </th>

              <th>
                Dispositivos
              </th>

              <th>
                Creada
              </th>

              <th>
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>
    `;


    tableWrap
      .querySelectorAll(
        'button[data-action]'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            handleLicenseAction
          );
        }
      );

  } catch (error) {

    tableWrap.innerHTML =
      `
        <p class="error">
          ${escapeHtml(
            error.message
          )}
        </p>
      `;
  }
}


/*
 * =========================================================
 * ACCIONES DE LICENCIA
 * =========================================================
 */

async function handleLicenseAction(
  event
) {

  const button =
    event.currentTarget;

  const id =
    button.dataset.id;

  const action =
    button.dataset.action;

  try {

    if (
      action === 'revoke'
    ) {

      const confirmed =
        confirm(
          '¿Seguro que quieres revocar esta key?'
        );

      if (!confirmed) {
        return;
      }

      await api(
        `/api/admin/licenses/${id}/revoke`,
        {
          method: 'POST'
        }
      );
    }


    if (
      action === 'reactivate'
    ) {

      await api(
        `/api/admin/licenses/${id}/reactivate`,
        {
          method: 'POST'
        }
      );
    }


    if (
      action === 'extend'
    ) {

      const days =
        Number(
          prompt(
            '¿Cuántos días quieres agregar?'
          )
        );

      if (
        !Number.isInteger(days) ||
        days < 1
      ) {

        return;
      }

      await api(
        `/api/admin/licenses/${id}/extend`,
        {
          method: 'POST',

          body:
            JSON.stringify({
              days
            })
        }
      );
    }

    await loadLicenses();

  } catch (error) {

    alert(
      error.message
    );
  }
}


/*
 * =========================================================
 * OPCIONES - NUEVA
 * =========================================================
 */

newOptionButton.addEventListener(
  'click',
  () => {

    openOptionForm();
  }
);


/*
 * =========================================================
 * OPCIONES - CANCELAR
 * =========================================================
 */

cancelOptionButton.addEventListener(
  'click',
  () => {

    closeOptionForm();
  }
);


/*
 * =========================================================
 * OPCIONES - CREAR / EDITAR
 * =========================================================
 */

optionForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    optionFormError.textContent =
      '';

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

        route:
          optionRoute.value.trim(),

        sortOrder:
          Number(
            optionSortOrder.value
          ) || 0
      };


      if (
        id
      ) {

        /*
         * EDITAR
         */

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

        /*
         * CREAR
         */

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

        /*
         * Si se creó correctamente
         * y el usuario seleccionó
         * un archivo, subirlo.
         */

        if (
          optionFile.files.length > 0 &&
          created.option
        ) {

          await uploadOptionFile(
            created.option.id
          );
        }
      }


      /*
       * Si estamos editando y se seleccionó
       * un nuevo archivo, reemplazarlo.
       */

      if (
        id &&
        optionFile.files.length > 0
      ) {

        await uploadOptionFile(
          id
        );
      }


      closeOptionForm();

      await loadOptions();

    } catch (error) {

      optionFormError.textContent =
        error.message;
    }
  }
);


/*
 * =========================================================
 * SUBIR ARCHIVO
 * =========================================================
 */

async function uploadOptionFile(
  id
) {

  const file =
    optionFile.files[0];

  if (!file) {
    return;
  }

  if (
    file.size >
    32 * 1024 * 1024
  ) {

    throw new Error(
      'El archivo no puede superar 32 MB.'
    );
  }

  const response =
    await fetch(
      `/api/admin/options/${id}/file`,
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

        body: file
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
      'No se pudo subir el archivo.'
    );
  }

  return data;
}


/*
 * =========================================================
 * ABRIR FORMULARIO
 * =========================================================
 */

function openOptionForm(
  option = null
) {

  optionFormError.textContent =
    '';

  optionFile.value =
    '';

  if (option) {

    optionFormTitle.textContent =
      'Editar opción';

    optionId.value =
      option.id;

    optionName.value =
      option.name || '';

    optionDescription.value =
      option.description || '';

    optionGame.value =
      option.game ||
      'freefire_normal';

    optionRoute.value =
      option.route || '';

    optionSortOrder.value =
      option.sortOrder || 0;

  } else {

    optionFormTitle.textContent =
      'Nueva opción';

    optionId.value =
      '';

    optionName.value =
      '';

    optionDescription.value =
      '';

    optionGame.value =
      'freefire_normal';

    optionRoute.value =
      '';

    optionSortOrder.value =
      0;
  }

  optionFormCard.classList.remove(
    'hidden'
  );

  optionFormCard.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}


/*
 * =========================================================
 * CERRAR FORMULARIO
 * =========================================================
 */

function closeOptionForm() {

  optionForm.reset();

  optionId.value =
    '';

  optionSortOrder.value =
    0;

  optionFormError.textContent =
    '';

  optionFormCard.classList.add(
    'hidden'
  );
}


/*
 * =========================================================
 * CARGAR OPCIONES
 * =========================================================
 */

refreshOptionsButton.addEventListener(
  'click',
  loadOptions
);

optionsGameFilter.addEventListener(
  'change',
  loadOptions
);


async function loadOptions() {

  try {

    const data =
      await api(
        '/api/admin/options'
      );

    optionsCache =
      data.options || [];

    renderOptions();

  } catch (error) {

    optionsWrap.innerHTML =
      `
        <p class="error">
          ${escapeHtml(
            error.message
          )}
        </p>
      `;
  }
}


/*
 * =========================================================
 * RENDER OPCIONES
 * =========================================================
 */

function renderOptions() {

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
                    Archivo:
                  </strong>

                  ${
                    option.hasFile
                      ? escapeHtml(
                          option.fileName ||
                          'Archivo'
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


                <button
                  class="small danger"
                  data-option-action="delete"
                  data-id="${option.id}"
                >
                  Eliminar
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
}


/*
 * =========================================================
 * ACCIONES DE OPCIÓN
 * =========================================================
 */

async function handleOptionAction(
  event
) {

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


  try {

    if (
      action === 'edit'
    ) {

      openOptionForm(
        option
      );

      return;
    }


    if (
      action === 'toggle'
    ) {

      await api(
        `/api/admin/options/${id}/status`,
        {
          method: 'PATCH',

          body:
            JSON.stringify({
              enabled:
                !option.enabled
            })
        }
      );

      await loadOptions();

      return;
    }


    if (
      action === 'delete'
    ) {

      const confirmed =
        confirm(
          `¿Eliminar la opción "${option.name}"?`
        );

      if (!confirmed) {
        return;
      }

      await api(
        `/api/admin/options/${id}`,
        {
          method: 'DELETE'
        }
      );

      await loadOptions();

    }

  } catch (error) {

    alert(
      error.message
    );
  }
}


/*
 * =========================================================
 * JUEGOS
 * =========================================================
 */

function gameLabel(
  game
) {

  if (
    game ===
    'freefire_normal'
  ) {

    return 'Free Fire Normal';
  }

  if (
    game ===
    'freefire_max'
  ) {

    return 'Free Fire MAX';
  }

  return game;
}


/*
 * =========================================================
 * SEGURIDAD HTML
 * =========================================================
 */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


/*
 * =========================================================
 * ARRANQUE
 * =========================================================
 */

if (token) {

  showAdmin();

} else {

  showLogin();
}