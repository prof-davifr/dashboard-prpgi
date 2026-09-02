// pos-validacao-porta.js — porta de entrada da página Pós-Graduação Validação.
//
// ATENÇÃO — isto não é controle de acesso. O GitHub Pages é hospedagem estática
// e não autentica ninguém: a verificação roda no navegador, dentro de um arquivo
// que o visitante já baixou, e o data.json que alimenta a página é público. A
// porta afasta o acesso casual e deixa claro que a página não é oficial. Ela não
// impede quem sabe abrir o código-fonte.
//
// Por isso o data.json não carrega dado pessoal: scripts/build.js remove nome,
// matrícula e e-mail antes de gravar (ver CLAUDE.md, seção LGPD).

// SHA-256 da senha, em hexadecimal minúsculo. Gere o seu com:
//     printf '%s' 'sua-senha' | sha256sum
const SENHA_HASH = '88cac47c761fa0607fa17306c2bbea4177b6ae1d2dc49fe691cead8a08ba23a4';

const MARCA_SESSAO = 'pos-validacao-liberado';

async function hashDaSenha(senha) {
  const bytes = new TextEncoder().encode(senha);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function abrirPagina() {
  document.body.classList.remove('trancado');
  iniciarPosValidacao();
}

document.addEventListener('DOMContentLoaded', () => {
  // A liberação vale só enquanto a aba do navegador estiver aberta.
  if (sessionStorage.getItem(MARCA_SESSAO) === '1') {
    abrirPagina();
    return;
  }

  const form = document.getElementById('porta-form');
  const campo = document.getElementById('porta-senha');
  const erro = document.getElementById('porta-erro');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    erro.textContent = '';

    // crypto.subtle exige contexto seguro: HTTPS ou localhost.
    if (!window.crypto || !crypto.subtle) {
      erro.textContent = 'Abra a página por HTTPS ou por localhost.';
      return;
    }

    if (await hashDaSenha(campo.value) !== SENHA_HASH) {
      erro.textContent = 'Senha incorreta.';
      campo.value = '';
      campo.focus();
      return;
    }

    sessionStorage.setItem(MARCA_SESSAO, '1');
    abrirPagina();
  });

  campo.focus();
});
