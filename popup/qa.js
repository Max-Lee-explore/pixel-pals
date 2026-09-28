(function (global) {
  const PLACEHOLDER_RE = /\$[A-Za-z0-9_@]+\$/g;
  const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/;

  const tokens = (msg) => (String(msg ?? '').match(PLACEHOLDER_RE) || []).map((p) => p.toUpperCase()).sort();
  const maxLength = (description) => {
    const m = /max\.?\s*(\d+)\s*char/i.exec(description || '');
    return m ? Number(m[1]) : null;
  };
  const visibleLength = (msg) => [...String(msg ?? '').replace(PLACEHOLDER_RE, '')].length;

  /**
   * Compares a translated messages.json against the English source.
   * Returns [{ key, text }] where text is a localised explanation.
   */
  function check(source, target, code, t) {
    const issues = [];
    const add = (key, text) => issues.push({ key, text });

    for (const [key, src] of Object.entries(source)) {
      const tgt = target[key];

      if (key === 'appLocale') {
        const value = String(tgt?.message ?? '').trim();
        if (value.replace('-', '_').toLowerCase() !== code.toLowerCase()) add(key, t('qaLocaleCode', [code]));
        continue;
      }
      if (!tgt || typeof tgt.message !== 'string') {
        add(key, t('qaMissing'));
        continue;
      }
      if (!tgt.message.trim()) {
        add(key, t('qaEmpty'));
        continue;
      }

      const expected = tokens(src.message);
      const actual = tokens(tgt.message);
      const defined = Object.keys(tgt.placeholders || {}).map((n) => `$${n.toUpperCase()}$`);
      const undefinedUsed = actual.some((p) => !defined.includes(p));
      if (expected.join() !== actual.join() || undefinedUsed) {
        add(key, t('qaPlaceholder', [expected.join(', ') || '—']));
      }

      const max = maxLength(src.description);
      const length = visibleLength(tgt.message);
      if (max && length > max) add(key, t('qaTooLong', [String(length), String(max)]));

      if (tgt.message === src.message && /\p{L}{3,}/u.test(src.message) && !key.startsWith('defaultName')) {
        add(key, t('qaSameAsSource'));
      }
    }

    for (const key of Object.keys(target)) {
      if (source[key]) continue;
      const base = key.replace(PLURAL_SUFFIX_RE, '');
      const isExtraPluralForm = base !== key && source[`${base}_other`];
      if (!isExtraPluralForm) add(key, t('qaExtraKey'));
    }

    return issues;
  }

  global.LocaleQA = { check };
})(globalThis);
