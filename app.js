function applyWikiLanguage(lang) {
  const translations = window.WIKI_LANG?.[lang] || window.WIKI_LANG?.pt || {};

  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (translations[key]) {
      element.innerHTML = translations[key];
    }
  });
  document.querySelectorAll('[data-lang]').forEach((button) => {
    const isActive = button.dataset.lang === lang;
    button.classList.toggle('active', isActive);
  });

  const commands = window.WIKI_COMMANDS?.[lang] || window.WIKI_COMMANDS?.pt || {};
  const commandAliases = Object.entries(window.WIKI_COMMANDS?.pt || {}).reduce((aliases, [canonical, portuguese]) => {
    aliases[canonical] = canonical;
    aliases[portuguese] = canonical;
    const english = window.WIKI_COMMANDS?.en?.[canonical];
    if (english) aliases[english] = canonical;
    return aliases;
  }, {});
  document.querySelectorAll('code').forEach((element) => {
    const sourceText = element.textContent;
    if (!sourceText.includes('/') && !element.closest('pre')) return;
    const tokenMap = window.WIKI_COMMAND_TOKENS?.[lang] || window.WIKI_COMMAND_TOKENS?.pt || {};
    const tokenAliases = Object.entries(window.WIKI_COMMAND_TOKENS?.pt || {}).reduce((aliases, [portuguese, canonical]) => {
      const portugueseKey = portuguese.toLowerCase();
      if (!aliases[portugueseKey] || portugueseKey.length > aliases[portugueseKey].length) {
        aliases[portugueseKey] = portuguese;
      }
      const english = window.WIKI_COMMAND_TOKENS?.en?.[portuguese] || window.WIKI_COMMAND_TOKENS?.en?.[canonical];
      if (english) {
        const englishKey = english.toLowerCase();
        if (!aliases[englishKey] || portugueseKey.length > aliases[englishKey].length) {
          aliases[englishKey] = portuguese;
        }
      }
      return aliases;
    }, {});
    element.textContent = element.textContent.replace(/\/([a-z][a-z0-9_]*)/gi, (full, command) => {
      const canonical = commandAliases[command.toLowerCase()];
      const translated = canonical ? commands[canonical] : null;
      return translated ? `/${translated}` : full;
    }).replace(/\b[a-z][a-z0-9_-]*\b/gi, (token, offset, source) => {
      if (source[offset - 1] === '/') return token;
      const portuguese = tokenAliases[token.toLowerCase()];
      return portuguese ? (tokenMap[portuguese] || token) : token;
    });
  });

  const effectiveLang = lang === 'en' ? 'en-US' : 'pt-BR';
  document.documentElement.lang = effectiveLang;
  localStorage.setItem('wikiLang', lang);
}

document.addEventListener('DOMContentLoaded', () => {
  const page = document.getElementById('page-wiki');
  if (!page) return;

  page.classList.add('wiki-manual-open', 'active');

  const syncFromHash = () => {
    const rawHash = location.hash.replace('#', '').split('?')[0];
    const targetId = rawHash || 'wiki-instalacao';
    const target = document.getElementById(targetId);

    document.querySelectorAll('.wiki-details').forEach((detail) => {
      detail.open = detail === target;
    });

    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
  };

  const details = [...document.querySelectorAll('.wiki-details')];
  details.forEach((detail) => {
    detail.addEventListener('toggle', () => {
      if (!detail.open) return;
      details.forEach((other) => {
        if (other !== detail) other.open = false;
      });
      const id = detail.id || '';
      if (id) {
        history.replaceState(null, '', `#${id}`);
      }
    });
  });

  document.querySelectorAll('.nav a').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav a').forEach((item) => item.classList.toggle('active', item === link));
    });
  });

  document.querySelectorAll('[data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLang = button.dataset.lang || 'pt';
      applyWikiLanguage(nextLang);
    });
  });

  if (!location.hash) {
    history.replaceState(null, '', '#wiki-instalacao');
  }

  const savedLang = localStorage.getItem('wikiLang') || 'pt';
  applyWikiLanguage(savedLang);
  syncFromHash();
  window.addEventListener('hashchange', syncFromHash, { passive: true });
});
