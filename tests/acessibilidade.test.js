// Regressões de acessibilidade sobre index.html e src/style.css.
//
// São verificações estruturais (atributos ARIA, rótulos, contraste calculado),
// não um substituto para teste com leitor de tela. O objetivo é impedir que as
// correções feitas se percam em edições futuras — por exemplo, um gráfico novo
// entrar sem aria-label, ou o verde da marca voltar como cor de texto.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(RAIZ, 'src', 'style.css'), 'utf-8');

// ─── Contraste (WCAG 2.1) ────────────────────────────────────────────────────

function luminancia(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const canais = [0, 2, 4]
    .map(i => parseInt(h.substr(i, 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function contraste(a, b) {
  const l1 = luminancia(a);
  const l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('contraste', () => {
  const varCss = nome => (css.match(new RegExp('--' + nome + ':\\s*(#[0-9a-fA-F]{3,6})')) || [])[1];

  test('--accent-text atinge 4,5:1 sobre branco (AA para texto normal)', () => {
    const cor = varCss('accent-text');
    expect(cor).toBeDefined();
    expect(contraste(cor, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  test('a aba ativa e o hover usam --accent-text, não o verde da marca', () => {
    const regras = css.split('\n').filter(l => /\.tab-btn(\.active|:hover)/.test(l));
    expect(regras.length).toBeGreaterThanOrEqual(2);
    regras.forEach(r => {
      expect(r).toMatch(/color:\s*var\(--accent-text\)/);
    });
  });

  test('o cinza dos rótulos secundários passa em AA', () => {
    expect(contraste('#666666', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  test('--accent segue reprovando como texto — por isso a variável separada', () => {
    // Documenta o motivo de --accent-text existir; se um dia a marca mudar e
    // --accent passar em AA, este teste avisa que a separação virou redundante.
    expect(contraste(varCss('accent'), '#ffffff')).toBeLessThan(4.5);
  });
});

// ─── Foco visível ────────────────────────────────────────────────────────────

describe('foco por teclado', () => {
  test('existe um indicador de foco global', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:/);
  });

  test('há um link para pular direto ao conteúdo', () => {
    expect(html).toMatch(/class="sr-only skip-link"/);
    expect(html).toMatch(/href="#tabs-nav"/);
    expect(html).toMatch(/id="tabs-nav"/);
  });
});

// ─── Padrão ARIA de abas ─────────────────────────────────────────────────────

describe('abas', () => {
  const botoes = [...html.matchAll(/<button class="tab-btn[^"]*"[^>]*>/g)].map(m => m[0]);
  const paineis = [...html.matchAll(/<section id="tab-[\w-]+"[^>]*>/g)].map(m => m[0]);

  test('o contêiner é um tablist rotulado', () => {
    expect(html).toMatch(/<div class="tabs"[^>]*role="tablist"[^>]*aria-label=/);
  });

  test('todo botão de aba tem role, aria-selected, aria-controls e id', () => {
    expect(botoes.length).toBe(8);
    botoes.forEach(b => {
      expect(b).toMatch(/role="tab"/);
      expect(b).toMatch(/aria-selected="(true|false)"/);
      expect(b).toMatch(/aria-controls="tab-[\w-]+"/);
      expect(b).toMatch(/id="aba-[\w-]+"/);
    });
  });

  test('roving tabindex: só a aba ativa é tabulável', () => {
    const tabulaveis = botoes.filter(b => /tabindex="0"/.test(b));
    expect(tabulaveis.length).toBe(1);
    expect(tabulaveis[0]).toMatch(/aria-selected="true"/);
  });

  test('todo painel é um tabpanel ligado à sua aba', () => {
    expect(paineis.length).toBe(8);
    paineis.forEach(p => {
      expect(p).toMatch(/role="tabpanel"/);
      expect(p).toMatch(/aria-labelledby="aba-[\w-]+"/);
      expect(p).toMatch(/tabindex="0"/);
    });
  });

  test('cada aria-controls aponta para um painel existente', () => {
    botoes.forEach(b => {
      const alvo = b.match(/aria-controls="([\w-]+)"/)[1];
      expect(html).toMatch(new RegExp(`<section id="${alvo}"`));
    });
  });

  test('o JS mantém aria-selected e tabindex em sincronia na troca de aba', () => {
    const core = fs.readFileSync(path.join(RAIZ, 'src', 'core.js'), 'utf-8');
    expect(core).toMatch(/setAttribute\('aria-selected', 'true'\)/);
    expect(core).toMatch(/setAttribute\('tabindex', '0'\)/);
    expect(core).toMatch(/ArrowRight/);
    expect(core).toMatch(/ArrowLeft/);
  });
});

// ─── Gráficos ────────────────────────────────────────────────────────────────

describe('gráficos', () => {
  const canvases = [...html.matchAll(/<canvas[^>]*>/g)].map(m => m[0]);

  test('todo canvas tem nome acessível — o Chart.js desenha em pixels', () => {
    expect(canvases.length).toBeGreaterThanOrEqual(31);
    canvases.forEach(c => {
      expect(c).toMatch(/role="img"/);
      expect(c).toMatch(/aria-label="Gráfico: .+"/);
    });
  });

  test('os rótulos não são todos iguais', () => {
    const rotulos = new Set(canvases.map(c => c.match(/aria-label="([^"]+)"/)[1]));
    expect(rotulos.size).toBeGreaterThan(20);
  });
});

// ─── Modais ──────────────────────────────────────────────────────────────────

describe('modais', () => {
  test('ambos são diálogos rotulados', () => {
    const dialogos = [...html.matchAll(/<div class="(?:map-)?modal-overlay"[^>]*>/g)].map(m => m[0]);
    expect(dialogos.length).toBe(2);
    dialogos.forEach(d => {
      expect(d).toMatch(/role="dialog"/);
      expect(d).toMatch(/aria-modal="true"/);
      expect(d).toMatch(/aria-labelledby="[\w-]+"/);
    });
  });

  test('os botões de fechar têm rótulo — "×" sozinho não diz nada', () => {
    expect(html).toMatch(/id="modal-close"[^>]*aria-label=/);
    expect(html).toMatch(/id="map-modal-close"[^>]*aria-label=/);
  });

  test('o foco é preso no diálogo e devolvido ao fechar', () => {
    const core = fs.readFileSync(path.join(RAIZ, 'src', 'core.js'), 'utf-8');
    expect(core).toMatch(/function prenderFoco/);
    expect(core).toMatch(/function abrirModal/);
    expect(core).toMatch(/function fecharModal/);
    expect(core).toMatch(/focoAntesDoModal/);
  });
});

// ─── Tabelas geradas ─────────────────────────────────────────────────────────

describe('tabelas', () => {
  const tables = fs.readFileSync(path.join(RAIZ, 'src', 'tables.js'), 'utf-8');

  test('toda tabela gerada tem <caption>', () => {
    const aberturas = (tables.match(/<table class="data-table"/g) || []).length;
    const captions = (tables.match(/<caption>/g) || []).length - 1; // -1: o comentário
    expect(aberturas).toBe(3);
    expect(captions).toBe(aberturas);
  });

  test('cabeçalhos declaram scope de linha e de coluna', () => {
    expect((tables.match(/th scope="col"/g) || []).length).toBeGreaterThanOrEqual(9);
    expect((tables.match(/th scope="row"/g) || []).length).toBe(3);
  });
});

// ─── Documento ───────────────────────────────────────────────────────────────

describe('documento', () => {
  test('declara o idioma', () => {
    expect(html).toMatch(/<html[^>]*lang="pt-?[bB][rR]"/);
  });

  test('o overlay de carregamento é anunciado', () => {
    expect(html).toMatch(/id="loading"[^>]*aria-live="polite"/);
  });

  test('o grupo de filtros é rotulado', () => {
    expect(html).toMatch(/class="controls"[^>]*aria-label=/);
  });
});
