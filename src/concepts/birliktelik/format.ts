import { sepetData, type Item, type Itemset } from './data';

const ORDER = sepetData.items;

/** Position in product order (unknown items go last). */
export function itemRank(item: Item): number {
  const r = ORDER.indexOf(item);
  return r < 0 ? ORDER.length : r;
}

/** Sort items into product order (unknown items last, alphabetically). */
export function sortItems(items: readonly Item[]): Item[] {
  return [...items].sort((a, b) => itemRank(a) - itemRank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Stable map key / text key: ids in product order joined by ",". */
export function setKey(set: Itemset): string {
  return sortItems(set).join(',');
}

export function keyToSet(key: string): Itemset {
  return key === '' ? [] : key.split(',');
}

export function itemName(item: Item): string {
  return sepetData.names[item] ?? item;
}

export function itemAbbr(item: Item): string {
  return sepetData.abbr[item] ?? item;
}

/** "Ekmek, Süt". */
export function setNames(set: Itemset): string {
  return sortItems(set).map(itemName).join(', ');
}

/** "ES": abbreviations back to back, as in the lattice. */
export function setAbbr(set: Itemset): string {
  return sortItems(set).map(itemAbbr).join('');
}

/** "{Ekmek, Süt}". */
export function setBraces(set: Itemset): string {
  return `{${setNames(set)}}`;
}
