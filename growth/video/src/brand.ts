// DESIGN.md tokens and the app's player swatches (tv-app Constants.kt).
export const C = {
  bg: '#120A1F',
  bgDeep: '#0B0614',
  surface: '#1E1430',
  elevated: '#2A1D42',
  outline: '#4A3A66',
  text: '#FFF7EC',
  text2: '#CFC3E0',
  muted: '#9A8CB3',
  primary: '#FF3D8B',
  accent: '#FFC23D',
  ink: '#120A1F',
  success: '#3DDC97',
  danger: '#FF5A4E',
};

export type Shape = 'circle' | 'square' | 'star' | 'triangle' | 'diamond' | 'hexagon';

export type Player = {name: string; color: string; shape: Shape; cream: boolean; word: string; clue: string};

// Sami (index 5) is the Mole: Pizza / Pasta is pair p019 of the English food pack.
export const PLAYERS: Player[] = [
  {name: 'Maya', color: '#F0183A', shape: 'circle', cream: false, word: 'PIZZA', clue: 'Cheese'},
  {name: 'Karim', color: '#478CFF', shape: 'square', cream: false, word: 'PIZZA', clue: 'Slice'},
  {name: 'Lea', color: '#FFF04D', shape: 'star', cream: false, word: 'PIZZA', clue: 'Oven'},
  {name: 'Joe', color: '#1FA88A', shape: 'triangle', cream: false, word: 'PIZZA', clue: 'Delivery'},
  {name: 'Nour', color: '#7A43FF', shape: 'diamond', cream: true, word: 'PIZZA', clue: 'Crust'},
  {name: 'Sami', color: '#FF7A1F', shape: 'hexagon', cream: false, word: 'PASTA', clue: 'Boiled?'},
];
export const MOLE = 5;
export const ROOM_CODE = 'JQPU';
