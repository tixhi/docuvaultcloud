/**
 * Lightweight toast notification system. Call DVToast.show(...) from
 * anywhere after the DOM is ready.
 */
(function () {
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
  };

  function ensureStack() {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show({ type = 'info', title, message, duration = 4200 }) {
    const stack = ensureStack();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div>
        <strong>${title}</strong>
        ${message ? `<p>${message}</p>` : ''}
      </div>
    `;
    stack.appendChild(toast);

    const remove = () => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 180);
    };
    setTimeout(remove, duration);
    toast.addEventListener('click', remove);
  }

  window.DVToast = {
    show,
    success: (title, message) => show({ type: 'success', title, message }),
    error: (title, message) => show({ type: 'error', title, message }),
    info: (title, message) => show({ type: 'info', title, message }),
  };
})();
