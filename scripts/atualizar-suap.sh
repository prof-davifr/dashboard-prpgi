#!/usr/bin/env bash
#
# Atualiza as abas que dependem do SUAP: Pós-Graduação (scraper-SUAPPos) e
# Produção Científica, Produção Técnica e Orientações (scraper-SUAPCNPQ, o
# Lattes declarado no SUAP).
#
# O SUAP exige login institucional, e o runner público do GitHub não o alcança.
# Por isso a coleta roda na máquina do assessor, como as do INPI e da lista do
# DGP. Os dois coletores e este repositório estão lado a lado no disco.
#
# O script é conservador de propósito:
#   - se o SUAP não responde, ele sai sem erro e tenta na próxima execução;
#   - cada fonte tem a sua cadência (30 dias), medida pelo arquivo mais novo
#     dela em dados/. Uma coleta que falha não avança a data e é repetida;
#   - a pós só entra em dados/ se o CSV novo tiver pelo menos 90% dos alunos
#     publicados. Uma exportação pela metade não esvazia a aba;
#   - o Lattes é incremental (ano anterior e ano corrente). O coletor mescla com
#     a base acumulada e deduplica, então um campus que falha só fica sem
#     atualização;
#   - npm run build, npm test e npm run validate rodam antes do commit;
#   - se o data.json não mudar, ele não cria commit;
#   - ele não publica por cima de commits locais que não estão no remoto.
#
# Os CSVs da pós trazem nome, matrícula e e-mail. Eles ficam onde a coleta
# manual sempre os deixou: output/ do coletor e dados/ deste repositório, os
# dois fora do git. O data.json recebe só o que o build.js deixa passar.
#
# Uso:
#   ./scripts/atualizar-suap.sh                 # cadência normal
#   MAX_IDADE_DIAS=0 ./scripts/atualizar-suap.sh  # força as duas coletas agora
#   FONTES=pos ./scripts/atualizar-suap.sh      # só a pós (ou FONTES=lattes)
#   PUBLICAR=0 ./scripts/atualizar-suap.sh      # coleta e build, sem commit
#
# Agendamento: veja systemd/ neste repositório.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPOS="$(dirname "$ROOT")"
POS_DIR="${POS_DIR:-$REPOS/scraper-SUAPPos}"
LATTES_DIR="${LATTES_DIR:-$REPOS/scraper-SUAPCNPQ}"
MAX_IDADE_DIAS="${MAX_IDADE_DIAS:-30}"
FONTES="${FONTES:-pos lattes}"
PUBLICAR="${PUBLICAR:-1}"
PISO_POS_PCT="${PISO_POS_PCT:-90}"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*"; }

# Uma coleta do Lattes leva horas. O timer não deve abrir a segunda por cima.
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/dashboard-prpgi-suap.lock"
if ! flock -n 9; then
  log "Outra coleta do SUAP está em curso. Nada a fazer."
  exit 0
fi

# Idade, em dias, do arquivo mais novo que casa com o padrão. Sem arquivo, 9999.
idade_dias() {
  local mais_novo
  mais_novo="$(find "$1" -maxdepth 1 -name "$2" -printf '%T@\n' 2>/dev/null | sort -n | tail -1)"
  [[ -n "$mais_novo" ]] || { echo 9999; return; }
  echo $(( ( $(date +%s) - ${mais_novo%.*} ) / 86400 ))
}

# O serviço do systemd não herda o PATH do terminal, e o python3 do sistema não
# tem selenium. PYTHON_POS=/caminho/python3 força um interpretador.
python_da_pos() {
  local cand
  if [[ -n "${PYTHON_POS:-}" ]]; then echo "$PYTHON_POS"; return; fi
  for cand in "$HOME"/.pyenv/versions/*/bin/python3 "$(command -v python3 || true)"; do
    [[ -x "$cand" ]] || continue
    if "$cand" -c 'import selenium, xlrd, pandas, dotenv' >/dev/null 2>&1; then echo "$cand"; return; fi
  done
  return 1
}

contar_csv() {
  node -e 'console.log(require(process.argv[1]).parseCSV(process.argv[2]).length)' \
    "$ROOT/scripts/build.js" "$1"
}

coletar_pos() {
  local py antes novo n publicados
  py="$(python_da_pos)" || { log "ERRO: nenhum python3 com selenium, xlrd, pandas e dotenv."; return 1; }
  antes="$(ls -t "$POS_DIR"/output/alunos_pos_*.csv 2>/dev/null | head -1 || true)"

  log "Pós-graduação: exportando as três modalidades do SUAP…"
  ( cd "$POS_DIR" && "$py" main.py --headless --format csv --output-dir "$POS_DIR/output" ) || return 1

  novo="$(ls -t "$POS_DIR"/output/alunos_pos_*.csv 2>/dev/null | head -1 || true)"
  if [[ -z "$novo" || "$novo" == "$antes" ]]; then
    log "ERRO: o coletor da pós terminou sem gravar CSV novo."
    return 1
  fi

  n="$(contar_csv "$novo")"
  publicados="$(node -e 'console.log(require(process.argv[1]).posgraduacao.length)' "$ROOT/data.json")"
  if (( n * 100 < publicados * PISO_POS_PCT )); then
    log "ERRO: o CSV novo tem $n alunos, abaixo de ${PISO_POS_PCT}% dos $publicados publicados. Não entra em dados/."
    return 1
  fi

  cp -p "$novo" "$ROOT/dados/scraper-SUAPPos/"
  log "Pós-graduação: $n alunos ($publicados publicados). $(basename "$novo") copiado para dados/."
}

coletar_lattes() {
  local ano
  ano="$(date +%Y)"
  if [[ ! -x "$LATTES_DIR/.venv/bin/python" ]]; then
    log "ERRO: $LATTES_DIR/.venv não existe. Rode scripts/start.sh naquele repositório."
    return 1
  fi
  # Cada versão do Playwright pede a sua build do navegador. Depois de um
  # upgrade do .venv a coleta falhava no login, com "Executable doesn't exist".
  # O comando não baixa nada quando a build certa já está no cache.
  "$LATTES_DIR/.venv/bin/python" -m playwright install --only-shell chromium || return 1
  log "Lattes: coletando $((ano - 1)) e $ano em todos os campi (leva horas)…"
  ( cd "$LATTES_DIR" && .venv/bin/python scripts/coletar-suap.py --anos "$((ano - 1))" "$ano" --sincronizar )
}

# Build, testes e, se algo mudou, commit e push. Duas tentativas: se o push
# perder a corrida para um commit novo no remoto (o refresh semanal dos grupos,
# por exemplo), desfaz o commit desta rodada, puxa e refaz o build.
publicar() {
  local tentativa mensagem="$1"
  cd "$ROOT"
  for tentativa in 1 2; do
    git pull --ff-only
    npm run build
    npm test
    npm run validate

    if git diff --quiet data.json; then
      log "O data.json não mudou. Nada a publicar."
      return 0
    fi
    if [[ "$PUBLICAR" != 1 ]]; then
      log "PUBLICAR=$PUBLICAR: o data.json novo fica na árvore, sem commit."
      return 0
    fi

    git add data.json
    git commit -m "$mensagem"
    if git push; then
      log "Publicado: $mensagem"
      return 0
    fi
    log "O push falhou (tentativa $tentativa). Desfaço o commit desta rodada e refaço."
    git reset --keep HEAD~1
  done
  return 1
}

test -d "$POS_DIR" || { echo "ERRO: coletor da pós não encontrado em $POS_DIR" >&2; exit 1; }
test -d "$LATTES_DIR" || { echo "ERRO: coletor do Lattes não encontrado em $LATTES_DIR" >&2; exit 1; }

# ── 1. O SUAP está ao alcance? ───────────────────────────────────────────────
if ! curl -sfI --max-time 15 https://suap.ifba.edu.br/ >/dev/null 2>&1; then
  log "SUAP fora de alcance. Nada a fazer; a próxima execução tenta de novo."
  exit 0
fi

# ── 2. Quais fontes estão vencidas? ──────────────────────────────────────────
vencidas=()
for fonte in $FONTES; do
  case "$fonte" in
    pos)    idade="$(idade_dias "$ROOT/dados/scraper-SUAPPos" 'alunos_pos_*.csv')" ;;
    lattes) idade="$(idade_dias "$ROOT/dados/scraper-SUAPCNPQ" '*.xlsx')" ;;
    *) echo "ERRO: fonte desconhecida '$fonte' (use pos e/ou lattes)" >&2; exit 1 ;;
  esac
  if (( idade >= MAX_IDADE_DIAS )); then
    log "$fonte: coleta mais nova há $idade dia(s). Vou coletar."
    vencidas+=("$fonte")
  else
    log "$fonte: coleta mais nova há $idade dia(s), abaixo do limite de $MAX_IDADE_DIAS."
  fi
done
if (( ${#vencidas[@]} == 0 )); then
  log "Nenhuma fonte vencida. Nada a fazer."
  exit 0
fi

# ── 3. A árvore do dashboard está em condição de receber o resultado? ────────
# Só o data.json é commitado, mas uma alteração local nele, ou um commit local
# que não está no remoto, é trabalho de alguém. Melhor parar antes das horas
# de coleta do que no fim.
cd "$ROOT"
if ! git diff --quiet HEAD -- data.json; then
  log "ERRO: o data.json tem alteração local. Resolva antes da coleta automática."
  exit 1
fi
if [[ "$PUBLICAR" == 1 ]]; then
  git fetch --quiet
  if [[ -n "$(git log --oneline '@{u}..')" ]]; then
    log "ERRO: há commits locais fora do remoto. Não publico por cima deles:"
    git log --oneline '@{u}..'
    exit 1
  fi
fi

# ── 4. Coleta ────────────────────────────────────────────────────────────────
ok=(); falhas=()
for fonte in "${vencidas[@]}"; do
  if "coletar_$fonte"; then ok+=("$fonte"); else falhas+=("$fonte"); log "ERRO: a coleta de $fonte falhou."; fi
done

# ── 5. Build e publicação do que deu certo ───────────────────────────────────
if (( ${#ok[@]} > 0 )); then
  declare -A NOME=([pos]="pós-graduação" [lattes]="produção Lattes")
  partes=(); for fonte in "${ok[@]}"; do partes+=("${NOME[$fonte]}"); done
  descricao="$(printf '%s e ' "${partes[@]}")"; descricao="${descricao% e }"
  publicar "dados: atualiza $descricao (SUAP) ($(date +%F))"
fi

if (( ${#falhas[@]} > 0 )); then
  log "Fontes com falha: ${falhas[*]}. A próxima execução tenta de novo."
  exit 1
fi
