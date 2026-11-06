# UPN QR Studio 

**UPN QR Studio** je spletno orodje za pripravo plačilnih nalogov UPN s QR kodo. QR in PDF se ustvarita lokalno v brskalniku.

[English Description below](#english-version)

---

## Ključne funkcije 🚀

- **PDF izvoz**: Vektorski PDF; na voljo sta izvoz za A4 in nalog v predvideni velikosti 210 × 99 mm.
- **Več nalogov iz CSV/JSON**: Uvoz do 500 nalogov, preverjanje vsakega zapisa in skupni PDF z enim ali do tremi nalogi na A4.
- **"Čarobna palčka" (Magic Wand) 🪄**: Samodejno prepoznavanje in popravljanje kontrolnih številk za SI (Modulo 11) in RF (Modulo 97) reference.
- **Datumi**: Datum plačila se ob odprtju obrazca predizpolni z današnjim datumom; rok plačila ostane prazen. Pri humanitarnem nalogu je datum plačila skrit in ni dovoljen.
- **Temni način (Dark Mode)**: Sodoben videz s preprostim preklopom.
- **Hitro kopiranje**: Gumb za kopiranje IBAN številk z vizualno potrditvijo.
- **UPN QR z ISO-8859-2**: QR kodiranje uporablja lokalno priloženo knjižnico Nayuki, ECI 4, različico 15 in korekcijo napak M.
- **EPC QR za SEPA**: Ločen predogled in PNG izvoz EPC SEPA kreditnega prenosa, različica zapisa 002; uporablja ime in IBAN prejemnika ter znesek/opis iz obrazca, po želji BIC in dodatno informacijo. EPC QR ni vstavljen v UPN obrazec/PDF; podpora posamezne banke, vključno z N26, ni zagotovljena.
- **Dva različna QR formata**: UPN QR v obrazcu sledi slovenskemu 20-vrstičnemu zapisu ZBS; EPC QR sledi ločenemu SEPA zapisu `BCD`. Tehnična razlaga in povezava na uradne EPC smernice sta v aplikaciji.
- **Zasebnost**: QR in PDF se ustvarita v brskalniku. Izvajalni viri so shranjeni v projektu; aplikacija ne uporablja zunanjih CDN-jev ali analitike.

## Pomembno pred uporabo

- Način **»Humanitarni«** je namenjen registriranemu izdajatelju UPN QR. Društvo ali donacija sama po sebi ne pomenita, da izdajatelj izpolnjuje pogoje. Pred uporabo načina preverite registracijo pri ZBS oziroma svoji banki.
- Ne ugibajte reference prejemnika ali kode namena. Uporabite podatke, ki jih je določil prejemnik oziroma izdajatelj.
- Oznaka »Nujno« je neobvezna pri običajnem plačilu; pri pologu, dvigu in humanitarnem nalogu ni dovoljena.
- ZBS je objavil, da so banke s koncem leta 2022 ukinile brezplačno preverjanje pravilnosti UPN QR in tiska; pripadajoči seznami preverjenih oziroma licenciranih izdajateljev odražajo stanje 31. 12. 2022. Za aktualne zahteve in morebitno preverjanje se obrnite na banko, kjer imate odprt transakcijski račun. Lokalni programski testi niso uradna potrditev QR-kode.
- Pred tiskanjem večje količine preverite poskusni izpis in fizično poravnavo. Pri tiskanju PDF-ja izberite dejansko velikost oziroma 100 % in izklopite samodejno prilagajanje strani, če želite ohraniti mere 210 × 99 mm.
- Koda projekta je licencirana pod PolyForm Noncommercial 1.0.0. Javna dostopnost aplikacije sama po sebi ne dovoljuje komercialne uporabe ali nadaljnje distribucije kode; za tak namen je potrebno ustrezno dovoljenje.
- Aplikacija je trenutno na voljo brez plačila. »Brezplačno« opisuje ceno dostopa, ne pa dovoljenih namenov uporabe; licenca še vedno omejuje komercialno uporabo programske opreme.

## Namestitev in uporaba 🛠️

### Uporaba aplikacije

Za običajno uporabo **ne potrebujete npm, Node.js, Git ali prenosa izvorne kode**. Odprite objavljeno spletno stran v brskalniku in izpolnite obrazec. Če želite aplikacijo namestiti, uporabite »Namesti aplikacijo« (če brskalnik to ponudi) ali možnost namestitve v meniju. Po prvem obisku, ko se aplikacija naloži, lahko nameščena PWA deluje tudi brez povezave. Uporabnik za to ne izvaja ukaza `npm`.

Če prenesete izvorno kodo kot ZIP, aplikacije ne odpirajte z dvojnim klikom na `index.html`: `file://` ne omogoča servisnega delavca ali namestitve PWA. Za preizkus lokalne kopije sledite razvojnim navodilom spodaj.

### Uvoz več nalogov in skupni PDF

Pod razdelkom **EPC QR / GiroCode** je **Več nalogov iz CSV ali JSON**. Datoteke lahko izberete s klikom na veliko spustno območje ali jih vanj povlečete; več datotek se združi po vrstnem redu izbire v en skupni PDF. Aplikacija pred izvozom preveri vse naloge. Napake vključujejo ime datoteke in številko naloga. Omejitev je skupaj 500 nalogov in 5 MB za vse izbrane datoteke.

Za začetek prenesite [primer CSV](./examples/primer-vec-nalogov.csv) ali [primer JSON](./examples/primer-vec-nalogov.json). To so testni podatki; ne uporabite jih za dejansko plačilo. CSV mora imeti vrstico z imeni stolpcev; vrstni red ni pomemben, ker se polja prepoznajo po imenih. Sprejeti so kanonični angleški ključi iz primerov ter ustrezna slovenska imena, na primer `imePlacnika`, `naslovPlacnika`, `znesek`, `namenPlacila` in `ibanPrejemnika`. Neznana ali podvojena imena stolpcev so napaka, ne tiha zamenjava podatkov. CSV podpira vejico, podpičje ali tabulator kot ločilo in kodiranje UTF-8 ali Windows-1250.

Podprta polja so `payerName`, `payerAddress`, `payerCity`, `payerIban`, `payerRefCode`, `payerRef`, `amount`, `currency`, `paymentDate`, `dueDate`, `polog`, `dvig`, `humanitarno`, `nujno`, `purposeCode`, `purpose`, `recipientName`, `recipientAddress`, `recipientCity`, `recipientIban`, `recipientRefCode`, `recipientRef` in `mode`. Zahtevana polja so odvisna od vrste naloga in se preverijo po istih pravilih kot običajni obrazec.

JSON je lahko seznam objektov ali objekt z lastnostjo `nalogi`, ki vsebuje seznam. Vrstni red lastnosti v objektih ni pomemben. Znesek je lahko zapisan z decimalno piko ali vejico; datumi so sprejeti v obliki `YYYY-MM-DD` ali `DD.MM.YYYY`. Če običajnemu plačilu, pologu ali dvigu datum ni podan, se uporabi današnji datum. Polja `polog`, `dvig`, `humanitarno` in `nujno` sprejmejo vrednosti da/ne, true/false, 1/0 ali X. Polje `mode` lahko vsebuje `placilo`, `polog`, `dvig` ali `humanitarno`.

Pred izvozom se prikaže predogled plačnika, prejemnika, zneska in vrste vsakega naloga. Preverite ga glede na izvorno datoteko; nalogov z napakami ni mogoče izvoziti.

Izberete lahko **1 nalog na A4** (na dnu strani, kot pri obstoječem A4 izvozu), **2 naloga na A4** (zgoraj in spodaj, s 33 mm praznega odmika ob robovih in med njima) ali **3 naloge na A4**. Trije nalogi velikosti 210 × 99 mm zapolnijo vseh 297 mm višine A4 brez reže; robovi tiskalnika jih lahko odrežejo. V vseh možnostih je širina naloga 210 mm, zato tiskalnik lahko odreže tudi stranske robove. Pred večjim tiskom natisnite poskusni list pri dejanski velikosti oziroma 100 %.

Skupni PDF vsebuje slovenski **UPN QR** na vsakem UPN obrazcu. To ni QR format, ki bi ga bilo mogoče prosto zamenjati z vsako tujo banko. Aplikacija ima ločeno možnost **EPC QR / GiroCode** za SEPA kreditna plačila; uporablja drug zapis (BCD/SCT), je odvisen od podpore bančne aplikacije in trenutno ponuja ločen predogled/PNG za posamezen obrazec, ne paketni izvoz in ne nadomesti UPN QR na tiskanem obrazcu. Za države zunaj SEPA ali posamezne bančne aplikacije univerzalne združljivosti ni mogoče zagotoviti.

Uvoženi podatki se obdelajo lokalno v zavihku brskalnika in se ne prenesejo na strežnik, ne spreminjajo enojnega obrazca ter se ne shranijo v `localStorage`. Uvoz je neodvisen od lokalnega UPN API-ja.

### Objavljanje na GitHub Pages

GitHub Pages lahko streže statične datoteke neposredno iz korenske mape veje `main`; za to ni potreben `npm build`. V **Settings → Pages** preverite vir objave: `Deploy from a branch`, veja `main`, mapa `/(root)`. Datoteka `.nojekyll` izključi obdelavo z Jekyllom. Relativne poti do sredstev podpirajo projektno stran na `/upn-generator/`, kar preveri tudi lokalni Playwright test. Po objavi vseeno preverite dejanski naslov Pages; lahko kaže staro različico, dokler se objava in predpomnilniki ne posodobijo.

### Različice

`version` v `package.json` (`1.0.0`) je različica metapodatkov paketa za razvojna orodja; uporabniku aplikacije je ne prikazujemo in objava na GitHub Pages je ne spremeni. `lockfileVersion` v `package-lock.json` (`3`) označuje obliko lock datoteke npm, ne različice aplikacije. Različice razvojnih knjižnic, na primer QR generatorja, so njihove lastne različice.

`CACHE_NAME` v `sw.js` je različica predpomnilnika PWA, ne številka javne izdaje. Trenutno je `upn-studio-v9`; ob spremembi izvajalnih datotek ali strategije predpomnjenja ga povečaj, da nameščene aplikacije ustvarijo svež predpomnilnik in odstranijo starega. To ne pomeni, da je aplikacija izdaja v5. Zaporedje revizij predpomnilnika ni nujno enako številkam javnih izdaj. GitHub repozitorij trenutno nima objavljenih izdaj ali Git tagov. Prvo uradno izdajo aplikacije lahko označiš kot `v1.0.0` z GitHub Release/tagom, ko jo želiš uradno razglasiti; za običajno objavo Pages to ni potrebno.

### Razvoj in lokalni preizkus

`npm` je orodje za razvoj in preverjanje projekta, ne zahteva za uporabo aplikacije. Za lokalni strežnik in teste potrebujete Node.js 24 ali novejši ter npm. Korenska mapa vsebuje izvorno kodo; `dist/` je ustvarjen paket, ki se uporablja za lokalni predogled in druga statična gostovanja.

V PowerShellu odprite mapo projekta in zaženite:

```powershell
Set-Location 'C:\pot\do\upn-generator'
npm ci
npm start
```

`npm start` izdela `dist/` in zažene lokalni strežnik na `http://127.0.0.1:4173/`; ustavite ga s `Ctrl+C`. Obiskovalci spletne strani tega ne počnejo.

Za celoten testni paket namestite Playwrightove brskalnike in zaženite teste:

```powershell
npx playwright install chromium firefox webkit
npm test
```

`npm test` preveri celotno aplikacijo v Chromiumu ter osnovno ustvarjanje QR v Firefoxu in WebKitu; dodatno preveri predpomnjenje, delovanje brez povezave, posodobitev servisnega delavca, projektno pot GitHub Pages in distribucijski paket. CI zažene teste v istih brskalnikih na Ubuntu. Testi ne pokrivajo vseh različic brskalnikov, mobilnih naprav ali namestitve PWA v iOS/Safari. Uspešni testi niso uradna potrditev UPN QR.

Če želite zgrajeno aplikacijo ročno objaviti pri drugem statičnem gostovanju, uporabite `npm run build` in objavite **vsebino** mape `dist/`. Za objavo korenske mape na GitHub Pages ta korak ni potreben. Build sestavi minimalni paket brez nameščanja dodatnih npm odvisnosti.

### Razporeditev projekta

- `index.html`, `css/`, `js/` in `assets/`: statična aplikacija in izvajalni viri.
- `sw.js`, `manifest.json` in `.nojekyll`: PWA, predpomnjenje brez povezave in statično gostovanje.
- `scripts/build.cjs`: ustvari minimalno izvajalno kopijo v `dist/`.
- `tests/`, `playwright.config.js`, `package.json` in `package-lock.json`: razvojni strežnik ter avtomatizirani testi.
- `.github/workflows/quality.yml`: isti testi v CI.
- `.local/`: skriti interni zapiski in raziskovalni primeri; mapa je izključena iz repozitorija in distribucije.
- `LICENSE` in priložena licenčna obvestila: licence ter obvestila tretjih oseb.

README vsebuje navodila za uporabo in vzdrževanje, zato za trenutno velikost projekta zadošča kot javna dokumentacija za razvijalce. `.local/` je namenjena internim zapiskom, izključena je z `.gitignore` in se ne objavlja.

## Kontakt in javljanje napak ✉️
Za prijavo težave ali predlog uporabite [GitHub Issues](https://github.com/mihaknific/upn-generator/issues).

## Zasebnost 🔒

Vnosi obrazca se obdelujejo v brskalniku in samodejno shranijo v njegov `localStorage`, da se obrazec lahko obnovi po ponovnem odprtju. Shranjevanje se izvede 500 ms po zadnji spremembi; čakajoči zapis se shrani tudi ob skritju ali zaprtju strani. Datuma plačila in roka se ne shranita, zato se datum plačila ob ponovnem odprtju privzeto nastavi na aktualni datum. `localStorage` ni šifriran; do shranjenih podatkov lahko dostopa vsak, ki uporablja isti profil brskalnika. Na skupni napravi po uporabi kliknite »Nov nalog«. **Podatki iz uvožene CSV/JSON datoteke se obdelajo samo v pomnilniku trenutnega zavihka in se ne shranijo v `localStorage`.** Aplikacija podatkov o plačilih ne pošilja tretji osebi.

---

<a name="english-version"></a>
# English Version 🌍

**UPN QR Studio** is a browser-based tool for preparing UPN QR payment slips in Slovenia. QR codes and PDFs are generated locally in the browser.

### Key Features 💎
- **PDF export**: Vector PDF output for A4 and the intended 210 × 99 mm slip size; exact printed size still depends on print settings.
- **Batch CSV/JSON import**: Validate up to 500 records and export one combined PDF with one or up to three slips per A4 page.
- **Magic Wand 🪄**: Intelligent auto-correction for SI (ISO 7064 Mod 11-2) and RF (ISO 11649 Mod 97-10) check digits.
- **Smart Formatting**: Automatic uppercase conversion while typing.
- **Dates**: The payment date defaults to today and the due date stays empty. Neither date is saved; the payment date is hidden and disallowed in humanitarian mode.
- **Dark Mode**: High-contrast modern interface with persistent settings.
- **Privacy-focused**: QR and PDF generation run in the browser. Runtime assets are bundled locally; the app does not use third-party CDNs or analytics.
- **Separate EPC QR**: Optional SEPA credit-transfer QR preview and PNG export using EPC payload version 002. It is separate from the Slovenian UPN slip/PDF and is not guaranteed to work with every bank or app, including N26.

UPN QR payloads use ISO-8859-2 bytes with ECI assignment 4. The QR matrix is generated locally using the Nayuki QR Code generator (MIT license), pinned at v1.8.0. A separate EPC QR preview and PNG export uses payload version 002; its optional BIC and additional information are separate fields. EPC QR is not embedded in the Slovenian UPN form/PDF, and support by a particular bank such as N26 is not guaranteed. The programmer guide for registered UPN QR issuers available with the project is dated December 2022; verify current requirements with your bank before real-world use.

### Important Before Use

- The **Humanitarian** mode is for a registered UPN QR issuer. Being a charity or collecting a donation does not by itself establish eligibility; confirm registration with ZBS or your bank.
- Do not guess the recipient reference or purpose code; use the values supplied by the recipient or issuer.
- The urgent-payment flag is optional for ordinary payments and is not allowed for cash deposit, cash withdrawal, or humanitarian mode.
- The Slovenian Bank Association (ZBS) announced that banks ended free UPN QR and printout validation at the end of 2022. Its associated issuer lists reflect the status on 31 December 2022. Ask your bank for current requirements and any available validation before collecting real payments. Passing local software tests is not official approval.
- Print a test copy and verify physical alignment. For the 210 × 99 mm slip, print at actual size/100% and disable automatic page scaling where applicable.
- The project source is licensed under PolyForm Noncommercial 1.0.0. Public access to the app does not grant permission for commercial use or redistribution of the source; permission is required for those purposes.
- The app is currently available at no charge. “Free” describes the price of access; it does not change the license's restriction on commercial use of the software.

### Automated Tests

Use Node.js 24 or newer. Run the local Playwright browser suite with:

```bash
npm ci
npx playwright install chromium firefox webkit
npm test
```

The tests run the full application suite in Chromium and a QR-generation smoke test in Firefox and WebKit. They also check service-worker caching, offline operation, updates, the GitHub Pages project path, and the distribution package. CI runs the same browsers on Ubuntu. The suite does not cover every browser version, mobile device, or iOS/Safari PWA installation. Passing local tests do not constitute official UPN/EPC QR approval; ask your bank for current requirements and test the QR in the intended banking app.

## Feedback & Bug Reporting ✉️
For bug reports or suggestions, use [GitHub Issues](https://github.com/mihaknific/upn-generator/issues).

## Privacy Statement 🔒
Payment data is processed in the browser and form entries are automatically saved in that browser's `localStorage` so the form can be restored after reload. Saves are debounced until 500 ms after the last change, and pending changes are flushed when the page is hidden or closed. Payment and due dates are intentionally not persisted, so the payment date gets a fresh default on reload. Browser `localStorage` is persistent and is not encrypted by this app; anyone with access to the same browser profile may be able to access saved entries. Use the reset button to clear the saved form data, especially on a shared device. **Imported CSV/JSON records are processed only in the current tab's memory and are not saved to `localStorage`.** The app does not send payment data to a third-party service. All runtime assets are bundled with the project, and the Content Security Policy restricts application resources and connections to the same origin. External references are ordinary links and are only visited if a user chooses to open them.

When the site is hosted online, the hosting provider still receives normal requests for the site and may log technical connection data such as IP address and request time. This app does not make visitors anonymous to its hosting provider.

### Using the application

**You do not need npm, Node.js, Git, or a source-code download to use the app.** Open the published website in a browser and fill out the form. To install it, choose “Install app” if offered, or use the browser's install option. After the first successful visit, the installed PWA can also work offline. Visitors do not run `npm`.

If you download the source ZIP, do not open `index.html` by double-clicking it: `file://` does not support service workers or PWA installation. Use the local development instructions below to preview a downloaded copy.

### Import multiple slips and create a combined PDF

Below the **EPC QR / GiroCode** section, use **Več nalogov iz CSV ali JSON**. Click the large drop area or drag files onto it; multiple files are combined in selection order into one PDF. The app validates every record before enabling export. Errors identify the file name, record number, and reason. The combined limits are 500 records and 5 MB across all selected files.

Start with the [CSV example](./examples/primer-vec-nalogov.csv) or [JSON example](./examples/primer-vec-nalogov.json). These are test data; do not use them for real payments. CSV columns are matched by header name, not position, so columns may be reordered. Canonical English names from the examples and corresponding Slovenian names (for example `imePlacnika`, `znesek`, and `ibanPrejemnika`) are accepted. Unknown or duplicate column names are reported as errors. CSV supports comma, semicolon, or tab delimiters and UTF-8 or Windows-1250 encoding.

Supported fields are `payerName`, `payerAddress`, `payerCity`, `payerIban`, `payerRefCode`, `payerRef`, `amount`, `currency`, `paymentDate`, `dueDate`, `polog`, `dvig`, `humanitarno`, `nujno`, `purposeCode`, `purpose`, `recipientName`, `recipientAddress`, `recipientCity`, `recipientIban`, `recipientRefCode`, `recipientRef`, and `mode`. Required fields depend on the transaction type and are checked using the same rules as the regular form.

JSON can be an array of objects or an object with a `nalogi` array. Object property order does not matter. Amounts may use a decimal point or comma, and dates may use `YYYY-MM-DD` or `DD.MM.YYYY`. If a payment, deposit, or withdrawal has no payment date, today's date is used. The `polog`, `dvig`, `humanitarno`, and `nujno` fields accept yes/no, true/false, 1/0, or X; `mode` accepts `placilo`, `polog`, `dvig`, or `humanitarno`.

The app shows a preview of each payer, recipient, amount, and transaction type before export. Compare it with the source file; records with validation errors cannot be exported.

Choose **1 slip per A4** (at the bottom, matching the existing A4 export), **2 per A4** (top and bottom, with 33 mm of blank space at the edges and between them), or **3 per A4**. Three 210 × 99 mm forms fill the entire 297 mm A4 height with no spacing. All layouts use the full 210 mm paper width, so printer margins may clip the sides; print a test sheet at actual size/100% before printing a batch.

The combined PDF always contains the Slovenian **UPN QR** format on each UPN slip. This is not a switchable QR format for every foreign bank. The app separately offers **EPC QR / GiroCode** for SEPA credit transfers, using a different BCD/SCT payload. Compatibility depends on the bank app; that feature currently exports a separate preview/PNG for one form at a time and does not replace the UPN QR on the printed form. Universal QR compatibility with banks outside SEPA or individual banking apps cannot be guaranteed.

Imported data is processed locally in the current browser tab. It is not uploaded, does not alter the single-slip form, and is not stored in `localStorage`; this feature does not use the separate local UPN API.

### Publishing to GitHub Pages

GitHub Pages can serve the static files directly from the `main` branch root; no `npm build` is needed. Check **Settings → Pages** for branch publishing from `main` and `/(root)`. The `.nojekyll` file disables Jekyll processing. Relative asset paths also support the project-site path `/upn-generator/`, which is covered by a local Playwright test. After publishing, verify the actual Pages URL because it may continue to show an older build until deployment and caches update.

### Versions

The `version` in `package.json` (`1.0.0`) is package metadata for development tools; it is not shown to app users and does not control GitHub Pages deployments. `lockfileVersion` in `package-lock.json` (`3`) identifies the npm lockfile format, not the app version. Development libraries, such as the QR generator, have their own versions.

`CACHE_NAME` in `sw.js` is the PWA cache revision, not the public release number. It is currently `upn-studio-v9`; increment it when runtime files or the caching strategy change so installed apps create a fresh cache and remove the old one. This does not make the app release v5. Cache revisions do not need to match public release numbers. The GitHub repository currently has no published releases or Git tags. You can mark the app's first official release as `v1.0.0` with a GitHub Release/tag when you are ready to announce it; this is not required for an ordinary Pages deployment.

### Development and local preview

`npm` is a development and testing tool, not a requirement for using the application. Local development requires Node.js 24 or newer and npm. The repository root contains the source; `dist/` is a generated package for local preview or other static hosts.

In PowerShell, change to the project folder and run:

```powershell
Set-Location 'C:\path\to\upn-generator'
npm ci
npm start
```

This builds `dist/` and starts a local server at `http://127.0.0.1:4173/`. Stop it with `Ctrl+C`; website visitors do not need to run it.

To run the automated tests locally, install the development dependencies and Playwright's Chromium browser:

```powershell
npx playwright install chromium firefox webkit
npm test
```

`npm test` runs the full application suite in Chromium and QR-generation smoke tests in Firefox and WebKit. It also checks offline caching, service-worker updates, the GitHub Pages project path, and the distribution package. CI runs the same browsers on Ubuntu. The tests do not cover every browser version, mobile device, or iOS/Safari PWA installation. Passing tests are not official UPN or EPC QR approval.

To publish a built copy manually to another static host, run `npm run build` and upload the **contents** of `dist/`. This is not needed for the current GitHub Pages configuration. The build creates the minimal runtime package without installing npm dependencies.

GitHub Pages does not allow custom HTTP security headers. The application includes a CSP meta tag, but it does not replace all HTTP security headers; use a host that supports header configuration if those headers are required.

### Licensing

The source code is licensed under [PolyForm Noncommercial 1.0.0](./LICENSE). Public access to the app does not grant permission for commercial use or redistribution of the source; contact the maintainer for permission for those purposes. Third-party notices and applicable license texts are included with the project in [`js/vendor/THIRD-PARTY-NOTICES.txt`](./js/vendor/THIRD-PARTY-NOTICES.txt) and the bundled license files.

## Licenca ⚖️
© 2026 **UPN QR Studio**. Vse pravice pridržane.
Licencirano pod [PolyForm Noncommercial 1.0.0](LICENSE) — koda je javno dostopna, lahko jo pregledujete, spreminjate in delite, vendar je **komercialna uporaba prepovedana**.
