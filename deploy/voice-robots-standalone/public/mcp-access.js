(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const base = '/modules/voice-robots/api.php/public/voice-robots-mcp/credentials';
  const endpoint = new URL('mcp.php', location.href).href;
  byId('endpoint').textContent = endpoint;
  let pending = null;
  function status(message, kind) { byId('status').textContent = message; byId('status').dataset.kind = kind || 'error'; }
  function hideSecret() { byId('token').value = ''; byId('secret').hidden = true; }
  async function request(path, method = 'GET', data) {
    const response = await fetch(base + path, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const value = await response.json();
    if (!response.ok) throw new Error(response.status === 401 ? 'Войдите в действующий интерфейс АТС и обновите страницу.' : String(value.message || 'Не удалось выполнить запрос.'));
    return value;
  }
  function scopeHint() {
    byId('scope-hint').textContent = byId('scope').value === 'configure' ? 'Модель сможет создавать и изменять роботов и проверять сценарии.' : 'Модель сможет читать настройки и проверять фразы. Изменение роботов недоступно.';
  }
  async function refresh() {
    byId('refresh').disabled = true;
    try {
      const result = await request('');
      const keys = result.credentials;
      byId('key-count').textContent = 'Всего: ' + keys.length;
      byId('empty').hidden = keys.length !== 0;
      const table = document.createElement('table');
      table.setAttribute('aria-label', 'Ключи кабинета');
      const head = table.createTHead().insertRow();
      for (const label of ['Название', 'Права', 'Действует до', '']) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th); }
      const body = table.createTBody();
      for (const key of keys) {
        const row = body.insertRow();
        const name = row.insertCell(); name.className = 'key-name'; name.textContent = key.name;
        const badge = document.createElement('span'); badge.className = 'badge'; badge.dataset.scope = key.scope === 'read' ? 'read' : 'configure';
        badge.textContent = key.scope === 'read' ? 'Только чтение' : 'Чтение и настройка'; row.insertCell().append(badge);
        const date = row.insertCell(); date.className = 'date';
        date.textContent = new Date(key.expiresAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const button = document.createElement('button'); button.className = 'button small danger'; button.textContent = 'Отозвать';
        button.onclick = () => { pending = key.id; byId('revoke-name').textContent = key.name; byId('revoke-dialog').showModal(); };
        row.insertCell().append(button);
      }
      byId('keys').replaceChildren(table); byId('keys').hidden = keys.length === 0;
    } catch (error) { status(error.message); }
    finally { byId('refresh').disabled = false; }
  }
  byId('issue').onsubmit = async event => {
    event.preventDefault(); const button = event.target.querySelector('button[type=submit]'); button.disabled = true;
    try {
      const key = await request('', 'POST', { name: byId('name').value.trim(), scope: byId('scope').value, days: Number(byId('days').value) });
      byId('token').value = key.token; byId('secret').hidden = false;
      status('Ключ создан. Сохраните его перед закрытием страницы.', 'success'); await refresh();
    } catch (error) { status(error.message); }
    finally { button.disabled = false; }
  };
  async function copy(value, message, fallback) {
    try { await navigator.clipboard.writeText(value); status(message, 'success'); }
    catch { status('Скопируйте значение вручную.'); if (fallback) { fallback.focus(); fallback.select(); } }
  }
  byId('copy').onclick = () => copy(byId('token').value, 'Ключ скопирован.', byId('token'));
  byId('copy-endpoint').onclick = () => copy(endpoint, 'Адрес MCP скопирован.');
  byId('hide-secret').onclick = hideSecret;
  byId('cancel-revoke').onclick = () => byId('revoke-dialog').close();
  byId('confirm-revoke').onclick = async () => {
    if (!pending) return;
    byId('confirm-revoke').disabled = true;
    try { await request('/' + encodeURIComponent(pending), 'DELETE'); hideSecret(); byId('revoke-dialog').close(); status('Ключ отозван.', 'success'); await refresh(); }
    catch (error) { status(error.message); byId('revoke-dialog').close(); }
    finally { byId('confirm-revoke').disabled = false; pending = null; }
  };
  byId('scope').onchange = scopeHint;
  byId('refresh').onclick = refresh;
  scopeHint(); refresh();
}());
