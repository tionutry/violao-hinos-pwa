# Violão dos Hinos — DigitaHinos (PWA)

Aplicativo instalável (PWA) para **executar os 480 hinos do Hinário nº 5 em violão fingerstyle**.

- **Tela principal** → ⚙ **Configurações** → **Biblioteca de hinos (480)** → escolher um hino → **área de execução**.
- **Área de execução**
  - Em cima, a **partitura 16:9** (ideal para YouTube) com fundo sépia: pauta do violão, espaço, **letra** (do MXL), **diagramas de acordes** e **tablatura**.
  - Embaixo, o **violão animado**: números dos dedos da mão esquerda (1-4) e a digitação da mão direita (**p i m a**).
  - Arranjo automático: **melodia** (soprano) + **baixo com o polegar (p) nas tônicas** de cada acorde + **dedilhado** com as demais notas do acorde até a próxima mudança.
  - O tom é transposto automaticamente para as posições mais fáceis do violão (dá para mudar com − / + ou escolher "Original com capotraste" nas configurações).
- **Duas vozes/aparências de violão**: **náilon** (clássico, madeira clara, som quente) e **aço** (folk, sunburst escuro, som brilhante). O som é sintetizado no próprio aparelho (nenhum arquivo de áudio).
- **Modo vídeo** (botão ⛶): esconde as barras e deixa só a partitura 16:9 + violão, para gravar a tela.

## Como publicar no GitHub Pages (pelo celular)

1. Crie um repositório novo (ex.: `violao-hinos`).
2. **Add file → Upload files** e envie **todos os arquivos desta pasta** (todos ficam na raiz, sem subpastas).
3. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
4. Abra `https://SEU-USUARIO.github.io/violao-hinos/` e use **Instalar app / Adicionar à tela inicial**.

> Ao atualizar qualquer arquivo, mude `VERSION` em `sw.js` (ex.: `v2`) para o aplicativo instalado baixar a nova versão.

## Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `app.css`, `app.js` | telas, biblioteca, configurações e controles |
| `arranger.js` | motor de arranjo: acordes → posições no violão → dedos (esquerda e p-i-m-a) → escolha do tom |
| `sheet.js` | partitura 16:9: pauta, letra, diagramas e tablatura |
| `guitar.js` | violão animado (náilon e aço) |
| `audio.js` | síntese do violão (Karplus-Strong) e reprodução sincronizada |
| `vexflow.js` | biblioteca de notação musical (VexFlow 4.2.5, licença MIT) |
| `hinos.json` | os 480 hinos convertidos dos MXL (melodia, letra, acordes, repetições) |
| `manifest.webmanifest`, `sw.js` | PWA instalável e funcionamento offline |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `icon.svg` | ícones |

## Observações

- Os acordes são **detectados automaticamente** a partir das 4 vozes do MXL (soprano, contralto, tenor e baixo). O baixo do arranjo toca sempre a **tônica** do acorde.
- Hinos com várias estrofes: a execução percorre todas (ou só a 1ª, nas configurações); a letra da estrofe atual aparece na partitura. O "Coro" é tocado após cada estrofe.
- Fermatas alongam o tempo; repetições e casas 1ª/2ª dos 4 hinos que as usam são respeitadas.
