'use strict';

/*
 * Ampliación compatible con el generador actual de XITFORGE.
 * Mantiene intactos los cuatro botones: 1 día, 7 días, 30 días,
 * Personalizar. Dentro de Personalizar añade minutos, horas,
 * días, semanas y meses de 30 días.
 */
(() => {
  const form = document.getElementById('createForm');
  const presets = document.getElementById('durationPresetWrap');
  const customWrap = document.getElementById('customDurationWrap');
  const quantity = document.getElementById('customDurationDays');
  const devices = document.getElementById('deviceLimit');
  const note = document.getElementById('licenseNote');
  const summary = document.getElementById('createSummary');
  const errorField = document.getElementById('createError');
  const resultCard = document.getElementById('createdKey');
  const resultKey = document.getElementById('createdKeyValue');
  const resultMeta = document.getElementById('createdKeyMeta');
  if (![form,presets,customWrap,quantity,devices,note,summary,errorField,
        resultCard,resultKey,resultMeta].every(Boolean)) return;

  const MAX_SECONDS = 36500 * 86400;
  const UNITS = Object.freeze({
    minutes: { seconds: 60, singular: 'minuto', plural: 'minutos' },
    hours:   { seconds: 3600, singular: 'hora', plural: 'horas' },
    days:    { seconds: 86400, singular: 'día', plural: 'días' },
    weeks:   { seconds: 7 * 86400, singular: 'semana', plural: 'semanas' },
    months:  { seconds: 30 * 86400, singular: 'mes', plural: 'meses' }
  });

  const quantityLabel = customWrap.querySelector('label[for="customDurationDays"]');
  if (quantityLabel) quantityLabel.textContent = 'Cantidad';
  quantity.placeholder = 'Ej. 1';
  quantity.inputMode = 'numeric';
  quantity.min = '1';
  quantity.step = '1';

  const unitLabel = document.createElement('label');
  unitLabel.htmlFor = 'xfDurationUnit';
  unitLabel.textContent = 'Unidad de tiempo';
  const unitSelect = document.createElement('select');
  unitSelect.id = 'xfDurationUnit';
  unitSelect.name = 'xfDurationUnit';
  unitSelect.style.width = '100%';
  unitSelect.style.marginBottom = '10px';
  for (const [value, text] of [
    ['days', 'Días'], ['minutes', 'Minutos'], ['hours', 'Horas'],
    ['weeks', 'Semanas'], ['months', 'Meses (30 días cada uno)']
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    unitSelect.appendChild(option);
  }
  customWrap.appendChild(unitLabel);
  customWrap.appendChild(unitSelect);

  function selectedPreset() {
    return presets.querySelector('.durationPreset.active')?.dataset.days || '7';
  }

  function selectedDuration() {
    const preset = selectedPreset();
    if (preset !== 'custom') {
      const days = Number(preset);
      if (![1, 7, 30].includes(days)) return null;
      return { seconds: days * 86400, label: `${days} ${days === 1 ? 'día' : 'días'}` };
    }
    const count = Number(quantity.value);
    const unit = UNITS[unitSelect.value];
    if (!unit || !Number.isSafeInteger(count) || count < 1 ||
        count > Math.floor(MAX_SECONDS / unit.seconds)) return null;
    return {
      seconds: count * unit.seconds,
      label: `${count} ${count === 1 ? unit.singular : unit.plural}`
    };
  }

  function syncQuantityLimits() {
    const unit = UNITS[unitSelect.value];
    quantity.max = String(Math.floor(MAX_SECONDS / unit.seconds));
    quantity.placeholder = unitSelect.value === 'months' ? 'Ej. 1 (30 días)' : 'Ej. 1';
  }

  function updateSummary() {
    const duration = selectedDuration();
    const deviceCount = Number(devices.value) || 1;
    const durationLabel = duration ? duration.label : 'Selecciona una duración válida';
    summary.textContent = `${durationLabel} · ${deviceCount} ${deviceCount === 1 ? 'dispositivo' : 'dispositivos'}`;
  }

  // The original panel already owns the preset buttons; run afterwards to
  // update only the personalized duration summary, without replacing them.
  for (const button of presets.querySelectorAll('.durationPreset')) {
    button.addEventListener('click', () => {
      if (button.dataset.days === 'custom' && quantity.value.trim() === '') {
        quantity.value = '1';
      }
      updateSummary();
    });
  }
  quantity.addEventListener('input', updateSummary);
  devices.addEventListener('input', updateSummary);
  unitSelect.addEventListener('change', () => {
    syncQuantityLimits();
    updateSummary();
  });
  syncQuantityLimits();
  updateSummary();

  // A duration shorter than one day has duration_days = NULL on the server.
  // Show its actual length in the existing license list without altering
  // legacy licenses or their expiration timestamp.
  if (typeof licenseExpirationText === 'function') {
    const originalExpirationText = licenseExpirationText;
    licenseExpirationText = function (license) {
      if (license && license.status === 'new' && !license.expires_at) {
        const seconds = Number(license.duration_seconds);
        if (Number.isSafeInteger(seconds) && seconds >= 60) {
          const hours = seconds / 3600;
          const count = Number.isInteger(hours) ? hours : seconds / 60;
          const unit = Number.isInteger(hours)
            ? (count === 1 ? 'HORA' : 'HORAS')
            : (count === 1 ? 'MINUTO' : 'MINUTOS');
          return `EMPIEZA AL PRIMER USO · ${count} ${unit}`;
        }
      }
      return originalExpirationText(license);
    };
  }

  // Capture before the existing legacy submit listener so short licenses
  // don't get rejected by its old durationDays-only validation.
  form.addEventListener('submit', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    void createLicense();
  }, { capture: true });

  async function createLicense() {
    errorField.textContent = '';
    const duration = selectedDuration();
    const deviceCount = Number(devices.value);
    if (!duration || !Number.isSafeInteger(duration.seconds) ||
        duration.seconds < 60 || duration.seconds > MAX_SECONDS) {
      errorField.textContent = 'Indica una duración válida desde 1 minuto.';
      return;
    }
    if (!Number.isSafeInteger(deviceCount) || deviceCount < 1 || deviceCount > 100) {
      errorField.textContent = 'El número de dispositivos debe estar entre 1 y 100.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (!submit || submit.disabled) return;
    const oldLabel = submit.textContent;
    submit.disabled = true;
    submit.textContent = 'GENERANDO...';
    const customerNote = note.value.trim();
    // Whole days use the original durationDays API. Non-whole days use the
    // new durationSeconds field; the backend validates the same bounds.
    const durationField = duration.seconds % 86400 === 0
      ? { durationDays: duration.seconds / 86400 }
      : { durationSeconds: duration.seconds };
    try {
      const data = await api('/api/admin/licenses', {
        method: 'POST',
        body: JSON.stringify({ ...durationField, deviceLimit: deviceCount, note: customerNote })
      });
      if (!data || typeof data.key !== 'string' || data.key.length === 0) {
        throw new Error('El servidor no devolvió una key válida.');
      }
      resultKey.textContent = data.key;
      resultMeta.textContent = `${duration.label} · ${deviceCount} ${deviceCount === 1 ? 'dispositivo' : 'dispositivos'}` +
        (customerNote ? ` · ${customerNote}` : '');
      resultCard.classList.remove('hidden');
      showToast('Key generada correctamente');
      await loadLicenses();
    } catch (err) {
      errorField.textContent = err && err.message ? err.message : 'No se pudo generar la key.';
    } finally {
      submit.disabled = false;
      submit.textContent = oldLabel;
    }
  }
})();
