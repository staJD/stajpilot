(() => {
  const dialog = document.querySelector('.image-dialog');
  const content = dialog.querySelector('.dialog-content');
  let trigger = null;
  document.querySelectorAll('[data-enlarge]').forEach((button) => {
    button.addEventListener('click', () => {
      trigger = button;
      const source = button.closest('figure');
      const figure = document.createElement('figure');
      figure.append(source.querySelector('.evidence-image').cloneNode(true));
      figure.append(source.querySelector('figcaption').cloneNode(true));
      figure.querySelector('img').loading = 'eager';
      content.replaceChildren(figure);
      dialog.showModal();
    });
  });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    content.replaceChildren();
    trigger?.focus();
  });
})();
