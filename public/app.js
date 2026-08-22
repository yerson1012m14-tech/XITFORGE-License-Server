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

const versionTab =
  document.getElementById(
    'versionTab'
  );

const licensesView =
  document.getElementById(
    'licensesView'
  );

const optionsView =
  document.getElementById(
    'optionsView'
  );

const versionView =
  document.getElementById(
    'versionView'
  );


/*
 * =========================================================
 * LICENCIAS V2
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

const createdKeyMeta =
  document.getElementById(
    'createdKeyMeta'
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

const durationPresetWrap =
  document.getElementById(
    'durationPresetWrap'
  );

const customDurationWrap =
  document.getElementById(
    'customDurationWrap'
  );

const customDurationDays =
  document.getElementById(
    'customDurationDays'
  );

const deviceLimitInput =
  document.getElementById(
    'deviceLimit'
  );

const licenseNoteInput =
  document.getElementById(
    'licenseNote'
  );

const createSummary =
  document.getElementById(
    'createSummary'
  );

const createError =
  document.getElementById(
    'createError'
  );

const licenseSearch =
  document.getElementById(
    'licenseSearch'
  );

const licenseStatusFilter =
  document.getElementById(
    'licenseStatusFilter'
  );

const statTotal =
  document.getElementById(
    'statTotal'
  );

const statActive =
  document.getElementById(
    'statActive'
  );

const statExpired =
  document.getElementById(
    'statExpired'
  );

const statRevoked =
  document.getElementById(
    'statRevoked'
  );

const statDevices =
  document.getElementById(
    'statDevices'
  );

const licenseModal =
  document.getElementById(
    'licenseModal'
  );

const licenseModalEyebrow =
  document.getElementById(
    'licenseModalEyebrow'
  );

const licenseModalTitle =
  document.getElementById(
    'licenseModalTitle'
  );

const licenseModalBody =
  document.getElementById(
    'licenseModalBody'
  );

const licenseModalActions =
  document.getElementById(
    'licenseModalActions'
  );

const licenseModalClose =
  document.getElementById(
    'licenseModalClose'
  );

const toast =
  document.getElementById(
    'toast'
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

const optionCategory =
  document.getElementById(
    'optionCategory'
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


const newOriginalButton = document.getElementById('newOriginalButton');
const originalFormWrap = document.getElementById('originalFormWrap');
const originalForm = document.getElementById('originalForm');
const originalGame = document.getElementById('originalGame');
const originalRoute = document.getElementById('originalRoute');
const originalFiles = document.getElementById('originalFiles');
const cancelOriginalButton = document.getElementById('cancelOriginalButton');
const originalFormError = document.getElementById('originalFormError');
const originalFilesWrap = document.getElementById('originalFilesWrap');

let originalFilesCache = [];


/*
 * =========================================================
 * CONTROL DE VERSIÓN
 * =========================================================
 */

const versionForm =
  document.getElementById(
    'versionForm'
  );

const latestVersion =
  document.getElementById(
    'latestVersion'
  );

const minimumVersion =
  document.getElementById(
    'minimumVersion'
  );

const downloadUrl =
  document.getElementById(
    'downloadUrl'
  );

const updateMessage =
  document.getElementById(
    'updateMessage'
  );

const forceUpdate =
  document.getElementById(
    'forceUpdate'
  );

const versionBadge =
  document.getElementById(
    'versionBadge'
  );

const versionExample =
  document.getElementById(
    'versionExample'
  );

const versionFormError =
  document.getElementById(
    'versionFormError'
  );

const versionSaved =
  document.getElementById(
    'versionSaved'
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

versionTab.addEventListener(
  'click',
  showVersionTab
);


function showLicensesTab() {

  licensesTab.classList.add(
    'active'
  );

  optionsTab.classList.remove(
    'active'
  );

  versionTab.classList.remove(
    'active'
  );

  licensesView.classList.remove(
    'hidden'
  );

  optionsView.classList.add(
    'hidden'
  );

  versionView.classList.add(
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

  versionTab.classList.remove(
    'active'
  );

  optionsView.classList.remove(
    'hidden'
  );

  licensesView.classList.add(
    'hidden'
  );

  versionView.classList.add(
    'hidden'
  );

  loadOptions();
  loadOriginalFiles();
}


function showVersionTab() {

  versionTab.classList.add(
    'active'
  );

  licensesTab.classList.remove(
    'active'
  );

  optionsTab.classList.remove(
    'active'
  );

  versionView.classList.remove(
    'hidden'
  );

  licensesView.classList.add(
    'hidden'
  );

  optionsView.classList.add(
    'hidden'
  );

  loadAppVersion();
}


/*
 * =========================================================
 * LICENCIAS V2 - ESTADO
 * =========================================================
 */

let licensesCache = [];
let selectedDuration = 7;
let toastTimer = null;

function showToast(message, type = 'success') {
  toast.textContent = String(message || '');
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

function closeLicenseModal() {
  if (licenseModal.open) {
    licenseModal.close();
  }
  licenseModalBody.innerHTML = '';
  licenseModalActions.innerHTML = '';
}

licenseModalClose.addEventListener('click', closeLicenseModal);

licenseModal.addEventListener('click', event => {
  if (event.target === licenseModal) {
    closeLicenseModal();
  }
});

function openLicenseModal({
  eyebrow = 'XITFORGE',
  title,
  body,
  actions = []
}) {
  licenseModalEyebrow.textContent = eyebrow;
  licenseModalTitle.textContent = title;
  licenseModalBody.innerHTML = body;
  licenseModalActions.innerHTML = '';

  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.className = action.className || 'secondary';
    button.addEventListener('click', action.onClick);
    licenseModalActions.appendChild(button);
  }

  if (!licenseModal.open) {
    licenseModal.showModal();
  }
}

/*
 * =========================================================
 * DURACIÓN
 * =========================================================
 */

function currentDurationDays() {
  if (selectedDuration === 'custom') {
    return Number(customDurationDays.value);
  }
  return Number(selectedDuration);
}

function updateCreateSummary() {
  const days = currentDurationDays();
  const devices = Number(deviceLimitInput.value) || 1;

  const durationText =
    Number.isInteger(days) && days > 0
      ? `${days} ${days === 1 ? 'día' : 'días'}`
      : 'Selecciona los días';

  createSummary.textContent =
    `${durationText} · ${devices} ${devices === 1 ? 'dispositivo' : 'dispositivos'}`;
}

durationPresetWrap
  .querySelectorAll('.durationPreset')
  .forEach(button => {
    button.addEventListener('click', () => {
      durationPresetWrap
        .querySelectorAll('.durationPreset')
        .forEach(item => item.classList.remove('active'));

      button.classList.add('active');

      selectedDuration =
        button.dataset.days === 'custom'
          ? 'custom'
          : Number(button.dataset.days);

      customDurationWrap.classList.toggle(
        'hidden',
        selectedDuration !== 'custom'
      );

      if (selectedDuration === 'custom') {
        customDurationDays.focus();
      }

      updateCreateSummary();
    });
  });

customDurationDays.addEventListener('input', updateCreateSummary);
deviceLimitInput.addEventListener('input', updateCreateSummary);

/*
 * =========================================================
 * CREAR LICENCIA
 * =========================================================
 */

createForm.addEventListener('submit', async event => {
  event.preventDefault();

  createError.textContent = '';

  const durationDays = currentDurationDays();
  const deviceLimit = Number(deviceLimitInput.value);
  const note = licenseNoteInput.value.trim();

  if (
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 36500
  ) {
    createError.textContent =
      'Pon una cantidad válida de días.';
    return;
  }

  if (
    !Number.isInteger(deviceLimit) ||
    deviceLimit < 1 ||
    deviceLimit > 100
  ) {
    createError.textContent =
      'El número de dispositivos debe estar entre 1 y 100.';
    return;
  }

  const submitButton =
    createForm.querySelector('button[type="submit"]');

  const oldText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'GENERANDO...';

  try {
    const data = await api(
      '/api/admin/licenses',
      {
        method: 'POST',
        body: JSON.stringify({
          durationDays,
          deviceLimit,
          note
        })
      }
    );

    createdKeyValue.textContent = data.key;
    createdKeyMeta.textContent =
      `${durationDays} ${durationDays === 1 ? 'día' : 'días'} · ` +
      `${deviceLimit} ${deviceLimit === 1 ? 'dispositivo' : 'dispositivos'}` +
      `${note ? ` · ${note}` : ''}`;

    createdKey.classList.remove('hidden');

    showToast('Key generada correctamente');

    await loadLicenses();
  } catch (error) {
    createError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = oldText;
  }
});

/*
 * =========================================================
 * COPIAR KEY
 * =========================================================
 */

async function copyText(text) {
  const value = String(text || '');

  if (!value) {
    throw new Error('Nada para copiar');
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.pointerEvents = 'none';
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, area.value.length);

  const ok = document.execCommand('copy');
  area.remove();

  if (!ok) {
    throw new Error('No se pudo copiar');
  }
}

copyKeyButton.addEventListener('click', async () => {
  try {
    await copyText(createdKeyValue.textContent);
    copyKeyButton.textContent = 'Copiada ✓';
    showToast('Key copiada');

    setTimeout(() => {
      copyKeyButton.textContent = 'Copiar key';
    }, 1200);
  } catch {
    showToast('No se pudo copiar la key', 'error');
  }
});

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function formatDate(value) {
  if (!value) {
    return 'Sin expiración';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('es-DO');
}

function licenseState(license) {
  if (license.status === 'revoked') {
    return 'revoked';
  }

  if (
    license.expires_at &&
    Date.now() >= new Date(license.expires_at).getTime()
  ) {
    return 'expired';
  }

  return 'active';
}

function statusBadge(license) {
  const state = licenseState(license);

  if (state === 'active') {
    return '<span class="badge active">ACTIVA</span>';
  }

  if (state === 'expired') {
    return '<span class="badge expired">EXPIRADA</span>';
  }

  return '<span class="badge revoked">REVOCADA</span>';
}

function licenseDisplayKey(license) {
  return `${license.key_prefix}•••${license.key_last4}`;
}

function filteredLicenses() {
  const query = String(licenseSearch.value || '')
    .trim()
    .toLowerCase();

  const stateFilter = licenseStatusFilter.value;

  return licensesCache.filter(license => {
    const state = licenseState(license);

    if (
      stateFilter !== 'all' &&
      state !== stateFilter
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      license.key_prefix,
      license.key_last4,
      license.note || '',
      state
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });
}

function updateStats() {
  let active = 0;
  let expired = 0;
  let revoked = 0;
  let devices = 0;

  for (const license of licensesCache) {
    const state = licenseState(license);

    if (state === 'active') active += 1;
    if (state === 'expired') expired += 1;
    if (state === 'revoked') revoked += 1;

    devices += Number(license.devices || 0);
  }

  statTotal.textContent = licensesCache.length;
  statActive.textContent = active;
  statExpired.textContent = expired;
  statRevoked.textContent = revoked;
  statDevices.textContent = devices;
}

/*
 * =========================================================
 * CARGAR / RENDER LICENCIAS
 * =========================================================
 */

async function loadLicenses() {
  try {
    const data = await api('/api/admin/licenses');

    licensesCache = data.licenses || [];

    updateStats();
    renderLicenses();
  } catch (error) {
    tableWrap.innerHTML =
      `<div class="emptyState error">${escapeHtml(error.message)}</div>`;
  }
}

function renderLicenses() {
  const licenses = filteredLicenses();

  if (licenses.length === 0) {
    tableWrap.innerHTML =
      '<div class="emptyState">No hay licencias que coincidan.</div>';
    return;
  }

  const rows = licenses.map(license => {
    const state = licenseState(license);
    const canReactivate = state === 'revoked';

    return `
      <tr>
        <td>
          <div class="licenseKey">
            ${escapeHtml(licenseDisplayKey(license))}
          </div>
          <div class="licenseNote">
            ${escapeHtml(license.note || 'Sin nota')}
          </div>
        </td>

        <td>
          ${statusBadge(license)}
        </td>

        <td>
          <div class="deviceCount">
            ${Number(license.devices || 0)}
            /
            ${Number(license.device_limit || 1)}
          </div>
        </td>

        <td>
          <div class="expiresText">
            ${escapeHtml(formatDate(license.expires_at))}
          </div>
        </td>

        <td>
          <button
            type="button"
            class="small secondary manageButton"
            data-action="manage"
            data-id="${license.id}"
          >
            Administrar
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tableWrap.innerHTML = `
    <div class="tableScroll">
      <table class="licenseTable">
        <thead>
          <tr>
            <th>Key / Cliente</th>
            <th>Estado</th>
            <th>Dispositivos</th>
            <th>Expira</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  tableWrap
    .querySelectorAll('button[data-action]')
    .forEach(button => {
      button.addEventListener(
        'click',
        handleLicenseAction
      );
    });
}

refreshButton.addEventListener('click', loadLicenses);
licenseSearch.addEventListener('input', renderLicenses);
licenseStatusFilter.addEventListener('change', renderLicenses);

/*
 * =========================================================
 * ACCIONES DE LICENCIA
 * =========================================================
 */

function getCachedLicense(id) {
  return licensesCache.find(
    item => String(item.id) === String(id)
  ) || null;
}

async function handleLicenseAction(event) {
  const button = event.currentTarget;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const license = getCachedLicense(id);

  if (!license) {
    return;
  }

  if (action === 'manage') {
    showManageLicense(license);
    return;
  }

  if (action === 'devices') {
    await showDevices(license);
    return;
  }

  if (action === 'reset') {
    confirmResetDevices(license);
    return;
  }

  if (action === 'extend') {
    showExtendLicense(license);
    return;
  }

  if (action === 'edit') {
    showEditLicense(license);
    return;
  }

  if (action === 'revoke') {
    confirmRevoke(license);
    return;
  }

  if (action === 'reactivate') {
    await reactivateLicense(license);
    return;
  }

  if (action === 'delete') {
    confirmDeleteLicense(license);
  }
}

/*
 * =========================================================
 * MENÚ DE ADMINISTRACIÓN
 * =========================================================
 */

function showManageLicense(license) {
  const state = licenseState(license);
  const canReactivate = state === 'revoked';

  openLicenseModal({
    eyebrow: 'ADMINISTRAR KEY',
    title: licenseDisplayKey(license),
    body: `
      <div class="manageSummary">
        <div>
          <span>Cliente / nota</span>
          <strong>${escapeHtml(license.note || 'Sin nota')}</strong>
        </div>

        <div>
          <span>Dispositivos</span>
          <strong>
            ${Number(license.devices || 0)}
            /
            ${Number(license.device_limit || 1)}
          </strong>
        </div>

        <div>
          <span>Expira</span>
          <strong>${escapeHtml(formatDate(license.expires_at))}</strong>
        </div>
      </div>

      <div class="manageActions">
        <button type="button" data-manage="devices">
          Ver dispositivos
        </button>

        <button type="button" data-manage="reset">
          Reset dispositivos
        </button>

        <button type="button" data-manage="extend">
          + Agregar días
        </button>

        <button type="button" data-manage="edit">
          Editar cliente / límite
        </button>

        <button type="button" data-manage="replace">
          Reemplazar key
        </button>

        <button type="button" data-manage="${canReactivate ? 'reactivate' : 'revoke'}">
          ${canReactivate ? 'Reactivar key' : 'Revocar key'}
        </button>

        <button
          type="button"
          class="menuDanger"
          data-manage="delete"
        >
          Borrar key
        </button>
      </div>
    `,
    actions: [
      {
        label: 'Cerrar',
        className: 'secondary',
        onClick: closeLicenseModal
      }
    ]
  });

  licenseModalBody
    .querySelectorAll('[data-manage]')
    .forEach(button => {
      button.addEventListener('click', async () => {
        const action = button.dataset.manage;

        if (action === 'devices') {
          await showDevices(license);
          return;
        }

        if (action === 'reset') {
          confirmResetDevices(license);
          return;
        }

        if (action === 'extend') {
          showExtendLicense(license);
          return;
        }

        if (action === 'edit') {
          showEditLicense(license);
          return;
        }

        if (action === 'replace') {
          confirmReplaceLicense(license);
          return;
        }

        if (action === 'revoke') {
          confirmRevoke(license);
          return;
        }

        if (action === 'reactivate') {
          closeLicenseModal();
          await reactivateLicense(license);
          return;
        }

        if (action === 'delete') {
          confirmDeleteLicense(license);
        }
      });
    });
}


/*
 * =========================================================
 * REEMPLAZAR KEY
 * =========================================================
 */

function confirmReplaceLicense(license) {
  openLicenseModal({
    eyebrow: 'REEMPLAZAR KEY',
    title: licenseDisplayKey(license),
    body: `
      <div class="warningBox">
        La key anterior dejará de funcionar inmediatamente.
        Se conservarán el vencimiento, cliente y límite de dispositivos.
        Los celulares vinculados se liberarán.
      </div>
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'Reemplazar key',
        className: 'danger',
        onClick: () => replaceLicenseKey(license)
      }
    ]
  });
}

async function replaceLicenseKey(license) {
  try {
    const data = await api(
      `/api/admin/licenses/${license.id}/replace`,
      { method: 'POST' }
    );

    await loadLicenses();

    openLicenseModal({
      eyebrow: 'NUEVA KEY',
      title: 'Key reemplazada',
      body: `
        <div class="replacementKeyBox">
          <code id="replacementKeyValue">${escapeHtml(data.key)}</code>
          <p class="keySaveWarning">
            ⚠ Guarda esta key ahora. Después solo se mostrará parcialmente.
          </p>
          <button id="copyReplacementKey" type="button">Copiar key</button>
        </div>
      `,
      actions: [
        {
          label: 'Cerrar',
          className: 'secondary',
          onClick: closeLicenseModal
        }
      ]
    });

    const copyButton = document.getElementById('copyReplacementKey');
    copyButton.addEventListener('click', async () => {
      try {
        await copyText(data.key);
        copyButton.textContent = 'Copiada ✓';
        showToast('Nueva key copiada');
      } catch {
        showToast('No se pudo copiar la key', 'error');
      }
    });
  } catch (error) {
    showToast(error.message, 'error');
  }
}


/*
 * =========================================================
 * DISPOSITIVOS
 * =========================================================
 */

async function showDevices(license) {
  openLicenseModal({
    eyebrow: 'DISPOSITIVOS',
    title: licenseDisplayKey(license),
    body: '<div class="modalLoading">Cargando...</div>',
    actions: [
      {
        label: 'Cerrar',
        className: 'secondary',
        onClick: closeLicenseModal
      }
    ]
  });

  try {
    const data = await api(
      `/api/admin/licenses/${license.id}/activations`
    );

    const devices = data.activations || [];

    if (devices.length === 0) {
      licenseModalBody.innerHTML =
        '<div class="emptyState">Esta key no tiene ningún celular vinculado.</div>';
      return;
    }

    licenseModalBody.innerHTML = devices.map(device => `
      <div class="deviceItem">
        <div>
          <strong>
            Celular ${escapeHtml(device.device_code)}
          </strong>
          <span>
            Vinculado: ${escapeHtml(formatDate(device.activated_at))}
          </span>
          <span>
            Último uso: ${escapeHtml(formatDate(device.last_seen_at))}
          </span>
        </div>

        <button
          class="small danger"
          type="button"
          data-remove-device="${device.id}"
        >
          Quitar
        </button>
      </div>
    `).join('');

    licenseModalBody
      .querySelectorAll('[data-remove-device]')
      .forEach(removeButton => {
        removeButton.addEventListener('click', async () => {
          removeButton.disabled = true;

          try {
            await api(
              `/api/admin/licenses/${license.id}/activations/${removeButton.dataset.removeDevice}`,
              {
                method: 'DELETE'
              }
            );

            showToast('Dispositivo eliminado');

            await loadLicenses();

            await showDevices(
              getCachedLicense(license.id) || license
            );
          } catch (error) {
            removeButton.disabled = false;
            showToast(error.message, 'error');
          }
        });
      });
  } catch (error) {
    licenseModalBody.innerHTML =
      `<div class="emptyState error">${escapeHtml(error.message)}</div>`;
  }
}

/*
 * =========================================================
 * RESET DISPOSITIVOS
 * =========================================================
 */

function confirmResetDevices(license) {
  openLicenseModal({
    eyebrow: 'RESET DISPOSITIVOS',
    title: 'Liberar esta key',
    body: `
      <p class="modalText">
        Se eliminarán todos los celulares vinculados a
        <strong>${escapeHtml(licenseDisplayKey(license))}</strong>.
      </p>

      <div class="warningBox">
        Después del reset, la key podrá vincularse a otro celular.
        La key no se borra ni se revoca.
      </div>
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'RESET DISPOSITIVOS',
        className: 'dangerAction',
        onClick: async event => {
          const btn = event.currentTarget;
          btn.disabled = true;
          btn.textContent = 'RESETEANDO...';

          try {
            const data = await api(
              `/api/admin/licenses/${license.id}/activations`,
              {
                method: 'DELETE'
              }
            );

            closeLicenseModal();

            showToast(
              `${Number(data.removed || 0)} dispositivo(s) liberado(s)`
            );

            await loadLicenses();
          } catch (error) {
            btn.disabled = false;
            btn.textContent = 'RESET DISPOSITIVOS';
            showToast(error.message, 'error');
          }
        }
      }
    ]
  });
}

/*
 * =========================================================
 * AGREGAR DÍAS
 * =========================================================
 */

function showExtendLicense(license) {
  openLicenseModal({
    eyebrow: 'EXTENDER LICENCIA',
    title: licenseDisplayKey(license),
    body: `
      <label for="modalExtendDays">
        Días para agregar
      </label>

      <input
        id="modalExtendDays"
        type="number"
        min="1"
        max="36500"
        step="1"
        value="7"
      >

      <p class="fieldHelp">
        Si la key ya expiró, el nuevo tiempo comienza desde ahora.
      </p>
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'AGREGAR DÍAS',
        className: 'primaryAction',
        onClick: async event => {
          const days = Number(
            document.getElementById('modalExtendDays').value
          );

          if (
            !Number.isInteger(days) ||
            days < 1 ||
            days > 36500
          ) {
            showToast(
              'Pon una cantidad válida de días',
              'error'
            );
            return;
          }

          const btn = event.currentTarget;
          btn.disabled = true;

          try {
            await api(
              `/api/admin/licenses/${license.id}/extend`,
              {
                method: 'POST',
                body: JSON.stringify({ days })
              }
            );

            closeLicenseModal();
            showToast(`${days} día(s) agregados`);
            await loadLicenses();
          } catch (error) {
            btn.disabled = false;
            showToast(error.message, 'error');
          }
        }
      }
    ]
  });
}

/*
 * =========================================================
 * EDITAR KEY
 * =========================================================
 */

function showEditLicense(license) {
  openLicenseModal({
    eyebrow: 'EDITAR LICENCIA',
    title: licenseDisplayKey(license),
    body: `
      <label for="modalLicenseNote">
        Cliente / nota
      </label>

      <input
        id="modalLicenseNote"
        type="text"
        maxlength="120"
        value="${escapeHtml(license.note || '')}"
      >

      <label for="modalDeviceLimit">
        Límite de dispositivos
      </label>

      <input
        id="modalDeviceLimit"
        type="number"
        min="1"
        max="100"
        step="1"
        value="${Number(license.device_limit || 1)}"
      >
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'GUARDAR',
        className: 'primaryAction',
        onClick: async event => {
          const note =
            document
              .getElementById('modalLicenseNote')
              .value
              .trim();

          const deviceLimit = Number(
            document.getElementById('modalDeviceLimit').value
          );

          if (
            !Number.isInteger(deviceLimit) ||
            deviceLimit < 1 ||
            deviceLimit > 100
          ) {
            showToast(
              'El límite debe estar entre 1 y 100',
              'error'
            );
            return;
          }

          const btn = event.currentTarget;
          btn.disabled = true;

          try {
            await api(
              `/api/admin/licenses/${license.id}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  note,
                  deviceLimit
                })
              }
            );

            closeLicenseModal();
            showToast('Licencia actualizada');
            await loadLicenses();
          } catch (error) {
            btn.disabled = false;
            showToast(error.message, 'error');
          }
        }
      }
    ]
  });
}

/*
 * =========================================================
 * REVOCAR / REACTIVAR
 * =========================================================
 */

function confirmRevoke(license) {
  openLicenseModal({
    eyebrow: 'REVOCAR',
    title: 'Desactivar esta key',
    body: `
      <p class="modalText">
        La key
        <strong>${escapeHtml(licenseDisplayKey(license))}</strong>
        dejará de funcionar, pero seguirá guardada y podrás reactivarla.
      </p>
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'REVOCAR',
        className: 'dangerAction',
        onClick: async event => {
          const btn = event.currentTarget;
          btn.disabled = true;

          try {
            await api(
              `/api/admin/licenses/${license.id}/revoke`,
              {
                method: 'POST'
              }
            );

            closeLicenseModal();
            showToast('Key revocada');
            await loadLicenses();
          } catch (error) {
            btn.disabled = false;
            showToast(error.message, 'error');
          }
        }
      }
    ]
  });
}

async function reactivateLicense(license) {
  try {
    await api(
      `/api/admin/licenses/${license.id}/reactivate`,
      {
        method: 'POST'
      }
    );

    showToast('Key reactivada');
    await loadLicenses();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

/*
 * =========================================================
 * BORRAR KEY
 * =========================================================
 */

function confirmDeleteLicense(license) {
  openLicenseModal({
    eyebrow: 'BORRAR DEFINITIVAMENTE',
    title: 'Eliminar key',
    body: `
      <p class="modalText">
        Vas a borrar
        <strong>${escapeHtml(licenseDisplayKey(license))}</strong>
        y todos sus dispositivos vinculados.
      </p>

      <div class="dangerBox">
        Esta acción no se puede deshacer.
      </div>
    `,
    actions: [
      {
        label: 'Cancelar',
        className: 'secondary',
        onClick: closeLicenseModal
      },
      {
        label: 'BORRAR KEY',
        className: 'dangerAction',
        onClick: async event => {
          const btn = event.currentTarget;
          btn.disabled = true;
          btn.textContent = 'BORRANDO...';

          try {
            await api(
              `/api/admin/licenses/${license.id}`,
              {
                method: 'DELETE'
              }
            );

            closeLicenseModal();
            showToast('Key borrada definitivamente');
            await loadLicenses();
          } catch (error) {
            btn.disabled = false;
            btn.textContent = 'BORRAR KEY';
            showToast(error.message, 'error');
          }
        }
      }
    ]
  });
}

updateCreateSummary();

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
 * ARCHIVOS ORIGINALES PARA DESACTIVAR
 * =========================================================
 */

newOriginalButton.addEventListener('click', () => {
  originalFormError.textContent = '';
  originalFormWrap.classList.remove('hidden');
  originalFormWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

cancelOriginalButton.addEventListener('click', () => {
  originalForm.reset();
  originalFormError.textContent = '';
  originalFormWrap.classList.add('hidden');
});

originalForm.addEventListener('submit', async event => {
  event.preventDefault();
  originalFormError.textContent = '';

  const files = Array.from(originalFiles.files || []);
  const route = originalRoute.value.trim();
  const game = originalGame.value;

  if (!files.length) {
    originalFormError.textContent = 'Selecciona al menos un archivo.';
    return;
  }

  const submitButton = originalForm.querySelector('button[type="submit"]');
  const oldText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = `Subiendo 0/${files.length}...`;

  try {
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];

      if (file.size > 32 * 1024 * 1024) {
        throw new Error(`${file.name} supera 32 MB.`);
      }

      submitButton.textContent = `Subiendo ${i + 1}/${files.length}...`;
      await uploadOriginalFile({ game, route, file, sortOrder: i });
    }

    showToast(
      files.length === 1
        ? 'Archivo original guardado'
        : `${files.length} archivos originales guardados`
    );

    originalForm.reset();
    originalFormWrap.classList.add('hidden');
    await loadOriginalFiles();
  } catch (error) {
    originalFormError.textContent = error.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = oldText;
  }
});

async function uploadOriginalFile({ game, route, file, sortOrder }) {
  const response = await fetch('/api/admin/original-files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-Game': game,
      'X-Route': route,
      'X-File-Name': file.name,
      'X-File-Mime': file.type || 'application/octet-stream',
      'X-Sort-Order': String(sortOrder || 0)
    },
    body: file
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo subir el archivo original.');
  }

  return data;
}

async function loadOriginalFiles() {
  try {
    const data = await api('/api/admin/original-files');
    originalFilesCache = data.originals || [];
    renderOriginalFiles();
  } catch (error) {
    originalFilesWrap.innerHTML =
      `<div class="emptyState error">${escapeHtml(error.message)}</div>`;
  }
}

function renderOriginalFiles() {
  if (!originalFilesCache.length) {
    originalFilesWrap.innerHTML = `
      <div class="emptyState compactEmpty">
        Todavía no hay archivos originales.
      </div>
    `;
    return;
  }

  originalFilesWrap.innerHTML = originalFilesCache.map(item => `
    <div class="originalFileItem">
      <div class="originalFileMain">
        <strong>${escapeHtml(item.fileName || 'Archivo')}</strong>
        <span>${escapeHtml(gameLabel(item.game))}</span>
        <code>${escapeHtml(item.route || '')}</code>
      </div>
      <div class="originalFileSide">
        <span>${formatBytes(item.fileSize || 0)}</span>
        <button
          type="button"
          class="small danger"
          data-original-delete="${item.id}"
        >
          Eliminar
        </button>
      </div>
    </div>
  `).join('');

  originalFilesWrap
    .querySelectorAll('[data-original-delete]')
    .forEach(button => {
      button.addEventListener('click', async () => {
        const id = Number(button.dataset.originalDelete);
        const item = originalFilesCache.find(x => Number(x.id) === id);
        if (!item) return;

        const confirmed = confirm(
          `¿Eliminar el original "${item.fileName}"?`
        );
        if (!confirmed) return;

        try {
          await api(`/api/admin/original-files/${id}`, { method: 'DELETE' });
          await loadOriginalFiles();
          showToast('Archivo original eliminado');
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


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

        category:
          optionCategory.value,

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

        if (created.option) {

          if (
            optionFile.files.length > 0
          ) {

            await uploadOptionFile(
              created.option.id
            );
          }
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

    optionCategory.value =
      option.category ||
      'holograma';

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

    optionCategory.value =
      'holograma';

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
                    Categoría:
                  </strong>

                  ${option.category === 'aimbot' ? 'Aimbots' : (option.category === 'fps' ? 'FPS' : 'Hologramas')}
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
                    ACTIVAR:
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
 * CONTROL DE VERSIÓN
 * =========================================================
 */

async function loadAppVersion() {

  versionFormError.textContent =
    '';

  versionSaved.textContent =
    '';

  versionBadge.textContent =
    'Cargando';

  try {

    const data =
      await api(
        '/api/admin/app-version'
      );

    latestVersion.value =
      data.latestVersion || '1.0.0';

    minimumVersion.value =
      data.minimumVersion || '1.0.0';

    downloadUrl.value =
      data.downloadUrl || '';

    updateMessage.value =
      data.message || '';

    forceUpdate.checked =
      Boolean(
        data.forceUpdate
      );

    versionBadge.textContent =
      forceUpdate.checked
        ? 'OBLIGATORIA'
        : 'OPCIONAL';

    versionBadge.classList.toggle(
      'active',
      forceUpdate.checked
    );

    versionBadge.classList.toggle(
      'revoked',
      !forceUpdate.checked
    );

    updateVersionExample();

  } catch (error) {

    versionBadge.textContent =
      'ERROR';

    versionBadge.classList.remove(
      'active'
    );

    versionBadge.classList.add(
      'revoked'
    );

    versionFormError.textContent =
      error.message;
  }
}


function updateVersionExample() {

  const minimum =
    minimumVersion.value
      .trim() || '1.0.0';

  const latest =
    latestVersion.value
      .trim() || '1.0.0';

  if (forceUpdate.checked) {

    versionExample.textContent =
      `Menor que ${minimum} → BLOQUEADO · ${latest} = última versión`;

  } else {

    versionExample.textContent =
      `Actualización obligatoria desactivada · ${latest} = última versión`;
  }
}


[
  latestVersion,
  minimumVersion
].forEach(
  input => {

    input.addEventListener(
      'input',
      updateVersionExample
    );
  }
);

forceUpdate.addEventListener(
  'change',
  updateVersionExample
);


versionForm.addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    versionFormError.textContent =
      '';

    versionSaved.textContent =
      '';

    try {

      const data =
        await api(
          '/api/admin/app-version',
          {
            method: 'PUT',

            body:
              JSON.stringify({
                latestVersion:
                  latestVersion.value.trim(),

                minimumVersion:
                  minimumVersion.value.trim(),

                forceUpdate:
                  forceUpdate.checked,

                downloadUrl:
                  downloadUrl.value.trim(),

                message:
                  updateMessage.value.trim()
              })
          }
        );

      latestVersion.value =
        data.latestVersion;

      minimumVersion.value =
        data.minimumVersion;

      downloadUrl.value =
        data.downloadUrl || '';

      updateMessage.value =
        data.message || '';

      forceUpdate.checked =
        Boolean(
          data.forceUpdate
        );

      versionBadge.textContent =
        forceUpdate.checked
          ? 'OBLIGATORIA'
          : 'OPCIONAL';

      versionBadge.classList.toggle(
        'active',
        forceUpdate.checked
      );

      versionBadge.classList.toggle(
        'revoked',
        !forceUpdate.checked
      );

      versionSaved.textContent =
        'Guardado correctamente.';

      updateVersionExample();

    } catch (error) {

      versionFormError.textContent =
        error.message;
    }
  }
);


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