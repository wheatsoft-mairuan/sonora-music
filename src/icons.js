const modules = import.meta.glob('./icons/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const ICONS = Object.fromEntries(
  Object.entries(modules).map(([path, source]) => {
    const name = path.split('/').pop().replace('.svg', '');
    const viewBox = source.match(/viewBox="([^"]+)"/)?.[1] || '0 -960 960 960';
    const inner = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
    return [name, { viewBox, inner }];
  }),
);

/**
 * Mount a single hidden SVG sprite containing every local icon.
 * Icons are sourced from @material-symbols/svg-400 (rounded, 400 weight).
 */
export function mountIconSprite() {
  const symbols = Object.entries(ICONS)
    .map(([name, { viewBox, inner }]) => `<symbol id="i-${name}" viewBox="${viewBox}">${inner}</symbol>`)
    .join('');

  const sprite = document.createElement('div');
  sprite.id = 'icon-sprite';
  sprite.setAttribute('aria-hidden', 'true');
  sprite.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
  document.body.prepend(sprite);
}

export function icon(name, className = '', attrs = '') {
  return `<svg class="icon ${className}" ${attrs} aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

export function hasIcon(name) {
  return Boolean(ICONS[name]);
}
