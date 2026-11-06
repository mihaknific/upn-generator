import { wikiData } from './wiki-data.js';

/**
 * Wiki Module — Handles dynamic rendering of help tables and fuzzy search.
 * Now supports bilingual (SL/EN) purpose codes with classification and descriptions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Pogoste kode namenov za hiter pregled
    const topPurposeCodes = [
        { code: 'GDSV', sl: { class: 'Komerciala', name: 'Nakup blaga in storitev', desc: 'Nakup ali prodaja blaga in storitev.' }, en: { class: 'Commercial', name: 'Purchase Sale Of Goods and Services', desc: 'Transaction is related to purchase and sale of goods and services.' } },
        { code: 'SALA', sl: { class: 'Plače & Podpore', name: 'Plače', desc: 'Izplačilo plač, porodniške.' }, en: { class: 'Salary & Benefits', name: 'Salary Payment', desc: 'Transaction is the payment of salaries.' } },
        { code: 'PENS', sl: { class: 'Plače & Podpore', name: 'Pokojnina', desc: 'Izplačilo pokojnin.' }, en: { class: 'Salary & Benefits', name: 'Pension Payment', desc: 'Transaction is the payment of pension.' } },
        { code: 'CHAR', sl: { class: 'Potrošnik', name: 'Dobrodelno plačilo', desc: 'Plačilo v dobrodelne namene, solidarna pomoč, humanitarna plačila.' }, en: { class: 'Consumer', name: 'Charity Payment', desc: 'Transaction is a payment for charity reasons.' } },
        { code: 'TAXS', sl: { class: 'Davki', name: 'Davek', desc: 'Plačilo davka na dohodek iz kapitala, dohodnine, itd.' }, en: { class: 'Tax', name: 'Tax Payment', desc: 'Transaction is the payment of taxes.' } },
        { code: 'RENT', sl: { class: 'Splošno', name: 'Najemnina', desc: 'Plačilo najemnine.' }, en: { class: 'General', name: 'Rent', desc: 'Transaction is the payment of rent.' } },
        { code: 'WEBI', sl: { class: 'Splošno', name: 'Spletno plačilo', desc: 'Plačilo nakupa izvedenega prek svetovnega spleta.' }, en: { class: 'General', name: 'Internet-Initiated Transaction', desc: 'Transaction is related to a payment initiated via internet.' } }
    ];

    // Language state
    let currentLang = 'sl'; // 'sl' or 'en'

    // Currencies list (Global fiat currencies, categorized)
    const currencies = [
        { group: true, title: 'Uradna valuta v Sloveniji (SEPA območje)' },
        { code: 'EUR', name: 'Evro', location: 'Slovenija, Evroobmočje' },

        { group: true, title: 'Ostale svetovne valute (Mednarodna nakazila)' },
        { code: 'USD', name: 'Ameriški dolar', location: 'Združene države Amerike' },
        { code: 'CHF', name: 'Švicarski frank', location: 'Švica, Lihtenštajn' },
        { code: 'GBP', name: 'Britanski funt', location: 'Združeno kraljestvo' },
        { code: 'AED', name: 'Dirham ZAE', location: 'Združeni arabski emirati' },
        { code: 'AFN', name: 'Afganistanski afgani', location: 'Afganistan' },
        { code: 'ALL', name: 'Albanski lek', location: 'Albanija' },
        { code: 'AMD', name: 'Armenski dram', location: 'Armenija' },
        { code: 'ANG', name: 'Nizozemsko-antilski gulden', location: 'Curaçao, Sint Maarten' },
        { code: 'AOA', name: 'Angolska kvanza', location: 'Angola' },
        { code: 'ARS', name: 'Argentinski peso', location: 'Argentina' },
        { code: 'AUD', name: 'Avstralski dolar', location: 'Avstralija' },
        { code: 'AWG', name: 'Arubski florin', location: 'Aruba' },
        { code: 'AZN', name: 'Azerbajdžanski manat', location: 'Azerbajdžan' },
        { code: 'BAM', name: 'Konvertibilna marka', location: 'Bosna in Hercegovina' },
        { code: 'BBD', name: 'Barbadoški dolar', location: 'Barbados' },
        { code: 'BDT', name: 'Bangladeška taka', location: 'Bangladeš' },
        { code: 'BGN', name: 'Bolgarski lev', location: 'Bolgarija' },
        { code: 'BHD', name: 'Bahranski dinar', location: 'Bahrajn' },
        { code: 'BIF', name: 'Burundski frank', location: 'Burundi' },
        { code: 'BMD', name: 'Bermudski dolar', location: 'Bermudi' },
        { code: 'BND', name: 'Brunejski dolar', location: 'Brunej' },
        { code: 'BOB', name: 'Bolivijski boliviano', location: 'Bolivija' },
        { code: 'BRL', name: 'Brazilski real', location: 'Brazilija' },
        { code: 'BSD', name: 'Bahamski dolar', location: 'Bahami' },
        { code: 'BTN', name: 'Butanski ngultrum', location: 'Butan' },
        { code: 'BWP', name: 'Bocvanska pula', location: 'Bocvana' },
        { code: 'BYN', name: 'Beloruski rubelj', location: 'Belorusija' },
        { code: 'BZD', name: 'Belizejski dolar', location: 'Belize' },
        { code: 'CAD', name: 'Kanadski dolar', location: 'Kanada' },
        { code: 'CDF', name: 'Kongoški frank', location: 'Demokratična republika Kongo' },
        { code: 'CLP', name: 'Čilski peso', location: 'Čile' },
        { code: 'CNY', name: 'Kitajski juan', location: 'Ljudska republika Kitajska' },
        { code: 'COP', name: 'Kolumbijski peso', location: 'Kolumbija' },
        { code: 'CRC', name: 'Kostarikaški kolon', location: 'Kostarika' },
        { code: 'CUP', name: 'Kubanski peso', location: 'Kuba' },
        { code: 'CVE', name: 'Zelenortski eskudo', location: 'Zelenortski otoki' },
        { code: 'CZK', name: 'Češka krona', location: 'Češka' },
        { code: 'DJF', name: 'Džibutski frank', location: 'Džibuti' },
        { code: 'DKK', name: 'Danska krona', location: 'Danska' },
        { code: 'DOP', name: 'Dominikanski peso', location: 'Dominikanska republika' },
        { code: 'DZD', name: 'Alžirski dinar', location: 'Alžirija' },
        { code: 'EGP', name: 'Egiptovski funt', location: 'Egipt' },
        { code: 'ERN', name: 'Eritrejska nakfa', location: 'Eritreja' },
        { code: 'ETB', name: 'Etiopski bir', location: 'Etiopija' },
        { code: 'FJD', name: 'Fidžijski dolar', location: 'Fidži' },
        { code: 'FKP', name: 'Falklandski funt', location: 'Falklandski otoki' },
        { code: 'GEL', name: 'Gruzijski lari', location: 'Gruzija' },
        { code: 'GHS', name: 'Ganski cedi', location: 'Gana' },
        { code: 'GIP', name: 'Gibraltarski funt', location: 'Gibraltar' },
        { code: 'GMD', name: 'Gambijski dalasi', location: 'Gambija' },
        { code: 'GNF', name: 'Gvinejski frank', location: 'Gvineja' },
        { code: 'GTQ', name: 'Gvatemalski kecal', location: 'Gvatemala' },
        { code: 'GYD', name: 'Gvajanski dolar', location: 'Gvajana' },
        { code: 'HKD', name: 'Hongkonški dolar', location: 'Hongkong' },
        { code: 'HNL', name: 'Honduraška lempira', location: 'Honduras' },
        { code: 'HTG', name: 'Haitijski gurd', location: 'Haiti' },
        { code: 'HUF', name: 'Madžarski forint', location: 'Madžarska' },
        { code: 'IDR', name: 'Indonezijska rupija', location: 'Indonezija' },
        { code: 'INR', name: 'Indijska rupija', location: 'Indija' },
        { code: 'IQD', name: 'Iraški dinar', location: 'Irak' },
        { code: 'IRR', name: 'Iranski rial', location: 'Iran' },
        { code: 'ISK', name: 'Islandska krona', location: 'Islandija' },
        { code: 'JMD', name: 'Jamajški dolar', location: 'Jamajka' },
        { code: 'JOD', name: 'Jordanski dinar', location: 'Jordanija' },
        { code: 'JPY', name: 'Japonski jen', location: 'Japonska' },
        { code: 'KES', name: 'Kenijski šiling', location: 'Kenija' },
        { code: 'KGS', name: 'Kirgiški som', location: 'Kirgizistan' },
        { code: 'KHR', name: 'Kamboški riel', location: 'Kambodža' },
        { code: 'KMF', name: 'Komorski frank', location: 'Komori' },
        { code: 'KPW', name: 'Severnokorejski von', location: 'Severna Koreja' },
        { code: 'KRW', name: 'Južnokorejski von', location: 'Južna Koreja' },
        { code: 'KWD', name: 'Kuvajtski dinar', location: 'Kuvajt' },
        { code: 'KYD', name: 'Kajmanski dolar', location: 'Kajmanski otoki' },
        { code: 'KZT', name: 'Kazahstanski tenge', location: 'Kazahstan' },
        { code: 'LAK', name: 'Laoški kip', location: 'Laos' },
        { code: 'LBP', name: 'Libanonski funt', location: 'Libanon' },
        { code: 'LKR', name: 'Šrilanška rupija', location: 'Šrilanka' },
        { code: 'LRD', name: 'Liberijski dolar', location: 'Liberija' },
        { code: 'LSL', name: 'Lesotski loti', location: 'Lesoto' },
        { code: 'LYD', name: 'Libijski dinar', location: 'Libija' },
        { code: 'MAD', name: 'Maroški dirham', location: 'Maroko' },
        { code: 'MDL', name: 'Moldavski leu', location: 'Moldavija' },
        { code: 'MGA', name: 'Malgaški ariarij', location: 'Madagaskar' },
        { code: 'MKD', name: 'Makedonski denar', location: 'Severna Makedonija' },
        { code: 'MMK', name: 'Mjanmarski kjat', location: 'Mjanmar' },
        { code: 'MNT', name: 'Mongolski tugrik', location: 'Mongolija' },
        { code: 'MOP', name: 'Makaoska pataka', location: 'Makav' },
        { code: 'MRU', name: 'Mavretanska uguija', location: 'Mavretanija' },
        { code: 'MUR', name: 'Mavricijska rupija', location: 'Mavricij' },
        { code: 'MVR', name: 'Maldivska rufija', location: 'Maldivi' },
        { code: 'MWK', name: 'Malavijska kvača', location: 'Malavi' },
        { code: 'MXN', name: 'Mehiški peso', location: 'Mehika' },
        { code: 'MYR', name: 'Malezijski ringit', location: 'Malezija' },
        { code: 'MZN', name: 'Mozambiški metikal', location: 'Mozambik' },
        { code: 'NAD', name: 'Namibijski dolar', location: 'Namibija' },
        { code: 'NGN', name: 'Nigerijska naira', location: 'Nigerija' },
        { code: 'NIO', name: 'Nikaragovska zlata kordova', location: 'Nikaragva' },
        { code: 'NOK', name: 'Norveška krona', location: 'Norveška' },
        { code: 'NPR', name: 'Nepalska rupija', location: 'Nepal' },
        { code: 'NZD', name: 'Novozelandski dolar', location: 'Nova Zelandija' },
        { code: 'OMR', name: 'Omanski rial', location: 'Oman' },
        { code: 'PAB', name: 'Panamska balboa', location: 'Panama' },
        { code: 'PEN', name: 'Perujski sol', location: 'Peru' },
        { code: 'PGK', name: 'Papuanska kina', location: 'Papua Nova Gvineja' },
        { code: 'PHP', name: 'Filipinski peso', location: 'Filipini' },
        { code: 'PKR', name: 'Pakistanska rupija', location: 'Pakistan' },
        { code: 'PLN', name: 'Poljski zlot', location: 'Poljska' },
        { code: 'PYG', name: 'Paragvajski gvarani', location: 'Paragvaj' },
        { code: 'QAR', name: 'Katarski rial', location: 'Katar' },
        { code: 'RON', name: 'Romunski lev', location: 'Romunija' },
        { code: 'RSD', name: 'Srbski dinar', location: 'Srbija' },
        { code: 'RUB', name: 'Ruski rubelj', location: 'Ruska federacija' },
        { code: 'RWF', name: 'Ruandski frank', location: 'Ruanda' },
        { code: 'SAR', name: 'Saudski rial', location: 'Saudova Arabija' },
        { code: 'SBD', name: 'Salomonski dolar', location: 'Salomonovi otoki' },
        { code: 'SCR', name: 'Sejšelska rupija', location: 'Sejšeli' },
        { code: 'SDG', name: 'Sudanski funt', location: 'Sudan' },
        { code: 'SEK', name: 'Švedska krona', location: 'Švedska' },
        { code: 'SGD', name: 'Singapurski dolar', location: 'Singapur' },
        { code: 'SLL', name: 'Sieraleonski leone', location: 'Sierra Leone' },
        { code: 'SOS', name: 'Somalski šiling', location: 'Somalija' },
        { code: 'SRD', name: 'Surinamski dolar', location: 'Surinam' },
        { code: 'STN', name: 'Dobra Svetega Tomaža in Principa', location: 'Sveti Tomaž in Princip' },
        { code: 'SYP', name: 'Sirski funt', location: 'Sirija' },
        { code: 'SZL', name: 'Svazijski lilangeni', location: 'Esvatini' },
        { code: 'THB', name: 'Tajski baht', location: 'Tajska' },
        { code: 'TJS', name: 'Tadžikistanski somoni', location: 'Tadžikistan' },
        { code: 'TMT', name: 'Turkmenistanski manat', location: 'Turkmenistan' },
        { code: 'TND', name: 'Tunizijski dinar', location: 'Tunizija' },
        { code: 'TOP', name: 'Tongovska pa\’anga', location: 'Tonga' },
        { code: 'TRY', name: 'Turška lira', location: 'Turčija' },
        { code: 'TTD', name: 'Dolar Trinidada in Tobaga', location: 'Trinidad in Tobago' },
        { code: 'TWD', name: 'Novi tajvanski dolar', location: 'Tajvan' },
        { code: 'TZS', name: 'Tanzanijski šiling', location: 'Tanzanija' },
        { code: 'UAH', name: 'Ukrajinska grivna', location: 'Ukrajina' },
        { code: 'UGX', name: 'Ugandski šiling', location: 'Uganda' },
        { code: 'UYU', name: 'Urugvajski peso', location: 'Urugvaj' },
        { code: 'UZS', name: 'Uzbekistanski som', location: 'Uzbekistan' },
        { code: 'VEF', name: 'Venezuelski bolivar', location: 'Venezuela' },
        { code: 'VND', name: 'Vietnamski dong', location: 'Vietnam' },
        { code: 'VUV', name: 'Vanuatujski vatu', location: 'Vanuatu' },
        { code: 'WST', name: 'Samoanska tala', location: 'Samoa' },
        { code: 'XAF', name: 'CFA frank BEAC', location: 'Srednja Afrika' },
        { code: 'XCD', name: 'Vzhodnokaribski dolar', location: 'Vzhodni Karibi' },
        { code: 'XOF', name: 'CFA frank BCEAO', location: 'Zahodna Afrika' },
        { code: 'XPF', name: 'CFP frank', location: 'Francoska Polinezija' },
        { code: 'YER', name: 'Jemenski rial', location: 'Jemen' },
        { code: 'ZAR', name: 'Južnoafriški rand', location: 'Južna Afrika' },
        { code: 'ZMW', name: 'Zambijska kvača', location: 'Zambija' },
        { code: 'ZWL', name: 'Zimbabvejski dolar', location: 'Zimbabve' }
    ];

    function renderPurposeCodeTable(data, tbodyId, lang) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';

        data.forEach(item => {
            const tr = document.createElement('tr');
            const info = item[lang] || item['sl'] || { class: '-', name: '-', desc: '-' };
            tr.innerHTML = `
                <td><span class="wiki-tag highlight">${item.code}</span></td>
                <td><span class="text-xs font-medium text-slate-500">${info.class}</span></td>
                <td><strong>${info.name}</strong></td>
                <td><span class="text-xs text-slate-500">${info.desc}</span></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderCurrencyTable(data, tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;
        tbody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            if (item.group) {
                tr.className = 'table-group-header';
                tr.innerHTML = `<td colspan="3">${item.title}</td>`;
            } else {
                tr.innerHTML = `
                    <td><span class="wiki-tag">${item.code}</span></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="text-xs text-slate-500">${item.location}</span></td>
                `;
            }
            tbody.appendChild(tr);
        });
    }

    const langBtn = document.getElementById('lang-switch-btn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'sl' ? 'en' : 'sl';
            langBtn.innerHTML = currentLang === 'sl' ? 'SL / <span style="font-weight: normal; opacity: 0.6;">EN</span>' : '<span style="font-weight: normal; opacity: 0.6;">SL</span> / EN';
            renderPurposeCodeTable(topPurposeCodes, 'wiki-tbody-purposes-top', currentLang);
            renderPurposeCodeTable(wikiData, 'wiki-tbody-purposes-all', currentLang);
        });
    }

    // Utils for fuzzy string matching
    const normalizeStr = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const attachFuzzySearch = (inputId, getRows) => {
        const inputEl = document.getElementById(inputId);
        if (!inputEl) return;
        inputEl.addEventListener('input', (e) => {
            const queryWords = normalizeStr(e.target.value.trim()).split(/\s+/);
            const rows = getRows();

            rows.forEach(row => {
                if (row.classList.contains('table-group-header')) return; // skip headers

                const text = normalizeStr(row.textContent);
                // Check if all words in query match somewhere in the text
                const isMatch = queryWords.every(word => text.includes(word));

                if (queryWords[0] === '' || isMatch) {
                    row.classList.remove('hidden-row');
                } else {
                    row.classList.add('hidden-row');
                }
            });
        });
    };

    attachFuzzySearch('wikiSearchPurposes', () => document.querySelectorAll('#wiki-tbody-purposes-all tr'));
    attachFuzzySearch('wikiSearchCurrencies', () => document.querySelectorAll('#wiki-tbody-currencies tr'));

    // Initial render
    renderPurposeCodeTable(topPurposeCodes, 'wiki-tbody-purposes-top', currentLang);
    renderCurrencyTable(currencies, 'wiki-tbody-currencies');

    // Render all purposes
    renderPurposeCodeTable(wikiData, 'wiki-tbody-purposes-all', currentLang);
});

