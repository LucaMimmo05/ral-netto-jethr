# Da lordo a netto — simulatore RAL 2026

Prototipo per la prova tecnica **Product Builder @ JET HR**.

Un calcolatore che, data una RAL (retribuzione annua lorda), proietta il netto annuale e mensile percepito da un dipendente, mostrando ogni singola voce trattenuta al lordo (contributi, imposte, addizionali) con le relative aliquote.

**[→ Prova il calcolatore](#)** *(link GitHub Pages dopo il deploy)*

## Scope e ipotesi

Come indicato nella traccia, il dominio "netto da lordo" in Italia è molto ampio (CCNL, carichi di famiglia, welfare, ISEE, part-time, straordinari, TFR...). Questo prototipo copre **un caso singolo e standard**:

- Impiegato del settore privato, **contratto a tempo indeterminato**
- Residenza fiscale a **Milano**
- **Nessuna agevolazione** (no bonus giovani, impatriati, legge 104, familiari a carico, altri redditi)
- Anno d'imposta **2026**, 365 giorni di lavoro nell'anno

Tutte le altre semplificazioni sono documentate ed elencate nella sezione "Note metodologiche" **dentro l'app stessa** (non solo qui), insieme alle fonti normative usate per ogni aliquota — proprio perché il punto dell'esercizio non è produrre un numero, ma dimostrare di aver capito e controllato la logica dietro.

## Come funziona il calcolo

```
RAL
 − Contributi INPS lavoratore (9,19%, +1% oltre soglia massimale)
 = Imponibile fiscale
 − IRPEF lorda (23% / 33% / 43% a scaglioni)
 + Detrazione da lavoro dipendente (art. 13 TUIR)
 + Ulteriore detrazione "cuneo fiscale" (redditi 20.000–40.000 €)
 − Addizionale regionale Lombardia (a scaglioni, 1,23%–1,73%)
 − Addizionale comunale Milano (0,80%, esente sotto 23.000 €)
 + Trattamento integrativo (credito d'imposta, redditi fino a 20.000 €)
 = NETTO ANNUALE
```

Il codice in [`script.js`](script.js) implementa ogni passaggio come funzione separata e commentata con il riferimento normativo, cos'è distinguibile e verificabile riga per riga — nessuna dipendenza esterna, nessun calcolo "a scatola chiusa".

## Stack

HTML/CSS/JS puro, senza framework né build step: apribile con un doppio click sul file `index.html`, oppure servito staticamente (GitHub Pages). Scelta deliberata per restare completamente ispezionabile e sotto controllo, coerente con lo spirito della prova.

## Sviluppo locale

```bash
python3 -m http.server 8000
```

poi apri `http://localhost:8000`.
