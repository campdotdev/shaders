export const parseHex = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '');

  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
};
