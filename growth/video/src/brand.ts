// DESIGN.md tokens and the app's player swatches (tv-app Constants.kt).
// v2 "Evolved Current" marketing palette (growth/marketing/review-v2/DECISIONS.md): the app's night-violet world,
// lit like a party (avg luma 45–60 instead of 21–37). The TV app keeps DESIGN.md's darker tokens for now.
export const C = {
  bg: '#2B1650',
  bgDeep: '#1D1036',
  surface: '#3A2266',
  elevated: '#4A2E7A',
  outline: '#6B54A0',
  text: '#FFF7EC',
  text2: '#E2D6F5',
  muted: '#B8A8D6',
  primary: '#FF4F9A',
  accent: '#FFC94D',
  ink: '#1A0B2E',
  success: '#3DDC97',
  danger: '#FF5A4E',
};

export type Shape = 'circle' | 'square' | 'star' | 'triangle' | 'diamond' | 'hexagon';

export type Player = {name: string; color: string; shape: Shape; cream: boolean; word: string; clue: string};

// Sami (index 5) is the Mole: Pizza / Pasta is pair p019 of the English food pack.
export const PLAYERS: Player[] = [
  {name: 'Maya', color: '#FF3355', shape: 'circle', cream: false, word: 'PIZZA', clue: 'Cheese'},
  {name: 'Karim', color: '#5A9BFF', shape: 'square', cream: false, word: 'PIZZA', clue: 'Slice'},
  {name: 'Lea', color: '#FFF04D', shape: 'star', cream: false, word: 'PIZZA', clue: 'Oven'},
  {name: 'Joe', color: '#2BC49F', shape: 'triangle', cream: false, word: 'PIZZA', clue: 'Delivery'},
  {name: 'Nour', color: '#9A6BFF', shape: 'diamond', cream: true, word: 'PIZZA', clue: 'Crust'},
  {name: 'Sami', color: '#4FE3D2', shape: 'hexagon', cream: false, word: 'PASTA', clue: 'Boiled?'},
];
export const MOLE = 5;
export const ROOM_CODE = 'JQPU';
