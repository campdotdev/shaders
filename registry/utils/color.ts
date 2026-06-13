export const parseHex = (hex: string): [number, number, number] => {
  const cleanedHex = hex.replace('#', '');

  return [
    parseInt(cleanedHex.slice(0, 2), 16) / 255,
    parseInt(cleanedHex.slice(2, 4), 16) / 255,
    parseInt(cleanedHex.slice(4, 6), 16) / 255,
  ];
};
