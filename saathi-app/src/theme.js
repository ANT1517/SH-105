// Design Foundation sampled from Stitch Design System ("Botanical Sanity")

export const colors = {
  // Primary dark green
  primary: '#0F3E17',
  forestInk: '#0F3E17',
  forestInkSub: '#1B4D24',
  forestSubtle: '#3A5C3F',

  // Light green & botanical surfaces
  panelKeylime: '#E1F4DF',
  keylimeWash: '#EBF7EA',
  panelMint: '#CFE7D3',
  mintVeil: '#D8EDE0',
  panelSage: '#B1DBB8',
  sageMist: '#BDE0C3',

  // Canvas / card background
  background: '#FFFEFC',
  paperCream: '#FFFEFC',
  cream: '#FFFEFC',
  cardBackground: '#FFFFFF',
  surfaceContainerLow: '#F8F7F4',
  surfaceContainer: '#F2F0EC',
  white: '#FFFFFF',

  // Text colors
  text: '#191C1A',
  onSurface: '#191C1A',
  charcoal: '#212522',

  // Muted text
  mutedText: '#4A544C',
  onSurfaceVariant: '#4A544C',
  textSubtle: '#5C675F',
  textTertiary: '#7D8880',

  // Accent & Caution (Slate counter-panel)
  accent: '#B6CED5',
  panelSlate: '#B6CED5',
  slateHush: '#C7DAE0',
  slateText: '#1A333B',

  // Functional feedback
  errorBg: '#FDE8E8',
  errorBorder: '#F8B4B4',
  errorText: '#9B1C1C',
  warningBg: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',
  successBg: '#DEF7EC',
  successBorder: '#BCF0DA',
  successText: '#03543F',

  // Borders & Dividers
  border: '#E8E6E0',
  borderMist: '#E8E6E0',
  hairlineMist: '#E0DDD5',
  keylimeBorder: '#C8EDCA',
  sageBorder: '#9AC9A2',
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  cardPadding: 18,
  screenPadding: 16,
};

export const radius = {
  xs: 4,
  sm: 6,
  md: 10,
  card: 16,
  button: 12,
  input: 10,
  pill: 999,
  badge: 999,
  full: 9999,
};

export const shadows = {
  subtle: {
    shadowColor: '#0F3E17',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F3E17',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  modal: {
    shadowColor: '#0F3E17',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

export const typography = {
  heroAmount: {
    fontSize: 34,
    fontWeight: '700',
    lineHeight: 40,
    color: colors.forestInk,
    letterSpacing: -0.5,
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.forestInk,
    letterSpacing: -0.3,
  },
  amountSm: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    color: colors.forestInk,
  },
  display: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: colors.forestInk,
  },
  headlineLg: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.forestInk,
    letterSpacing: 0.2,
  },
  headlineMd: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    color: colors.forestInk,
  },
  headlineSm: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: colors.forestInk,
  },
  bodyLg: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    color: colors.charcoal,
  },
  bodyMd: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.charcoal,
  },
  bodySm: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    color: colors.mutedText,
  },
  labelLg: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: colors.forestInk,
  },
  labelMd: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: colors.forestInk,
  },
  labelSm: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.forestInk,
  },
};

export const theme = {
  colors,
  spacing,
  radius,
  shadows,
  typography,
};

export default theme;
