/*
 * Simulatore RAL -> Netto
 * Ipotesi: impiegato, tempo indeterminato, CCNL generico, residenza Milano (MI),
 * nessuna agevolazione (no bonus giovani, no legge 104, no altri redditi/oneri deducibili),
 * anno d'imposta 2026, contribuente non a carico, 365 giorni di lavoro nell'anno.
 *
 * Fonti normative usate per le costanti sotto, vedi anche la sezione
 * "Note metodologiche" nella pagina.
 */

// --- INPS (contributi a carico del lavoratore) ---
// Aliquota IVS lavoratore 9,19%; +1% aggiuntivo sulla quota di retribuzione
// che eccede il primo massimale pensionabile annuo (art. 3-ter L. 438/1992),
// rivalutato ISTAT per il 2026.
const INPS_RATE = 0.0919;
const INPS_RATE_EXTRA = 0.1019;
const INPS_SOGLIA_MASSIMALE = 56224;

// --- IRPEF nazionale 2026 (riforma a 3 aliquote) ---
const IRPEF_SCAGLIONI = [
  { limite: 28000, aliquota: 0.23 },
  { limite: 50000, aliquota: 0.33 },
  { limite: Infinity, aliquota: 0.43 },
];

// --- Addizionale regionale Lombardia 2026 (art. 72 L.R. 10/2003), a scaglioni ---
const ADD_REGIONALE_LOMBARDIA = [
  { limite: 15000, aliquota: 0.0123 },
  { limite: 28000, aliquota: 0.0158 },
  { limite: 50000, aliquota: 0.0172 },
  { limite: Infinity, aliquota: 0.0173 },
];

// --- Addizionale comunale Milano 2026: aliquota unica, soglia di esenzione (non scaglione) ---
const ADD_COMUNALE_MILANO_RATE = 0.008;
const ADD_COMUNALE_MILANO_ESENZIONE = 23000;

/** Applica una struttura a scaglioni progressivi a una base imponibile. */
function calcolaProgressivo(base, scaglioni) {
  let imposta = 0;
  let sogliaPrecedente = 0;
  for (const scaglione of scaglioni) {
    if (base <= sogliaPrecedente) break;
    const quota = Math.min(base, scaglione.limite) - sogliaPrecedente;
    imposta += quota * scaglione.aliquota;
    sogliaPrecedente = scaglione.limite;
  }
  return imposta;
}

function calcolaINPS(ral) {
  const baseOrdinaria = Math.min(ral, INPS_SOGLIA_MASSIMALE);
  const baseExtra = Math.max(0, ral - INPS_SOGLIA_MASSIMALE);
  return baseOrdinaria * INPS_RATE + baseExtra * INPS_RATE_EXTRA;
}

/** Detrazione da lavoro dipendente (art. 13 TUIR), formula 2026. */
function calcolaDetrazioneLavoroDipendente(redditoImponibile) {
  const rc = redditoImponibile;
  if (rc <= 0) return 0;
  if (rc <= 15000) return 1955;
  if (rc <= 28000) return 1910 + 1190 * (28000 - rc) / 13000;
  if (rc <= 50000) return 1910 * (50000 - rc) / 22000;
  return 0;
}

/**
 * Cuneo fiscale 2026, in due componenti giuridicamente distinte:
 * - "trattamentoIntegrativo": credito d'imposta, spetta anche se l'IRPEF
 *   netta è già azzerata dalle detrazioni (per redditi fino a 20.000,
 *   qui semplificato assumendo sempre capienza per la fascia 15-20k).
 * - "ulterioreDetrazione": vera detrazione d'imposta, riduce l'IRPEF lorda
 *   insieme alla detrazione da lavoro dipendente e NON può portarla sotto zero.
 */
function calcolaCuneoFiscale(redditoImponibile) {
  const rc = redditoImponibile;
  if (rc <= 20000) {
    return { trattamentoIntegrativo: 1200, ulterioreDetrazione: 0 };
  }
  if (rc <= 32000) {
    return { trattamentoIntegrativo: 0, ulterioreDetrazione: 1000 };
  }
  if (rc < 40000) {
    return { trattamentoIntegrativo: 0, ulterioreDetrazione: 1000 * (40000 - rc) / 8000 };
  }
  return { trattamentoIntegrativo: 0, ulterioreDetrazione: 0 };
}

function calcolaAddizionaleRegionale(redditoImponibile) {
  return calcolaProgressivo(redditoImponibile, ADD_REGIONALE_LOMBARDIA);
}

function calcolaAddizionaleComunale(redditoImponibile) {
  if (redditoImponibile <= ADD_COMUNALE_MILANO_ESENZIONE) return 0;
  return redditoImponibile * ADD_COMUNALE_MILANO_RATE;
}

/** Calcolo completo: da RAL a netto, con ogni voce intermedia esposta. */
function calcolaNetto(ral) {
  const inps = calcolaINPS(ral);
  const redditoImponibile = ral - inps;

  const irpefLorda = calcolaProgressivo(redditoImponibile, IRPEF_SCAGLIONI);
  const detrazioneLavoro = calcolaDetrazioneLavoroDipendente(redditoImponibile);
  const cuneo = calcolaCuneoFiscale(redditoImponibile);

  const detrazioniTotali = detrazioneLavoro + cuneo.ulterioreDetrazione;
  const irpefNetta = Math.max(0, irpefLorda - detrazioniTotali);

  const addRegionale = calcolaAddizionaleRegionale(redditoImponibile);
  const addComunale = calcolaAddizionaleComunale(redditoImponibile);

  const nettoAnnuale =
    ral - inps - irpefNetta - addRegionale - addComunale + cuneo.trattamentoIntegrativo;

  return {
    ral,
    inps,
    redditoImponibile,
    irpefLorda,
    detrazioneLavoro,
    ulterioreDetrazione: cuneo.ulterioreDetrazione,
    irpefNetta,
    addRegionale,
    addComunale,
    trattamentoIntegrativo: cuneo.trattamentoIntegrativo,
    nettoAnnuale,
  };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

const ralInput = document.getElementById('ral-input');
const ralSlider = document.getElementById('ral-slider');
const mensilitaButtons = document.querySelectorAll('[data-mensilita]');

let ultimoRisultato = null;
let mensilitaAttuali = 13;

const euro = (n) =>
  n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const euroFine = (n) =>
  n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

function render() {
  if (!ultimoRisultato) return;
  const r = ultimoRisultato;
  const nettoMensile = r.nettoAnnuale / mensilitaAttuali;
  const aliquotaEffettiva = ((r.ral - r.nettoAnnuale) / r.ral) * 100;

  document.getElementById('netto-annuale').textContent = euro(r.nettoAnnuale);
  document.getElementById('netto-mensile').textContent = euro(nettoMensile);
  document.getElementById('aliquota-effettiva').textContent = aliquotaEffettiva.toFixed(1) + '%';

  const righe = [
    ['Retribuzione annua lorda (RAL)', r.ral, '+', null],
    ['Contributi INPS a carico lavoratore', -r.inps, '−', '9,19% (10,19% oltre € 56.224)'],
    ['= Imponibile fiscale', r.redditoImponibile, '=', null],
    ['IRPEF lorda', -r.irpefLorda, '−', '23% / 33% / 43% a scaglioni'],
    ['Detrazione lavoro dipendente', r.detrazioneLavoro, '+', 'art. 13 TUIR'],
    ['Ulteriore detrazione (cuneo fiscale)', r.ulterioreDetrazione, '+', r.ulterioreDetrazione > 0 ? '20.000–40.000 €' : 'non spettante'],
    ['Addizionale regionale Lombardia', -r.addRegionale, '−', '1,23%–1,73% a scaglioni'],
    ['Addizionale comunale Milano', -r.addComunale, '−', r.addComunale > 0 ? '0,80%' : 'esente (reddito ≤ 23.000)'],
    ['Trattamento integrativo', r.trattamentoIntegrativo, '+', r.trattamentoIntegrativo > 0 ? 'credito, reddito ≤ 20.000' : 'non spettante'],
  ];

  const tbody = document.getElementById('cedolino-body');
  tbody.innerHTML = '';
  for (const [label, valore, segno, nota] of righe) {
    const tr = document.createElement('tr');
    if (label.startsWith('=')) tr.classList.add('riga-subtotale');
    tr.innerHTML = `
      <td class="col-voce">${label}</td>
      <td class="col-nota">${nota ?? ''}</td>
      <td class="col-valore ${valore < 0 ? 'negativo' : valore > 0 && segno === '+' ? 'positivo' : ''}">${segno === '=' ? euroFine(valore) : euroFine(Math.abs(valore))}</td>
    `;
    tbody.appendChild(tr);
  }

  const trNetto = document.createElement('tr');
  trNetto.classList.add('riga-netto');
  trNetto.innerHTML = `
    <td class="col-voce">NETTO ANNUALE</td>
    <td class="col-nota"></td>
    <td class="col-valore">${euroFine(r.nettoAnnuale)}</td>
  `;
  tbody.appendChild(trNetto);

  disegnaWaterfall(r);
}

function disegnaWaterfall(r) {
  const passi = [
    { label: 'RAL', delta: r.ral, tipo: 'base' },
    { label: 'INPS', delta: -r.inps, tipo: 'trattenuta' },
    { label: 'IRPEF netta', delta: -r.irpefNetta, tipo: 'trattenuta' },
    { label: 'Add. regionale', delta: -r.addRegionale, tipo: 'trattenuta' },
    { label: 'Add. comunale', delta: -r.addComunale, tipo: 'trattenuta' },
    { label: 'Bonus fiscale', delta: r.trattamentoIntegrativo, tipo: 'bonus' },
    { label: 'NETTO', delta: r.nettoAnnuale, tipo: 'finale' },
  ];

  const width = 720;
  const height = 300;
  const marginBottom = 34;
  const marginTop = 30;
  const chartHeight = height - marginBottom - marginTop;
  const barGap = 14;
  const barWidth = (width - barGap * (passi.length - 1)) / passi.length;
  const maxVal = r.ral;
  const scale = chartHeight / maxVal;

  let cursore = 0;
  let svg = '';

  passi.forEach((passo, i) => {
    const x = i * (barWidth + barGap);
    let yTop, h, classe, valoreMostrato;

    if (passo.tipo === 'base' || passo.tipo === 'finale') {
      h = passo.delta * scale;
      yTop = marginTop + (chartHeight - h);
      classe = passo.tipo === 'finale' ? 'barra-finale' : 'barra-base';
      valoreMostrato = passo.delta;
      cursore = passo.delta;
    } else {
      const nuovoCursore = cursore + passo.delta;
      const top = Math.max(cursore, nuovoCursore);
      const bottom = Math.min(cursore, nuovoCursore);
      h = (top - bottom) * scale;
      yTop = marginTop + (chartHeight - top * scale);
      classe = passo.tipo === 'bonus' ? 'barra-bonus' : 'barra-trattenuta';
      valoreMostrato = passo.delta;
      cursore = nuovoCursore;
    }

    svg += `
      <g class="barra-gruppo">
        <rect class="${classe}" x="${x}" y="${yTop}" width="${barWidth}" height="${Math.max(h, 1)}" rx="2"></rect>
        <text class="etichetta-valore" x="${x + barWidth / 2}" y="${yTop - 8}">${(valoreMostrato >= 0 ? '' : '−') + Math.round(Math.abs(valoreMostrato)).toLocaleString('it-IT')}</text>
        <text class="etichetta-nome" x="${x + barWidth / 2}" y="${height - 12}">${passo.label}</text>
      </g>
    `;
  });

  document.getElementById('waterfall').innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}

/** Ricalcola e ridisegna a partire dal valore corrente di RAL. Chiamata ad ogni interazione: nessun bottone "Calcola", il tool risponde in tempo reale come un vero software. */
function aggiorna(ral) {
  if (!ral || ral <= 0) return;
  ultimoRisultato = calcolaNetto(ral);
  render();
}

ralInput.addEventListener('input', () => {
  const ral = parseFloat(ralInput.value.replace(',', '.'));
  if (!ral || ral <= 0) return;
  const ralClamp = Math.min(ral, parseFloat(ralSlider.max));
  ralSlider.value = ralClamp;
  aggiorna(ral);
});

ralSlider.addEventListener('input', () => {
  ralInput.value = ralSlider.value;
  aggiorna(parseFloat(ralSlider.value));
});

mensilitaButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    mensilitaButtons.forEach((b) => b.classList.remove('attivo'));
    btn.classList.add('attivo');
    mensilitaAttuali = parseInt(btn.dataset.mensilita, 10);
    render();
  });
});

// Valore precompilato: calcolo iniziale immediato, nessuna azione richiesta.
aggiorna(parseFloat(ralInput.value));
