/* Shared, in-page image previews. Image availability never changes verification. */
(function () {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function imagePath(record) {
    const candidates = [record?.image];
    if (record?.source?.status === 'screenshot-verified') candidates.push(record.source.file);
    return candidates.find(path => typeof path === 'string' &&
      /^(?:images|evidence-inbox)\/[^?#]+\.(?:png|jpe?g|webp)$/i.test(path) &&
      !path.split('/').includes('..')) || '';
  }

  function preview(record) {
    const path = imagePath(record);
    if (!path) return '';
    const name = escape(record.name);
    return '<button type="button" class="scav-image-preview" data-image-preview aria-haspopup="dialog" aria-label="Enlarge ' + name + ' image">' +
      '<img src="' + escape(path) + '" alt="' + name + '" loading="lazy">' +
      '<span>Tap or click to enlarge</span></button>';
  }

  window.ScavImages = { imagePath, preview };
  let dialog, opener, savedScroll, savedBody;

  function createViewer() {
    dialog = document.createElement('dialog');
    dialog.className = 'scav-image-viewer';
    dialog.setAttribute('aria-label', 'Enlarged image');
    dialog.innerHTML = '<button type="button" class="scav-image-close" aria-label="Close enlarged image" autofocus>×</button>' +
      '<button type="button" class="scav-image-full" aria-label="Close enlarged image"><img alt=""></button>' +
      '<p class="scav-image-caption">Tap or click the image to return</p>';
    document.body.appendChild(dialog);
    dialog.addEventListener('click', event => {
      if (event.target === dialog || event.target.closest('button')) dialog.close();
    });
    dialog.addEventListener('close', () => {
      Object.assign(document.body.style, savedBody);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
      window.scrollTo({ top: savedScroll.y, left: savedScroll.x, behavior: 'instant' });
      dialog.querySelector('img').removeAttribute('src');
    });
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-image-preview]');
    if (!trigger) return;
    const image = trigger.querySelector('img');
    if (!image) return;
    event.preventDefault();
    if (!dialog) createViewer();
    if (dialog.open) return;
    opener = trigger;
    savedScroll = { x: window.scrollX, y: window.scrollY };
    savedBody = Object.fromEntries(['position', 'top', 'left', 'width', 'overflow'].map(key => [key, document.body.style[key]]));
    const enlarged = dialog.querySelector('img');
    enlarged.src = image.currentSrc || image.src;
    enlarged.alt = image.alt;
    dialog.setAttribute('aria-label', image.alt + ' — enlarged image');
    dialog.showModal();
    Object.assign(document.body.style, { position: 'fixed', top: -savedScroll.y + 'px', left: '0', width: '100%', overflow: 'hidden' });
  });

  // A missing asset must not leave a broken-image control in a card.
  document.addEventListener('error', event => {
    if (event.target.matches?.('[data-image-preview] img')) event.target.closest('[data-image-preview]').hidden = true;
  }, true);
})();
