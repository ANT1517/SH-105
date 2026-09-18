// Meera's Fixture Data for Saathi App

export const MEERA_FIXTURE = {
  user: {
    name: 'Meera',
  },
  pots: {
    cash: 2000,
    bank: 5000,
    shg: 2500,
    chit_committed: 4000,
    post_office: 5000,
  },
  potsList: [
    {
      id: 'bank',
      name: 'Bank',
      subLabel: 'Bank Savings',
      amount: '₹5,000',
      amountNum: 5000,
      status: 'Ready to use',
      icon: 'account-balance',
      color: '#0F3E17',
    },
    {
      id: 'cash',
      name: 'Cash',
      subLabel: 'At home or bag',
      amount: '₹2,000',
      amountNum: 2000,
      status: 'In hand',
      icon: 'payments',
      color: '#0F3E17',
    },
    {
      id: 'shg',
      name: 'SHG Bachat',
      subLabel: 'Monthly meeting',
      amount: '₹2,500',
      amountNum: 2500,
      status: 'Growing',
      icon: 'groups',
      color: '#0F3E17',
    },
    {
      id: 'post_office',
      name: 'Post Office',
      subLabel: 'Post office savings',
      amount: '₹5,000',
      amountNum: 5000,
      status: 'Steady Growth',
      icon: 'local-post-office',
      color: '#0F3E17',
    },
  ],
  chit: {
    name: 'Chit (Bessoo)',
    amount: '₹4,000',
    amountNum: 4000,
    status: 'Locked until Oct — cannot spend now',
  },
  chatMessages: [
    {
      id: '1',
      sender: 'user',
      type: 'voice',
      duration: '0:04',
      text: 'I earned ₹800 from tailoring today',
      timestamp: '10:14 AM',
    },
    {
      id: '2',
      sender: 'saathi',
      type: 'text',
      text: "Got it! I've added ₹800 to your Business pot from tailoring.",
      timestamp: '10:14 AM',
    },
    {
      id: '3',
      sender: 'user',
      type: 'text',
      text: "Can I save enough for my daughter's education this year?",
      timestamp: '10:15 AM',
    },
    {
      id: '4',
      sender: 'saathi',
      type: 'text',
      text: "You need ₹12,000 more. If you save ₹2,000 every month, you'll reach your goal in 6 months.",
      timestamp: '10:15 AM',
    },
  ],
  ledger: {
    summary: {
      badgeLabel: 'Achaar + Silai • Pickle & Tailoring',
      revenue: '₹1,800',
      revenueNum: 1800,
      cost: '₹0',
      costNum: 0,
      profit: '₹1,800',
      profitNum: 1800,
      reassuranceText: 'Yeh kamai aapke Business pot mein gayi. — This income went into your Business pot.',
      ctaText: 'Turn this into a listing',
    },
    voiceMemo: {
      duration: '0:07',
      hindiText: 'Aaj maine ₹800 ki tailoring ki aur ₹1,000 ke achaar bechey.',
      englishText: 'Today I did ₹800 tailoring and sold ₹1,000 of pickles.',
    },
    recentEntries: [
      {
        id: '1',
        name: 'Pickle sales',
        hindiName: 'Achaar ki bikri',
        date: 'Yesterday evening',
        amount: '+₹1,000',
      },
      {
        id: '2',
        name: 'Tailoring order',
        hindiName: 'Silai ka kaam',
        date: 'Yesterday evening',
        amount: '+₹800',
      },
      {
        id: '3',
        name: 'Mango pickle jars (3)',
        hindiName: 'Aam ke achaar (3 dabbe)',
        date: '2 days ago',
        amount: '+₹350',
      },
    ],
  },
  safetyShield: {
    warningBadge: '⚠️ Please be careful',
    heading: 'This message looks suspicious',
    flaggedLabel: 'Flagged message',
    flaggedSmsText: 'Your KYC will expire. Click here to verify: bit.ly/xyz123',
    explanationText:
      'This message is asking you to click a link urgently. Real banks do not ask you to verify KYC through a text message link. We cannot be 100% sure, but please do not click this link.',
    rulesHeading: '3 Simple Rules for your safety',
    rules: [
      'Do not tap or open the link',
      'Your bank money is safe right now',
      'Never share your 4 or 6 digit OTP',
    ],
    audioButtonText: '🔊 Hear explanation (30 sec)',
    primaryButtonText: 'I understand, ignore it',
    secondaryButtonText: 'Talk to a Sakhi (helper)',
  },
  educationGoal: {
    title: 'Education Goal',
    hindiTitle: 'Padhai ka Lakshya',
    savedAmount: 8000,
    targetAmount: 20000,
    savedText: '₹8,000 saved',
    targetText: '₹20,000 target',
    subtext: 'Beti ki padhai ke liye — For your daughter\'s education',
    monthlyAmount: '₹2,000',
  },
  recentEarnings: {
    heading: 'Aaj ki Kamai — Today\'s Earnings',
    items: [
      { label: 'Pickle', hindiLabel: 'Achaar', amount: '₹1,000', isHighlight: false },
      { label: 'Tailoring', hindiLabel: 'Silai', amount: '₹800', isHighlight: false },
      { label: 'Profit', hindiLabel: 'Munafa', amount: '₹1,800 ↑', isHighlight: true },
    ],
    subtext: 'Asha didi ke saath kal sham ko — Updated yesterday evening with Asha didi',
  },
};

/**
 * Computes the total money across pots:
 * (cash + bank + shg + chit_committed + post_office)
 * @returns {number} 18500
 */
export function getTotal() {
  const { cash = 0, bank = 0, shg = 0, chit_committed = 0, post_office = 0 } = MEERA_FIXTURE.pots;
  return cash + bank + shg + chit_committed + post_office;
}

/**
 * Formatted string of total amount: "₹18,500"
 */
export function getFormattedTotal() {
  return `₹${getTotal().toLocaleString('en-IN')}`;
}

export default MEERA_FIXTURE;
