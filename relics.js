// "From the captain's drawer": real bits of the old organising docs, shown on a trip's page.
// Everything in quotes is verbatim, typos and all. That's the point.
// A trip shows its relics when its record has relics: '<id>' (or matches the trip below).
// "prepared" is a ready-to-check archive entry: the organiser gets a one-click "Add it" on Home.
window.JAMU_RELICS = [{
  id: 'dyje-2020',
  match: t => t.relics === 'dyje-2020' || (t.organiser === 'jakub' && /^2020-07/.test(t.start || '')),

  prepared: {
    title: 'Společenstvo inscenace na vodě',
    organiser: 'jakub',
    place: 'Dyje, ze Znojma do Hevlína',
    start: '2020-07-21', end: '2020-07-25',
    // Everyone who ticked 21.–25. 7. in the 2020 date poll, minus Júlia, who couldn't make it in the end.
    attendees: ['adam', 'sylvie', 'alzbeta', 'viktoria', 'ladislav', 'dalibor', 'jakub'],
    crowned: '',
    photos_url: 'https://drive.google.com/drive/folders/1fIETY0vPvvbzxZHQFEvcarPTfGyCE7vg',
    story: 'Jaro 2020, karanténa. Kuba nám místo zprávy do chatu, kde by to zapadlo, poslal dlouhý mail. Že život umí být těžký a krutý a zvládá se jen s blízkými lidmi, a že těmi lidmi jsme pro něj my. A protože slova občas nestačí, vezme nás na vodu. Tak vzniklo Společenstvo inscenace na vodě, a s ním i naše jméno a první z našich tradic.\n\nČtyři noci, tři etapy a skoro 40 kilometrů po Dyji: ze Znojma do Krhovic, přes přírodní rezervaci Meandry Dyje do Hrádku a dál až do Hevlína. Kolem renesančního mlýna se čtyřmi koly, s ochutnávkou vína ve sklepní uličce v Hrádku a s rumem přivázaným za lodí, ať není teplý.',
    quotes: '„Synu, jsou jen tři věci, které opravdu potřebuješ na vodu. Teplé plavky, otvírák a nějakou pičovinu.“ (Zdeněk Julina)\n„Ahoj! (to je vodácký pozdrav, kdybste nevěděli O:-) )“\n„Ostatní spoluvodáky ráno zdravím panákem zelené, abychom sjednotili dech.“',
    relics: 'dyje-2020'
  },

  // The captain's picks from the "Dyje 2020" Drive folder (Dalibor's photos + the ones Jakub found in 2026). Shown straight from Drive.
  picks: [
    { id: '1HJ7g-xpC9B8oyoVyhtkGe3KnUFqL_qYL', caption: 'Celá posádka' },
    { id: '1VAlTyL2f4t24jXNBCsWr-YDW5qGk3HkB', caption: 'Vyplouváme' },
    { id: '1ka9UPnVRIhPPhBmVgidZM2So_lX9Y0Z1', caption: 'Na vodě' },
    { id: '1hSeEXzDc3rgJL8PviVPD_eItS-ilm4Th', caption: 'Flotila' },
    { id: '1LJl6CU1Z7ci2wZ3mfHLmGMtZZQoTjIx7', caption: 'Znojmo, start' },
    { id: '1_PffvFKy7uvxzy6ZWAL2fBrgw-TdtAKE', caption: 'Ještě na suchu' },
    { id: '1LwAyg5aU3xvdHaSWV_U_yKU7Ffo5ANmX', caption: 'Sjednocený dech' },
    { id: '1zwHdLuXWCy3CVhR7PazlHrkcNKEDhYnT', caption: 'Brodění' },
    { id: '1_C8iFC7261cAOidioug-pvpheiSD2AVS', caption: 'Siesta' },
    { id: '1rujkPTZUSehGkMfSHk3Hmz79QFSljpsc', caption: 'Na nádraží' },
    { id: '1Z9MkD1vuvcXxSubh2ZMpSmRDtH1e3Pb1', caption: 'Nad údolím' },
    { id: '1r1geaQEhl1JlJ5UusPgGu3l_YB33EQrB', caption: 'Večer u kapličky' },
    { id: '1v41zoiYtAr-sTf3PCbcwPQCz76DTgZKJ', caption: 'Výhled' }
  ],

  letter: {
    date: '2020-04-26', from: 'jakub', subject: 'Kubův emoční výlev a z toho vzniklé nápady',
    lead: [
      'Ahojte, kamarádi.',
      'V první řadě se omlouvám, že vám v tento poklidný čas nic-nedělání posílám mail. Ale na chatu by to prostě zapadlo a to já bych nerad. Během tohoto karanténního období jsem si uvědomil, že život dokáže být dost těžký a krutý. A díky tomu jsem si uvědomil, že tuto těžkost a krutost může člověk zvládat jen za pomoci blízkých lidí, kteří v těchto chvílích můžou pomoct. Těmito lidmi jste pro mě vy.',
      'Nicméně se teď ve svém novém dospělém životě učím, že slova občas nestačí a je dobré když to člověk podpoří nějakým tím činem. A tak mě napadlo, že bych mohl zkusit něco udělat pro vás/nás všechny, vynaložit nějakou energii a třeba z toho jednoho dne vyrobíme další z příjemných tradic.'
    ],
    named: 'Takže Vám představuji svůj koncept: Společenstvo inscenace na vodě.',
    rest: [
      ['Kdy?', 'Tohle si myslím bude ta nejpalčivější otázka a proto… proto se na ni zatím vykašleme. Plout bychom měli někdy okolo prázdnin až bude hezky. Ale teď stejně všcihni prd víme co bude.'],
      ['Kam?', 'Ze svých mnoholetých vodáckých zkušeností jsem vybral řeku Dyje. Řeka je to dost velká, takže je poměrně jistota, že tam bude voda. Není to Vltava, takže je šance že tam nebude grandiozně moc lidí a je jednoduchá, takže i ti z vás, kteří jsou touto bohalibou činností nepolíbení se nemusí bát. Asi to nebude extra-ultra-mega adrenalin, ale na příjemné splavení je to cajk.'],
      ['Za kolik?', 'Voda má tu obrovskou výhodu, že je levná. Stačí zaplatit pronájem lodě, spaní v kempech je většinou okolo 100/noc. A pak už si jen platíte alkohol (cca 20 000 Kč/den) a jídlo (400 Kč/den). Dobře… s tím alkoholem jsem to možná přehnal, ale na vodě se fakt dost pije.'],
      ['Pár zásadních otázek', 'Chceš se vody účastnit? Chceš abychom na Vodě byli jen náš ročník? Udělíme výjimku pro partnery a partnerky? (Ahoj Nikol :-) )']
    ],
    sign: 'S pozdravem, Kapitán Kubko!',
    ps: [
      'P.S.: Dalibore, ne nejsi v tomto mailu náhodou, ty už prostě jsi součástí našeho ročníku.',
      'P.P.S.: Zatím Vám nedávám deadline na vyplnění, protože kdo má rád deadliny, že?',
      'P.P.P.S: Jde mi o to být s váma a vodu jsem zvolil protože je mi nejbližší.'
    ],
    reply: { from: 'dalibor', text: 'Boží nápad a jsem všema deseti pro! Btw díky za PS #1, hřeje to u srdíčka 😄' }
  },

  poll: {
    deadline: 'DATUM DEADLINE – 7. 6. 2020 23:59',
    people: ['adam', 'michaela', 'sylvie', 'alzbeta', 'julia', 'viktoria', 'nikol', 'ladislav', 'dalibor', 'jakub'],
    winner: '21.–25. 7.',
    rows: [
      ['1.–5. 7.',   [1, 0, 1, 1, 0, 0, 1, 0, 1, 1]],
      ['6.–10. 7.',  [1, 0, 1, 1, 0, 1, 0, 0, 1, 1]],
      ['11.–15. 7.', [1, 0, 0, 0, 0, 1, 0, 0, 0, 1]],
      ['16.–20. 7.', [0, 0, 0, 1, 0, 0, 1, 1, 0, 1]],
      ['21.–25. 7.', [1, 0, 1, 1, 1, 1, 0, 1, 1, 1]],
      ['26.–30. 7.', [1, 0, 0, 0, 1, 1, 0, 1, 1, 1]],
      ['1.–5. 8.',   [1, 1, 1, 0, 0, 0, 0, 1, 1, 1]],
      ['6.–10. 8.',  [1, 1, 0, 0, 0, 0, 0, 1, 1, 1]],
      ['11.–15. 8.', [1, 1, 0, 0, 1, 0, 1, 1, 1, 1]]
    ],
    notes: [
      { who: 'julia', text: 'Ahoj, veĺmi sa ospravedlňujem za nestihnutie deadlinu a vypĺňam takto pozde. Tie termíny, ktoré som dala sú velmi orientačné.' },
      { who: 'jakub', text: 'Pokud se mi sami neozvete, že nemůžete do konce tohoto týdne, budu s vámi na vodu počítat, chtít po vás peníze a budu fakt dost smutnej a naštvanej když nepojedete :-)' },
      { who: 'michaela', text: 'Jak už jsem říkala Kubovi, já to bohužel nedám. Moc mě to mrzí… Je mi to moc lito, určitě to bude skvělý.' }
    ]
  },

  budget: {
    lines: [['Loď (půlka, 3 dny)', 330], ['Pádlo', 90], ['Barel', 90], ['Vesta', 75], ['Kemp Znojmo', 160], ['Kemp Krhovice', 120], ['Kemp Hrádek', 100]],
    total: 965,
    note: 'V lodi jsou vždycky minimálně dva :-)',
    estimate: 'A pak už si jen platíte alkohol (cca 20 000 Kč/den) a jídlo (400 Kč/den). Dobře… s tím alkoholem jsem to možná přehnal.',
    fleet: [
      ['22. 6. 2020', 'Objednávka: 4× Vydra, 8 pádel, 8 barelů, 8 vest, odvoz z Hevlína. Celkem 5 380 Kč.'],
      ['17. 7. 2020', 'Nová objednávka je 2 lodě Vydra a 1 loď Samba 5.2. (odpadl nám člověk)']
    ]
  },

  voices: {
    question: 'Udělíme výjimku pro partnery a partnerky?',
    tally: { yes: ['alzbeta', 'ladislav', 'dalibor'], no: ['adam', 'sylvie', 'nikol'], meh: ['michaela', 'julia', 'viktoria'] },
    quotes: [
      { who: 'nikol', text: 'né že bych ho nemilovala, ale nemusí být všude se mnou žejo :D' },
      { who: 'sylvie', text: 'jakože, zasloužíme si všichni čas jen pro sebe :D' },
      { who: 'viktoria', text: 'kludne, ale myslím že to trošku uberá na intimite akcie. Ja si pustím papuľu na špacír aj pred cudzími, ale viem že nie každý z Vás je tak otvorený :D' },
      { who: 'dalibor', text: 'Čím víc nás pojede, tím mín si užijem sami sebe navzájem. Ale v zásadě proti nejsem' },
      { who: 'michaela', text: 'je mi to fuk :-)' },
      { who: 'nikol', text: 'jen mám problém se zádama, vždy jsem umřela bolestí.. každopádně raft je docela cesta a nebo někdo kdo to za mě odřídí :D' },
      { who: 'sylvie', text: 'ano ano ano!!!!' },
      { who: '', text: 'kubi si skvelý 🌸 chýbate mi!' }
    ]
  },

  guide: {
    intro: 'Namísto vypisování dlouhého seznamu co si sbalit to zkusím trochu jinak. Popíšu Vám první den a půl vody.',
    steps: [
      'Vystupuju z vlaku na nádraží ve Znojmě a přesouvám se pěšky do kempu. V kempu potkávám své kamarády a plný radosti jim okamžitě nabízím jakékoli omamné či psychotropní látky které mám v tu chvíli u sebe. (Na vodě se poměrně dost pije! doporučuju se hojně vybavit)',
      'Ná druhý den se probouzím plný radosti a energie z přicházejícího dne. Ostatní spoluvodáky ráno zdravím panákem zelené, abychom sjednotili dech.',
      'Ve své lodi mám nachystaný jeden 50ti litrový barel, do kterého MUSÍM být schopný uložit všechny své věci. Kdybych se náhodou udělal/cvakl (tak se říká tomu, když se vyklopíte do vody), věci v barelu zůstanou i tak suché.',
      'Za loď si provázkem přivážu alkohol (přece nebudu pít teplý rum!) a vyplouvám vstříc novým dobrodružstvím.'
    ],
    must: ['pokrývka hlavy', 'opalovák', 'boty do vody', 'pytel na věci do barelu', 'rum'],
    rule: 'Drží se pravidlo „jedno teplé jídlo denně“.',
    quote: { text: 'Synu, jsou jen tři věci, které opravdu potřebuješ na vodu. Teplé plavky, otvírák a nějakou pičovinu.', by: 'Zdeněk Julina' },
    joke: 'Víte co je to obrácený exorcismus? To je když povoláte ďábla aby vám pomohl vypudit kněze z malého dítěte :-)'
  },

  route: {
    start: { name: 'Centrum Vodárna, U Obří hlavy 7, Znojmo', gps: '48.8549481,16.040827', note: 'Já tam budu v 16:54. Pokud stopnete člověka na ulici a nabídnete mu Zelenou nebo Rum, každý místní vás rád nasměruje :-)' },
    stops: [
      { name: 'Znojmo', night: '21./22. 7.' },
      { name: 'Krhovice', km: 15, night: '22./23. 7.', text: 'Výhledy na historické město, pak ničím nerušená a velmi pohodová plavba.' },
      { name: 'Hrádek', km: 11, night: '23./24. 7.', text: 'Meandry Dyje. U brodu renesanční vodní mlýn se čtyřmi funkčními koly. Ochutnávka vína ve sklepní uličce.' },
      { name: 'Hevlín', km: 11, night: '24./25. 7.', text: 'Řeka se stále příjemně kroutí. Jeden sjízdný vakový jez.' }
    ]
  }
}];
