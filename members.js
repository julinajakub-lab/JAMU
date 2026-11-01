// The gang. Edit the texts freely. "jamu" = who they were at school, "line" = who they are,
// "links" = public things about them found online (theses, festival pages…).
window.JAMU_MEMBERS = [
  { id: 'adam',     name: 'Adam Harton',        short: 'Adam',    nick: '#MrBomBo',              jamu: 'Film buff · Slovak delegation',
    line: 'Name any film and Adamko has seen it, rated it and has an opinion about the director. The other half of our Slovak delegation.' },
  { id: 'alzbeta',  name: 'Alžběta Konečná',    short: 'Bětka',   nick: '#Kondomka',             jamu: 'World traveller',
    line: 'Somewhere on the planet right now. Nobody is quite sure where, but whenever she turns up, it’s the best surprise of the day. Lives happily in her own world.' },
  { id: 'dalibor',  name: 'Dalibor Chvátal',    short: 'Dalibor', nick: '',                      jamu: 'Adopted from JevTech',
    line: 'Studied JevTech, got adopted by theatre management in 2016 and we’re never letting him go. Still waiting for a nickname.' },
  { id: 'jakub',    name: 'Jakub Julina',       short: 'Jakub',   nick: '#HonzaPeniz',           jamu: 'The law guy',
    line: 'Law was his domain at JAMU. Reads the small print so the rest of us don’t have to. Also built this website.' },
  { id: 'julia',    name: 'Júlia Pecková',      short: 'Júlia',   nick: '#VedouciZajezdu',       jamu: 'Head of SETKÁNÍ/ENCOUNTER 2019',
    line: 'Led the 29th SETKÁNÍ/ENCOUNTER and all of us with it. Still the one who brings us together. In autumn 2026 she took the crown by letter, without even coming. Her nickname finally lives up to its name.' },
  { id: 'ladislav', name: 'Ladislav Horák',     short: 'Laďa',    nick: '#PPLko',                jamu: 'Everyone’s favourite',
    line: 'Friends with literally everyone. Every teacher, every porter, every person at JAMU knew and liked him. Still true.',
    honour: { text: 'The only one of us who ever uploaded his photos to our shared Drive (April 2019). Ten folders were made. One was filled.', url: 'https://drive.google.com/drive/folders/1c79k_JB5kQl7SwibHjRRfqT3H4QcwUi3', link: 'His folder' } },
  { id: 'michaela', name: 'Michaela Zemčíková', short: 'Míša',    nick: '#AlkoHolka',            jamu: 'Head of Off-program 2019',
    line: 'Former queen of every party. Now one of the gang’s first mums, and a brilliant one. We are all very proud of her.',
    links: [{ title: 'Her thesis: Head of Off-program, ENCOUNTER 2019', url: 'https://theses.cz/id/29ozgh?lang=en' }] },
  { id: 'nikol',    name: 'Nikol Vrbová',       short: 'Nikol',   nick: '#ŽádnýSexAUžAniNásilí', jamu: 'Perfectionist-in-chief',
    line: 'Every file ready, every deadline met, every document perfect. Arriving at the cottage is the one deadline she never makes.' },
  { id: 'sylvie',   name: 'Sylvie Vojtová',     short: 'Sylvie',  nick: '#NegativniSylvinka',    jamu: 'Head of Jury & Guests 2019',
    line: 'Takes a moment to open up. Then you find out she has the biggest heart of us all and is one of the kindest people on this planet.',
    links: [{ title: 'Her thesis: Head of Jury, Ensembles & Guests, ENCOUNTER 2019', url: 'https://theses.cz/id/d0w4t7?lang=en' }] },
  { id: 'viktoria', name: 'Viktória Kállayová', short: 'Viki',    nick: '#PrdniSiDoSacku',       jamu: 'Hyperactive · Slovak delegation',
    line: 'Hyperactive, Slovak and impossible to keep up with. Has already done three things while you read this.',
    links: [{ title: 'Her thesis: JAMŮví, the pilot year of a festival of JAMU audiovisual studios', url: 'https://theses.cz/id/uuftxy?lang=en' }] }
];

// The one who is no longer with us. (She is fine.)
window.JAMU_GHOST = { name: 'Iva Černá', short: 'Iva' };

// Who reigns when the database is brand new. Changed later by the crowning ceremony.
window.JAMU_DEFAULT_COURT = { ruler: 'julia', heir: '' };
// Autumn 2026: Júlia skipped Laďa's trip but took over the crown by letter. The gang agreed.

// Everyone who has worn the crown before this website existed (since the first trip, Dyje on boats, 2020).
// Each of them owes the archive the page of the trip(s) they organised. Júlia and Dalibor haven't reigned yet.
window.JAMU_PAST_RULERS = ['jakub', 'adam', 'alzbeta', 'ladislav', 'michaela', 'nikol', 'sylvie', 'viktoria'];
