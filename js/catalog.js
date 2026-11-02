export const EXPENSE_CATEGORIES = [
  { id: 'moradia', name: 'Moradia' },
  { id: 'mercado', name: 'Mercado' },
  { id: 'alimentacao', name: 'Restaurantes e delivery' },
  { id: 'transporte', name: 'Transporte' },
  { id: 'contas', name: 'Contas e serviços' },
  { id: 'assinaturas', name: 'Assinaturas' },
  { id: 'saude', name: 'Saúde' },
  { id: 'educacao', name: 'Educação' },
  { id: 'lazer', name: 'Lazer' },
  { id: 'compras', name: 'Compras' },
  { id: 'viagem', name: 'Viagem' },
  { id: 'pets', name: 'Pets' },
  { id: 'impostos', name: 'Impostos e taxas' },
  { id: 'investimento', name: 'Investimentos / reserva' },
  { id: 'outros', name: 'Outros' },
];

export const INCOME_CATEGORIES = [
  { id: 'salario', name: 'Salário' },
  { id: 'freelance', name: 'Freelance / extra' },
  { id: 'rendimentos', name: 'Rendimentos' },
  { id: 'reembolso', name: 'Reembolso' },
  { id: 'presente', name: 'Presente' },
  { id: 'venda', name: 'Venda' },
  { id: 'outros-in', name: 'Outros' },
];

export const METHODS = {
  pix: 'Pix',
  debito: 'Débito',
  cartao: 'Cartão de crédito',
  dinheiro: 'Dinheiro',
  boleto: 'Boleto',
  ted: 'Transferência',
  deposito: 'Depósito em conta',
};
export const EXPENSE_METHODS = ['pix', 'debito', 'cartao', 'boleto', 'dinheiro', 'ted'];
export const INCOME_METHODS = ['deposito', 'pix', 'ted', 'dinheiro'];

const ALL_CATS = new Map([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.id, c.name]));
export const categoryName = (id) => ALL_CATS.get(id) || 'Outros';
export const methodName = (id) => METHODS[id] || '—';

export const CARD_BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'];
export const CARD_COLORS = [
  { id: 'graphite', a: '#2b2b2b', b: '#0d0d0d' },
  { id: 'violet', a: '#7b5cf0', b: '#3d2a9e' },
  { id: 'blue', a: '#3b82f6', b: '#1d3fa8' },
  { id: 'teal', a: '#14a37f', b: '#0b5c49' },
  { id: 'wine', a: '#b4234f', b: '#5e0f28' },
  { id: 'orange', a: '#f07b3f', b: '#b0401a' },
  { id: 'gold', a: '#c9a24f', b: '#7a5c22' },
  { id: 'silver', a: '#a7adb5', b: '#5d636b' },
];
export const cardGradient = (colorId) => {
  const c = CARD_COLORS.find((x) => x.id === colorId) || CARD_COLORS[0];
  return `linear-gradient(135deg, ${c.a}, ${c.b})`;
};
export const MILES_PROGRAMS = ['Livelo', 'Esfera', 'Smiles', 'LATAM Pass', 'TudoAzul', 'Átomos', 'Membership Rewards', 'Iupp', 'Outro'];
