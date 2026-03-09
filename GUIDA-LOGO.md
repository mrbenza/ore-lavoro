# Guida — Sostituzione Logo Aziendale

## File da sostituire

Il logo è referenziato in `index.html` come:
```html
<img src="logo.png" alt="Borelli Costruzioni" />
```

Sostituisci il file **`logo.png`** nella cartella radice del progetto (`ore-lavoro/`).

---

## Formato consigliato

| Proprietà | Valore consigliato |
|-----------|-------------------|
| Nome file | `logo.png` (invariato) |
| Formato | **PNG** con sfondo trasparente |
| Larghezza | 200–400 px |
| Altezza | 60–120 px |
| Peso file | < 100 KB |

> Evita JPG (no trasparenza) e BMP/TIFF (troppo pesanti).

---

## Come sostituire

1. Prepara il file logo nel formato corretto
2. Rinominalo **`logo.png`**
3. Copialo nella cartella `ore-lavoro/` sovrascrivendo il file esistente
4. Fai il deploy su Vercel — il logo si aggiorna automaticamente

---

## Ottimizzazione consigliata

Prima di caricare, comprimi il file su **squoosh.app** o **tinypng.com**:
- Seleziona formato OxiPNG o WebP
- Mantieni la trasparenza
- Punta a < 50 KB per caricamento veloce su mobile

---

## Verifica finale

Dopo il deploy controlla il logo su:
- Mobile (schermo piccolo)
- Desktop
- Tema scuro — lo sfondo trasparente garantisce leggibilità su qualsiasi sfondo
