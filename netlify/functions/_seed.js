// The 15 real deals that were hardcoded in Ethan's frontend. Used to seed an
// empty database on first run so the live site opens with the real pipeline.
// createdDate is injected at seed time (kept out of here to stay deterministic).
const SEED_DEALS = [
  { id: 1,  name: 'Voozaa',                            capital: 5000000,  status: 'lead', reference: '',      client: '',            fee: 5,  equity: 0, rank: 1,  files: [], notes: '',                probability: 60 },
  { id: 2,  name: 'Walmart Deal',                      capital: 15000000, status: 'lead', reference: '',      client: 'Walmart',     fee: 4,  equity: 0, rank: 2,  files: [], notes: '',                probability: 75 },
  { id: 3,  name: 'BKFC',                              capital: 50000000, status: 'lead', reference: 'Steve', client: '',            fee: 5,  equity: 2, rank: 3,  files: [], notes: '',                probability: 50 },
  { id: 4,  name: 'Colton Elliot - Tampa Real Estate', capital: 60000000, status: 'lead', reference: '',      client: 'Colton Elliot', fee: 5, equity: 2, rank: 4, files: [], notes: '',                probability: 70 },
  { id: 5,  name: 'Meat Factory',                      capital: 25000000, status: 'lead', reference: '',      client: '',            fee: 5,  equity: 2, rank: 5,  files: [], notes: '',                probability: 40 },
  { id: 6,  name: 'Lake Havasu Energy',                capital: 900000,   status: 'lead', reference: 'Corey', client: '',            fee: 4,  equity: 0, rank: 6,  files: [], notes: '',                probability: 55 },
  { id: 7,  name: 'Kelly Walker - Political Campaign', capital: 70000,    status: 'lead', reference: 'Corey', client: 'Kelly Walker', fee: 15, equity: 0, rank: 7,  files: [], notes: '',                probability: 100 },
  { id: 8,  name: 'James SAFE Deal',                   capital: 2000000,  status: 'lead', reference: 'Corey', client: 'James',       fee: 3,  equity: 0, rank: 8,  files: [], notes: '',                probability: 65 },
  { id: 9,  name: 'Satellite Company',                 capital: 50000000, status: 'lead', reference: 'Corey', client: '',            fee: 5,  equity: 1, rank: 9,  files: [], notes: '',                probability: 35 },
  { id: 10, name: 'Pyrolysis Systems',                 capital: 50000000, status: 'lead', reference: 'Corey', client: '',            fee: 5,  equity: 2, rank: 10, files: [], notes: '',                probability: 80 },
  { id: 11, name: 'Trade Desk Fund',                   capital: 75000000, status: 'lead', reference: 'Corey', client: '',            fee: 4,  equity: 0, rank: 11, files: [], notes: '',                probability: 45 },
  { id: 12, name: 'David',                             capital: 40000000, status: 'lead', reference: '',      client: 'David',       fee: 5,  equity: 0, rank: 12, files: [], notes: 'Wants $40M raised.', probability: 50 },
  { id: 14, name: 'International Bridge Loan',          capital: 200000,   status: 'lead', reference: 'Corey', client: '',            fee: 7,  equity: 0, rank: 14, files: [], notes: '',                probability: 50 },
  { id: 15, name: 'Gold Deals (Multiple)',             capital: 0,        status: 'lead', reference: 'Corey', client: '',            fee: 5,  equity: 0, rank: 15, files: [], notes: '',                probability: 20 },
  { id: 16, name: 'Oil Deals (Multiple)',              capital: 0,        status: 'lead', reference: 'Corey', client: '',            fee: 4,  equity: 0, rank: 16, files: [], notes: '',                probability: 25 }
];

module.exports = { SEED_DEALS };
