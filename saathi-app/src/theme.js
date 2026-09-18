// Design Foundation sampled from Stitch Design System ("Botanical Sanity")

export const colors = {
  // Primary dark green
  primary: '#0F3E17',
  forestInk: '#0F3E17',
  forestInkSub: '#264D2C',
  forestSubtle: '#455E49',

  // Light green & botanical surfaces
  panelKeylime: '#E1F4DF',
  keylimeWash: '#E1F4DF',
  panelMint: '#CFE7D3',
  mintVeil: '#CFE7D3',
  panelSage: '#B1DBB8',
  sageMist: '#B1DBB8',

  // Canvas / card background
  background: '#FFFEFC',
  paperCream: '#FFFEFC',
  cream: '#FFFEFC',
  cardBackground: '#FFFEFC',
  surfaceContainerLow: '#F4F3F1',
  white: '#FFFFFF',

  // Text colors
  text: '#1A1C1B',
  onSurface: '#1A1C1B',
  charcoal: '#222222',

  // Muted text
  mutedText: '#424940',
  onSurfaceVariant: '#424940',
  textSubtle: '#455E49',

  // Accent & Caution (Slate counter-panel)
  accent: '#B6CED5',
  panelSlate: '#B6CED5',
  slateHush: '#B6CED5',
  slateText: '#1E3840',

  // Borders & Dividers
  border: '#EFEEEB',
  borderMist: '#EFEEEB',
  hairlineMist: '#E5E3DC',
  keylimeBorder: '#D0ECCB',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  cardPadding: 20,
  screenPadding: 16,
};

export const radius = {
  sm: 6,
  md: 10,
  card: 14,
  button: 14,
  pill: 999,
  badge: 999,
  full: 9999,
};

export const typography = {
  display: {
    fontFamily: 'Playfair Display',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 44,
  },
  headlineLg: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  headlineMd: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  headlineSm: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  bodyLg: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  bodyMd: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  bodySm: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  labelLg: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  labelMd: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  labelSm: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
  },
};

export const theme = {
  colors,
  spacing,
  radius,
  typography,
};

export default theme;
