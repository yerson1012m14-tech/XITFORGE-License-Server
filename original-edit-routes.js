const express = require('express');

const MAX_BYTES = 32 * 1024 * 1024;
function detail(row) {
  return { id: row.id, game: row.game, route: row.route,
    fileName: row.target_file_name, sourceFileName: row.source_file_name,
    mimeType: row.mime_type, fileSize: Number(row.file_size),
    sortOrder: Number(row.sort_order), updatedAt: row.updated_at };
}
function invalid(message) { const error = new Error(message); error.status = 400; throw error; }
function idOf(req) {
  const value = String(req.params.id);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) invalid('Original no válido.');
  return value;
}
function metadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Datos no válidos.');
  const output = {};
  if (input.game !== undefined) {
    if (!['freefire_normal', 'freefire_max'].includes(input.game)) invalid('Selecciona un juego válido.');
    output.game = input.game;
  }
  if (input.route !== undefined) {
    if (typeof input.route !== 'string') invalid('Ruta no válida.');
    const route = input.route.trim().replace(/\/+$/, '');
    if (!route || route.length > 2048 || /[\\\x00-\x1f\x7f]/.test(route) || route.startsWith('/') || /^[a-z]:/i.test(route) || route.split('/').some(p => !p || p === '.' || p === '..')) invalid('Usa una ruta relativa, por ejemplo Documents/carpeta.');
    output.route = route;
  }
  if (input.fileName !== undefined) {
    if (typeof input.fileName !== 'string') invalid('Nombre de destino no válido.');
    const name = input.fileName.trim();
    if (!name || name.length > 255 || /[/\\\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..') invalid('El nombre de destino debe ser un nombre de archivo, sin carpetas.');
    output.fileName = name;
  }
  if (input.sortOrder !== undefined) {
    if (!Number.isSafeInteger(input.sortOrder) || Math.abs(input.sortOrder) > 100000) invalid('El orden debe ser un número entero entre -100000 y 100000.');
    output.sortOrder = input.sortOrder;
  }
  if (!Object.keys(output).length) invalid('No hay cambios para guardar.');
  return output;
}
function header(req, name) {
  try { return decodeURIComponent(req.get(name) || ''); }
  catch { invalid('El encabezado del archivo no es válido.'); }
}
function fail(res, error) {
  if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un original con ese juego, ruta y nombre de destino.' });
  return res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el original. Inténtalo nuevamente.' });
}
function registerOriginalEditRoutes({ app, pool, requireAdmin }) {
  app.get('/api/admin/original-files/:id', requireAdmin, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, game, route, target_file_name, source_file_name, mime_type, file_size, sort_order, updated_at FROM app_original_files WHERE id = $1', [idOf(req)]);
      if (!result.rows.length) return res.status(404).json({ error: 'Este original ya no existe. Actualiza el listado.' });
      res.json({ ok: true, original: detail(result.rows[0]) });
    } catch (error) { fail(res, error); }
  });
  const save = replace => async (req, res) => {
    try {
      const id = idOf(req);
      let changes, bytes = null, source = null, mime = null;
      if (replace) {
        changes = metadata({ game: header(req, 'x-game'), route: header(req, 'x-route'), fileName: header(req, 'x-target-file-name'), sortOrder: Number(header(req, 'x-sort-order')) });
        bytes = req.body;
        if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) invalid('Selecciona un archivo de entre 1 byte y 32 MB.');
        source = header(req, 'x-source-file-name');
        if (!source || source.length > 255 || /[/\\\x00-\x1f\x7f]/.test(source)) invalid('Nombre del archivo cargado no válido.');
        mime = header(req, 'x-file-mime') || 'application/octet-stream';
        if (mime.length > 120 || /[\x00-\x1f\x7f]/.test(mime)) invalid('Tipo de archivo no válido.');
      } else { changes = metadata(req.body); }
      // One statement keeps destination and new content together; metadata edits preserve bytes.
      const result = await pool.query(`UPDATE app_original_files SET
        game=COALESCE($1,game), route=COALESCE($2,route), target_file_name=COALESCE($3,target_file_name),
        sort_order=COALESCE($4,sort_order), source_file_name=COALESCE($5,source_file_name),
        mime_type=COALESCE($6,mime_type), file_data=COALESCE($7::bytea,file_data),
        file_size=COALESCE($8::bigint,file_size), updated_at=$9
        WHERE id=$10 RETURNING id,game,route,target_file_name,source_file_name,mime_type,file_size,sort_order,updated_at`,
      [changes.game ?? null, changes.route ?? null, changes.fileName ?? null, changes.sortOrder ?? null,
        source, mime, bytes, bytes ? bytes.length : null, new Date().toISOString(), id]);
      if (!result.rows.length) return res.status(404).json({ error: 'Este original ya no existe. Actualiza el listado.' });
      res.json({ ok: true, original: detail(result.rows[0]) });
    } catch (error) { fail(res, error); }
  };
  app.patch('/api/admin/original-files/:id', requireAdmin, save(false));
  app.put('/api/admin/original-files/:id', requireAdmin, express.raw({ type: 'application/octet-stream', limit: '32mb' }), save(true));
}
module.exports = { registerOriginalEditRoutes };
