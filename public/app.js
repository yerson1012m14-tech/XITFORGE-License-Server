let token = sessionStorage.getItem('xitforgeAdminToken') || '';

const loginView = document.getElementById('loginView');
const adminView = document.getElementById('adminView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const createForm = document.getElementById('createForm');
const createdKey = document.getElementById('createdKey');
const createdKeyValue = document.getElementById('createdKeyValue');
const copyKeyButton = document.getElementById('copyKeyButton');
const refreshButton = document.getElementById('refreshButton');
const logoutButton = document.getElementById('logoutButton');
const tableWrap = document.getElementById('tableWrap');

function showAdmin() {
  loginView.classList.add('hidden');
  adminView.classList.remove('hidden');
  loadLicenses();
}

function showLogin() {
  adminView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

async function api(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    logout();
    throw new Error('Sesión expirada');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Error de servidor');
  }

  return data;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  try {
    const password = document.getElementById('adminPassword').value;

    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });

    token = data.token;
    sessionStorage.setItem('xitforgeAdminToken', token);
    loginForm.reset();
    showAdmin();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const durationDays =
      Number(document.getElementById('durationDays').value);

    const deviceLimit =
      Number(document.getElementById('deviceLimit').value);

    const data = await api('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify({ durationDays, deviceLimit })
    });

    createdKeyValue.textContent = data.key;
    createdKey.classList.remove('hidden');

    await loadLicenses();
  } catch (error) {
    alert(error.message);
  }
});

copyKeyButton.addEventListener('click', async () => {
  await navigator.clipboard.writeText(createdKeyValue.textContent);
  copyKeyButton.textContent = 'Copiada';
  setTimeout(() => copyKeyButton.textContent = 'Copiar', 1200);
});

refreshButton.addEventListener('click', loadLicenses);

logoutButton.addEventListener('click', logout);

function logout() {
  token = '';
  sessionStorage.removeItem('xitforgeAdminToken');
  showLogin();
}

function formatDate(value) {
  if (!value) return 'Permanente';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('es-DO');
}

function statusBadge(status) {
  const cls = status === 'active' ? 'active' : 'revoked';
  const label = status === 'active' ? 'ACTIVA' : 'REVOCADA';
  return `<span class="badge ${cls}">${label}</span>`;
}

async function loadLicenses() {
  try {
    const data = await api('/api/admin/licenses');

    if (!data.licenses.length) {
      tableWrap.innerHTML = '<p class="muted">No hay keys todavía.</p>';
      return;
    }

    const rows = data.licenses.map((license) => {
      const actionButtons = license.status === 'active'
        ? `<button class="small danger" data-action="revoke" data-id="${license.id}">Revocar</button>`
        : `<button class="small" data-action="reactivate" data-id="${license.id}">Reactivar</button>`;

      return `
        <tr>
          <td>
            <strong>${license.key_prefix}•••${license.key_last4}</strong>
          </td>
          <td>${statusBadge(license.status)}</td>
          <td>${formatDate(license.expires_at)}</td>
          <td>${license.devices}/${license.device_limit}</td>
          <td>${formatDate(license.created_at)}</td>
          <td>
            ${actionButtons}
            <button class="small" data-action="extend" data-id="${license.id}">+ días</button>
          </td>
        </tr>
      `;
    }).join('');

    tableWrap.innerHTML = `
      <div class="tableScroll">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Estado</th>
              <th>Expira</th>
              <th>Dispositivos</th>
              <th>Creada</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    tableWrap.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', handleAction);
    });
  } catch (error) {
    tableWrap.innerHTML = `<p class="error">${error.message}</p>`;
  }
}

async function handleAction(event) {
  const button = event.currentTarget;
  const id = button.dataset.id;
  const action = button.dataset.action;

  try {
    if (action === 'revoke') {
      await api(`/api/admin/licenses/${id}/revoke`, {
        method: 'POST'
      });
    }

    if (action === 'reactivate') {
      await api(`/api/admin/licenses/${id}/reactivate`, {
        method: 'POST'
      });
    }

    if (action === 'extend') {
      const days = Number(
        prompt('¿Cuántos días quieres agregar?')
      );

      if (!Number.isInteger(days) || days < 1) {
        return;
      }

      await api(`/api/admin/licenses/${id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ days })
      });
    }

    await loadLicenses();
  } catch (error) {
    alert(error.message);
  }
}

if (token) {
  showAdmin();
} else {
  showLogin();
}
