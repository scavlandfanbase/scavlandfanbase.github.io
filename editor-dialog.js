// Shared accessible editor dialog. Native dialog supplies focus containment/inertness.
let scavDialogSequence = 0;
window.scavEditorDialog = function ({ title, submit = 'Save changes', build, onSubmit, changedOnly = false, readOnly = false }) {
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'scav-editor-dialog';
  const form = document.createElement('form');
  const heading = document.createElement('h2');
  heading.id = 'scav-dialog-title-' + (++scavDialogSequence);
  heading.textContent = title;
  dialog.setAttribute('aria-labelledby', heading.id);
  const body = document.createElement('div');
  body.className = 'scav-dialog-body';
  const error = document.createElement('p');
  error.className = 'scav-dialog-error';
  error.setAttribute('role', 'alert');
  const actions = document.createElement('div');
  actions.className = 'scav-dialog-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = 'Cancel';
  const save = document.createElement('button');
  save.type = 'submit'; save.textContent = submit;
  if(!readOnly)actions.append(cancel); actions.append(save); form.append(heading, body, error, actions); dialog.append(form);
  let dirty = false, busy = false, discarding = false;
  const close = () => { dialog.close(); dialog.remove(); if (opener?.isConnected) opener.focus(); };
  const requestClose = () => {
    if (busy) return;
    if (dirty && !discarding) {
      discarding = true; error.textContent = 'Discard unsaved changes? Choose Discard changes to close.';
      cancel.textContent = 'Discard changes'; return;
    }
    close();
  };
  cancel.onclick = requestClose;
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[inert]'));
    const first = controls[0], last = controls.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  let initialValues;
  form.addEventListener('input', event => { if(event.target.dataset.editorTransient)return; dirty = true; discarding = false; cancel.textContent = 'Cancel'; if (changedOnly) save.disabled = JSON.stringify([...new FormData(form)]) === initialValues; });
  const api = { body, form, save, close, error, setDirty: () => { dirty = true; discarding = false; cancel.textContent = 'Cancel'; save.disabled = false; } };
  build(api);
  initialValues = JSON.stringify([...new FormData(form)]);
  if (changedOnly) save.disabled = true;
  form.onsubmit = async event => {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    busy = true; save.disabled = cancel.disabled = true; body.inert = true; form.setAttribute('aria-busy','true'); error.textContent = '';
    try { await onSubmit(api); close(); }
    catch (reason) { error.textContent = reason.message; save.textContent = 'Retry'; }
    finally { busy = false; body.inert = false; form.removeAttribute('aria-busy'); save.disabled = cancel.disabled = false; }
  };
  document.body.append(dialog); dialog.showModal();
  (form.querySelector('[autofocus]')||[...form.querySelectorAll('input:not(:disabled),select:not(:disabled),textarea:not(:disabled)')].find(el=>el.getClientRects().length)||(readOnly?save:cancel)).focus();
  return api;
};
