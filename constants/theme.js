import { COLORS } from './colors';

export const THEME = {
  colors: COLORS,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 999,
  },
  typography: {
    sizes: {
      small: 12,
      body: 16,
      h3: 20,
      h2: 24,
      h1: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      bold: '700',
    }
  },
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    }
  }
};
